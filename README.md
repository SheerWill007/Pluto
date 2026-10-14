# 🪐 Pluto - Multi-Agent AI Workspace

<p align="center">
	<img src="frontend/public/pluto.png" alt="Pluto" width="200" />
</p>

<p align="center">
  <strong>An intelligent orchestrator that brings together web search, document intelligence, Gmail triage, and code generation in one unified workspace.</strong>
</p>

<p align="center">
  <a href="#-overview">Overview</a> •
  <a href="#-key-features">Features</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-api-reference">API</a> •
  <a href="#-project-structure">Structure</a>
</p>

---

## 📖 Overview

**Pluto** is a production-ready, multi-agent AI workspace built on **LangGraph** that orchestrates intelligent conversations with streaming responses. It dynamically decides when to invoke specialized tools based on user queries, providing a seamless experience across multiple AI capabilities.

### What Makes Pluto Special?

Pluto isn't just another chatbot—it's a sophisticated multi-agent system that:

- **Thinks Before Acting**: Uses LangGraph to build a dynamic execution graph, deciding which agents and tools to invoke based on context
- **Streams Everything**: Real-time token streaming over Server-Sent Events (SSE) with live topology visualization
- **Brings Your Own Model**: Works with Google Gemini, OpenAI, Anthropic Claude, Groq, OpenRouter, or local Ollama models
- **Maintains Context**: Per-user isolation ensures your conversations, documents, and Gmail data stay private
- **Ships Production-Ready**: Enterprise-grade security, observability, and deployment infrastructure out of the box

### Use Cases

- **Research Assistant**: Search the web, analyze documents, and synthesize information
- **Code Companion**: Generate code with automatic review and quality checks
- **Inbox Manager**: Triage Gmail, summarize threads, and surface action items
- **Knowledge Base**: Query your personal document collection with cited sources

---

## ✨ Key Features

### 🎯 Core Capabilities

#### 1. **Streaming Agent Chat**
- **Real-time Response Generation**: Tokens stream over Server-Sent Events as the model thinks
- **Live Topology Map**: Visual representation of which tools and agents are being invoked
- **Interactive Experience**: See the AI's decision-making process in real-time

#### 2. **Multi-Agent System**
- **Orchestrator**: Central brain that routes requests to specialized agents
- **Web Research Agent**: Live DuckDuckGo search for current information
- **RAG Agent**: Document ingestion and retrieval with source citations
- **Gmail Agent**: Inbox analysis, thread summarization, and spam detection
- **Code Generator**: Context-aware code generation
- **Code Critic**: Automated code review with security and correctness checks

#### 3. **Universal LLM Support**
Work with any major provider through a unified interface:
- **Google Gemini** (gemini-pro, gemini-1.5-pro)
- **OpenAI** (GPT-4, GPT-3.5-turbo)
- **Anthropic** (Claude 3 Opus, Sonnet, Haiku)
- **Groq** (Fast inference with Llama, Mixtral)
- **OpenRouter** (Access to 100+ models)
- **Ollama** (Local models for privacy)

#### 4. **Enterprise-Grade Security**
- ✅ **Verified Google Sign-In** with strict token validation
- ✅ **JWT Authentication** with secure signing and expiration
- ✅ **PBKDF2 Password Hashing** (600,000 iterations) with automatic upgrades
- ✅ **Encrypted OAuth Tokens** at rest using Fernet symmetric encryption
- ✅ **CSRF Protection** on all state-changing operations
- ✅ **Rate Limiting** per-client request budgets
- ✅ **Strict CORS** with no wildcard origins
- ✅ **Security Headers** (HSTS, CSP, X-Frame-Options)
- ✅ **Audit Logging** for all authentication and data events

#### 5. **Per-User Isolation**
- **Private Conversations**: Chat history scoped to authenticated users
- **Personal Document Collections**: RAG vectors tagged by owner
- **Isolated Gmail Access**: OAuth tokens encrypted and user-specific
- **Secure Fact Storage**: Long-term memory isolated per account

