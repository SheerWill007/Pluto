# Contributing to Pluto

Thank you for your interest in contributing to Pluto, a multi-agent AI workspace built on LangGraph, FastAPI, and React. Contributions of all kinds are welcome, from bug reports to new agents and LLM providers.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Reporting Bugs](#reporting-bugs)
- [Reporting Security Vulnerabilities](#reporting-security-vulnerabilities)
- [Suggesting Features](#suggesting-features)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing Requirements](#testing-requirements)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Extending Pluto](#extending-pluto)
- [License and Contributor Agreement](#license-and-contributor-agreement)
- [Questions](#questions)

## Code of Conduct

By participating in this project, you agree to maintain a respectful, professional, and inclusive environment for all contributors. Constructive feedback is encouraged; harassment and personal attacks are not tolerated.

## Ways to Contribute

- Report bugs and issues
- Suggest new features or enhancements
- Improve documentation
- Submit bug fixes
- Implement new features, agents, tools, or LLM providers
- Add or improve tests
- Review pull requests

## Reporting Bugs

Before creating a bug report, search the existing [issues](https://github.com/SheerWill007/Pluto/issues) to avoid duplicates.

A good bug report includes:

- A clear and descriptive title
- Detailed steps to reproduce the issue
- Expected behavior compared with actual behavior
- Screenshots, where applicable
- Environment details: operating system, browser, Python version, Node.js version, and whether you are running via Docker or locally
- The LLM provider and model in use, if the issue involves agent behavior
- Relevant error messages or logs, including the `request_id` from the error response, which allows the request to be correlated with server logs

Do not include API keys, tokens, or other credentials in an issue.

## Reporting Security Vulnerabilities

Do not report security vulnerabilities through public issues. See [SECURITY.md](SECURITY.md) for the security policy, or contact the maintainer privately through [GitHub](https://github.com/SheerWill007) or the [portfolio](https://willx.tech/). Include a description, the potential impact, and steps to reproduce. Reports are acknowledged within 48 hours.

## Suggesting Features

Feature suggestions are welcome. When proposing a new feature:

- Use a clear and descriptive title
- Describe the proposed feature in detail
- Explain the problem it solves and who benefits
- Describe how it fits the existing architecture (for example, a new agent, tool, or API endpoint)
- Include relevant examples, API sketches, or mockups

For larger changes, open an issue to discuss the approach before writing code. This avoids duplicated effort and helps keep the design coherent.

## Development Setup

### Prerequisites

- Python 3.11 or later
- Node.js 22 or later and npm
- Git
- Docker and Docker Compose (optional, for PostgreSQL and Redis)

PostgreSQL and Redis are optional for development. Without them the API runs in degraded mode, with in-memory chat history, guest sessions only, and no Gmail integration.

### Getting the Code

```bash
git clone https://github.com/SheerWill007/Pluto.git
cd Pluto
cp .env.example .env
```

Edit `.env` and set at minimum one LLM provider key. For local runs that use authentication or Gmail, also set `JWT_SECRET_KEY` and `TOKEN_ENCRYPTION_KEY`. Generation commands are documented in `.env.example`.

### Backend Setup

```bash
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Unix/macOS:
source .venv/bin/activate

pip install -r requirements-dev.txt

python -m uvicorn app:app --reload
```

The API is available at `http://localhost:8000`, with interactive documentation at `http://localhost:8000/docs`.

### Frontend Setup

```bash
cd frontend
cp .env.example .env
npm ci
npm run dev
```

The frontend is available at `http://localhost:5173`.

### Optional Services

To run PostgreSQL and Redis locally:

```bash
docker compose up -d postgres redis
```

Database migrations run automatically on application startup. To run them manually:

```bash
python -m alembic upgrade head
```

### Helper Scripts

```bash
./start.sh   # Start backend and frontend
./status.sh  # Check service status
./stop.sh    # Stop all services
```

### Running Tests

#### Backend

```bash
pytest                        # Run the full suite
pytest --cov                  # With a coverage report
pytest -v                     # Verbose output
pytest tests/test_auth.py     # A single file
```

#### Frontend

```bash
cd frontend
npm run check                 # TypeScript, lint, and build
npm run lint                  # ESLint only
npm run type-check            # TypeScript only
```

## Pull Request Process

1. **Fork the repository** and create a branch from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**, following the code style guidelines below.

3. **Add tests** for any new functionality or bug fix.

4. **Update documentation** as needed, including the README, `.env.example`, and `CHANGELOG.md` for user-visible changes.

5. **Run the quality checks** and confirm they pass:

   ```bash
   # Backend
   ruff check .
   ruff format .
   pytest --cov

   # Frontend
   cd frontend && npm run check
   ```

6. **Check dependencies** if you added or upgraded any:

   ```bash
   pip-audit
   cd frontend && npm audit
   ```

7. **Commit your changes** using clear, descriptive messages that follow the [commit guidelines](#commit-message-guidelines):

   ```bash
   git commit -m "feat: add feature description"
   ```

8. **Push to your fork**:

   ```bash
   git push origin feature/your-feature-name
   ```

9. **Open a pull request** that includes:
   - A clear title and description
   - References to any related issues
   - Screenshots or recordings for UI changes
   - A summary of the changes and any migration or configuration impact
   - Notes on breaking changes, if any

10. **Wait for review.** Maintainers will review the pull request and may request changes.

11. **Address feedback** by pushing additional commits to the same branch.

The CI pipeline (`.github/workflows/ci.yml`) runs linting, type checks, tests, security audits, and Docker builds on every push and pull request. A pull request is ready to merge only when all checks pass.

## Code Style Guidelines

### Backend (Python)

- Follow PEP 8
- Use type hints for function signatures
- Write docstrings for public functions and classes
- Keep lines to a maximum of 120 characters
- Use `ruff` for linting and formatting; the configuration lives in `pyproject.toml`
- Keep API controllers thin: validate input, then delegate to services
- Use parameterized queries for all database access
- Use the structured logger from `core/logging.py` rather than `print`

### Frontend (TypeScript and React)

- Use TypeScript in strict mode
- Use functional components and hooks
- Define a props interface for every component
- Keep API access in the typed client under `frontend/src/lib/`
- Keep shared state in the Zustand stores under `frontend/src/stores/`
- Use ESLint and Prettier
- Use meaningful names for variables, functions, and components

### General Guidelines

- Write clean, readable, and maintainable code
- Keep functions small and focused on a single responsibility
- Avoid deep nesting
- Comment complex logic rather than obvious code
- Remove commented-out code and debug statements before submitting
- Never commit secrets, API keys, or `.env` files

### Security and Isolation Requirements

Pluto enforces per-user isolation, and contributions must preserve it:

- Tools must be created through the per-request factories in `tools/factory.py` and bound to the calling user.
- Queries that return user data (documents, chats, Gmail, stored facts) must be scoped to the authenticated user.
- State-changing endpoints must retain authentication, CSRF protection, and rate limiting.
- Security-relevant events should be written to the audit log.
- User-supplied LLM API keys must never be persisted or logged.
- OAuth tokens must remain encrypted at rest.

Changes that touch authentication, encryption, or isolation require tests in `tests/test_security.py` or `tests/test_isolation.py`, as appropriate.

## Testing Requirements

All contributions should include appropriate tests. The existing suite covers security, API contracts, user isolation, streaming, and agent behavior.

### Backend Testing

- Unit tests for business logic and services
- API endpoint tests, including authentication and error cases
- Isolation tests for any feature that stores or returns user data
- Streaming tests for changes to SSE events
- Agent tests for new routing or tool-selection behavior

LLM calls must be mocked in tests so the suite does not depend on external providers or API keys.

### Frontend Testing

- Unit tests for utility functions and stores
- Component tests for React components
- Integration tests for API and streaming interactions

### Test Coverage

- Aim for at least 70% coverage on new code
- Critical paths, such as authentication, encryption, and isolation, should have 90% or higher coverage
- Every bug fix should include a regression test that would have caught the bug

## Commit Message Guidelines

Use the Conventional Commits format:

- `feat: ` for a new feature
- `fix: ` for a bug fix
- `docs: ` for documentation changes
- `style: ` for formatting and other non-functional style changes
- `refactor: ` for code refactoring
- `test: ` for adding or updating tests
- `chore: ` for maintenance tasks

Write the subject line in the imperative mood and keep it under 72 characters. Use the body to explain what changed and why when the change is not obvious. Optional scopes are encouraged, for example `feat(rag): support Markdown tables` or `fix(auth): reject expired tokens`.

## Extending Pluto

Pluto is designed to be extended. The README's Development Guide contains the full procedures; a summary follows.

### Adding a New Agent

1. Create the agent in `agents/new_agent.py`.
2. Register it in `agents/orchestrator.py` so the orchestrator can route to it.
3. Add an endpoint in `api/v1/` if the agent needs direct API access.
4. Add tests in `tests/test_new_agent.py`.
5. Update the documentation.

### Adding a New LLM Provider

1. Create the provider in `llm_provider/new_provider.py`, extending `BaseLLMProvider`.
2. Register it in `llm_provider/factory.py`.
3. Add the required environment variables to `.env.example`.
4. Document the provider in the README configuration section.

### Adding a New Tool

1. Define the tool in `tools/`.
2. Expose it through `tools/factory.py` so it is bound to the calling user.
3. Add isolation tests confirming that one user cannot access another user's data through the tool.

## License and Contributor Agreement

Pluto is proprietary software. By submitting a contribution, you agree that it may be used, modified, and distributed as part of the project under the license terms that govern it.

You also confirm that:

- You have the right to submit the contribution
- The contribution is your original work, or you have permission to submit it
- The contribution does not include code or data that would conflict with the project's license or any third-party license

## Questions

If you have questions about contributing, you can:

- Open an issue with the `question` label on [GitHub Issues](https://github.com/SheerWill007/Pluto/issues)
- Contact the maintainer through [GitHub](https://github.com/SheerWill007) or the [portfolio](https://willx.tech/)

Thank you for helping improve Pluto.