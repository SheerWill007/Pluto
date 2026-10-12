# Changelog

## 2.1.0

### Frontend redesign
- New deep-space interface: a WebGL vortex whose glowing core travels on a circular orbit
  while the streaks swirl around it; scroll velocity spins it faster.
- Lenis smooth scrolling with scroll-driven effects on the landing page: the hero card opens
  into the vortex as you scroll, parallax agent cards, a word-by-word manifesto reveal, a
  scroll-drawn workflow line, and a velocity-skewed marquee.
- Floating pill navigation, serif display type, and one dark theme across the landing page and
  dashboard. The topology map is now its own tab (`/topology`).
- The landing page renders at `/` directly, so the Google redirect sign-in keeps its
  `?code=` callback parameters (they were lost to a redirect before).
- Dashboard panels adapt to phone widths.

### Agent fixes
- **Web search never worked**: `langchain-community` 0.4 imports the renamed `ddgs` package,
  but `duckduckgo-search` was installed. Requirements now use `ddgs`.
- **A failing tool aborted the whole answer** (e.g. a rate-limited code pipeline). Tool errors
  are now returned to the model, which explains or works around them.
- **Models without tool calling failed outright** (Ollama `llama3`, some OpenRouter models).
  The orchestrator now retries as plain chat.
- **Ollama chat bypassed the backend**, so it never reached the agents. It now uses the same
  orchestrator as every other provider.
- **The coding workspace ignored the selected provider** and always called OpenAI with retired
  model names. It now follows the control bar.
- Model names resolve through one table (`config/models.py`); previously two conflicting tables
  could rewrite valid Gemini names to models that don't exist (`gemini-3.6-flash`).
- A server base URL (e.g. Groq's) is no longer reused when a request picks another provider.
- Ollama health is probed even when the server's default provider is a cloud one.
- Retrieval relevance scores are clamped to [0, 1].

## 2.0.0

### Security
- **Fixed account takeover via `/auth/google`**: the endpoint issued a session for any email
  in the request body. It now verifies a Google token server-side and derives the identity
  from Google. The client secret was removed from the browser; the redirect flow's code
  exchange happens on the server, with a CSRF `state` check.
- **Fixed sessions signed with an empty secret** when `JWT_SECRET_KEY` was unset. Production
  now refuses to start without a strong secret; development uses an ephemeral one.
- **Fixed the frontend "authenticate locally anyway" fallback** that signed users in after the
  backend rejected their Google login.
- **Fixed cross-user data exposure**: chat history, facts, and RAG documents were global or
  keyed by guessable IDs; all are now scoped to the authenticated user. Chat, RAG, and code
  endpoints previously required no authentication at all.
- **Fixed Gmail OAuth login-CSRF**: the `state` parameter was the raw user ID; it's now a
  signed, expiring token.
- **Fixed server API keys leaking across providers**: choosing another provider in the UI sent
  the server's key (e.g. the Gemini key) to that provider.
- Gmail OAuth tokens encrypted at rest; password hashing raised to 600k PBKDF2 iterations
  with constant-time comparison and automatic rehash; uniform login failures.
- CORS restricted to configured origins (was `*` with credentials); security headers; rate
  limiting; request-size, upload-size, and file-type limits; agent tool-loop cap.
- Dependencies raised past ~130 known advisories (Starlette, pypdf, cryptography, LangChain,
  LangGraph); CI now audits dependencies.

### Bug fixes
- Gmail connect could never complete: the callback rebuilt the OAuth flow without the PKCE
  verifier the connect step auto-generated.
- The orchestrator's Gmail tool crashed (called without the required user ID).
- The RAG page crashed on load (`Upload` icon used but never imported).
- RAG queries ignored the provider selected in the top bar (read nonexistent store fields).
- RAG queries were hardcoded to Groq; the code critic was hardcoded to a Groq-only model.
- Documents seemed to disappear when a custom API key changed the embedding collection;
  the embedding backend is now a server property.
- The per-chat system prompt was shown in the UI but never sent to the model.
- Gmail inbox search refetched on every keystroke; a polling interval leaked on unmount.
- Nested multipart emails showed no body; HTML-only emails showed raw markup.
- Blocking LLM calls ran inside `async` endpoints, stalling the event loop.
- PostgreSQL/Redis outages were cached forever; both now recover automatically.
- TypeScript checking was silently broken (TS 7 removed `baseUrl`) and ESLint matched no
  files; both now run and pass.

### Features
- Streaming chat over Server-Sent Events, with tool activity shown live in the message and
  the topology map.
- `POST /auth/guest` for real (server-issued) guest sessions.
- `DELETE /rag/documents/{source}`, `DELETE /chat/{session_id}/history`, `GET /health/ready`,
  `GET /metrics`.
- RAG answers cite source documents and return relevance scores.
- Ollama now supports tool calling (via `langchain-ollama`).
- Error boundary with stale-deploy detection; session-expiry notice on the login page.

### Platform
- Backend reorganized into `core/` (logging, errors, security, rate limiting, metrics,
  crypto), `api/v1/` (one router per domain), and `services/`.
- PostgreSQL connection pooling and versioned migrations with an advisory lock.
- Structured JSON logging with request and user correlation; Prometheus metrics; audit log.
- First-load JavaScript reduced from 1.58 MB to ~0.49 MB via route and vendor code splitting;
  three.js loads only with the topology view.
- Typed API client and fully typed stores (230 type errors → 0); oxlint replaces the
  non-functional ESLint setup.
- Multi-stage, non-root Docker images; nginx image with CSP and SSE-friendly proxying;
  `docker compose` stack with PostgreSQL, Redis, health checks, and volumes.
- GitHub Actions CI (lint, types, tests, audits, image builds) and Dependabot.
- 87 backend tests covering security primitives, API contracts, user isolation, streaming,
  and the real LangGraph agent loop.
