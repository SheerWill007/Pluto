# Pluto: Multi-Agent AI Workspace

<p align="center">
  <img src="frontend/public/pluto.png" alt="Pluto" width="200" />
</p>

<p align="center">
  <strong>A multi-agent orchestrator that unifies web search, document intelligence, Gmail triage, and code generation in a single workspace.</strong>
</p>

<p align="center">
  <a href="https://github.com/SheerWill007">GitHub</a> |
  <a href="https://willx.tech/">Portfolio</a> |
  <a href="https://www.linkedin.com/in/willxtech">LinkedIn</a>
</p>

<p align="center">
  <a href="#overview">Overview</a> |
  <a href="#key-features">Features</a> |
  <a href="#architecture">Architecture</a> |
  <a href="#quick-start">Quick Start</a> |
  <a href="#configuration">Configuration</a> |
  <a href="#api-reference">API</a> |
  <a href="#project-structure">Structure</a>
</p>

---

## Overview

Pluto is a production-ready, multi-agent AI workspace built on LangGraph. It orchestrates conversations with streaming responses and dynamically decides which specialized agents and tools to invoke based on the user's query.

### Design Principles

- **Deliberate routing.** LangGraph builds an execution graph at runtime, selecting agents and tools based on context.
- **Streaming by default.** Tokens are delivered in real time over Server-Sent Events (SSE), alongside a live topology view of agent activity.
- **Provider-agnostic.** Works with Google Gemini, OpenAI, Anthropic Claude, Groq, OpenRouter, or local Ollama models.
- **Per-user isolation.** Conversations, documents, and Gmail data are scoped to the authenticated user.
- **Production posture.** Security controls, observability, and deployment tooling are included from the start.

### Use Cases

- **Research assistant:** search the web, analyze documents, and synthesize findings.
- **Code companion:** generate code with automated review and quality checks.
- **Inbox management:** triage Gmail, summarize threads, and surface action items.
- **Knowledge base:** query a personal document collection with cited sources.

---

## Key Features

### Streaming Agent Chat

- Real-time token streaming over Server-Sent Events.
- Live topology map showing which agents and tools are being invoked.
- Visibility into the system's decision-making as a response is produced.

### Multi-Agent System

| Agent | Role |
|---|---|
| Orchestrator | Central router that dispatches requests to specialized agents |
| Web Research Agent | Live DuckDuckGo search for current information |
| RAG Agent | Document ingestion and retrieval with source citations |
| Gmail Agent | Inbox analysis, thread summarization, and spam detection |
| Code Generator | Context-aware code generation |
| Code Critic | Automated review for security and correctness |

### Universal LLM Support

A unified interface covers the major providers:

- **Google Gemini** (gemini-pro, gemini-1.5-pro)
- **OpenAI** (GPT-4, GPT-3.5-turbo)
- **Anthropic** (Claude 3 Opus, Sonnet, Haiku)
- **Groq** (fast inference with Llama and Mixtral)
- **OpenRouter** (access to 100+ models)
- **Ollama** (local models for privacy)

### Security

- Verified Google Sign-In with strict token validation
- JWT authentication with secure signing and expiration
- PBKDF2 password hashing (600,000 iterations) with automatic upgrades
- OAuth tokens encrypted at rest using Fernet symmetric encryption
- CSRF protection on all state-changing operations
- Per-client rate limiting
- Strict CORS with no wildcard origins
- Security headers (HSTS, CSP, X-Frame-Options)
- Audit logging for authentication and data events

### Per-User Isolation

- **Conversations:** chat history is scoped to the authenticated user.
- **Documents:** RAG vectors are tagged by owner.
- **Gmail:** OAuth tokens are encrypted and user-specific.
- **Long-term memory:** stored facts are isolated per account.

### Observability

- Structured JSON logging with request IDs for distributed tracing
- Prometheus metrics for HTTP requests, LLM calls, and system health
- Liveness and readiness probes for Kubernetes and Docker
- Audit trail for compliance and security monitoring
- Graceful degradation when dependencies are unavailable

---

## Architecture

### System Overview

