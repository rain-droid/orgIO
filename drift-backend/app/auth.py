import os
import jwt
import httpx
from fastapi import HTTPException, Header, Depends
from typing import Optional
from pydantic import BaseModel

CLERK_ISSUER = os.getenv("CLERK_ISSUER", "")
CLERK_JWKS_URL = f"{CLERK_ISSUER}/.well-known/jwks.json"

class User(BaseModel):
    id: str
    email: Optional[str] = None
    org_id: Optional[str] = None

# Cache for JWKS
_jwks_cache = None

async def get_jwks():
    """Fetch JWKS from Clerk"""
    global _jwks_cache
    if _jwks_cache is None:
        async with httpx.AsyncClient() as client:
            response = await client.get(CLERK_JWKS_URL)
            _jwks_cache = response.json()
    return _jwks_cache

async def verify_clerk_token(authorization: str = Header(...)) -> dict:
    """Verify Clerk JWT token"""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = authorization.replace("Bearer ", "")
    
    try:
        # For development, we can skip verification
        if os.getenv("ENV") == "development":
            # Decode without verification for dev
            payload = jwt.decode(token, options={"verify_signature": False})
            return payload
        
        # Production: verify with JWKS
        jwks = await get_jwks()
        
        # Get the key ID from token header
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        
        # Find matching key
        key = None
        for k in jwks.get("keys", []):
            if k.get("kid") == kid:
                key = jwt.algorithms.RSAAlgorithm.from_jwk(k)
                break
        
        if key is None:
            raise HTTPException(status_code=401, detail="Key not found")
        
        # Verify token
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=CLERK_ISSUER
        )
        return payload
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

async def get_current_user(token_data: dict = Depends(verify_clerk_token)) -> User:
    """Extract user from verified token"""
    return User(
        id=token_data.get("sub", ""),
        email=token_data.get("email"),
        org_id=token_data.get("org_id")
    )
