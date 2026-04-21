from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):

    # LLM Configurations
    LLM_PROVIDER: str = "openrouter"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "anthropic/claude-opus-4.7"

    # Model Configurations
    OUTCOME_WINDOW_DAYS: int = 30
    CROSS_FITTING_FOLDS: int = 5
    CAUSAL_FOREST_N_ESTIMATORS: int = 1000

    # Treament Balance Thresholds
    # GOOD: treated % between 20–80%
    BALANCE_GOOD_MIN: float = 0.20
    BALANCE_GOOD_MAX: float = 0.80
    # INSUFFICIENT: treated % below 10% or above 90%
    BALANCE_INSUFFICIENT_MIN: float = 0.10
    BALANCE_INSUFFICIENT_MAX: float = 0.90

    # Azure Storage Congirations
    AZURE_STORAGE_CONNECTION_STRING: str = ""
    AZURE_CONTAINER_NAME: str = "imc-sessions"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

settings = Settings()