```mermaid
flowchart LR
    Browser["React SPA<br/>(Vite, Zustand)"] -->|"/api/v1 · JWT · SSE"| Nginx
    Nginx["nginx<br/>static + proxy"] --> API
    subgraph API["FastAPI"]
        MW["Middleware<br/>request ID · metrics · headers · rate limit"] --> Routers
        Routers["Routers<br/>auth · chat · rag · code · gmail · system"] --> Orchestrator
        Orchestrator["LangGraph orchestrator"] --> Tools["Tools<br/>web search · code pipeline<br/>documents · Gmail"]
    end
    API --> PG[("PostgreSQL<br/>users · facts · tokens · audit")]
    API --> Redis[("Redis<br/>chat memory · rate limits")]
    API --> Chroma[("ChromaDB<br/>embedded vectors")]
    Orchestrator --> LLM["LLM providers"]
```

### Agent Flow

```mermaid
graph TD
    A[User Query] --> B[Orchestrator]
    B --> C{Analyze Intent}
    C -->|Web Info| D[Research Agent]
    C -->|Code Task| E[Code Generator]
    C -->|Document Query| F[RAG Agent]
    C -->|Email Task| G[Gmail Agent]
    C -->|Simple Query| H[Direct Response]

    E --> I[Code Critic]
    I -->|Approved| J[Return Code]
    I -->|Issues Found| E

    D --> K[Merge Results]
    F --> K
    G --> K
    H --> K
    J --> K

    K --> L[Stream to User]
```

### Layer Responsibilities

| Layer | Location | Responsibility |
|---|---|---|
| Entry point | `app.py` | App factory, lifespan management (config validation, migrations), middleware stack |
| HTTP API | `api/v1/` | Domain-specific routers; thin controllers handling validation and authentication |
| Cross-cutting | `core/` | Logging, error handling, security (JWT and passwords), rate limits, metrics, crypto |
| Agents | `agents/` | LangGraph orchestrator and specialized agents (RAG, Gmail, code generation and review) |
| Tools | `tools/` | Per-request tool factories bound to the calling user for isolation |
| Data layer | `memory/`, `rag/` | PostgreSQL (pooled, migrated), Redis, and ChromaDB behind abstractions |
| LLM abstraction | `llm_provider/` | Provider-agnostic model construction and configuration |
| Frontend | `frontend/src/` | Typed API client, state management (Zustand), and UI components |

### Technology Stack

**Backend**

- Framework: FastAPI (async Python)
- Agent framework: LangGraph (stateful agent orchestration)
- LLM integration: LangChain (unified model interface)
- Data stores: PostgreSQL (relational), Redis (cache and memory), ChromaDB (vectors)
- Authentication: JWT and OAuth 2.0 (Google)
- API documentation: OpenAPI/Swagger (auto-generated)

**Frontend**

- Framework: React 18 with TypeScript
- Build tool: Vite
- State management: Zustand
- Styling: Tailwind CSS and Framer Motion
- HTTP client: Axios with interceptors
- Icons: Lucide React

**Infrastructure**

- Containerization: Docker with multi-stage builds
- Orchestration: Docker Compose (development), Kubernetes-ready
- Reverse proxy: nginx (static files and API proxy)
- CI/CD: GitHub Actions (lint, test, build, security audit)
- Monitoring: Prometheus-compatible metrics

---

## Quick Start

### Option 1: Docker (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/SheerWill007/Pluto.git
cd Pluto

# 2. Create environment configuration
cp .env.example .env

# 3. Generate required secrets
# Linux / macOS:
openssl rand -hex 32  # use for JWT_SECRET_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # use for TOKEN_ENCRYPTION_KEY

# Windows (PowerShell): see the generation commands in .env.example

# 4. Edit .env and set at minimum:
#    - JWT_SECRET_KEY (32+ characters)
#    - TOKEN_ENCRYPTION_KEY (Fernet key)
#    - POSTGRES_PASSWORD
#    - One LLM provider key (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)

# 5. Start the full stack
docker compose up --build
```

Once running:

| Service | URL |
|---|---|
| Frontend | http://localhost:8080 |
| API documentation | http://localhost:8000/docs |
| Metrics | http://localhost:8000/metrics |

The stack includes nginx serving the React SPA, the FastAPI backend, PostgreSQL, Redis, and persistent data volumes.

### Option 2: Local Development

**Requirements:** Python 3.11+, Node 22+, PostgreSQL (optional), Redis (optional)

#### Backend

```bash
# 1. Create a virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements-dev.txt

