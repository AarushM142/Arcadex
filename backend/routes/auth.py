from fastapi import APIRouter, Depends, Header, HTTPException, status

from backend.auth_utils import get_current_user


router = APIRouter()


async def auth_dependency(authorization: str | None = Header(default=None)):
    """
    Extract and validate the Supabase JWT from Authorization header.
    DB wiring is deferred; this currently only parses and returns a minimal user dict.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )
    token = authorization.split(" ", 1)[1]
    user = await get_current_user(token)
    return user


@router.get("/me")
async def me(user=Depends(auth_dependency)):
    """
    Return the authenticated user's basic identity as seen from the backend.
    """
    return {"user_id": user["id"], "email": user.get("email")}

