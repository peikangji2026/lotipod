from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # 项目信息
    PROJECT_NAME: str = "Test Platform API"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"

    # 数据库
    DATABASE_URL: str = "postgresql://postgres:postgres123@localhost:5432/testplatform"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production-min-32-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://192.168.100.212:5173",
        "http://192.168.100.212:3000",
    ]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