# 3. Configure the environment
cp .env.example .env
# Edit .env with your settings

# 4. Start the API server
python -m uvicorn app:app --reload
```

The API is served at http://localhost:8000.

> **Note:** Without PostgreSQL and Redis, the API runs in degraded mode: user accounts and Gmail integration are unavailable, chat history is held in memory and lost on restart, and guest sessions remain available for testing.

#### Frontend

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install dependencies
npm ci  # or npm install

# 3. Configure the environment
cp .env.example .env
# Edit .env if needed (defaults are usually sufficient)

# 4. Start the development server
npm run dev
```

The frontend is served at http://localhost:5173.

#### Helper Scripts

```bash
./start.sh   # Start backend and frontend
./status.sh  # Check service status
./stop.sh    # Stop all services
```

---

## Configuration

All configuration is managed through environment variables. See [`.env.example`](.env.example) for the complete, commented list.

### Core

| Variable | Description | Required | Default |
|---|---|---|---|
| `ENVIRONMENT` | `development` or `production` | Yes | `development` |
| `JWT_SECRET_KEY` | Secret for signing JWTs (32+ characters) | Production | None |
| `TOKEN_ENCRYPTION_KEY` | Fernet key for encrypting OAuth tokens | Gmail | None |
| `CORS_ORIGINS` | Comma-separated allowed origins | Yes | `http://localhost:5173` |

### LLM Providers

| Variable | Description | Example |
|---|---|---|
| `LLM_PROVIDER` | Provider name (auto-detected if blank) | `openai`, `anthropic`, `google` |
| `LLM_MODEL` | Model identifier | `gpt-4`, `claude-3-opus-20240229` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `ANTHROPIC_API_KEY` | Anthropic API key | `sk-ant-...` |
| `GOOGLE_API_KEY` | Google AI API key | |
| `GROQ_API_KEY` | Groq API key | |
| `OPENROUTER_API_KEY` | OpenRouter API key | |
| `OLLAMA_BASE_URL` | Ollama server URL | `http://localhost:11434` |

> **User-supplied keys:** Users can provide their own API keys through the UI. These keys are sent per request and are never stored server-side.

### Databases

| Variable | Description | Default |
|---|---|---|
| `POSTGRES_URL` | PostgreSQL connection string | `postgresql://pluto:password@localhost:5432/pluto` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |

### Authentication and Rate Limiting

| Variable | Description | Default |
|---|---|---|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID for Google Sign-In | None |
| `GMAIL_WEB_CLIENT_ID` | Separate OAuth client for Gmail API access | None |
| `GMAIL_WEB_CLIENT_SECRET` | Gmail OAuth client secret | None |
| `GMAIL_REDIRECT_URI` | OAuth callback URL | `http://localhost:8000/api/v1/gmail/connect` |
| `RATE_LIMIT_PER_MINUTE` | General rate limit | `60` |
| `AUTH_RATE_LIMIT_PER_MINUTE` | Authentication endpoint rate limit | `10` |
| `ALLOW_GUEST_ACCESS` | Enable anonymous sessions | `true` |

### Observability

| Variable | Description | Default |
|---|---|---|
| `LOG_FORMAT` | `json` or `text` | `text` |
| `LOG_LEVEL` | `DEBUG`, `INFO`, `WARNING`, `ERROR` | `INFO` |

---

## API Reference

All endpoints are served under `/api/v1`. Errors follow a consistent format:

```json
{
  "detail": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "request_id": "uuid-for-log-correlation"
}
```

### Authentication

All endpoints, except system health checks and authentication endpoints, require a JWT:

```
Authorization: Bearer <token>
```

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/signup` | Create an account with email and password |
| `POST` | `/auth/login` | Log in with email and password |
| `POST` | `/auth/google` | Authenticate with a Google OAuth token |
| `POST` | `/auth/guest` | Create a temporary anonymous session |
| `GET` | `/auth/me` | Retrieve the current user profile |

### System

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/health` | Liveness probe | No |
| `GET` | `/health/ready` | Readiness probe (checks database) | No |
| `GET` | `/config/llm` | Available LLM providers | No |
| `GET` | `/config/auth` | Authentication configuration | No |
| `GET` | `/agents/status` | Agent health status | No |
| `GET` | `/metrics` | Prometheus metrics | No |

