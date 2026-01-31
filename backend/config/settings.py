from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Clerk Authentication
    CLERK_SECRET_KEY: str
    
    # Supabase Database
    SUPABASE_URL: str
    SUPABASE_KEY: str
    
    # OpenAI
    OPENAI_API_KEY: str
    
    # Agent Configuration
    AGENT_MODEL: str = "gpt-4o"
    AGENT_TEMPERATURE: float = 0.7
    
    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