#### 6. **Production Observability**
- 📊 **Structured JSON Logging** with request IDs for distributed tracing
- 📈 **Prometheus Metrics** for HTTP requests, LLM calls, and system health
- 🏥 **Health Probes** (liveness and readiness) for Kubernetes/Docker
- 📝 **Audit Trail** for compliance and security monitoring
- ⚡ **Graceful Degradation** when dependencies are unavailable

---

## 🏗️ Architecture

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
| **Entry Point** | `app.py` | App factory, lifespan management (config validation, migrations), middleware stack |
| **HTTP API** | `api/v1/` | Domain-specific routers; thin controllers with validation and authentication |
| **Cross-Cutting** | `core/` | Logging, error handling, security (JWT/passwords), rate limits, metrics, crypto |
| **Agents** | `agents/` | LangGraph orchestrator, specialized agents (RAG, Gmail, code generation/review) |
| **Tools** | `tools/` | Per-request tool factories bound to the calling user for isolation |
| **Data Layer** | `memory/`, `rag/` | PostgreSQL (pooled, migrated), Redis, ChromaDB with abstractions |
| **LLM Abstraction** | `llm_provider/` | Provider-agnostic model construction and configuration |
| **Frontend** | `frontend/src/` | Typed API client, state management (Zustand), UI components |

### Technology Stack

**Backend**
- **Framework**: FastAPI (async Python web framework)
- **Agent Framework**: LangGraph (stateful agent orchestration)
- **LLM Integration**: LangChain (unified LLM interface)
- **Databases**: PostgreSQL (relational), Redis (cache/memory), ChromaDB (vectors)
- **Authentication**: JWT + OAuth 2.0 (Google)
- **API Documentation**: OpenAPI/Swagger (auto-generated)

**Frontend**
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite (fast bundling and HMR)
- **State Management**: Zustand (lightweight state)
- **Styling**: Tailwind CSS + Framer Motion (animations)
- **HTTP Client**: Axios with interceptors
- **Icons**: Lucide React

**Infrastructure**
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose (development) / Kubernetes-ready
- **Reverse Proxy**: nginx (static files + API proxy)
- **CI/CD**: GitHub Actions (lint, test, build, security audit)
- **Monitoring**: Prometheus-compatible metrics

---

## 🚀 Quick Start

### Option 1: Docker (Recommended)

Get up and running in under 2 minutes:

```bash
# 1. Clone the repository
git clone https://github.com/SheerWill007/Pluto.git
cd pluto

# 2. Create environment configuration
cp .env.example .env

# 3. Generate required secrets
# On Linux/Mac:
openssl rand -hex 32  # Use for JWT_SECRET_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # TOKEN_ENCRYPTION_KEY

# On Windows (PowerShell):
# Use the generation commands in .env.example

# 4. Edit .env and set at least:
#    - JWT_SECRET_KEY (32+ chars)
#    - TOKEN_ENCRYPTION_KEY (Fernet key)
#    - POSTGRES_PASSWORD
#    - One LLM provider key (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)

# 5. Start the entire stack
docker compose up --build
```

**Access the application**:
- Frontend: http://localhost:8080
- API Docs: http://localhost:8000/docs
- Metrics: http://localhost:8000/metrics

The stack includes:
- ✅ nginx serving the React SPA
- ✅ FastAPI backend
- ✅ PostgreSQL database
- ✅ Redis cache
- ✅ Persistent data volumes

### Option 2: Local Development

**Requirements**: Python 3.11+, Node 22+, PostgreSQL (optional), Redis (optional)

#### Backend Setup

```bash
# 1. Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements-dev.txt

# 3. Configure environment
cp .env.example .env
# Edit .env with your settings

# 4. Start the API server
python -m uvicorn app:app --reload
```

