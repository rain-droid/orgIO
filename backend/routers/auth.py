from fastapi import APIRouter, Header, HTTPException, status
from services.clerk_auth import get_current_user
from services.supabase_client import get_supabase

router = APIRouter()


@router.post("/auth/session")
async def validate_session(
    authorization: str = Header(...),
):
    """
    Validate Clerk token and return user info.
    Used by Desktop App on startup and Web App for user data.
    
    Returns:
        User dict with userId, orgId, email, name, role, avatarUrl
    """
    user = await get_current_user(authorization)
    supabase = get_supabase()
    
    # Upsert user in database
    user_data = {
        "id": user["userId"],
        "org_id": user["orgId"],
        "email": user["email"],
        "name": user["name"],
        "avatar_url": user["avatarUrl"]
    }
    
    # Check if user exists
    existing = supabase.table("users").select("*").eq("id", user["userId"]).execute()
    
    if existing.data:
        # Update existing user
        supabase.table("users").update(user_data).eq("id", user["userId"]).execute()
        role = existing.data[0].get("role", "dev")
    else:
        # Create new user with default role
        user_data["role"] = "dev"
        supabase.table("users").insert(user_data).execute()
        role = "dev"
    
    return {
        "userId": user["userId"],
        "orgId": user["orgId"],
        "email": user["email"],
        "name": user["name"],
        "role": role,
        "avatarUrl": user["avatarUrl"]
    }
