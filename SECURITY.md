# Security

## Reporting a vulnerability

Please report suspected vulnerabilities privately to the maintainers rather than opening a
public issue. Include reproduction steps and, if possible, the `request_id` from the
affected API response.

## Security model

### Authentication
- **Passwords** are hashed with PBKDF2-HMAC-SHA256 at 600,000 iterations (OWASP 2023) with a
  per-user salt, verified in constant time. Hashes from earlier versions (100k iterations)
  are upgraded transparently on the next successful login.
- **Login responses** are identical for unknown accounts and wrong passwords, and take the
  same time (a dummy hash is verified), so accounts can't be enumerated.
- **Sessions** are HS256 JWTs carrying `iss`, `aud`, `iat`, `nbf`, `exp`, `jti`, and a token
  type, so a token minted for one purpose (e.g. OAuth state) can't be replayed as another.
  In production the server refuses to start without a ≥ 32-character `JWT_SECRET_KEY`.
- **Google sign-in** is verified server-side: the browser submits a Google token, the server
  validates it with Google, checks it was issued to `GOOGLE_CLIENT_ID`, requires a verified
  email, and derives the identity from Google's response. The client secret never reaches
  the browser. A Google login never silently merges into an existing password account.
- **Guest sessions** are short-lived tokens with a random identity and can't use Gmail.

### Authorization and isolation
- Every feature endpoint requires a bearer token.
- Chat history (Redis), long-term facts (PostgreSQL), and documents (ChromaDB `owner`
  metadata) are namespaced by user ID. Agent tools are constructed per request and closed
  over the caller, so the orchestrator cannot read another user's data.

### Gmail
- The OAuth `state` is a signed, 10-minute token, preventing login-CSRF that would link an
  attacker's mailbox to a victim's account (or the reverse).
- Access and refresh tokens are encrypted at rest with Fernet when `TOKEN_ENCRYPTION_KEY`
  is set (required in production). Legacy plaintext rows remain readable.
- Email content is treated as untrusted input in agent prompts.

### Transport and browser
- CORS is restricted to `CORS_ORIGINS`; wildcards are rejected in production.
- API responses set `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, `Cross-Origin-Opener-Policy`, and HSTS (production).
- The nginx image adds a Content-Security-Policy scoped to Google sign-in and Google Fonts.
- The frontend never renders model output as raw HTML.

### Abuse controls
- Fixed-window rate limits per client (Redis-backed when available): a general API budget
  and a stricter budget for auth endpoints. Responses include `Retry-After`.
- Request size limits: chat messages (32k chars), code context (100k chars), uploads
  (`MAX_UPLOAD_MB`, extension allowlist, path components stripped from filenames).
- The agent loop is capped (`RECURSION_LIMIT`) so a model can't call tools indefinitely.
- A server-side provider key is only sent to its own provider, never to whichever provider
  a user selects.

### Operations
- Unhandled errors return a generic message plus a request ID; stack traces stay in logs.
- Interactive API docs are disabled in production.
- Containers run as non-root users.
- CI audits Python and npm dependencies for known vulnerabilities.

## Known accepted advisories

| Advisory | Package | Why it doesn't apply |
|---|---|---|
| PYSEC-2026-3813, PYSEC-2026-3814, PYSEC-2026-3815 | chromadb 0.5.11 | All three affect Chroma's **HTTP server** (tenant authorization, RBAC, and a collection-update endpoint). Pluto embeds Chroma in-process via `PersistentClient` and never runs or exposes a Chroma server. |

chromadb is held at 0.5.x for on-disk compatibility with existing collections. Moving to
1.x requires re-ingesting documents; plan it as a separate migration. Revisit this table
whenever the ignore list in `.github/workflows/ci.yml` changes.

## Deployment checklist

- [ ] `ENVIRONMENT=production`
- [ ] Random `JWT_SECRET_KEY` (≥ 32 chars) and `TOKEN_ENCRYPTION_KEY` (Fernet), stored in a secret manager
- [ ] `CORS_ORIGINS` lists only your frontend origin(s)
- [ ] `GOOGLE_CLIENT_ID` set if Google sign-in is enabled
- [ ] TLS terminated in front of the app; `GMAIL_REDIRECT_URI` uses `https://`
- [ ] PostgreSQL and Redis not reachable from the internet
- [ ] `/metrics` restricted to your monitoring network
- [ ] `ALLOW_GUEST_ACCESS` reviewed for your deployment