API will be available at http://localhost:8000

> **Note**: Without PostgreSQL and Redis, the API runs in **degraded mode**:
> - No user accounts or Gmail integration
> - In-memory chat history (lost on restart)
> - Guest sessions still work for testing

#### Frontend Setup

```bash
# 1. Navigate to frontend
cd frontend

# 2. Install dependencies
npm ci  # or npm install

# 3. Configure environment
cp .env.example .env
# Edit .env if needed (usually defaults work)

# 4. Start development server
npm run dev
```

Frontend will be available at http://localhost:5173

#### Quick Start Script

Use the included helper scripts:

```bash
./start.sh   # Start both backend and frontend
./status.sh  # Check service status
./stop.sh    # Stop all services
```

---

## ⚙️ Configuration

All configuration is managed through environment variables. See [`.env.example`](.env.example) for the complete, commented list.

### Essential Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `ENVIRONMENT` | `development` or `production` | Yes | `development` |
| `JWT_SECRET_KEY` | Secret for signing JWT tokens (32+ chars) | Yes in prod | - |
| `TOKEN_ENCRYPTION_KEY` | Fernet key for encrypting OAuth tokens | Yes for Gmail | - |
| `CORS_ORIGINS` | Comma-separated allowed origins | Yes | `http://localhost:5173` |

### LLM Provider Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `LLM_PROVIDER` | Provider name (auto-detected if blank) | `openai`, `anthropic`, `google` |
| `LLM_MODEL` | Model identifier | `gpt-4`, `claude-3-opus-20240229` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `ANTHROPIC_API_KEY` | Anthropic API key | `sk-ant-...` |
| `GOOGLE_API_KEY` | Google AI API key | - |
| `GROQ_API_KEY` | Groq API key | - |
| `OPENROUTER_API_KEY` | OpenRouter API key | - |
| `OLLAMA_BASE_URL` | Ollama server URL | `http://localhost:11434` |

> **User Keys**: Users can provide their own API keys via the UI. These keys are sent per-request and **never stored** server-side.

### Database Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_URL` | PostgreSQL connection string | `postgresql://pluto:password@localhost:5432/pluto` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |

### Security Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID for "Sign in with Google" | - |
| `GMAIL_WEB_CLIENT_ID` | Separate OAuth client for Gmail API access | - |
| `GMAIL_WEB_CLIENT_SECRET` | Gmail OAuth client secret | - |
| `GMAIL_REDIRECT_URI` | OAuth callback URL | `http://localhost:8000/api/v1/gmail/connect` |
| `RATE_LIMIT_PER_MINUTE` | General rate limit | `60` |
| `AUTH_RATE_LIMIT_PER_MINUTE` | Auth endpoint rate limit | `10` |
| `ALLOW_GUEST_ACCESS` | Enable anonymous sessions | `true` |

### Observability Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_FORMAT` | `json` or `text` | `text` |
| `LOG_LEVEL` | `DEBUG`, `INFO`, `WARNING`, `ERROR` | `INFO` |

---

## 📡 API Reference

All endpoints are under `/api/v1`. Errors follow a consistent format:

```json
{
  "detail": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "request_id": "uuid-for-log-correlation"
}
```

### Authentication

All endpoints (except system health checks and auth endpoints) require a JWT token:

```
Authorization: Bearer <token>
```

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/signup` | Create a new account with email/password |
| `POST` | `/auth/login` | Login with email/password |
| `POST` | `/auth/google` | Authenticate with Google OAuth token |
| `POST` | `/auth/guest` | Create temporary anonymous session |
| `GET` | `/auth/me` | Get current user profile |

### System Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/health` | Liveness probe | No |
| `GET` | `/health/ready` | Readiness probe (checks DB) | No |
| `GET` | `/config/llm` | Available LLM providers | No |
| `GET` | `/config/auth` | Auth configuration | No |
| `GET` | `/agents/status` | Agent health status | No |
| `GET` | `/metrics` | Prometheus metrics | No |