### Chat

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/chat` | Send a message and receive the complete response |
| `POST` | `/chat/stream` | Send a message and stream the response via SSE |
| `DELETE` | `/chat/{session_id}/history` | Clear conversation history |

**Streaming events** (`/chat/stream`):

| Event | Meaning |
|---|---|
| `start` | The agent has begun processing |
| `token` | A single token from the LLM |
| `tool_start` | An agent has invoked a tool |
| `tool_end` | A tool has returned a result |
| `done` | Complete response with metadata |
| `error` | An error occurred during processing |

### Documents (RAG)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/rag/ingest` | Upload and index documents |
| `GET` | `/rag/documents` | List the user's documents |
| `DELETE` | `/rag/documents/{source}` | Delete a specific document |
| `DELETE` | `/rag/documents` | Delete all of the user's documents |
| `POST` | `/rag/query` | Query the document collection |

Supported formats: PDF, DOCX, Markdown, CSV, TXT.

### Code

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/code/generate` | Generate code from a description |
| `POST` | `/code/critic` | Review code for issues |

### Gmail

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/gmail/connect` | Begin the OAuth flow to link Gmail |
| `GET` | `/gmail/status` | Check Gmail connection status |
| `POST` | `/gmail/disconnect` | Unlink the Gmail account |
| `GET` | `/gmail/list` | List recent emails |
| `GET` | `/gmail/get/{id}` | Retrieve a specific email |
| `POST` | `/gmail/summarize` | Summarize the inbox or a thread |

> **Note:** Gmail features require a registered (non-guest) account and a completed OAuth link.

---

## Project Structure

```
pluto/
├── agents/                     # Multi-agent system
│   ├── orchestrator.py         # Main LangGraph orchestrator
│   ├── research_agent.py       # Web search agent
│   ├── rag_agent.py            # Document retrieval agent
│   ├── gmail_agent.py          # Email triage agent
│   ├── code_generator.py       # Code generation agent
│   ├── code_critic.py          # Code review agent
│   ├── common.py               # Shared agent utilities
│   └── __init__.py
│
├── api/                        # FastAPI HTTP layer
│   ├── deps.py                 # Dependency injection (auth, DB)
│   ├── routes.py               # Root router aggregator
│   └── v1/
│       ├── auth.py             # Authentication endpoints
│       ├── chat.py             # Chat and streaming endpoints
│       ├── code.py             # Code generation endpoints
│       ├── gmail.py            # Gmail integration endpoints
│       ├── rag.py              # Document endpoints
│       └── system.py           # Health and configuration endpoints
│
├── core/                       # Cross-cutting concerns
│   ├── config.py               # Environment-based configuration
│   ├── logging.py              # Structured logging
│   ├── errors.py               # Custom exceptions
│   ├── security.py             # JWT, password hashing, crypto
│   ├── rate_limit.py           # Rate limiting middleware
│   ├── metrics.py              # Prometheus metrics
│   └── middleware.py           # Request ID, headers, CORS
│
├── llm_provider/               # LLM provider abstraction
│   ├── factory.py              # Provider factory
│   ├── base.py                 # Base provider interface
│   ├── openai_provider.py
│   ├── anthropic_provider.py
│   ├── google_provider.py
│   ├── groq_provider.py
│   ├── openrouter_provider.py
│   └── ollama_provider.py
│
├── memory/                     # Data persistence layer
│   ├── postgres.py             # PostgreSQL connection and queries
│   ├── redis_client.py         # Redis connection and operations
│   ├── chat_memory.py          # Conversation history management
│   ├── user_memory.py          # User facts and preferences
│   └── migrations/             # Database schema migrations
│
├── rag/                        # Document processing and retrieval
│   ├── ingestion.py            # Parsing and chunking
│   ├── vectorstore.py          # ChromaDB interface
│   ├── embeddings.py           # Embedding generation
│   └── retriever.py            # Similarity search
│
├── schemas/                    # Pydantic models
│   ├── auth.py
│   ├── chat.py
│   ├── code.py
│   ├── gmail.py
│   ├── rag.py
│   └── user.py
│
├── services/                   # Business logic layer
│   ├── auth_service.py
│   ├── gmail_service.py
│   └── user_service.py
│
├── tools/                      # LangChain tool definitions
│   ├── web_search.py           # DuckDuckGo search tool
│   ├── document_search.py      # RAG query tool
│   ├── gmail_tools.py          # Gmail operation tools
│   ├── code_tools.py           # Code generation tools
│   └── factory.py              # Tool factory with user binding
│
├── scripts/                    # Utility scripts
│   ├── assign_legacy_documents.py
│   └── generate_keys.py
│
├── tests/                      # Test suite
│   ├── test_agents.py
│   ├── test_api.py
│   ├── test_auth.py
│   ├── test_isolation.py
│   ├── test_security.py
│   └── test_streaming.py
│
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── components/         # auth, chat, cosmos, documents, gmail, settings
│   │   ├── lib/                # api.ts, auth.ts, streaming.ts
│   │   ├── stores/             # authStore, chatStore, settingsStore
│   │   ├── pages/              # Landing, Dashboard, NotFound
│   │   ├── hooks/              # useAuth, useChat, useLenis
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── public/                 # pluto.png, favicon.ico
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── nginx.conf
│
├── .github/workflows/ci.yml    # CI/CD pipeline
├── app.py                      # FastAPI application entry point
├── requirements.txt            # Production dependencies
├── requirements-dev.txt        # Development dependencies
├── pyproject.toml              # Project config (ruff, pytest)
├── docker-compose.yml          # Multi-container orchestration
├── Dockerfile                  # Backend container image
├── .env.example                # Environment template
├── CHANGELOG.md                # Version history
├── SECURITY.md                 # Security policy
├── start.sh                    # Development start script
├── stop.sh                     # Development stop script
└── status.sh                   # Service status check
```

