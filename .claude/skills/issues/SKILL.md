---
name: issues
description: Publish a plan file (PRD, spec, or tickets.md) as GitHub issues and milestones. Parses the file, creates milestones, then creates issues in dependency order with labels, milestone assignments, and blocking edges. Use when the user says "publish to GitHub", "create issues from plan", "create milestones", "publish plan", or passes a plan/ticket/spec file.
disable-model-invocation: true
---

# Issues — Publish a plan to GitHub

Take a plan file and publish it as GitHub **milestones** and **issues** on the repo's issue tracker.

Requires `gh` CLI authenticated to the target repo.

## Process

### 1. Read the plan

Read the plan file the user provides. It comes in one of three forms, each parsed differently:

- **PRD** (`docs/prd/prd-*.md`) — phases under ## Release Plan become milestones; user stories under ## User Stories become issues grouped by milestone
- **Tickets file** (`tickets.md` in repo root) — each `## <Title>` section is an issue; the file may also define phases as headings that group tickets into milestones
- **Spec** (any format) — identify logical groups for milestones and individual work items for issues

Fallback: if the file has no clear grouping, treat the whole plan as a single milestone.

### 2. Confirm the breakdown

Present the parsed breakdown to the user:

```
Milestone: Phase 1 — MVP (5 issues)
  #1  As a user, I want to upload audio
  #2  As a user, I want to get a transcript
  #3  ...

Milestone: Phase 2 — Analytics (3 issues)
  ...
```

Ask:
- Are the milestone boundaries right?
- Should any issues be split or merged?
- Which labels to apply (default: `ready-for-agent`)?
- Target repo (default: from `git remote get-url origin`)?

Iterate until the user approves.

**Completion criterion:** user has confirmed the breakdown and target repo.

### 3. Create milestones

For each logical group (phase, release, epic), create a GitHub milestone:

```bash
gh api "repos/{owner}/{repo}/milestones" \
  -f title="<title>" \
  -f description="<description>"
```

Capture the milestone number from the response. If a milestone with the same title already exists, skip creation and use its number.

**Completion criterion:** every milestone exists on GitHub, and each has a known milestone number.

### 4. Create issues in dependency order

Create issues **blockers first** so `--blocked-by` can reference real issue numbers.

For each issue:

```bash
gh issue create \
  --repo "<owner/repo>" \
  --title "<title>" \
  --body "<body>" \
  --label "ready-for-agent" \
  --milestone "<milestone-title>"
```

Pass `--blocked-by` with the issue numbers of blocking issues already created.

Use the [Issue body template](#issue-body-template) for the body. Include the **Acceptance criteria** and **Blocked by** section from the source plan.

**Completion criterion:** every issue exists on GitHub; the count matches the approved breakdown.

### 5. Report

Print a summary:

```
Published 8 issues across 2 milestones to owner/repo:

Milestone: Phase 1 — MVP
  #1  Upload audio  → https://github.com/owner/repo/issues/1
  #2  Get transcript → https://github.com/owner/repo/issues/2

Milestone: Phase 2 — Analytics
  #7  Dashboard → https://github.com/owner/repo/issues/7
```

**Completion criterion:** user can verify every issue and milestone exists at its URL.

---

## Reference

### Issue body template

```markdown
## What to build

{end-to-end behaviour from the user's perspective}

## Acceptance criteria

- [ ] {criterion 1}
- [ ] {criterion 2}

{include "Blocked by" only if the source plan defines blockers}
{include "Parent" only if the issue is a sub-issue of another issue}
```

### `gh` commands reference

| Action | Command |
|--------|---------|
| Create milestone | `gh api "repos/{owner}/{repo}/milestones" -f title="<title>" -f description="<desc>"` |
| List milestones | `gh api "repos/{owner}/{repo}/milestones" --jq '.[] | {number, title}'` |
| Create issue | `gh issue create --repo "<owner/repo>" --title "<title>" --body "<body>" --label "<label>" --milestone "<milestone>" [--blocked-by <nums>]` |
| Create label | `gh api "repos/{owner}/{repo}/labels" -f name="<name>" -f color="<color>"` |
| List labels | `gh label list --repo "<owner/repo>"` |