### Chat Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/chat` | Send message, get complete response |
| `POST` | `/chat/stream` | Send message, stream response via SSE |
| `DELETE` | `/chat/{session_id}/history` | Clear conversation history |

**Streaming Events** (`/chat/stream`):
- `start`: Agent begins processing
- `token`: Individual token from LLM
- `tool_start`: Agent invokes a tool
- `tool_end`: Tool returns result
- `done`: Complete response with metadata
- `error`: Error occurred during processing

### RAG (Document) Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/rag/ingest` | Upload and index documents |
| `GET` | `/rag/documents` | List user's documents |
| `DELETE` | `/rag/documents/{source}` | Delete specific document |
| `DELETE` | `/rag/documents` | Delete all user documents |
| `POST` | `/rag/query` | Query document collection |

**Supported Formats**: PDF, DOCX, Markdown, CSV, TXT

### Code Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/code/generate` | Generate code from description |
| `POST` | `/code/critic` | Review code for issues |

### Gmail Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/gmail/connect` | OAuth flow to link Gmail |
| `GET` | `/gmail/status` | Check Gmail connection status |
| `POST` | `/gmail/disconnect` | Unlink Gmail account |
| `GET` | `/gmail/list` | List recent emails |
| `GET` | `/gmail/get/{id}` | Get specific email |
| `POST` | `/gmail/summarize` | Summarize inbox or thread |

> **Note**: Gmail features require a registered (non-guest) account and OAuth linking.

---

## 📂 Project Structure

### Complete Directory Tree

