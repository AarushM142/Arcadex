from fastapi import APIRouter, Depends, HTTPException, status

from backend.routes.auth import auth_dependency
from backend.services import games_service


router = APIRouter()


@router.post("/tictactoe/start")
async def start_tictactoe(user=Depends(auth_dependency)):
    """
    Start a TicTacToe game session.
    """
    session = await games_service.start_tictactoe_session(user_id=user["id"])
    return session


@router.post("/tictactoe/move")
async def tictactoe_move(payload: dict, user=Depends(auth_dependency)):
    """
    Apply a move to a TicTacToe session.
    """
    session_id = payload.get("session_id")
    move = payload.get("move")
    if not session_id or not isinstance(move, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="session_id and move are required",
        )

    result = await games_service.apply_tictactoe_move(
        user_id=user["id"],
        session_id=session_id,
        move=move,
    )
    return result

