from supabase import create_client, Client
from config.settings import settings

# Initialize Supabase client
supabase: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_KEY
)


def get_supabase() -> Client:
    """
    Dependency to get Supabase client.
    
    Returns:
        Supabase client instance
    """
    return supabase