```
pluto/
│
├── 📁 agents/                      # Multi-agent system implementation
│   ├── orchestrator.py             # Main LangGraph orchestrator
│   ├── research_agent.py           # Web search agent
│   ├── rag_agent.py                # Document retrieval agent
│   ├── gmail_agent.py              # Email triage agent
│   ├── code_generator.py           # Code generation agent
│   ├── code_critic.py              # Code review agent
│   ├── common.py                   # Shared agent utilities
│   └── __init__.py
│
├── 📁 api/                         # FastAPI HTTP layer
│   ├── deps.py                     # Dependency injection (auth, DB)
│   ├── routes.py                   # Root router aggregator
│   └── 📁 v1/                      # API version 1
│       ├── auth.py                 # Authentication endpoints
│       ├── chat.py                 # Chat and streaming endpoints
│       ├── code.py                 # Code generation endpoints
│       ├── gmail.py                # Gmail integration endpoints
│       ├── rag.py                  # RAG/document endpoints
│       └── system.py               # Health/config endpoints
│
├── 📁 core/                        # Cross-cutting concerns
│   ├── config.py                   # Environment-based configuration
│   ├── logging.py                  # Structured logging setup
│   ├── errors.py                   # Custom exceptions
│   ├── security.py                 # JWT, password hashing, crypto
│   ├── rate_limit.py               # Rate limiting middleware
│   ├── metrics.py                  # Prometheus metrics
│   └── middleware.py               # Request ID, headers, CORS
│
├── 📁 llm_provider/                # LLM provider abstraction
│   ├── factory.py                  # Provider factory
│   ├── openai_provider.py          # OpenAI integration
│   ├── anthropic_provider.py       # Anthropic/Claude integration
│   ├── google_provider.py          # Google Gemini integration
│   ├── groq_provider.py            # Groq integration
│   ├── openrouter_provider.py      # OpenRouter integration
│   ├── ollama_provider.py          # Ollama local models
│   └── base.py                     # Base provider interface
│
├── 📁 memory/                      # Data persistence layer
│   ├── postgres.py                 # PostgreSQL connection and queries
│   ├── redis_client.py             # Redis connection and operations
│   ├── chat_memory.py              # Conversation history management
│   ├── user_memory.py              # User facts/preferences storage
│   └── migrations/                 # Database schema migrations
│
├── 📁 rag/                         # Document processing and retrieval
│   ├── ingestion.py                # Document parsing and chunking
│   ├── vectorstore.py              # ChromaDB interface
│   ├── embeddings.py               # Embedding generation
│   └── retriever.py                # Similarity search

│
├── 📁 schemas/                     # Pydantic models for validation
│   ├── auth.py                     # Auth request/response models
│   ├── chat.py                     # Chat message models
│   ├── code.py                     # Code generation models
│   ├── gmail.py                    # Gmail integration models
│   ├── rag.py                      # Document/RAG models
│   └── user.py                     # User profile models
│
├── 📁 services/                    # Business logic layer
│   ├── auth_service.py             # Authentication logic
│   ├── gmail_service.py            # Gmail API integration
│   └── user_service.py             # User management
│
├── 📁 tools/                       # LangChain tool definitions
│   ├── web_search.py               # DuckDuckGo search tool
│   ├── document_search.py          # RAG query tool
│   ├── gmail_tools.py              # Gmail operation tools
│   ├── code_tools.py               # Code generation tools
│   └── factory.py                  # Tool factory with user binding
│
├── 📁 scripts/                     # Utility scripts
│   ├── assign_legacy_documents.py  # Migration helper
│   └── generate_keys.py            # Key generation utility
│
├── 📁 tests/                       # Test suite
│   ├── test_agents.py              # Agent behavior tests
│   ├── test_api.py                 # API endpoint tests
│   ├── test_auth.py                # Authentication tests
│   ├── test_isolation.py           # User isolation tests
│   ├── test_security.py            # Security tests
│   └── test_streaming.py           # SSE streaming tests
│
├── 📁 frontend/                    # React SPA
│   │
│   ├── 📁 src/
│   │   ├── 📁 components/          # React components
│   │   │   ├── 📁 auth/            # Auth UI (login, signup)
│   │   │   ├── 📁 chat/            # Chat interface
│   │   │   ├── 📁 cosmos/          # 3D visualizations
│   │   │   ├── 📁 documents/       # Document management
│   │   │   ├── 📁 gmail/           # Gmail interface
│   │   │   └── 📁 settings/        # Settings panels
│   │   │
│   │   ├── 📁 lib/                 # Utilities and clients
│   │   │   ├── api.ts              # Typed API client
│   │   │   ├── auth.ts             # Auth helpers
│   │   │   └── streaming.ts        # SSE handler
│   │   │
│   │   ├── 📁 stores/              # Zustand state management
│   │   │   ├── authStore.ts        # Auth state
│   │   │   ├── chatStore.ts        # Chat state
│   │   │   └── settingsStore.ts    # App settings
│   │   │
│   │   ├── 📁 pages/               # Page components
│   │   │   ├── Landing.tsx         # Landing page
│   │   │   ├── Dashboard.tsx       # Main app dashboard
│   │   │   └── NotFound.tsx        # 404 page
│   │   │
│   │   ├── 📁 hooks/               # Custom React hooks
│   │   │   ├── useAuth.ts          # Authentication hook
│   │   │   ├── useChat.ts          # Chat logic hook
│   │   │   └── useLenis.ts         # Smooth scrolling
│   │   │
│   │   ├── App.tsx                 # Root component
│   │   ├── main.tsx                # Entry point
│   │   └── index.css               # Global styles
│   │
│   ├── 📁 public/                  # Static assets
│   │   ├── pluto.png               # Logo
│   │   └── favicon.ico             # Favicon
│   │
│   ├── index.html                  # HTML template
│   ├── package.json                # Node dependencies
│   ├── vite.config.ts              # Vite configuration
│   ├── tailwind.config.js          # Tailwind CSS config
│   ├── tsconfig.json               # TypeScript config
│   ├── Dockerfile                  # Frontend container
│   └── nginx.conf                  # nginx configuration
│
├── 📁 .github/                     # GitHub configuration
│   └── 📁 workflows/
│       └── ci.yml                  # CI/CD pipeline
│
├── app.py                          # FastAPI application entry
├── requirements.txt                # Python production dependencies
├── requirements-dev.txt            # Python development dependencies
├── pyproject.toml                  # Python project config (ruff, pytest)
├── docker-compose.yml              # Multi-container orchestration
├── Dockerfile                      # Backend container image
├── .env.example                    # Environment template
├── .gitignore                      # Git ignore rules
├── README.md                       # This file
├── CHANGELOG.md                    # Version history
├── SECURITY.md                     # Security policy
├── start.sh                        # Development start script
├── stop.sh                         # Development stop script
└── status.sh                       # Service status check
```

