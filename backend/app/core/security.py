from datetime import datetime, timedelta
from typing import Any, Union
import hashlib
import os
import bcrypt
import jwt
from cryptography.fernet import Fernet

ALGORITHM = "HS256"
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "CHANGE_THIS_TO_A_SECURE_SECRET_KEY")
INTERNAL_INGEST_TOKEN_PREFIX = "intk_"

# ---------------------------------------------------------------------------
# Password utilities (bcrypt – one-way hash, not reversible)
# ---------------------------------------------------------------------------

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

# ---------------------------------------------------------------------------
# Platform API key utilities (SHA-256 – one-way hash for authentication)
# ---------------------------------------------------------------------------

def hash_api_key(key: str) -> str:
    """Return the SHA-256 hex digest of a platform API key for storage/lookup."""
    return hashlib.sha256(key.encode('utf-8')).hexdigest()

def mask_api_key(key: str) -> str:
    """Return a display-safe masked version (first 12 chars + '...')."""
    return key[:12] + "..." if len(key) > 12 else key


def create_internal_ingest_token(hashed_api_key: str, expires_minutes: int = 10) -> str:
    """Create a short-lived internal token that carries a hashed API key reference."""
    payload = {
        "typ": "internal_ingest",
        "hk": hashed_api_key,
        "exp": datetime.utcnow() + timedelta(minutes=expires_minutes),
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return f"{INTERNAL_INGEST_TOKEN_PREFIX}{token}"


def resolve_ingest_key_hash(api_key: str) -> str | None:
    """
    Resolve incoming ingest credentials to a stored ApiKey.key hash.
    Supports:
      1) plaintext user key -> SHA-256 hash
      2) internal signed token -> embedded hash
    """
    if not api_key:
        return None

    if api_key.startswith(INTERNAL_INGEST_TOKEN_PREFIX):
        raw = api_key[len(INTERNAL_INGEST_TOKEN_PREFIX):]
        try:
            payload = jwt.decode(raw, SECRET_KEY, algorithms=[ALGORITHM])
            if payload.get("typ") != "internal_ingest":
                return None
            return payload.get("hk")
        except Exception:
            return None

    return hash_api_key(api_key)

# ---------------------------------------------------------------------------
# LLM credential encryption utilities (Fernet – symmetric, reversible)
# ---------------------------------------------------------------------------

def _get_fernet() -> Fernet:
    """Initialise Fernet with the ENCRYPTION_KEY env variable."""
    raw_key = os.environ.get("ENCRYPTION_KEY", "")
    if not raw_key:
        raise ValueError(
            "ENCRYPTION_KEY environment variable is not set. "
            "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    return Fernet(raw_key.encode())

def encrypt_value(value: str) -> str:
    """Encrypt a plaintext string (e.g. an LLM API key) for storage."""
    return _get_fernet().encrypt(value.encode('utf-8')).decode('utf-8')

def decrypt_value(encrypted_value: str) -> str:
    """Decrypt a Fernet-encrypted string back to plaintext."""
    return _get_fernet().decrypt(encrypted_value.encode('utf-8')).decode('utf-8')

# ---------------------------------------------------------------------------
# JWT utilities
# ---------------------------------------------------------------------------

def create_access_token(
    subject: Union[str, Any], expires_delta: timedelta = None
) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
