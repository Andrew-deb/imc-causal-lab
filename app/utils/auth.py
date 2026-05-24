import base64
import json
import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.configs import settings
from typing import Optional, Dict, Any

security = HTTPBearer(auto_error=False)

# In-memory cache for Clerk public keys (JWKS)
jwks_cache: Dict[str, Any] = {}

def get_clerk_domain(publishable_key: str) -> str:
    """
    Extracts the Clerk Frontend API domain from the Publishable Key.
    Publishable key is typically in the format pk_test_xxxxxx or pk_live_xxxxxx,
    where xxxxxx is the base64-encoded domain ending with $.
    """
    if not publishable_key:
        return ""
    parts = publishable_key.split('_')
    if len(parts) < 3:
        return ""
    encoded_payload = parts[2]
    # Add base64 padding if necessary
    padding = len(encoded_payload) % 4
    if padding:
        encoded_payload += '=' * (4 - padding)
    try:
        decoded = base64.b64decode(encoded_payload).decode('utf-8')
        if decoded.endswith('$'):
            decoded = decoded[:-1]
        return decoded
    except Exception:
        return ""

def get_jwks_url(token_iss: Optional[str] = None) -> str:
    """
    Determines the JWKS endpoint URL using the publishable key or fallback issuer.
    """
    domain = get_clerk_domain(settings.VITE_CLERK_PUBLISHABLE_KEY or "")
    if domain:
        return f"https://{domain}/.well-known/jwks.json"
    if token_iss:
        return f"{token_iss.rstrip('/')}/.well-known/jwks.json"
    raise ValueError("Clerk Publishable Key is not configured and token issuer is missing.")

async def fetch_jwks(jwks_url: str) -> Dict[str, Any]:
    """
    Fetches the JSON Web Key Set (JWKS) from Clerk.
    """
    global jwks_cache
    if jwks_url in jwks_cache:
        return jwks_cache[jwks_url]
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(jwks_url)
            if response.status_code == 200:
                jwks_cache[jwks_url] = response.json()
                return jwks_cache[jwks_url]
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to fetch JWKS from Clerk: status={response.status_code}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error connecting to Clerk JWKS endpoint: {str(e)}"
            )

async def verify_clerk_token(token: str) -> Dict[str, Any]:
    """
    Verifies the RS256 signature and claims of the Clerk JWT token.
    """
    try:
        unverified_header = jwt.get_unverified_header(token)
        unverified_claims = jwt.decode(token, options={"verify_signature": False})
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid JWT format: {str(e)}"
        )
    
    kid = unverified_header.get("kid")
    if not kid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token header missing key ID (kid)"
        )
    
    iss = unverified_claims.get("iss")
    try:
        jwks_url = get_jwks_url(iss)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    
    jwks = await fetch_jwks(jwks_url)
    
    rsa_key = None
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            rsa_key = key
            break
            
    if not rsa_key:
        # Clear cache and retry once to accommodate key rotation
        global jwks_cache
        if jwks_url in jwks_cache:
            del jwks_cache[jwks_url]
            try:
                jwks = await fetch_jwks(jwks_url)
                for key in jwks.get("keys", []):
                    if key.get("kid") == kid:
                        rsa_key = key
                        break
            except Exception:
                pass
                
    if not rsa_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="JWKS key not found for token kid"
        )
        
    try:
        public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(rsa_key))
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_aud": False}
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}"
        )

async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> str:
    """
    FastAPI dependency to require authentication and return the Clerk user ID.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials are required"
        )
    payload = await verify_clerk_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User identity (sub claim) missing from token"
        )
    return user_id

async def get_current_user_optional(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[str]:
    """
    FastAPI dependency to optionally verify authentication. Returns user ID if token is provided and valid, otherwise None.
    """
    if not credentials:
        return None
    try:
        payload = await verify_clerk_token(credentials.credentials)
        return payload.get("sub")
    except Exception as e:
        # If credentials were sent but are invalid, we raise 401
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {str(e)}"
        )
