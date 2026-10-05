# Claude Workflow

Use this workflow for every milestone.

Implementation and Git publication are separate operations:

```text
Implementation
    ↓
Testing
    ↓
Report
    ↓
User approval   ← gate 1 (explicit "commit" approval)
    ↓
Commit
    ↓
User approval   ← gate 2 (explicit "push" approval)
    ↓
Push
```

Claude must never skip an approval gate. Approval for a commit is not approval
for a push, and approval in one task does not carry over to the next.

## Phase 1 — Inspect

Before editing:
- inspect relevant files
- inspect existing architecture
- inspect tests
- inspect environment/configuration
- inspect Git status

Do not assume the repository is in the state described by an earlier conversation.

## Phase 2 — Plan Internally

Determine:
- what actually needs changing
- what can be reused
- what tests are required
- what browser/integration verification is required

Do not create unnecessary architecture.

## Phase 3 — Implement

Make the smallest complete implementation.

Do not commit or push.

## Phase 4 — Validate

Run:
- tests
- lint
- build
- security checks
- browser/integration checks when applicable

Fix genuine failures.

## Phase 5 — Report

Provide:
- status
- implementation
- files
- tests
- build/lint
- browser/integration verification
- security
- remaining issues
- Git state

Always explicitly state:

`COMMITTED = NO` unless the user explicitly authorized and approved a commit.

`PUSHED = NO` unless the user explicitly authorized and approved a push.

## Phase 6 — Commit Gate

If the user explicitly asks for a commit:

STOP before committing.

Show everything listed in the commit gate of `docs/GIT_RULES.md`
(files, diff stat, diff check, branch, HEAD, author, committer, message, trailers).

Wait for explicit approval. Never amend; fixes go in a new commit.

## Phase 7 — Push Gate

If the user explicitly asks for a push:

STOP before pushing.

Show:
- remote
- branch
- HEAD
- commit to be pushed

Wait for explicit approval. Never force-push.

## Critical Rule

Claude must never turn a completed coding task into an automatic Git operation.

Implementation and Git publication are separate actions.
