# Development Rules

## General

Inspect before editing.

Prefer the smallest correct change that fits the existing architecture.

Reuse:
- existing API client
- existing services
- existing hooks
- existing models
- existing components
- existing utilities

Do not duplicate existing functionality.

## Dependencies

Before adding a dependency:
1. Check whether the repository already provides the capability.
2. Check whether Node/browser built-ins are sufficient.
3. Add a dependency only when justified.

Do not add packages merely for convenience.

## Backend

- Keep controllers focused.
- Keep authorization server-side.
- Validate inputs.
- Normalize errors.
- Never leak internal infrastructure details.
- Never log secrets or credentials.

## Frontend

- Do not bypass backend authorization.
- Handle loading/error/empty states.
- Avoid duplicate requests.
- Clean up listeners/timers.
- Preserve accessibility.
- Preserve responsive behavior.

## Configuration

Use `.env.example` for documented placeholders.

Never put real credentials into source files.

## Scope

Complete the requested milestone fully, including tests and verification.

Do not silently start the next milestone.
