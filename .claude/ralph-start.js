#!/usr/bin/env node
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const configPath = process.env.RALPH_CONFIG || path.join(ROOT, '.claude', 'ralph.config.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
const counterPath = path.join(ROOT, '.claude', 'ralph.iterations.json')

const phases =
  config.phases && config.phases.length ? config.phases : [{ milestone: config.milestone, branch: config.branch }]

const DRY = process.env.RALPH_DRY_RUN === '1'
const noopGh = DRY || process.env.RALPH_NOOP_GH === '1'
const agentBudget = Number(config.maxIterations) || 20
const maxFixAttempts = Number(config.maxFixAttempts) || 5
const agentCmd = process.env.RALPH_AGENT_CMD || 'opencode run --auto --agent build'

let state = { phaseIndex: 0, count: 0 }

function saveState() {
  fs.writeFileSync(counterPath, JSON.stringify(state))
}

function log(...args) {
  console.log(...args)
}

function run(cmd) {
  const res = spawnSync(cmd, { cwd: ROOT, shell: true, stdio: 'inherit' })
  return res.status === 0
}

function runCapture(cmd) {
  const res = spawnSync(cmd, { cwd: ROOT, shell: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  return { ok: res.status === 0, out: (res.stdout || '').trim(), err: (res.stderr || '').trim() }
}

function phaseTests(phase) {
  if (process.env.RALPH_TESTS) {
    return process.env.RALPH_TESTS.split(',').map((s) => s.trim()).filter(Boolean)
  }
  if (Array.isArray(phase.tests) && phase.tests.length) return phase.tests
  if (Array.isArray(config.tests) && config.tests.length) return config.tests
  return ['npm run test']
}

function runTests(phase) {
  const cmds = phaseTests(phase)
  log(`🧪 Запускаю тесты: ${cmds.join(' && ')}`)
  if (DRY) {
    log('   [dry-run] тесты пропущены (считаем зелёными)')
    return true
  }
  for (const cmd of cmds) {
    if (!run(cmd)) return false
  }
  return true
}

function runAgent(prompt) {
  if (state.count >= agentBudget) {
    log(`⛔ Бюджет агентских сессий исчерпан (${agentBudget}). Останавливаю цикл.`)
    return false
  }
  state.count++
  saveState()
  if (DRY) {
    log(`   [dry-run] сессия #${state.count}/${agentBudget}: ${agentCmd} "${prompt}"`)
    return true
  }
  log(`🤖 Сессия агента #${state.count}/${agentBudget}...`)
  return run(`${agentCmd} "${prompt}"`)
}

function openIssues(phase) {
  const res = runCapture(`gh issue list --milestone "${phase.milestone}" --state open --json number,title`)
  if (!res.ok) {
    log(`⚠️ Не удалось получить issues из milestone "${phase.milestone}": ${res.err}`)
    return null
  }
  try {
    return JSON.parse(res.out)
  } catch {
    log(`⚠️ Некорректный ответ gh issue list: ${res.out}`)
    return null
  }
}

function closeIssue(number) {
  log(`ℹ️ Закрываю Issue #${number}`)
  if (noopGh) {
    log('   [noop] gh issue close')
    return true
  }
  return run(`gh issue close ${number}`)
}

function commentIssue(number, body) {
  if (noopGh) {
    log(`💬 [noop] комментарий в Issue #${number}`)
    return true
  }
  const tmp = path.join(ROOT, '.claude', `.ralph-comment-${number}.md`)
  fs.writeFileSync(tmp, body)
  const ok = run(`gh issue comment ${number} --body-file "${tmp}"`)
  fs.unlinkSync(tmp)
  return ok
}

function createPr(phase) {
  log(`📌 Создаю PR из ${phase.branch} в main (milestone: ${phase.milestone})`)
  if (noopGh) {
    log('   [noop] gh pr create')
    return true
  }
  return run(
    `gh pr create --base main --head "${phase.branch}" --title "feat: ${phase.milestone}" --body "Ralph loop: ${phase.milestone}"`,
  )
}

function processPhase(phase, phaseIndex) {
  log(`\n📦 Фаза ${phaseIndex + 1}/${phases.length}: "${phase.milestone}" (branch: ${phase.branch})`)

  const seen = new Set()
  let guard = 0
  while (true) {
    const issues = openIssues(phase)
    if (issues === null) return false
    if (issues.length === 0) {
      log('✅ В milestone не осталось открытых issues.')
      return true
    }
    if (state.count >= agentBudget) return false

    const issue = issues.find((i) => !seen.has(i.number))
    if (!issue) {
      log('⚠️ Все открытые issues уже обработаны, но не закрыты — прерываю фазу.')
      return true
    }
    seen.add(issue.number)
    guard++
    log(`\n🎯 Issue #${issue.number}: ${issue.title} (открыто: ${issues.length})`)

    const implementPrompt =
      config.prompt
        .replace('{milestone}', phase.milestone)
        .replace('{branch}', phase.branch) +
      ` Реализуй открытую Issue #${issue.number} из milestone '${phase.milestone}' в ветке '${phase.branch}'.`

    if (!runAgent(implementPrompt)) return false

    let fixAttempts = 0
    let green = runTests(phase)
    while (!green) {
      if (fixAttempts >= maxFixAttempts) break
      fixAttempts++
      log(`\n🔴 Тесты красные (попытка фикса ${fixAttempts}/${maxFixAttempts}). Запускаю сессию починки...`)
      const fixPrompt = `Прочитай .claude/ralph.md. Тесты сейчас красные. Запусти тесты, найди падающие и исправь причину — код и/или тесты — до тех пор, пока ВСЕ тесты не станут зелёными. Не отключай и не удаляй тесты. Работай в ветке '${phase.branch}' по milestone '${phase.milestone}' в Issue #${issue.number}. Коммить исправления по правилам conventional commits.`
      if (!runAgent(fixPrompt)) return false
      green = runTests(phase)
    }

    if (green) {
      log('🟢 Тесты зелёные.')
      const stillOpen = openIssues(phase)
      if (stillOpen === null) return false
      if (stillOpen.some((i) => i.number === issue.number)) {
        closeIssue(issue.number)
      }
    } else {
      log(`⛔ Issue #${issue.number}: тесты не зелёные после ${maxFixAttempts} попыток исправления.`)
      commentIssue(
        issue.number,
        `Тесты остаются красными после ${maxFixAttempts} попыток исправления.\n\nКоманда проверки: \`${phaseTests(phase).join(' && ')}\`\n\nТребуется ручной разбор.`,
      )
    }

    if (guard > issues.length + 10) {
      log('⚠️ Защитный предел итераций по issues — прерываю фазу.')
      return true
    }
  }
}

function main() {
  if (!config.active) {
    log('Ralph отключён (active=false в .claude/ralph.config.json).')
    return
  }

  state = { phaseIndex: 0, count: 0, startedAt: new Date().toISOString() }
  saveState()

  log(`🚀 Ralph Loop стартует. Фазы: ${phases.map((p) => p.milestone).join(' | ')}`)
  log(`Бюджет агентских сессий: ${agentBudget} • макс. попыток фикса на issue: ${maxFixAttempts}${DRY ? ' (dry-run)' : ''}`)

  for (let i = 0; i < phases.length; i++) {
    if (state.count >= agentBudget) {
      log('⛔ Бюджет исчерпан — стоп.')
      break
    }
    state.phaseIndex = i
    saveState()

    const done = processPhase(phases[i], i)
    if (!done) break

    if (config.pr !== false) {
      createPr(phases[i])
    }
    if (config.review !== false) {
      const reviewPrompt = `Прочитай .claude/ralph.md. Найди последний открытый PR из ветки '${phases[i].branch}' и проведи детальное code review: архитектура, безопасность, производительность, соответствие PRD. Оставь комментарии через gh pr review / gh pr comment.`
      if (!runAgent(reviewPrompt)) break
    }
  }

  log('🎉 Цикл завершён.')
  saveState()
}

main()
