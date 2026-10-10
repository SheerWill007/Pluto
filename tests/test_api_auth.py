import pytest

from core.security import decode_access_token, hash_password

SIGNUP = {"email": "Ada@Example.com", "password": "analytical1", "name": "Ada"}


def test_signup_creates_account_and_returns_token(client, user_repo):
    r = client.post("/api/v1/auth/signup", json=SIGNUP)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["email"] == "ada@example.com"  # normalized
    assert decode_access_token(body["token"]).id == body["id"]
    assert ("auth.signup", body["id"]) in user_repo.audit


def test_signup_duplicate_email_conflicts(client, user_repo):
    client.post("/api/v1/auth/signup", json=SIGNUP)
    r = client.post("/api/v1/auth/signup", json={**SIGNUP, "email": "ADA@example.com"})
    assert r.status_code == 409 and r.json()["code"] == "email_taken"


@pytest.mark.parametrize("password", ["short1", "nodigitshere", "12345678"])
def test_signup_rejects_weak_passwords(client, user_repo, password):
    r = client.post("/api/v1/auth/signup", json={**SIGNUP, "password": password})
    assert r.status_code == 422 and r.json()["code"] == "validation_error"


def test_signup_rejects_invalid_email(client, user_repo):
    r = client.post("/api/v1/auth/signup", json={**SIGNUP, "email": "not-an-email"})
    assert r.status_code == 422


def test_login_success_and_failure(client, user_repo):
    client.post("/api/v1/auth/signup", json=SIGNUP)
    ok = client.post("/api/v1/auth/login", json={"email": "ada@example.com", "password": "analytical1"})
    assert ok.status_code == 200 and ok.json()["token"]

    bad = client.post("/api/v1/auth/login", json={"email": "ada@example.com", "password": "wrong-pass1"})
    unknown = client.post("/api/v1/auth/login", json={"email": "nobody@example.com", "password": "whatever1"})
    # Same response for wrong password and unknown account: no user enumeration
    assert bad.status_code == unknown.status_code == 401
    assert bad.json()["detail"] == unknown.json()["detail"]
    assert ("auth.login_failed", "ada@example.com") in user_repo.audit


def test_login_upgrades_legacy_password_hash(client, user_repo):
    import hashlib
    import os
    salt = os.urandom(16)
    legacy = f"{salt.hex()}:{hashlib.pbkdf2_hmac('sha256', b'oldpass99', salt, 100_000).hex()}"
    user_repo.create_local_user("old@example.com", legacy, "Old")

    r = client.post("/api/v1/auth/login", json={"email": "old@example.com", "password": "oldpass99"})
    assert r.status_code == 200
    assert user_repo.users[1]["password_hash"].startswith("pbkdf2_sha256$")


def test_auth_unavailable_without_database(client):
    r = client.post("/api/v1/auth/login", json={"email": "a@example.com", "password": "whatever1"})
    assert r.status_code == 503 and r.json()["code"] == "service_unavailable"


def test_guest_login_and_me(client):
    r = client.post("/api/v1/auth/guest")
    assert r.status_code == 200
    token = r.json()["token"]
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["auth_provider"] == "guest"


def test_guest_login_can_be_disabled(client, monkeypatch):
    from config.settings import settings
    monkeypatch.setattr(settings, "ALLOW_GUEST_ACCESS", False)
    assert client.post("/api/v1/auth/guest").status_code == 403


class TestGoogle:
    def _patch_verify(self, monkeypatch, email="grace@example.com"):
        import api.v1.auth
        from services.google_auth import GoogleIdentity
        calls = []

        def fake_verify(**kwargs):
            calls.append(kwargs)
            return GoogleIdentity(email=email, name="Grace", picture=None)

        monkeypatch.setattr(api.v1.auth, "verify_google_login", fake_verify)
        return calls

    def test_identity_comes_from_verified_token_not_request_body(self, client, user_repo, monkeypatch):
        calls = self._patch_verify(monkeypatch)
        r = client.post("/api/v1/auth/google", json={"access_token": "ya29.token", "email": "attacker@evil.io"})
        assert r.status_code == 200
        assert r.json()["email"] == "grace@example.com"
        assert calls[0]["access_token"] == "ya29.token"

    def test_request_without_token_is_rejected(self, client, user_repo):
        # The old API accepted {"email": ...} and issued a token for it
        r = client.post("/api/v1/auth/google", json={"email": "victim@example.com", "name": "x"})
        assert r.status_code == 422

    def test_does_not_merge_into_password_account(self, client, user_repo, monkeypatch):
        user_repo.create_local_user("grace@example.com", hash_password("pw123456", iterations=1000), "G")
        self._patch_verify(monkeypatch)
        r = client.post("/api/v1/auth/google", json={"access_token": "ya29.token"})
        assert r.status_code == 409

    def test_audience_mismatch_rejected(self, monkeypatch):
        from core.errors import AuthError
        from services import google_auth
        with pytest.raises(AuthError):
            google_auth._check_audience("some-other-app.apps.googleusercontent.com")


def test_auth_endpoints_are_rate_limited(client, user_repo, monkeypatch):
    from config.settings import settings
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_PER_MINUTE", 3)
    codes = [client.post("/api/v1/auth/login", json={"email": "a@example.com", "password": "x1234567"}).status_code
             for _ in range(5)]
    assert codes[:3] == [401, 401, 401]
    assert codes[3] == 429
    r = client.post("/api/v1/auth/login", json={"email": "a@example.com", "password": "x1234567"})
    assert int(r.headers["retry-after"]) > 0
