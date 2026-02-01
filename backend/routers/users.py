from fastapi import APIRouter, Header, HTTPException, status
from typing import Dict, Any

from services.clerk_auth import get_current_user
from services.supabase_client import get_supabase

router = APIRouter()


def _upsert_user(user: Dict[str, Any]) -> Dict[str, Any]:
    supabase = get_supabase()

    existing = supabase.table("users").select("*").eq("id", user["userId"]).execute()

    if existing.data:
        existing_record = existing.data[0]
        # Only update org_id if we have a new one (don't overwrite with null)
        org_id = user["orgId"] or existing_record.get("org_id")
        
        user_data = {
            "email": user["email"],
            "name": user["name"],
            "avatar_url": user["avatarUrl"]
        }
        # Only update org_id if it's not null
        if user["orgId"]:
            user_data["org_id"] = user["orgId"]
            
        supabase.table("users").update(user_data).eq("id", user["userId"]).execute()
        role = existing_record.get("role")  # Can be None if not set yet
        is_new = False
    else:
        org_id = user["orgId"]
        user_data = {
            "id": user["userId"],
            "org_id": org_id,
            "email": user["email"],
            "name": user["name"],
            "avatar_url": user["avatarUrl"]
        }
        # DON'T set default role - user must choose in onboarding
        # role will be NULL until they complete onboarding
        supabase.table("users").insert(user_data).execute()
        role = None
        is_new = True

    # Needs onboarding if new OR if role was never set
    needs_onboarding = is_new or role is None

    return {
        "userId": user["userId"],
        "orgId": org_id,
        "email": user["email"],
        "name": user["name"],
        "role": role,
        "avatarUrl": user["avatarUrl"],
        "isNew": is_new,
        "needsOnboarding": needs_onboarding
    }


@router.get("/users/me")
async def get_me(authorization: str = Header(None)):
    """Return current user profile and ensure user exists in DB."""
    print(f"[USERS/ME] Called with auth header: {authorization[:50] if authorization else 'MISSING'}...")
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "No Authorization header provided"}
        )
    user = await get_current_user(authorization)
    return _upsert_user(user)


@router.patch("/users/me")
async def update_me(update_data: Dict[str, Any], authorization: str = Header(...)):
    """Update current user profile (role only for now)."""
    user = await get_current_user(authorization)
    supabase = get_supabase()

    role = update_data.get("role")
    if role not in {"pm", "dev", "designer"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": "Invalid role"}
        )

    supabase.table("users").update({"role": role}).eq("id", user["userId"]).execute()

    return _upsert_user(user)
