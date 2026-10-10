import hashlib
import os
from datetime import timedelta

import pytest

from core import security
from core.errors import AuthError


def _legacy_hash(password: str) -> str:
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
    return f"{salt.hex()}:{key.hex()}"


class TestPasswords:
    def test_round_trip(self):
        h = security.hash_password("correct horse 1", iterations=1000)
        assert security.verify_password(h, "correct horse 1")
        assert not security.verify_password(h, "wrong horse 1")

    def test_hash_is_salted(self):
        assert security.hash_password("same1", iterations=1000) != security.hash_password("same1", iterations=1000)

    def test_legacy_format_still_verifies_and_needs_rehash(self):
        legacy = _legacy_hash("hunter22")
        assert security.verify_password(legacy, "hunter22")
        assert not security.verify_password(legacy, "hunter23")
        assert security.password_needs_rehash(legacy)

    def test_current_format_does_not_need_rehash(self):
        assert not security.password_needs_rehash(security.hash_password("pw123456"))

    def test_weaker_iteration_count_needs_rehash(self):
        assert security.password_needs_rehash(security.hash_password("pw123456", iterations=1000))

    @pytest.mark.parametrize("garbage", ["", "nocolon", "zz:zz", "pbkdf2_sha256$x$y$z", None])
    def test_malformed_hash_never_verifies(self, garbage):
        assert not security.verify_password(garbage, "anything")


class TestTokens:
    def test_access_token_round_trip(self):
        user = security.decode_access_token(security.create_access_token(42, "a@b.co"))
        assert user.id == "42" and user.db_id == 42 and user.email == "a@b.co" and not user.is_guest

    def test_guest_token(self):
        token, guest_id = security.create_guest_token()
        user = security.decode_access_token(token)
        assert user.is_guest and user.id == guest_id and user.db_id is None

    def test_expired_token_rejected(self):
        token = security._encode({"sub": "1", "typ": "access"}, timedelta(seconds=-10))
        with pytest.raises(AuthError) as exc:
            security.decode_access_token(token)
        assert exc.value.code == "token_expired"

    def test_tampered_token_rejected(self):
        token = security.create_access_token(1, "a@b.co")
        head, payload, sig = token.split(".")
        with pytest.raises(AuthError):
            security.decode_access_token(f"{head}.{payload}.{sig[::-1]}")

    def test_token_signed_with_other_secret_rejected(self):
        import jwt
        forged = jwt.encode({"sub": "1", "typ": "access", "iss": "pluto-agent", "aud": "pluto-agent-api",
                             "exp": 9999999999, "iat": 0}, "attacker-secret-attacker-secret-0000", algorithm="HS256")
        with pytest.raises(AuthError):
            security.decode_access_token(forged)

    def test_oauth_state_cannot_be_used_as_access_token(self):
        with pytest.raises(AuthError):
            security.decode_access_token(security.create_oauth_state(7))

    def test_oauth_state_round_trip(self):
        assert security.verify_oauth_state(security.create_oauth_state(7)) == 7

    def test_access_token_cannot_be_used_as_oauth_state(self):
        with pytest.raises(AuthError):
            security.verify_oauth_state(security.create_access_token(7, "a@b.co"))
