from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):

    # LLM Configurations
    LLM_PROVIDER: str = "openrouter"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "anthropic/claude-opus-4.7"

    # Model Configurations
    OUTCOME_WINDOW_DAYS: int = 30
    CROSS_FITTING_FOLDS: int = 3
    CAUSAL_FOREST_N_ESTIMATORS: int = 500      # reduced from 1000 for speed

    # Performance Tuning (adjustable for accuracy vs speed)
    FIRST_STAGE_N_ESTIMATORS: int = 100        # GBR/GBC trees in first-stage models
    MAX_SUBSAMPLE_ROWS: int = 30000            # subsample threshold (0 = no limit)

    # Treatment Balance Thresholds
    # GOOD: treated % between 20–80%
    BALANCE_GOOD_MIN: float = 0.20
    BALANCE_GOOD_MAX: float = 0.80
    # INSUFFICIENT: treated % below 10% or above 90%
    BALANCE_INSUFFICIENT_MIN: float = 0.10
    BALANCE_INSUFFICIENT_MAX: float = 0.90

    # Demo mode: use hardcoded IMC mapping instead of LLM
    # Set to False when ready for production with real LLM mapping
    USE_DEMO_MAPPING: bool = True

    # MongoDB Configuration
    MONGODB_URI: str = ""           # Set in .env
    MONGODB_DATABASE: str = "imc_causal_lab"
    USE_MONGO: bool = False         # Toggle: False = in-memory, True = MongoDB 

    # Azure Storage Configurations
    AZURE_STORAGE_CONNECTION_STRING: str = ""
    AZURE_CONTAINER_NAME: str = "imc-sessions"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

settings = Settings()


# ── Default IMC Mapping for Demo Dataset ────────────────────────────
# Used when USE_DEMO_MAPPING=True. Based on Kotler & Keller's IMC framework.
# Remove/disable when deploying to production with real LLM classification.

DEFAULT_IMC_MAPPING: dict[str, str] = {
    "Online Display Ads": "advertising",
    "Print Advertisement": "advertising",
    "Search Engine Marketing": "advertising",
    "TV Advertisement": "advertising",
    "Radio Advertisement": "advertising",
    "Email Marketing": "direct_marketing",
    "SMS Marketing": "direct_marketing",
    "Influencer Marketing": "promotion",
    "In-Store Promotion": "promotion",
    "Social Media": "promotion",
}