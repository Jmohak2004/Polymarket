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

    # Web source discovery (search + scrape). Configure at least one for best results;
    # without keys, falls back to DuckDuckGo HTML search (rate-limited, dev use).
    tavily_api_key: str = ""
    serpapi_key: str = ""
    google_cse_id: str = ""
    google_cse_api_key: str = ""
    brave_search_api_key: str = ""

    # Scrape: max bytes per page, user-agent
    max_fetch_bytes: int = 2_000_000
    http_user_agent: str = "PolyOracleSourceBot/1.0 (+https://github.com) research"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Database
    database_url: str = "sqlite+aiosqlite:///./polymarket.db"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
