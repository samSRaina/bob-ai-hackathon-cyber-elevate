from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql+psycopg://bobengine:bobengine@localhost:5434/bobengine"

    # LLM — pluggable, defaults to DeepSeek
    LLM_API_BASE_URL: str = "https://api.deepseek.com"
    LLM_API_KEY: Optional[str] = None
    LLM_MODEL: str = "deepseek-flash"
    LLM_REQUEST_TIMEOUT_SECONDS: int = 30

    APP_ENV: str = "development"


settings = Settings()