### Key Components Explained

#### Backend Structure

**`agents/`** - The brain of Pluto
- **orchestrator.py**: LangGraph state machine that analyzes user queries and routes to appropriate agents
- **Specialized agents**: Each agent is an expert in its domain (research, documents, code, email)
- **Tool integration**: Agents invoke tools through the LangChain framework

**`api/v1/`** - RESTful HTTP interface
- Each file handles one domain (auth, chat, rag, etc.)
- Thin controllers that validate input and call services
- Automatic OpenAPI documentation generation

**`core/`** - Cross-cutting infrastructure
- **security.py**: JWT signing, password hashing, token encryption
- **logging.py**: Structured logs with request correlation
- **metrics.py**: Prometheus metrics for observability
- **rate_limit.py**: Token bucket rate limiting per client

**`llm_provider/`** - Multi-provider LLM abstraction
- Unified interface across 6+ LLM providers
- Automatic provider detection from API keys
- Model-specific parameter handling

**`memory/`** - Data persistence
- PostgreSQL for structured data (users, facts, audit logs)
- Redis for ephemeral data (chat history, rate limits)
- Automatic schema migrations on startup

**`rag/`** - Document intelligence
- Ingestion pipeline: parse → chunk → embed → index
- ChromaDB for vector similarity search
- Source citation in responses

**`tools/`** - Agent capabilities
- LangChain tools bound to the calling user
- Enforces per-user isolation at the tool level
- Web search, document query, Gmail access, code generation

#### Frontend Structure

