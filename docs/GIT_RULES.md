# Git Rules

## Ownership

Git authorship belongs to the project's configured user identity.

Claude must never represent itself as an author or co-author.

Never change `user.name` / `user.email` (repository, global, or system config) and
never set `GIT_AUTHOR_*` / `GIT_COMMITTER_*` to alter authorship.

## Forbidden Attribution

Never add:

- `Co-Authored-By: Claude`
- `Co-Authored-By: Anthropic`
- Claude Code attribution trailers
- Anthropic attribution trailers
- AI-generated author identities

Do not modify Git configuration, hooks, or commit templates to create such attribution.

## Before Any Commit

A commit is allowed only after explicit user authorization.

Before committing, inspect:

```bash
git status
git diff --stat
git diff --check
git diff --name-only
git branch --show-current
git log -1 --oneline
git config user.name
git config user.email
```

Then report:

- files
- diff summary
- branch
- HEAD
- author
- committer
- commit message
- trailers

Stop and wait for approval.

## Before Push

Never push automatically.

Before an explicitly authorized push, verify:

```bash
git status
git log -1 --oneline
git remote -v
```

Report exactly what will be pushed.

## History

Never rewrite Git history, whether published or unpublished, unless the user explicitly requests it.

Never use:

- `git commit --amend`
- force push (`git push --force`, `--force-with-lease`, `-f`)
- destructive reset (`git reset --hard`)
- rebase that rewrites commits (`git rebase`, including interactive rebase)
- `git filter-branch`
- `git filter-repo`

A mistake in a commit is fixed with a new commit, never by amending or rewriting.

Historical Claude attribution is not a reason to silently rewrite history.

## Clean Working Tree

After an authorized commit, verify:

```bash
git status
git log -1 --oneline
```

The working tree should be clean unless the user explicitly wants uncommitted work.
