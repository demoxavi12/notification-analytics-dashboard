# Security Rules

## Secrets

Never commit or print:

- JWT secrets
- MongoDB credentials
- Redis credentials
- API keys
- access tokens
- refresh tokens
- cookies
- passwords
- private keys

`.env.example` may contain placeholders only.

## Authentication

- Public registration must not allow privileged role assignment.
- Protected routes require valid authentication.
- Role checks in the frontend are UX only.
- Backend authorization is authoritative.
- Do not weaken authentication to make local testing easier.

## Authorization

Always enforce ownership and role boundaries on the backend.

Cached responses must never cross:
- users
- roles
- authorization scopes

Never cache:
- authentication responses
- authorization failures
- sensitive mutation responses

## Logging

Logs must not expose:
- credentials
- tokens
- cookies
- complete connection strings
- sensitive user data

Operational logs should contain enough context to diagnose failures without revealing secrets.

## Git History

Treat historical secrets as public.

Do not silently rewrite history.

If an exposed secret is discovered:
1. rotate/revoke it
2. remove it from current tracked content
3. document the situation
4. only rewrite history with explicit authorization
