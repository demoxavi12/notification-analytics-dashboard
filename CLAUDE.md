# PulseOps — Claude Operating Contract

This repository is PulseOps, a multi-service Notification & Analytics Dashboard.

These rules are mandatory for every Claude Code session.

## 1. Operating Mode

- Inspect the existing architecture before changing anything.
- Work autonomously within the explicitly requested milestone.
- Do not narrate routine work.
- Fix genuine issues you discover within scope.
- Do not expand scope without a clear reason.
- Do not replace working architecture merely for style.
- Prefer existing utilities, services, components, and dependencies.
- Do not add dependencies unless genuinely required.
- Never fabricate tests, browser results, performance numbers, or integration results.

## 2. Git Safety — Mandatory

Claude has NO automatic Git authority. Implementation and Git publication are
separate operations: finishing (and testing) a change never implies committing,
pushing, or opening a PR.

NEVER:
- commit automatically
- push automatically
- create a PR automatically
- rewrite Git history — published OR unpublished (no filter-branch, filter-repo,
  history-rewriting rebase, or destructive reset)
- amend commits (`git commit --amend`)
- force-push (`--force`, `--force-with-lease`, `-f`)
- modify Git author/committer identity (repository, global, or system)
- add Claude/Anthropic attribution of any kind
- add `Co-Authored-By` trailers (including `Co-Authored-By: Claude` / `Co-Authored-By: Anthropic`)
- modify Git hooks, commit templates, or Git configuration for attribution

Required sequence: implementation → testing → report → **user approval** →
commit → **user approval** → push. Never skip an approval gate.

The commit gate (what to show before committing) and push gate are defined in
[docs/GIT_RULES.md](docs/GIT_RULES.md). Stop at each gate and wait for explicit approval.

If Git history already contains Claude/Anthropic attribution, do not rewrite it
unless the user explicitly requests history rewriting.

Project permissions in the workspace `.claude/settings.json` require approval for
`git commit`, `git push` and `gh pr create`, and deny history-rewriting and
identity-changing Git commands. These are a safety net, not a substitute for the rules above.

## 3. Security

- Never print `.env` contents or secrets.
- Never commit `.env` files.
- Never expose JWT secrets, database credentials, Redis credentials, API keys, tokens, cookies, or passwords.
- Never log complete database/Redis connection strings.
- Never weaken authorization for development convenience.
- Backend authorization is authoritative.
- Never place secrets in frontend bundles.
- Treat historical secrets as public and require rotation rather than assuming history is private.

## 4. Testing

After implementation:
- run relevant backend tests
- run relevant frontend tests
- run lint
- run production build where applicable
- add regression tests for genuine bugs
- fix failures before reporting completion

Do not add a component-testing framework unless explicitly requested.

## 5. Browser Verification

When browser verification is part of the task:
- use the real application whenever possible
- do not claim browser verification from static inspection
- verify loading, success, empty, error and retry states where relevant
- verify responsive behavior when UI changes
- check console errors/warnings after a clean-run marker

## 6. Scope

Do not:
- redesign working architecture without need
- add unrelated features
- introduce infrastructure not requested
- add Redis queues, workers, pub/sub, WebSockets, etc. unless explicitly required
- silently modify deployment configuration
- silently modify Git history

## 7. Final Reporting

Report:
- STATUS
- implementation
- files changed
- tests
- build/lint
- browser verification
- security findings
- remaining issues
- GIT state

Explicitly state:
- COMMITTED = YES/NO
- PUSHED = YES/NO

If no commit was requested, the expected result is:
COMMITTED = NO
PUSHED = NO

## 8. Detailed Rules

These documents are part of this contract:

- [docs/GIT_RULES.md](docs/GIT_RULES.md) — attribution, commit/push gates, history
- [docs/CLAUDE_WORKFLOW.md](docs/CLAUDE_WORKFLOW.md) — milestone phases and approval gates
- [docs/DEVELOPMENT_RULES.md](docs/DEVELOPMENT_RULES.md) — implementation conventions
- [docs/SECURITY_RULES.md](docs/SECURITY_RULES.md) — secrets, auth, logging
- [docs/TESTING_RULES.md](docs/TESTING_RULES.md) — required verification

@docs/GIT_RULES.md
@docs/CLAUDE_WORKFLOW.md
@docs/DEVELOPMENT_RULES.md
@docs/SECURITY_RULES.md
@docs/TESTING_RULES.md
