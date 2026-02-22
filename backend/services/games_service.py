import asyncio
import uuid
from typing import Dict

from backend.services import tictactoe_engine, tbc_engine, wallet_service


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

async def start_tbc_session(user_id: str, class_id: int, mode: str) -> Dict:
    session_id = str(uuid.uuid4())
    p1 = tbc_engine.create_fighter("Player 1", class_id)
    
    if mode == "gauntlet":
        enemies = [tbc_engine.create_fighter(name, i) for i, name in enumerate(["Knight", "Magician", "Alchemist"])]
        # Match JS logic: Player HP = 1.5 * total enemy HP
        total_enemy_hp = sum(e.maxHp for e in enemies)
        p1.maxHp = p1.hp = int(total_enemy_hp * 1.5)
        _sessions[session_id] = {
            "type": "tbc",
            "mode": "gauntlet",
            "user_id": user_id,
            "p1": p1,
            "enemies": enemies,
            "seed": 12345, # Default seed
            "turn": 1
        }
    else:
        p2 = tbc_engine.create_fighter("Bot", 0) # Default knight
        _sessions[session_id] = {
            "type": "tbc",
            "mode": "ai",
            "user_id": user_id,
            "p1": p1,
            "p2": p2,
            "seed": 12345,
            "turn": 1
        }
    
    return {"session_id": session_id, "p1": _fighter_to_dict(p1)}

async def apply_tbc_move(user_id: str, session_id: str, move: int, target_idx: int = 0) -> Dict:
    session = _sessions.get(session_id)
    if not session or session["user_id"] != user_id:
        raise ValueError("Invalid session")

    seed = session["seed"]
    if session["mode"] == "gauntlet":
        seed = tbc_engine.resolve_gauntlet_turn(session["p1"], session["enemies"], move, target_idx, seed)
    else:
        # Get AI move for p2
        ai_move, seed = tbc_engine.get_ai_move(session["p2"], session["p1"], seed)
        seed = tbc_engine.resolve_turn(session["p1"], session["p2"], move, ai_move, seed)
    
    session["seed"] = seed
    session["turn"] += 1
    
    result = {
        "p1": _fighter_to_dict(session["p1"]),
        "turn": session["turn"]
    }
    if session["mode"] == "gauntlet":
        result["enemies"] = [_fighter_to_dict(e) for e in session["enemies"]]
    else:
        result["p2"] = _fighter_to_dict(session["p2"])
        
    return result

def _fighter_to_dict(f):
    return {
        "name": f.name.decode('utf-8'),
        "classId": f.classId,
        "hp": f.hp,
        "maxHp": f.maxHp,
        "charge": f.charge,
        "buffActive": bool(f.buffActive),
        "dotStacks": f.dotStacks
    }

