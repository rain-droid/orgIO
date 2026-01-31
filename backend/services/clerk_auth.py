import jwt
import httpx
from fastapi import HTTPException, status
from config.settings import settings
from typing import Optional

# Clerk JWKS endpoint
CLERK_JWKS_URL = "https://fine-shrew-58.clerk.accounts.dev/.well-known/jwks.json"

# Cache for JWKS
_jwks_cache: Optional[dict] = None


async def get_jwks() -> dict:
    """Fetch Clerk JWKS (JSON Web Key Set)"""
    global _jwks_cache
    
    if _jwks_cache is not None:
        return _jwks_cache
    
    async with httpx.AsyncClient() as client:
        response = await client.get(CLERK_JWKS_URL)
        response.raise_for_status()
        _jwks_cache = response.json()
        return _jwks_cache


async def verify_clerk_token(token: str) -> dict:
    """
    Verify Clerk JWT token and return user info.
    
    Args:
        token: JWT token from Authorization header
        
    Returns:
        dict with userId, orgId, email, name
        
    Raises:
        HTTPException: If token is invalid
    """
    try:
        # Get JWKS
        jwks = await get_jwks()
        
        # Get unverified header to find the key
        unverified_header = jwt.get_unverified_header(token)
        
        # Find the matching key
        rsa_key = None
        for key in jwks.get("keys", []):
            if key.get("kid") == unverified_header.get("kid"):
                rsa_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
                break
        
        if rsa_key is None:
            raise ValueError("No matching key found in JWKS")
        
        # Verify and decode the token
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            options={"verify_aud": False}  # Clerk tokens don't always have audience
        )
        
        # Extract user info from token claims
        user_id = payload.get("sub")
        org_id = payload.get("org_id")
        
        # Clerk session tokens have limited claims
        # For full user data, we'd need to call the Clerk API
        return {
            "userId": user_id,
            "orgId": org_id,
            "email": payload.get("email"),
            "name": payload.get("name") or payload.get("username") or user_id,
            "avatarUrl": payload.get("image_url")
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "TOKEN_EXPIRED",
                "message": "Token has expired"
            }
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_TOKEN",
                "message": f"Invalid token: {str(e)}"
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "UNAUTHORIZED",
                "message": f"Authentication failed: {str(e)}"
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
