# Testing Rules

## Required Verification

For meaningful changes, run the applicable:

- backend tests
- frontend tests
- lint
- production build
- secret scan
- `git diff --check`

## Regression Tests

Every genuine bug fixed should have regression coverage when practical.

Prefer deterministic tests.

Do not create tests that merely assert implementation details without protecting behavior.

## Browser Testing

For UI changes, verify the actual browser application.

Check:
- loading
- populated
- empty
- error
- retry
- responsive layouts
- keyboard/focus behavior where relevant
- console after clean run

## Integration Testing

Prefer real services when the environment supports them.

Do not claim real integration when using a mock or scratch replacement.

If a mock is necessary, clearly identify it as a mock.

## Reporting

Never report:
- a test as passing when it was not run
- a browser check as completed when it was only inspected statically
- a performance improvement without measurement
