"""
Symmetric encryption for secrets stored at rest (e.g. Gmail OAuth refresh tokens).

Values are stored as "enc:v1:<fernet token>". Rows written before encryption was
enabled are plain strings and are still readable, so the change is backward compatible.
"""

import logging
from functools import lru_cache
from typing import Optional

from config.settings import settings

logger = logging.getLogger(__name__)

_PREFIX = "enc:v1:"


@lru_cache(maxsize=1)
def _fernet():
    if not settings.TOKEN_ENCRYPTION_KEY:
        return None
    from cryptography.fernet import Fernet
    return Fernet(settings.TOKEN_ENCRYPTION_KEY.encode())


def encrypt_secret(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    f = _fernet()
    if f is None:
        return value
    return _PREFIX + f.encrypt(value.encode()).decode()


def decrypt_secret(value: Optional[str]) -> Optional[str]:
    if value is None or not value.startswith(_PREFIX):
        return value
    f = _fernet()
    if f is None:
        raise RuntimeError("Encrypted secret found but TOKEN_ENCRYPTION_KEY is not configured.")
    return f.decrypt(value[len(_PREFIX):].encode()).decode()
