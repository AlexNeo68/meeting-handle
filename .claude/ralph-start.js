#!/usr/bin/env node
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const configPath = process.env.RALPH_CONFIG || path.join(ROOT, '.claude', 'ralph.config.json');
const counterPath = path.join(ROOT, '.claude', 'ralph.iterations.json');
const logPath = path.join(ROOT, '.claude', 'ralph-loop.log');

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const DRY = process.env.RALPH_DRY_RUN === '1';
const noopGh = DRY || process.env.RALPH_NOOP_GH === '1';
const agentBudget = Number(process.env.RALPH_AGENT_BUDGET || config.maxIterations) || 100;
const maxFixAttempts = Number(config.maxFixAttempts) || 5;
const agentTimeoutMs = Number(process.env.RALPH_AGENT_TIMEOUT_MS) || 30 * 60 * 1000;
const agentCmdTokens = (process.env.RALPH_AGENT_CMD || 'opencode run --auto --agent build')
  .trim()
  .split(/\s+/);

const phases =
  config.phases && config.phases.length
    ? config.phases
    : [{ milestone: config.milestone, branch: config.branch }];

let state = { phaseIndex: 0, count: 0, startedAt: new Date().toISOString() };

// ---------- helpers ----------

function saveState() {
  fs.writeFileSync(counterPath, JSON.stringify(state));
}

function log(...args) {
  const line = args.join(' ');
  console.log(line);
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${line}\n`);
}

function truncate(s, n = 160) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function run(cmd) {
  const res = spawnSync(cmd, { cwd: ROOT, shell: true, stdio: 'inherit' });
  return res.status === 0;
}

function runCapture(cmd) {
  const res = spawnSync(cmd, {
    cwd: ROOT,
    shell: true,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { ok: res.status === 0, out: (res.stdout || '').trim(), err: (res.stderr || '').trim() };
}

function sleepSync(ms) {
  spawnSync('sleep', [String(Math.max(1, Math.round(ms / 1000)))], { stdio: 'ignore' });
}

// Транзиентные сетевые сбои GitHub GraphQL (EOF, reset, 5xx) не должны ронять цикл.
function runCaptureRetry(cmd, attempts = 4, delayMs = 2000) {
  for (let i = 1; i <= attempts; i++) {
    const res = runCapture(cmd);
    if (res.ok) return res;
    if (i < attempts) log(`   [retry ${i}/${attempts}] ${cmd} → ${res.err || 'failed'}`);
    if (i < attempts) sleepSync(delayMs);
  }
  return runCapture(cmd);
}

// ---------- agent session (async, timeout + process-group kill) ----------
// Exit code агента НИКОГДА не прерывает цикл: после сессии всегда идёт гейт.

function runAgentAsync(prompt, label) {
  if (state.count >= agentBudget) {
    log(`⛔ Бюджет агентских сессий исчерпан (${agentBudget}).`);
    return Promise.resolve({ ok: false, reason: 'budget' });
  }
  state.count++;
  saveState();
  if (DRY) {
    log(
      `   [dry-run] сессия #${state.count}/${agentBudget} [${label}]: ${agentCmdTokens.join(' ')} "${truncate(prompt)}"`,
    );
    return Promise.resolve({ ok: true, timedOut: false });
  }
  log(`🤖 Сессия агента #${state.count}/${agentBudget} [${label}]...`);
  const args = [...agentCmdTokens, prompt];
  return new Promise((resolve) => {
    const child = spawn(args[0], args.slice(1), { cwd: ROOT, stdio: 'inherit', detached: true });
    let timedOut = false;
    let killTimer = null;
    const timer = setTimeout(() => {
      timedOut = true;
      log(`⏱️ Таймаут сессии (${Math.round(agentTimeoutMs / 60000)} мин). Завершаю процесс...`);
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {}
      killTimer = setTimeout(() => {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {}
      }, 5000);
      killTimer.unref();
    }, agentTimeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      log(`⚠️ Не удалось запустить агента: ${err.message}`);
      resolve({ ok: false, timedOut: false, error: err.message });
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      if (timedOut) resolve({ ok: false, timedOut: true, code, signal });
      else resolve({ ok: code === 0, code, signal });
    });
  });
}

