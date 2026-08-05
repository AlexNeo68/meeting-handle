---
name: parallel-code-review
description: Run the three project reviewers — security-review, performance-review, test-coverage — in parallel against a diff or set of files, then aggregate their findings into one report. Use when the user asks for a full review ("review everything", "run all reviewers", "check security + performance + tests"), before merging a branch, or after completing a major feature.
---

# Parallel Code Review

Dispatch the three review subagents **in parallel** so each works with its own isolated context, then combine their reports into a single actionable output.

**Core principle:** reviews run concurrently, findings come back to the coordinator, never the other way around.

## The three reviewers

| Agent | File | Axes |
|-------|------|------|
| `@security-review` | `.claude/agents/security-review.md` | auth, IDOR, validation, file upload, secrets, XSS/CSRF |
| `@performance-review` | `.claude/agents/performance-review.md` | N+1, indexes, re-renders, bundle, waterfalls |
| `@test-coverage` | `.claude/agents/test-coverage.md` | behavior tests, edge cases, coverage gaps |

## When to use

**Mandatory:**
- Full review of a branch before merge to `main`
- After completing a major feature that touches both API and web
- Before deployment after significant changes

**Optional:**
- When the user says "проверь всё", "run the review agents", "review security, perf and tests"
- When a change is risky (auth, file upload, payments-adjacent logic)

**If the user asks about only one axis** — run only that agent, not all three.

## Process

### 1. Pin the scope

Ask if ambiguous; otherwise use these defaults in order:

1. Uncommitted changes: `git diff` + `git status` (working tree).
2. A commit range the user named: `git diff BASE..HEAD`.
3. No range and clean tree → the last commit: `git diff HEAD~1..HEAD`.

Capture:
- `git diff <scope>` (or the list of changed files if the diff is huge)
- `git status --short`
- Short description of what the change does and any plan/PRD it implements

**Fail early:** if the diff is empty, tell the user and stop.

### 2. Build the shared context block

One context block, given identically to all three agents:

```
Scope: <description of the change + plan/PRD reference if any>
Diff: git diff BASE..HEAD   (paste the output; or point at the file list + working tree)
Files changed:
  - path (one per line, from git status/diff --name-only)
Commands: <any relevant run commands, e.g. npm run test:api>
```

Keep it to the work product — never the coordinator's session history.

### 3. Dispatch in parallel

Launch all three agents in a **single message** (multiple tool calls, no waiting between them), each with the same context block:

```
@security-review    → Security review of the diff/scope
@performance-review → Performance review of the diff/scope
@test-coverage      → Test coverage review of the diff/scope
```

Give each agent the same instructions:
- Review the scope; the diff is included.
- Use the checklist from your own prompt.
- Report `file:line` findings grouped by severity.
- Test-coverage may read/write tests and must run them — give it the test command and allow it time to iterate.

### 4. Aggregate the results

Merge the three reports into one combined output:

- **Section per axis** (Security / Performance / Test coverage), preserving each agent's severity ordering.
- **Deduplicate** overlapping findings — e.g. a large serialized object might be flagged by both security (data leak) and performance (payload size): keep the primary axis, note the cross-reference.
- **Cross-cutting severity rollup**: combine Critical/Important across all three into a single "must fix before merge" list, sorted by overall impact.

### 5. Act on findings

- Fix **Critical** immediately.
- Fix **Important** before proceeding.
- Note **Minor** for later.
- Re-run the affected agent on the fixes if the fix is non-trivial.

## Red Flags

**Never:**
- Run the agents sequentially when the user asked for a full review — parallel is the point.
- Skip one of the three when scope touches it ("it's simple").
- Ignore a Critical finding from any axis.
- Forward raw diffs from one agent's report into another agent's context.

**If reviewers disagree** (e.g. perf suggests caching, security flags the cache): the coordinator decides, favoring the axis with the higher severity impact, and says why.

## Example

```
User: проверь всё перед мержем
You:  scope = git diff origin/main..HEAD (5 files: auth, meetings, files, 2 web components)
      context block built
      [single message] dispatch @security-review, @performance-review, @test-coverage
      ⏳ wait for all three
      → Combined report:
        Security: 1 Critical (IDOR in files/delete), 2 Important
        Performance: 1 High (N+1 in meetings list)
        Test coverage: missing specs for files delete; 2 new tests added
      You: fix Critical IDOR first, then N+1, then merge
```
