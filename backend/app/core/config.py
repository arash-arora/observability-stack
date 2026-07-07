from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "LLM Observability Backend"
    API_V1_STR: str = "/api/v1"
    
    POSTGRES_USER: str = ""
    POSTGRES_PASSWORD: str = ""
    POSTGRES_SERVER: str = ""
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = ""

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    CLICKHOUSE_HOST: str = ""
    CLICKHOUSE_PORT: int = 8123
    CLICKHOUSE_USER: str = ""
    CLICKHOUSE_PASSWORD: str = ""

    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:8011,http://10.17.34.14:8011"
    CORS_ORIGIN_REGEX: str = r"^https?://(localhost|127\.0\.0\.1|10\.17\.34\.14)(:\d+)?$"

    # Fernet symmetric key for encrypting LLM provider credentials at rest.
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    ENCRYPTION_KEY: str = ""

    @property
    def CORS_ORIGINS_LIST(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
