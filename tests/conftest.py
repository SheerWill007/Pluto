import os
import tempfile

# Configure the app for tests *before* anything imports config.settings. Environment
# variables take precedence over a developer's local .env file.
os.environ.update({
    "ENVIRONMENT": "test",
    "JWT_SECRET_KEY": "test-secret-key-that-is-long-enough-for-hs256-0123456789",
    "TOKEN_ENCRYPTION_KEY": "",
    "CORS_ORIGINS": "http://localhost:5173",
    "RATE_LIMIT_ENABLED": "true",
    "RATE_LIMIT_PER_MINUTE": "1000",
    "AUTH_RATE_LIMIT_PER_MINUTE": "1000",
    "ALLOW_GUEST_ACCESS": "true",
    "GOOGLE_CLIENT_ID": "test-client-id.apps.googleusercontent.com",
    "LOG_LEVEL": "WARNING",
    "POSTGRES_URL": "postgresql://invalid:invalid@127.0.0.1:1/none",
    "REDIS_URL": "redis://127.0.0.1:1/0",
    # Never write vector data into the project directory during tests
    "CHROMA_PERSIST_DIR": tempfile.mkdtemp(prefix="pluto-test-chroma-"),
})

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(autouse=True)
def no_redis(monkeypatch):
    """Use the in-memory fallbacks instead of waiting on connection timeouts."""
    import api.v1.system
    import core.rate_limit
    import memory.redis_memory
    for module in (core.rate_limit, memory.redis_memory, api.v1.system):
        monkeypatch.setattr(module, "get_redis", lambda: None)
    core.rate_limit.reset_local_counters()
    memory.redis_memory._memory_storage.clear()


@pytest.fixture(autouse=True)
def no_database(monkeypatch):
    """Default: database unreachable. Tests needing users use the `user_repo` fixture."""
    import memory.db
    import memory.postgres_memory
    monkeypatch.setattr(memory.db, "is_available", lambda force=False: False)
    monkeypatch.setattr(memory.postgres_memory, "is_available", lambda force=False: False)


@pytest.fixture
def app():
    from app import app as fastapi_app
    return fastapi_app


@pytest.fixture
def client(app):
    with TestClient(app) as c:
        yield c


@pytest.fixture
def user_token():
    from core.security import create_access_token
    return create_access_token(1, "ada@example.com")


@pytest.fixture
def auth_headers(user_token):
    return {"Authorization": f"Bearer {user_token}"}


@pytest.fixture
def guest_headers():
    from core.security import create_guest_token
    token, _ = create_guest_token()
    return {"Authorization": f"Bearer {token}"}


class FakeUserRepo:
    """In-memory stand-in for the users table."""

    def __init__(self):
        self.users = {}
        self.audit = []
        self.next_id = 1

    def get_user_by_email(self, email):
        for u in self.users.values():
            if u["email"].lower() == email.lower():
                return dict(u)
        return None

    def get_user_by_id(self, user_id):
        u = self.users.get(user_id)
        return {k: v for k, v in u.items() if k != "password_hash"} if u else None

    def create_local_user(self, email, password_hash, name):
        user = {"id": self.next_id, "email": email.lower(), "name": name, "picture": None,
                "auth_provider": "local", "password_hash": password_hash}
        self.users[self.next_id] = user
        self.next_id += 1
        return {k: v for k, v in user.items() if k != "password_hash"}

    def get_or_create_google_user(self, email, name, picture):
        existing = self.get_user_by_email(email)
        if existing:
            existing.update(name=name, picture=picture)
            self.users[existing["id"]].update(name=name, picture=picture)
            return existing
        user = {"id": self.next_id, "email": email, "name": name, "picture": picture,
                "auth_provider": "google", "password_hash": None}
        self.users[self.next_id] = user
        self.next_id += 1
        return dict(user)

    def update_password_hash(self, user_id, password_hash):
        self.users[user_id]["password_hash"] = password_hash

    def touch_last_login(self, user_id):
        pass

    def check_postgres_availability(self):
        return True


@pytest.fixture
def user_repo(monkeypatch):
    import api.v1.auth
    import memory.postgres_memory
    repo = FakeUserRepo()
    for name in ("get_user_by_email", "get_user_by_id", "create_local_user", "get_or_create_google_user",
                 "update_password_hash", "touch_last_login", "check_postgres_availability"):
        monkeypatch.setattr(api.v1.auth.users, name, getattr(repo, name))
    monkeypatch.setattr(memory.postgres_memory, "record_audit_event",
                        lambda action, actor, ip, rid, details=None: repo.audit.append((action, actor)))
    import api.deps
    monkeypatch.setattr(api.deps, "record_audit_event",
                        lambda action, actor, ip, rid, details=None: repo.audit.append((action, actor)))
    return repo