**`components/`** - Reusable UI components
- **auth/**: Login, signup, Google OAuth
- **chat/**: Message bubbles, streaming indicators, tool activity
- **cosmos/**: 3D vortex visualization, animated backgrounds
- **documents/**: File upload, document list, search
- **gmail/**: Inbox list, email viewer, summarization

**`lib/`** - Utilities and API client
- **api.ts**: Type-safe API client with error handling
- **streaming.ts**: SSE connection management
- **auth.ts**: Token storage and refresh logic

**`stores/`** - Zustand state management
- **authStore**: User session, permissions
- **chatStore**: Messages, streaming state, tool activity
- **settingsStore**: LLM provider selection, theme

**`pages/`** - Route components
- **Landing.tsx**: Marketing page with animated sections
- **Dashboard.tsx**: Main application interface

---

## 🔍 Observability & Monitoring

### Logging

Every request generates a structured log entry:

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

**Agent actions** are logged with provider and latency:

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

### Metrics (Prometheus)

Available at `GET /metrics`:

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

**Liveness** (`GET /api/v1/health`):
- Returns 200 if the process is running
- Used by Kubernetes to restart crashed pods

**Readiness** (`GET /api/v1/health/ready`):
- Returns 200 if dependencies are healthy
- Returns 503 if PostgreSQL is unreachable (in production)
- Used by load balancers to route traffic

### Audit Log

Security-sensitive events are written to the `audit_log` table:

| Event | Logged Information |
|-------|-------------------|
| Signup | Email, timestamp, IP address |
| Login success/failure | Email, timestamp, IP, success |
| Gmail link/unlink | User ID, timestamp |
| Document upload | User ID, filename, size |
| Document deletion | User ID, document ID |

Query the audit log:
```sql
SELECT * FROM audit_log 
WHERE user_id = 'user_456' 
ORDER BY timestamp DESC 
LIMIT 20;
```

---

## 🧪 Testing & Quality Assurance

### Test Suite

Run the complete test suite:

```bash
# Backend tests
pytest --cov                 # With coverage report
pytest -v                    # Verbose output
pytest tests/test_auth.py    # Specific test file

# Frontend tests
cd frontend
npm run check                # TypeScript + lint + build
npm run lint                 # ESLint only
npm run type-check           # TypeScript only
```

### Test Coverage

**93 tests** covering:
- ✅ **Security**: JWT validation, password hashing, rate limiting, CSRF protection
- ✅ **API contracts**: Request/response validation for all endpoints
- ✅ **User isolation**: Documents, chats, and Gmail scoped correctly
- ✅ **Streaming**: SSE event parsing and error handling
- ✅ **Agent behavior**: Tool selection, response formatting
- ✅ **Error cases**: Invalid input, missing auth, resource not found

### Linting & Formatting

```bash
# Python
ruff check .                 # Lint (includes security rules)
ruff format .                # Format code

# Frontend
cd frontend
npm run lint                 # ESLint
npm run format               # Prettier (if configured)
```

### Security Audits

```bash
# Python dependency vulnerabilities
pip-audit

# Node dependency vulnerabilities  
cd frontend
npm audit

# Fix auto-fixable issues
npm audit fix
```

### CI/CD Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and PR:

1. **Lint**: Python (ruff) and TypeScript (ESLint)
2. **Type check**: Python (mypy if configured) and TypeScript
3. **Test**: pytest with coverage report
4. **Security**: pip-audit and npm audit
5. **Build**: Docker images for backend and frontend
6. **Deploy**: (Configure for your environment)

---

## 🔐 Security

Pluto is built with security as a first-class concern. See [SECURITY.md](SECURITY.md) for the complete security model.

### Security Features

#### Authentication & Authorization
- ✅ JWT tokens with secure signing (HMAC-SHA256)
- ✅ Token expiration and refresh mechanisms
- ✅ PBKDF2 password hashing (600,000 iterations)
- ✅ Automatic password hash upgrades
- ✅ Google OAuth 2.0 integration with token verification
- ✅ Per-user data isolation enforced at the query level

#### Encryption
- ✅ OAuth tokens encrypted at rest (Fernet symmetric encryption)
- ✅ HTTPS enforced in production (HSTS headers)
- ✅ Secure cookie flags (HttpOnly, Secure, SameSite)

#### Attack Prevention
- ✅ CSRF protection on state-changing endpoints
- ✅ Rate limiting (per-client and per-auth)
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS prevention (React escaping + CSP headers)
- ✅ Strict CORS (no wildcard origins)

#### Observability
- ✅ Audit logging for security events
- ✅ Request ID correlation across logs
- ✅ Failed login attempt tracking

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

Found a security issue? Please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email: [Your security contact email]
3. Include: Description, impact, reproduction steps
4. We'll acknowledge within 48 hours

---

## 🔄 Upgrading from v1.x

If you're upgrading from Pluto 1.x, please note these breaking changes:

### Authentication Changes
- ⚠️ **Session tokens are incompatible**: All users must sign in again
- ⚠️ **All endpoints require authentication**: Previously public endpoints now need a bearer token
- ⚠️ **Google sign-in changed**: Now requires `access_token`, `id_token`, or auth `code` (not raw email)

### Data Model Changes
- ⚠️ **Documents are per-user**: Legacy documents have no owner
  ```bash
  # Assign legacy documents to a user
  python -m scripts.assign_legacy_documents --owner <user_id>
  
  # Preview changes first
  python -m scripts.assign_legacy_documents --owner <user_id> --dry-run
  ```

### API Changes
- ✅ Error responses now include `request_id` for log correlation
- ✅ LLM provider failures return `502` (was `400`)
- ✅ Database schema migrations run automatically on startup

### Environment Variables
- ⚠️ `JWT_SECRET_KEY` is now required in production (≥32 chars)
- ⚠️ `TOKEN_ENCRYPTION_KEY` required for Gmail integration

See [CHANGELOG.md](CHANGELOG.md) for the complete changelog.

---

## 🛠️ Development Guide

### Setting Up Your Environment

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

3. **Run migrations**
   ```bash
   # Automatic on app startup, or manually:
   python -m alembic upgrade head
   ```

4. **Start services**
   ```bash
   ./start.sh  # or start backend/frontend separately
   ```

### Code Style

**Python**
- Follow PEP 8
- Use type hints
- Max line length: 120 characters
- Use `ruff` for linting and formatting

**TypeScript/React**
- Use TypeScript strict mode
- Functional components with hooks
- Props interfaces for all components
- Use ESLint and Prettier

### Adding a New Agent

1. Create agent in `agents/new_agent.py`:
   ```python
   from langchain.agents import AgentExecutor
   from langchain.tools import Tool
   
   def create_new_agent(llm, user_id: str):
       tools = [...]  # Your tools
       # Agent implementation
       return agent
   ```

2. Register in `agents/orchestrator.py`:
   ```python
   from agents.new_agent import create_new_agent
   
   # Add to orchestrator's tool selection logic
   ```

3. Add endpoint in `api/v1/new_feature.py`

4. Add tests in `tests/test_new_agent.py`

### Adding a New LLM Provider

1. Create provider in `llm_provider/new_provider.py`:
   ```python
   from llm_provider.base import BaseLLMProvider
   
   class NewProvider(BaseLLMProvider):
       def get_model(self, model_name: str, **kwargs):
           # Implementation
           pass
   ```

2. Register in `llm_provider/factory.py`:
   ```python
   PROVIDERS = {
       ...
       "newprovider": NewProvider,
   }
   ```

3. Add environment variables to `.env.example`

4. Document in README configuration section

---

## 📚 Additional Resources

### Documentation
- [API Documentation](http://localhost:8000/docs) - Interactive OpenAPI docs
- [CHANGELOG.md](CHANGELOG.md) - Version history and breaking changes
- [SECURITY.md](SECURITY.md) - Security policy and threat model

### Related Projects
- [LangChain](https://github.com/langchain-ai/langchain) - LLM framework
- [LangGraph](https://github.com/langchain-ai/langgraph) - Agent orchestration
- [FastAPI](https://fastapi.tiangolo.com/) - Web framework
- [ChromaDB](https://www.trychroma.com/) - Vector database

### Community & Support
- **GitHub Issues**: Bug reports and feature requests
- **Discussions**: Questions and community help
- **Discord**: [Link if available]

---

## 📄 License

This project is proprietary and confidential. Please refer to the internal documentation for licensing terms.

---

## 🙏 Acknowledgments

Built with:
- **LangChain & LangGraph** - Agent orchestration
- **FastAPI** - High-performance Python web framework
- **React & Vite** - Modern frontend stack
- **PostgreSQL, Redis, ChromaDB** - Robust data layer
- **Anthropic, OpenAI, Google** - LLM providers

---

## 📬 Contact

**Developer**: [willxtech](https://willx.tech)

**Links**:
- 🌐 Portfolio: [willx.tech](https://willx.tech/)
- 💼 LinkedIn: [linkedin.com/in/willxtech](https://www.linkedin.com/in/willxtech)
- 🐙 GitHub: [github.com/SheerWill007](https://github.com/SheerWill007)

---

<p align="center">
  <strong>Made with ❤️ by willxtech</strong>
</p>

<p align="center">
  <sub>Pluto • Multi-Agent AI Workspace • 2026</sub>
</p>