// ---------- config: gates ----------

function phaseTests(phase) {
  if (process.env.RALPH_TESTS)
    return process.env.RALPH_TESTS.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  if (Array.isArray(phase.tests) && phase.tests.length) return phase.tests;
  if (Array.isArray(config.tests) && config.tests.length) return config.tests;
  return ['npm run test'];
}

function extraGates(phase) {
  if (process.env.RALPH_GATES)
    return process.env.RALPH_GATES.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  if (Array.isArray(phase.gates) && phase.gates.length) return phase.gates;
  if (Array.isArray(config.gates) && config.gates.length) return config.gates;
  return ['npm run lint'];
}

function phaseGates(phase) {
  return [...phaseTests(phase), ...extraGates(phase)];
}

function runGates(phase) {
  const cmds = phaseGates(phase);
  log(`🧪 Гейт: ${cmds.join(' && ')}`);
  if (DRY) {
    log('   [dry-run] гейт пропущен (считаем зелёным)');
    return { ok: true, failed: [] };
  }
  const failed = [];
  for (const cmd of cmds) {
    if (!run(cmd)) failed.push(cmd);
  }
  if (failed.length) {
    log(`🔴 Красный гейт: ${failed.join(', ')}`);
    return { ok: false, failed };
  }
  log('🟢 Гейт зелёный.');
  return { ok: true, failed: [] };
}

// ---------- GitHub helpers ----------

function openIssues(phase) {
  const res = runCaptureRetry(
    `gh issue list --milestone "${phase.milestone}" --state open --json number,title`,
  );
  if (!res.ok) {
    log(`⚠️ Не удалось получить issues из milestone "${phase.milestone}": ${res.err}`);
    return null;
  }
  try {
    const issues = JSON.parse(res.out);
    // По возрастанию номера = порядок зависимостей (T1 → T8), а не «новые сверху».
    issues.sort((a, b) => a.number - b.number);
    return issues;
  } catch {
    log(`⚠️ Некорректный ответ gh issue list: ${res.out}`);
    return null;
  }
}

function issueState(number) {
  const res = runCaptureRetry(`gh issue view ${number} --json state`, 3, 1500);
  if (!res.ok) return null;
  try {
    return JSON.parse(res.out).state;
  } catch {
    return null;
  }
}

function closeIssue(number) {
  log(`ℹ️ Закрываю Issue #${number}`);
  if (noopGh) {
    log('   [noop] gh issue close');
    return true;
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    const closed =
      runCaptureRetry(`gh issue close ${number}`, 2, 1500).ok && issueState(number) === 'CLOSED';
    if (closed) return true;
    if (attempt < 3) {
      log(`   Повторная попытка закрытия (${attempt}/3)...`);
      sleepSync(1500);
    }
  }
  log(`⚠️ Не удалось закрыть Issue #${number}.`);
  return false;
}

function commentIssue(number, body) {
  if (noopGh) {
    log(`💬 [noop] комментарий в Issue #${number}`);
    return true;
  }
  const tmp = path.join(ROOT, '.claude', `.ralph-comment-${number}.md`);
  fs.writeFileSync(tmp, body);
  const ok = runCaptureRetry(`gh issue comment ${number} --body-file "${tmp}"`, 3, 1500).ok;
  fs.unlinkSync(tmp);
  return ok;
}

// ---------- git / branch ----------

function currentBranch() {
  return runCapture('git branch --show-current').out.trim();
}

function workingTreeDirty() {
  return runCapture('git status --porcelain').out.trim().length > 0;
}

// Прерванная/упавшая сессия может оставить незакоммиченные правки — сбрасываем,
// чтобы следующая сессия стартовала с чистого коммиченного состояния.
function ensureCleanTree() {
  if (DRY) return;
  if (!workingTreeDirty()) return;
  log('   🧹 Незакоммиченные правки прерванной сессии — сбрасываю к HEAD.');
  run('git reset --hard --quiet');
  run('git clean -fd --quiet');
}

