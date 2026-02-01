from fastapi import APIRouter, Request, HTTPException, status
from services.supabase_client import get_supabase
import hashlib
import hmac
import os

router = APIRouter()

CLERK_WEBHOOK_SECRET = os.getenv("CLERK_WEBHOOK_SECRET", "")


def verify_webhook(payload: bytes, signature: str) -> bool:
    """Verify Clerk webhook signature"""
    if not CLERK_WEBHOOK_SECRET:
        # In dev mode without secret, accept all
        return True
    
    expected = hmac.new(
        CLERK_WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(f"sha256={expected}", signature)


@router.post("/webhooks/clerk")
async def clerk_webhook(request: Request):
    """
    Handle Clerk webhooks for user and organization events.
    
    Events we care about:
    - user.created: Create user in our DB
    - user.updated: Update user in our DB
    - organizationMembership.created: User joined org -> save org_id
    - organizationMembership.deleted: User left org -> clear org_id
    """
    payload = await request.body()
    signature = request.headers.get("svix-signature", "")
    
    # Skip verification in dev (no secret set)
    if CLERK_WEBHOOK_SECRET and not verify_webhook(payload, signature):
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    try:
        data = await request.json()
    except:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    event_type = data.get("type")
    event_data = data.get("data", {})
    
    print(f"[WEBHOOK] Received: {event_type}")
    
    supabase = get_supabase()
    
    # User created
    if event_type == "user.created":
        user_id = event_data.get("id")
        email = event_data.get("email_addresses", [{}])[0].get("email_address", "")
        name = f"{event_data.get('first_name', '')} {event_data.get('last_name', '')}".strip() or "User"
        avatar = event_data.get("image_url")
        
        supabase.table("users").upsert({
            "id": user_id,
            "email": email,
            "name": name,
            "avatar_url": avatar
        }).execute()
        print(f"[WEBHOOK] Created user: {user_id}")
    
    # User updated
    elif event_type == "user.updated":
        user_id = event_data.get("id")
        email = event_data.get("email_addresses", [{}])[0].get("email_address", "")
        name = f"{event_data.get('first_name', '')} {event_data.get('last_name', '')}".strip() or "User"
        avatar = event_data.get("image_url")
        
        supabase.table("users").update({
            "email": email,
            "name": name,
            "avatar_url": avatar
        }).eq("id", user_id).execute()
        print(f"[WEBHOOK] Updated user: {user_id}")
    
    # User joined organization - THIS IS THE KEY ONE
    elif event_type == "organizationMembership.created":
        user_id = event_data.get("public_user_data", {}).get("user_id")
        org_id = event_data.get("organization", {}).get("id")
        
        if user_id and org_id:
            supabase.table("users").update({
                "org_id": org_id
            }).eq("id", user_id).execute()
            print(f"[WEBHOOK] User {user_id} joined org {org_id}")
    
    # User left organization
    elif event_type == "organizationMembership.deleted":
        user_id = event_data.get("public_user_data", {}).get("user_id")
        
        if user_id:
            supabase.table("users").update({
                "org_id": None
            }).eq("id", user_id).execute()
            print(f"[WEBHOOK] User {user_id} left org")
    
    return {"received": True}
