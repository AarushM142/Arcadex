import os
import httpx
import json
import asyncio
from fastapi import HTTPException
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

async def get_current_user(token: str):
    """
    Verify a Supabase JWT by calling Supabase's /auth/v1/user endpoint.
    """
    if not token:
        raise HTTPException(status_code=401, detail="No token provided")

    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(
            status_code=500,
            detail="Server misconfiguration: Supabase URL/key missing",
        )

    try:
        # Use httpx to call Supabase auth endpoint
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": SUPABASE_ANON_KEY,
                },
            )
            
        if resp.status_code in (401, 403):
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired session. Please sign in again.",
            )
        if resp.status_code != 200:
            raise HTTPException(
                status_code=401,
                detail=f"Auth error from Supabase: {resp.status_code}",
            )
            
        user_data = resp.json()
        user_id = user_data.get("id")
        email = user_data.get("email")

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: no user ID")

        return {"id": user_id, "email": email}

    except HTTPException:
        raise
    except Exception as e:
        # Include detailed error for debugging
        raise HTTPException(status_code=401, detail=f"Session invalid: {str(e)}")