### Component Notes

**`agents/`**
- `orchestrator.py` is the LangGraph state machine that analyzes queries and routes them to the appropriate agent.
- Each specialized agent owns a single domain: research, documents, code, or email.
- Agents invoke tools through the LangChain framework.

**`api/v1/`**
- One module per domain (auth, chat, rag, and so on).
- Controllers are thin: they validate input and delegate to services.
- OpenAPI documentation is generated automatically.

**`core/`**
- `security.py`: JWT signing, password hashing, and token encryption.
- `logging.py`: structured logs with request correlation.
- `metrics.py`: Prometheus metrics.
- `rate_limit.py`: token-bucket rate limiting per client.

**`llm_provider/`**
- A single interface across six providers.
- Automatic provider detection from available API keys.
- Model-specific parameter handling.

**`memory/`**
- PostgreSQL for structured data (users, facts, audit logs).
- Redis for ephemeral data (chat history, rate limits).
- Schema migrations run automatically on startup.

**`rag/`**
- Ingestion pipeline: parse, chunk, embed, index.
- ChromaDB for vector similarity search.
- Source citations included in responses.

**`tools/`**
- LangChain tools bound to the calling user.
- Per-user isolation enforced at the tool level.

---

## Observability and Monitoring

### Logging

Every request produces a structured log entry:

```json
{
  "timestamp": "2026-10-14T10:30:45.123Z",
  "level": "INFO",
  "request_id": "abc-123-def",
  "user_id": "user_456",
  "method": "POST",
  "path": "/api/v1/chat/stream",
  "status": 200,
  "duration_ms": 1234,
  "ip": "192.168.1.1"
}
```

LLM calls are logged with provider and latency:

```json
{
  "event": "llm_call",
  "provider": "openai",
  "model": "gpt-4",
  "tokens": 450,
  "duration_ms": 890,
  "user_id": "user_456"
}
```

### Metrics

Prometheus metrics are available at `GET /metrics`:

```
# HTTP request metrics
pluto_http_requests_total{method="POST",endpoint="/chat/stream",status="200"} 1234
pluto_http_request_duration_seconds_bucket{method="POST",endpoint="/chat/stream",le="1.0"} 980

# LLM call metrics
pluto_llm_calls_total{provider="openai",model="gpt-4",status="success"} 567
pluto_llm_call_duration_seconds_sum{provider="openai",model="gpt-4"} 456.78

# Document ingestion
pluto_documents_ingested_total{user_id="hashed"} 42
```

