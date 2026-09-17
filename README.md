# Pluto

Pluto is a robust, multi-agent AI orchestrator designed to streamline complex workflows involving document intelligence (RAG), email triage (Gmail integration), and dynamic code generation. By leveraging a flexible LLM provider abstraction layer, Pluto offers seamless access to industry-leading language models while maintaining a sophisticated, highly-responsive frontend workspace.

## Architecture and Components

The Pluto ecosystem is composed of a FastAPI backend and a React/Vite frontend.

### Backend Services
- **FastAPI Core**: High-performance asynchronous API for orchestrating multi-agent tasks.
- **RAG Engine**: Powered by LangChain and ChromaDB, enabling semantic search and document retrieval over ingested knowledge bases.
- **Agent Integrations**: Built-in integrations for external APIs, including secure Gmail connectivity and automated email summarization.
- **LLM Provider Abstraction**: A standardized interface allowing immediate model switching between OpenAI, Anthropic, Google, and local Ollama instances without codebase modifications.

### Frontend Application
- **React and Vite**: A rapid, modular frontend architecture.
- **Zustand State Management**: Lightweight and resilient state management for real-time agent orchestration.
- **Dynamic Interfaces**: Responsive glassmorphism aesthetics and smooth scroll behavior provided by Lenis.
- **TypeScript**: Ensuring type safety and maintainability across all UI components and hooks.

## System Requirements

- Python 3.9 or higher
- Node.js 18 or higher
- Redis (for session management and caching)
- API Credentials (based on your preferred LLM provider and integrations)

## Getting Started

### 1. Environment Configuration

Copy the sample environment variables and configure them with your credentials.

**Backend Configuration:**
```bash
cp .env.example .env
```
Ensure you configure `APP_NAME=Pluto Agent` and supply your relevant LLM provider API keys.

**Frontend Configuration:**
```bash
cd frontend
cp .env.example .env
```
Ensure `VITE_API_URL` points to your backend instance (default: `http://localhost:8000`).

### 2. Dependency Installation

**Backend:**
```bash
pip install -r requirements.txt
```

**Frontend:**
```bash
cd frontend
npm install
```

### 3. Running the System

Pluto provides shell scripts for managing the application lifecycle locally.

Start all services (Frontend and Backend):
```bash
./start.sh
```

Check the status of running services:
```bash
./status.sh
```

Stop all services safely:
```bash
./stop.sh
```

## Security Guidelines

- **API Keys**: Never commit your `.env` files or hardcode API keys. The system uses a centralized configuration object to securely manage credentials at runtime.
- **Authentication**: Local storage is used minimally. For production deployments, ensure secure cookie transmission and proper OAuth 2.0 configuration for Gmail integration.

## License

This project is proprietary and confidential. Please refer to the internal documentation for licensing terms.