function ensureBranch(branch, baseRef) {
  if (DRY) {
    log(`   [dry-run] ветка: ${branch} (база: ${baseRef})`);
    return { ok: true };
  }
  if (currentBranch() === branch) return { ok: true };
  if (workingTreeDirty()) {
    log(
      `⚠️ Рабочее дерево грязное, а нужно переключиться на '${branch}'. Закоммить или засташь изменения.`,
    );
    return { ok: false, error: 'dirty' };
  }
  if (!runCapture(`git rev-parse --verify --quiet "${branch}"`).ok) {
    log(`   Создаю ветку '${branch}' из '${baseRef}'...`);
    if (run(`git checkout -b "${branch}" "${baseRef}"`)) return { ok: true };
    return { ok: false, error: 'branch create' };
  }
  if (run(`git checkout "${branch}"`)) return { ok: true };
  return { ok: false, error: 'branch checkout' };
}

// Issue уже упомянута в коммитах ветки («closes #N», «#N» и т.п.).
function issueImplementedInBranch(branch, number) {
  if (DRY) return false;
  const res = runCapture(`git log --format=%s -200 "${branch}" | grep -iE "#${number}([^0-9]|$)"`);
  return res.ok;
}

// ---------- PR / review ----------

function findOpenPr(branch) {
  const res = runCaptureRetry(
    `gh pr list --head "${branch}" --state open --json number,url`,
    3,
    1500,
  );
  if (!res.ok) return null;
  try {
    const prs = JSON.parse(res.out);
    return prs[0] || null;
  } catch {
    return null;
  }
}

function createPr(phase) {
  log(`📌 Проверяю PR из ${phase.branch} в main (milestone: ${phase.milestone})`);
  if (noopGh) {
    log('   [noop] gh pr create');
    return true;
  }
  // Пушим ветку всегда: gh pr create требует head-реф на remote, а при
  // переиспользовании существующего PR это же обновляет его head новыми коммитами.
  if (!run(`git push -u origin "${phase.branch}"`)) {
    log(`   ⚠️ Не удалось запушить ветку '${phase.branch}' — PR не создан/не обновлён.`);
    return false;
  }
  const existing = findOpenPr(phase.branch);
  if (existing) {
    log(`   PR уже существует: #${existing.number} — переиспользую.`);
    return true;
  }
  const closedRes = runCapture(
    `gh issue list --milestone "${phase.milestone}" --state closed --json number,title`,
  );
  let issuesBody = '';
  if (closedRes.ok) {
    try {
      issuesBody = JSON.parse(closedRes.out)
        .map((i) => `- Closes #${i.number} — ${i.title}`)
        .join('\n');
    } catch {}
  }
  const tmp = path.join(
    ROOT,
    '.claude',
    `.ralph-pr-${phase.branch.replace(/[^a-z0-9-]/gi, '_')}.md`,
  );
  fs.writeFileSync(
    tmp,
    `Ralph loop: ${phase.milestone}\n\n${issuesBody}\n\n🤖 Generated with Claude Code`,
  );
  const ok = run(
    `gh pr create --base main --head "${phase.branch}" --title "feat: ${phase.milestone}" --body-file "${tmp}"`,
  );
  fs.unlinkSync(tmp);
  return ok;
}

// ---------- prompts ----------

function buildImplementPrompt(phase, number) {
  const preamble = (config.prompt || '')
    .replace(/\{milestone\}/g, phase.milestone)
    .replace(/\{branch\}/g, phase.branch)
    .trim();
  return `${preamble}

Реализуй открытую Issue #${number} из milestone '${phase.milestone}' в ветке '${phase.branch}'.

Порядок действий:
1. Прочитай Issue: gh issue view ${number} (title, body, критерии готовности, блокирующие зависимости). Если в Issue есть ссылки на PRD (docs/prd/*.md) — прочитай их.
2. Если задача УЖЕ реализована в ветке и работает — проверь это и просто закрой Issue: gh issue close ${number}. НЕ вноси лишних изменений.
3. Иначе работай по TDD: сначала напиши/обнови тесты, потом реализацию.
4. После каждого шага запускай гейт: ${phaseGates(phase).join(' && ')}.
5. Если менялся UI — прогони UI/UX проверки из CLAUDE.md (контраст ≥4.5:1, интерактивные элементы ≥44×44px, alt/aria-label, keyboard nav, без horizontal scroll, анимации 150–300ms, respects prefers-reduced-motion).
6. Коммить ИНКРЕМЕНТАЛЬНО: после каждого логически завершённого шага делай коммит (даже промежуточный) по conventional commits, в subject обязательно указывай 'closes #${number}'. Сессия может быть оборвана таймаутом — не теряй сделанную работу, фиксируй её коммитами по ходу.
7. НЕ создавай PR — его создаст ralph-start.js после завершения фазы.
8. Когда гейт зелёный и критерии готовности выполнены — закрой Issue: gh issue close ${number}.`;
}

