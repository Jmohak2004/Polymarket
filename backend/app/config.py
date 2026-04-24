from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_env: str = "development"
    secret_key: str = "change_me"

    # Blockchain
    rpc_url: str = "http://127.0.0.1:8545"
    chain_id: int = 31337
    oracle_private_key: str = ""
    prediction_market_address: str = ""
    oracle_resolver_address: str = ""

    # AI APIs
    openai_api_key: str = ""
    assemblyai_api_key: str = ""
    google_speech_api_key: str = ""

    # Weather
    openweather_api_key: str = ""
    tomorrow_io_api_key: str = ""

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Database
    database_url: str = "sqlite+aiosqlite:///./polymarket.db"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
