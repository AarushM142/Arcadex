import asyncio
import uuid
from typing import Dict

from backend.services import tictactoe_engine, wallet_service


_sessions: Dict[str, Dict] = {}


async def start_tictactoe_session(user_id: str) -> Dict:
    await asyncio.sleep(0)
    session_id = str(uuid.uuid4())
    state = tictactoe_engine.init_game()
    _sessions[session_id] = {
        "id": session_id,
        "user_id": user_id,
        "state": state,
        "is_over": False,
    }
    return {"session_id": session_id, "state": state}


async def apply_tictactoe_move(user_id: str, session_id: str, move: Dict) -> Dict:
    await asyncio.sleep(0)
    session = _sessions.get(session_id)
    if not session or session["user_id"] != user_id:
        raise ValueError("Invalid session")

    if session["is_over"]:
        return {
            "session_id": session_id,
            "state": session["state"],
            "is_over": True,
            "result": session.get("result"),
        }

    state = session["state"]
    row = int(move.get("row", -1))
    col = int(move.get("col", -1))
    state = tictactoe_engine.apply_move(state, row, col)
    result = tictactoe_engine.calculate_result(state)

    session["state"] = state
    response = {"session_id": session_id, "state": state, "is_over": False}

    if result in ("win", "lose", "draw"):
        session["is_over"] = True
        session["result"] = result
        response["is_over"] = True
        response["result"] = result

        coins = 0
        if result == "win":
            coins = 50
        elif result == "draw":
            coins = 10

        if coins > 0:
            await wallet_service.add_game_reward(user_id=user_id, coins=coins)
            response["coins_awarded"] = coins

    return response