function buildFixPrompt(phase, number, failedCmds) {
  return `Прочитай .claude/ralph.md. Гейт сейчас красный для Issue #${number} (milestone '${phase.milestone}', ветка '${phase.branch}').

Проваленные команды: ${failedCmds.join(' && ')}.

Запусти их, найди причину падения и исправь — код и/или тесты — до тех пор, пока ВСЕ они не станут зелёными. Не отключай и не удаляй тесты. Коммить исправления по conventional commits, в subject указывай 'closes #${number}'. Когда гейт зелёный и требования Issue выполнены — закрой Issue: gh issue close ${number}.`;
}

function buildReviewPrompt(phase) {
  return `Прочитай .claude/ralph.md. Найди последний открытый PR из ветки '${phase.branch}' (gh pr list --head '${phase.branch}') и проведи детальное code review: архитектура, безопасность, производительность, соответствие PRD (docs/prd/*.md) и критериям готовности issues из milestone '${phase.milestone}'. Оставь комментарии через gh pr review / gh pr comment. Блокирующие замечания указывай чётко; если всё хорошо — напиши об этом в PR.

ВАЖНО: если 'gh pr review --request-changes' падает с ошибкой «Can not request changes on your own pull request» (PR создан тем же аккаунтом), НЕ бросай задачу — оставь замечания через 'gh pr comment' или 'gh pr review --comment' (комментарий с вердиктом в начале).`;
}

// ---------- phase ----------

async function processPhase(phase, phaseIndex) {
  log(
    `\n📦 Фаза ${phaseIndex + 1}/${phases.length}: "${phase.milestone}" (branch: ${phase.branch})`,
  );

  // Фаза 1 ответвляется от main; следующие фазы — от ветки предыдущей (stacked PRs),
  // т.к. их задачи строятся на коде предыдущей фазы.
  const baseRef = phaseIndex === 0 ? 'origin/main' : phases[phaseIndex - 1].branch;
  const branchOk = ensureBranch(phase.branch, baseRef);
  if (!branchOk.ok) return { ok: false, error: branchOk.error || 'branch' };

  const processed = new Set();
  let closedCount = 0;
  let failedCount = 0;

  while (true) {
    const issues = openIssues(phase);
    if (issues === null) return { ok: false, error: 'gh issues' };
    if (issues.length === 0) {
      log(`✅ В milestone "${phase.milestone}" не осталось открытых issues.`);
      break;
    }
    const next = issues.find((i) => !processed.has(i.number));
    if (!next) {
      log(
        `⚠️ Открытые issues не обработаны в этом прогоне: ${issues.map((i) => `#${i.number}`).join(', ')}. Будут повторены при следующем запуске.`,
      );
      break;
    }
    processed.add(next.number);
    log(`\n🎯 Issue #${next.number}: ${next.title} (осталось открытых: ${issues.length})`);

    // Pre-flight: задача уже реализована в ветке → проверяем гейт и закрываем без сеанса агента.
    if (issueImplementedInBranch(phase.branch, next.number)) {
      const g = runGates(phase);
      if (g.ok) {
        log(
          `   Issue #${next.number} уже в коммитах ветки и гейт зелёный — закрываю без сеанса агента.`,
        );
        if (closeIssue(next.number)) closedCount++;
        continue;
      }
    }

    // Закрывать issue можно только если агент реально что-то сделал: появился коммит
    // (HEAD продвинулся) ИЛИ хотя бы одна сессия завершилась чисто (exit 0). Иначе
    // упавшая сессия (сеть/SSL) может дать «зелёный гейт» без изменений — не закрываем.
    const headBefore = runCapture('git rev-parse HEAD').out.trim();
    let didWork = false;
    const markWork = (res) => {
      if (res && res.ok && !res.reason) didWork = true;
      if (runCapture('git rev-parse HEAD').out.trim() !== headBefore) didWork = true;
    };

    ensureCleanTree();
    const implRes = await runAgentAsync(
      buildImplementPrompt(phase, next.number),
      `impl #${next.number}`,
    );
    if (implRes.reason === 'budget') return { ok: false, error: 'budget' };
    markWork(implRes);

    let gate = runGates(phase);
    let fixAttempts = 0;
    while (!gate.ok && fixAttempts < maxFixAttempts) {
      fixAttempts++;
      log(
        `🔴 Гейт красный (попытка фикса ${fixAttempts}/${maxFixAttempts}). Запускаю сессию починки...`,
      );
      const r = await runAgentAsync(
        buildFixPrompt(phase, next.number, gate.failed),
        `fix #${next.number} (${fixAttempts})`,
      );
      if (r.reason === 'budget') return { ok: false, error: 'budget' };
      markWork(r);
      gate = runGates(phase);
    }

    if (gate.ok) {
      if (didWork) {
        if (closeIssue(next.number)) closedCount++;
      } else {
        failedCount++;
        log(
          `⚠️ Issue #${next.number}: гейт зелёный, но агент не внёс изменений (нет коммита, сессии завершились с ошибкой). Issue остаётся открытой.`,
        );
        commentIssue(
          next.number,
          `Гейт зелёный, но агентская сессия не создала коммитов и завершилась с ошибкой. Изменения не обнаружены — issue остаётся открытой для повторного прогона.`,
        );
      }
    } else {
      failedCount++;
      log(`⛔ Issue #${next.number}: гейт не зелёный после ${maxFixAttempts} попыток исправления.`);
      commentIssue(
        next.number,
        `Гейт остаётся красным после ${maxFixAttempts} попыток исправления.\n\nПроваленные команды: \`${gate.failed.join(' && ')}\`\n\nТребуется ручной разбор.`,
      );
    }
  }

  log(`   Итог фазы: закрыто ${closedCount}, не прошло гейт ${failedCount}.`);
  return { ok: true };
}

