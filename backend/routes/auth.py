from fastapi import APIRouter, Depends, Header, HTTPException, status

from backend.auth_utils import get_current_user


router = APIRouter()


async def auth_dependency(authorization: str | None = Header(default=None)):
    """
    Extract and validate the Supabase JWT from Authorization header.
    Also checks if the user is banned from the Arcadex platform.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )
    token = authorization.split(" ", 1)[1]
    try:
        user = await get_current_user(token)
        
        # Check for Ban Status
        from backend.services.supabase_client import supabase
        import asyncio
        
        try:
            profile_resp = await asyncio.to_thread(
                supabase.table("profiles").select("is_banned").eq("id", user["id"]).single().execute
            )
            
            if profile_resp.data and profile_resp.data.get("is_banned"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your account has been banned from Arcadex. Contact support for details."
                )
        except HTTPException:
            raise
        except Exception as e:
            # If profile doesn't exist, we don't ban by default
            # Just log it or ignore if it's a "not found" error
            print(f"Auth check profile fetch error (ignored): {e}")
            pass
            
        return user
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"CRITICAL ERROR in auth_dependency: {e}")
        raise e


@router.get("/me")
async def me(user=Depends(auth_dependency)):
    """
    Return the authenticated user's basic identity as seen from the backend.
    """
    return {"user_id": user["id"], "email": user.get("email")}