### Health Probes

| Probe | Endpoint | Behavior |
|---|---|---|
| Liveness | `GET /api/v1/health` | Returns 200 while the process is running; used by Kubernetes to restart failed pods |
| Readiness | `GET /api/v1/health/ready` | Returns 200 when dependencies are healthy and 503 if PostgreSQL is unreachable (production); used by load balancers |

### Audit Log

Security-sensitive events are written to the `audit_log` table:

| Event | Logged Information |
|---|---|
| Signup | Email, timestamp, IP address |
| Login success or failure | Email, timestamp, IP address, outcome |
| Gmail link or unlink | User ID, timestamp |
| Document upload | User ID, filename, size |
| Document deletion | User ID, document ID |

Example query:

```sql
SELECT * FROM audit_log
WHERE user_id = 'user_456'
ORDER BY timestamp DESC
LIMIT 20;
```

---

## Testing and Quality Assurance

### Running Tests

```bash
# Backend
pytest --cov                 # With coverage report
pytest -v                    # Verbose output
pytest tests/test_auth.py    # Single test file

# Frontend
cd frontend
npm run check                # TypeScript, lint, and build
npm run lint                 # ESLint only
npm run type-check           # TypeScript only
```

### Coverage

The suite contains 93 tests covering:

- **Security:** JWT validation, password hashing, rate limiting, CSRF protection
- **API contracts:** request and response validation for all endpoints
- **User isolation:** documents, chats, and Gmail correctly scoped per user
- **Streaming:** SSE event parsing and error handling
- **Agent behavior:** tool selection and response formatting
- **Error cases:** invalid input, missing authentication, missing resources

### Linting and Formatting

```bash
# Python
ruff check .                 # Lint (includes security rules)
ruff format .                # Format

# Frontend
cd frontend
npm run lint                 # ESLint
npm run format               # Prettier (if configured)
```

### Security Audits

```bash
pip-audit                    # Python dependency vulnerabilities

cd frontend
npm audit                    # Node dependency vulnerabilities
npm audit fix                # Apply automatic fixes
```

### CI/CD Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request:

1. **Lint:** Python (ruff) and TypeScript (ESLint)
2. **Type check:** Python (mypy, if configured) and TypeScript
3. **Test:** pytest with coverage reporting
4. **Security:** pip-audit and npm audit
5. **Build:** Docker images for backend and frontend
6. **Deploy:** configure for your target environment

---

## Security

Pluto treats security as a first-class concern. See [SECURITY.md](SECURITY.md) for the complete security model.

### Authentication and Authorization

- JWT tokens with HMAC-SHA256 signing
- Token expiration and refresh mechanisms
- PBKDF2 password hashing (600,000 iterations) with automatic hash upgrades
- Google OAuth 2.0 integration with server-side token verification
- Per-user data isolation enforced at the query level

### Encryption

- OAuth tokens encrypted at rest (Fernet symmetric encryption)
- HTTPS enforced in production (HSTS)
- Secure cookie flags (HttpOnly, Secure, SameSite)

### Attack Prevention

- CSRF protection on state-changing endpoints
- Rate limiting (per client and per authentication endpoint)
- SQL injection prevention through parameterized queries
- XSS prevention through React escaping and CSP headers
- Strict CORS with no wildcard origins

### Monitoring

- Audit logging for security events
- Request ID correlation across logs
- Failed login attempt tracking

### Security Headers