// ---------- main ----------

async function main() {
  if (!config.active) {
    log('Ralph отключён (active=false в .claude/ralph.config.json).');
    return 0;
  }
  if (!phases.length) {
    log('⚠️ В конфиге нет фаз.');
    return 1;
  }
  if (!noopGh) {
    const auth = runCapture('gh auth status');
    if (!auth.ok) {
      log('⚠️ gh не авторизован. Выполни `gh auth login`.');
      return 1;
    }
  }

  state = { phaseIndex: 0, count: 0, startedAt: new Date().toISOString() };
  saveState();

  log(`🚀 Ralph Loop стартует. Фазы: ${phases.map((p) => p.milestone).join(' | ')}`);
  log(
    `Бюджет агентских сессий: ${agentBudget} • макс. попыток фикса на issue: ${maxFixAttempts} • таймаут сессии: ${Math.round(agentTimeoutMs / 60000)} мин${DRY ? ' (dry-run)' : ''}`,
  );

  for (let i = 0; i < phases.length; i++) {
    if (state.count >= agentBudget) {
      log('⛔ Бюджет исчерпан — стоп.');
      return 1;
    }
    state.phaseIndex = i;
    saveState();

    const result = await processPhase(phases[i], i);
    if (!result.ok) {
      if (result.error === 'budget') log('⛔ Бюджет исчерпан — стоп.');
      else if (result.error === 'dirty')
        log('⛔ Останавливаюсь: грязное рабочее дерево мешает переключить ветку.');
      else log(`⛔ Ошибка в фазе "${phases[i].milestone}": ${result.error}`);
      return 1;
    }

    if (config.pr !== false) {
      if (!createPr(phases[i])) log('⚠️ Не удалось создать/найти PR — продолжаю.');
    }
    if (config.review !== false) {
      const r = await runAgentAsync(buildReviewPrompt(phases[i]), `review ${phases[i].branch}`);
      if (r.reason === 'budget') {
        log('⛔ Бюджет исчерпан — стоп.');
        return 1;
      }
    }
  }

  log('🎉 Цикл завершён.');
  saveState();
  return 0;
}

main().then((code) => process.exit(code));
