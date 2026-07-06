"""
Migration: Encrypt credentials at rest
=======================================
Run this ONCE after deploying the encryption changes to migrate existing data:

  1. Platform API keys  → SHA-256 hash stored in `key` column; prefix stored in `key_prefix`
  2. LLM provider keys  → Fernet-encrypted value stored in `api_key`

Usage:
    ENCRYPTION_KEY=<your-key> python migrate_encrypt_credentials.py

The script is idempotent for LLM keys (it checks whether the value is already
a valid Fernet token before encrypting). For API keys it checks whether `key_prefix`
is already populated.
"""

import asyncio
import hashlib
import os
import sys

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlmodel import select


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

def get_database_url() -> str:
    user = os.environ.get("POSTGRES_USER", "postgres")
    password = os.environ.get("POSTGRES_PASSWORD", "password")
    server = os.environ.get("POSTGRES_SERVER", "localhost")
    port = os.environ.get("POSTGRES_PORT", "5432")
    db = os.environ.get("POSTGRES_DB", "obs_db")
    return f"postgresql+asyncpg://{user}:{password}@{server}:{port}/{db}"


def get_fernet() -> Fernet:
    key = os.environ.get("ENCRYPTION_KEY", "")
    if not key:
        print("ERROR: ENCRYPTION_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)
    return Fernet(key.encode())


def hash_api_key(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def mask_api_key(value: str) -> str:
    return value[:12] + "..." if len(value) > 12 else value


def is_already_encrypted(fernet: Fernet, value: str) -> bool:
    """Return True if `value` is already a valid Fernet token."""
    try:
        fernet.decrypt(value.encode("utf-8"))
        return True
    except (InvalidToken, Exception):
        return False


# ---------------------------------------------------------------------------
# Main migration
# ---------------------------------------------------------------------------

async def migrate() -> None:
    db_url = get_database_url()
    fernet = get_fernet()

    engine = create_async_engine(db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # ------------------------------------------------------------------
        # 1. Migrate platform API keys (ApiKey table)
        # ------------------------------------------------------------------
        from app.models.all_models import ApiKey

        print("Migrating platform API keys...")
        result = await session.execute(select(ApiKey))
        api_keys = result.scalars().all()

        migrated_keys = 0
        for api_key_obj in api_keys:
            if api_key_obj.key_prefix:
                # Already migrated – key is a hash, prefix is populated
                continue

            # The existing `key` column holds the plaintext (e.g. "sk-xxxx...")
            plaintext = api_key_obj.key
            api_key_obj.key = hash_api_key(plaintext)
            api_key_obj.key_prefix = mask_api_key(plaintext)
            session.add(api_key_obj)
            migrated_keys += 1

        print(f"  → Migrated {migrated_keys} API key(s).")

        # ------------------------------------------------------------------
        # 2. Migrate LLM provider API keys (LLMProvider table)
        # ------------------------------------------------------------------
        from app.models.llm_provider import LLMProvider

        print("Migrating LLM provider API keys...")
        result = await session.execute(select(LLMProvider))
        providers = result.scalars().all()

        migrated_providers = 0
        for provider in providers:
            if not provider.api_key:
                continue
            if is_already_encrypted(fernet, provider.api_key):
                # Already encrypted – skip
                continue

            provider.api_key = fernet.encrypt(provider.api_key.encode("utf-8")).decode("utf-8")
            session.add(provider)
            migrated_providers += 1

        print(f"  → Migrated {migrated_providers} LLM provider credential(s).")

        await session.commit()

    await engine.dispose()
    print("Migration complete.")


if __name__ == "__main__":
    # Add the backend directory to sys.path so app.models can be imported
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    asyncio.run(migrate())