In production mode, Pluto sets:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'
X-XSS-Protection: 1; mode=block
```

### Reporting Vulnerabilities

To report a security issue responsibly:

1. Do not open a public GitHub issue.
2. Contact the maintainer privately through the [portfolio](https://willx.tech/) or via [GitHub](https://github.com/SheerWill007).
3. Include a description, the potential impact, and steps to reproduce.

Reports will be acknowledged within 48 hours.

---

## Upgrading from v1.x

The following breaking changes apply when upgrading from Pluto 1.x.

### Authentication

- **Session tokens are incompatible.** All users must sign in again.
- **All endpoints require authentication.** Previously public endpoints now require a bearer token.
- **Google sign-in has changed.** It now requires an `access_token`, `id_token`, or authorization `code`, rather than a raw email address.

### Data Model

- **Documents are per-user.** Legacy documents have no owner and must be assigned:

  ```bash
  # Assign legacy documents to a user
  python -m scripts.assign_legacy_documents --owner <user_id>

  # Preview changes first
  python -m scripts.assign_legacy_documents --owner <user_id> --dry-run
  ```

### API

- Error responses now include a `request_id` for log correlation.
- LLM provider failures return `502` (previously `400`).
- Database schema migrations run automatically on startup.

### Environment Variables

- `JWT_SECRET_KEY` is now required in production (minimum 32 characters).
- `TOKEN_ENCRYPTION_KEY` is required for Gmail integration.

See [CHANGELOG.md](CHANGELOG.md) for the complete list of changes.

---

## Development Guide

### Environment Setup

1. **Install dependencies**

   ```bash
   # Backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements-dev.txt

   # Frontend
   cd frontend
   npm ci
   ```

2. **Start databases** (optional for development)

   ```bash
   docker compose up -d postgres redis
   ```

3. **Run migrations** (automatic on startup, or manually)

   ```bash
   python -m alembic upgrade head
   ```

4. **Start services**

   ```bash
   ./start.sh  # or start the backend and frontend separately
   ```

### Code Style

**Python**
- Follow PEP 8.
- Use type hints.
- Maximum line length of 120 characters.
- Use `ruff` for linting and formatting.

**TypeScript and React**
- TypeScript strict mode.
- Functional components with hooks.
- Props interfaces for all components.
- ESLint and Prettier.

### Adding a New Agent

1. Create the agent in `agents/new_agent.py`:

   ```python
   from langchain.agents import AgentExecutor
   from langchain.tools import Tool

   def create_new_agent(llm, user_id: str):
       tools = [...]  # Agent-specific tools
       # Agent implementation
       return agent
   ```

2. Register it in `agents/orchestrator.py`:

   ```python
   from agents.new_agent import create_new_agent

   # Add to the orchestrator's tool selection logic
   ```

3. Add an endpoint in `api/v1/new_feature.py`.
4. Add tests in `tests/test_new_agent.py`.

### Adding a New LLM Provider

1. Create the provider in `llm_provider/new_provider.py`:

   ```python
   from llm_provider.base import BaseLLMProvider

   class NewProvider(BaseLLMProvider):
       def get_model(self, model_name: str, **kwargs):
           # Implementation
           pass
   ```

2. Register it in `llm_provider/factory.py`:

   ```python
   PROVIDERS = {
       ...
       "newprovider": NewProvider,
   }
   ```

3. Add the required environment variables to `.env.example`.
4. Document the provider in the Configuration section of this README.

---

## Additional Resources

- [API Documentation](http://localhost:8000/docs): interactive OpenAPI docs (when running locally)
- [CHANGELOG.md](CHANGELOG.md): version history and breaking changes
- [SECURITY.md](SECURITY.md): security policy and threat model

**Related projects**

- [LangChain](https://github.com/langchain-ai/langchain): LLM framework
- [LangGraph](https://github.com/langchain-ai/langgraph): agent orchestration
- [FastAPI](https://fastapi.tiangolo.com/): web framework
- [ChromaDB](https://www.trychroma.com/): vector database

**Support**

- Bug reports and feature requests: [GitHub Issues](https://github.com/SheerWill007/Pluto/issues)

---

## License

This project is proprietary and confidential. Refer to the internal documentation for licensing terms.

---

## Acknowledgments

- LangChain and LangGraph for agent orchestration
- FastAPI for the Python web framework
- React and Vite for the frontend stack
- PostgreSQL, Redis, and ChromaDB for the data layer
- Anthropic, OpenAI, and Google as LLM providers

---

## Author

**willxtech**

- Portfolio: [willx.tech](https://willx.tech/)
- GitHub: [github.com/SheerWill007](https://github.com/SheerWill007)
- LinkedIn: [linkedin.com/in/willxtech](https://www.linkedin.com/in/willxtech)

---

<p align="center">
  <sub>Pluto | Multi-Agent AI Workspace | 2026 | Built by <a href="https://willx.tech/">willxtech</a></sub>
</p>