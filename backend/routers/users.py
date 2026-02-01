from fastapi import APIRouter, Header, HTTPException, status
from typing import Dict, Any

from services.clerk_auth import get_current_user
from services.supabase_client import get_supabase

router = APIRouter()


def _upsert_user(user: Dict[str, Any]) -> Dict[str, Any]:
    supabase = get_supabase()

    user_data = {
        "id": user["userId"],
        "org_id": user["orgId"],
        "email": user["email"],
        "name": user["name"],
        "avatar_url": user["avatarUrl"]
    }

    existing = supabase.table("users").select("*").eq("id", user["userId"]).execute()

    if existing.data:
        supabase.table("users").update(user_data).eq("id", user["userId"]).execute()
        role = existing.data[0].get("role", "dev")
        is_new = False
    else:
        user_data["role"] = "dev"
        supabase.table("users").insert(user_data).execute()
        role = "dev"
        is_new = True

    return {
        "userId": user["userId"],
        "orgId": user["orgId"],
        "email": user["email"],
        "name": user["name"],
        "role": role,
        "avatarUrl": user["avatarUrl"],
        "isNew": is_new
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
