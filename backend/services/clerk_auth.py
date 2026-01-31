from clerk_backend_api import Clerk
from fastapi import HTTPException, status
from config.settings import settings
import os

# Initialize Clerk client
clerk = Clerk(bearer_auth=settings.CLERK_SECRET_KEY)


async def verify_clerk_token(token: str) -> dict:
    """
    Verify Clerk JWT token and return user info.
    
    Args:
        token: JWT token from Authorization header
        
    Returns:
        dict with userId, orgId, email, name, avatarUrl
        
    Raises:
        HTTPException: If token is invalid
    """
    try:
        # Verify the session token
        session = clerk.sessions.verify_token(token)
        
        # Get user details
        user = clerk.users.get(session.user_id)
        
        # Get organization (if user is in one)
        org_id = None
        if hasattr(user, 'organization_memberships') and user.organization_memberships:
            org_id = user.organization_memberships[0].organization.id
        
        # Extract email
        email = None
        if hasattr(user, 'email_addresses') and user.email_addresses:
            email = user.email_addresses[0].email_address
        
        # Build name
        name = None
        if hasattr(user, 'first_name') and hasattr(user, 'last_name'):
            name = f"{user.first_name or ''} {user.last_name or ''}".strip()
        
        return {
            "userId": user.id,
            "orgId": org_id,
            "email": email,
            "name": name or email,
            "avatarUrl": getattr(user, 'image_url', None)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "UNAUTHORIZED",
                "message": f"Invalid or expired token: {str(e)}"
            }
        )


async def get_current_user(authorization: str) -> dict:
    """
    FastAPI dependency to get current authenticated user.
    
    Args:
        authorization: Authorization header value
        
    Returns:
        User dict
        
    Raises:
        HTTPException: If auth fails
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "UNAUTHORIZED",
                "message": "Missing or invalid authorization header"
            }
        )
    
    token = authorization.replace("Bearer ", "")
    return await verify_clerk_token(token)
