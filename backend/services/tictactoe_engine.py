import ctypes
import os
from typing import List

# Define the TicTacToeState struct matching tictactoe.c
class TicTacToeState(ctypes.Structure):
    _fields_ = [
        ("board", ctypes.c_int8 * 9),
        ("currentPlayer", ctypes.c_int8),
        ("gameMode", ctypes.c_int8),
        ("winner", ctypes.c_int8),
        ("isGameOver", ctypes.c_bool),
    ]

# Load DLL
dll_path = os.path.join(os.path.dirname(__file__), "..", "game_engine", "tictactoe.dll")
try:
    tt_lib = ctypes.CDLL(dll_path)

    # Function signatures
    tt_lib.init_game.argtypes = [ctypes.c_int8]
    tt_lib.init_game.restype = TicTacToeState

    tt_lib.make_move.argtypes = [TicTacToeState, ctypes.c_int]
    tt_lib.make_move.restype = TicTacToeState

    tt_lib.get_hint.argtypes = [TicTacToeState]
    tt_lib.get_hint.restype = ctypes.c_int
except Exception as e:
    print(f"Failed to load TicTacToe C engine: {e}")
    tt_lib = None

def init_game() -> List[List[str]]:
    if not tt_lib:
        return [["" for _ in range(3)] for _ in range(3)]
    
    # 0 is PVP mode in C
    c_state = tt_lib.init_game(0)
    return _c_state_to_py(c_state)

def apply_move(state: List[List[str]], row: int, col: int) -> List[List[str]]:
    if not tt_lib:
        # Fallback (simplified)
        state[row][col] = "X"
        return state
        
    c_state = _py_state_to_c(state)
    index = row * 3 + col
    new_c_state = tt_lib.make_move(c_state, index)
    return _c_state_to_py(new_c_state)

def calculate_result(state: List[List[str]]) -> str:
    if not tt_lib:
        return "in_progress"
        
    c_state = _py_state_to_c(state)
    if c_state.winner == 1: return "win"
    if c_state.winner == 2: return "lose"
    if c_state.winner == 3: return "draw"
    return "in_progress"

def _c_state_to_py(c_state: TicTacToeState) -> List[List[str]]:
    py_state = []
    for i in range(3):
        row = []
        for j in range(3):
            val = c_state.board[i * 3 + j]
            if val == 1: row.append("X")
            elif val == 2: row.append("O")
            else: row.append("")
        py_state.append(row)
    return py_state

def _py_state_to_c(py_state: List[List[str]]) -> TicTacToeState:
    c_state = TicTacToeState()
    for i in range(3):
        for j in range(3):
            val = py_state[i][j]
            if val == "X": c_state.board[i * 3 + j] = 1
            elif val == "O": c_state.board[i * 3 + j] = 2
            else: c_state.board[i * 3 + j] = 0
            
    # Estimate metadata
    flat = [cell for row in py_state for cell in row]
    x_count = flat.count("X")
    o_count = flat.count("O")
    c_state.currentPlayer = 1 if x_count <= o_count else 2
    c_state.gameMode = 0
    c_state.isGameOver = False
    c_state.winner = 0
    return c_state
