"""
Python wrapper around the C TicTacToe engine.

For now this uses a pure-Python fallback implementation so the rest of the
stack can run without compiling C. You will replace the Python logic with
ctypes bindings to tictactoe.c / tictactoe.dll while keeping the same
function signatures.
"""

from typing import List


def init_game() -> List[List[str]]:
    return [["" for _ in range(3)] for _ in range(3)]


def apply_move(state: List[List[str]], row: int, col: int) -> List[List[str]]:
    if not (0 <= row < 3 and 0 <= col < 3):
        return state
    if state[row][col]:
        return state

    # Simple alternating turns based on number of filled cells
    flat = [cell for r in state for cell in r]
    x_count = flat.count("X")
    o_count = flat.count("O")
    current = "X" if x_count <= o_count else "O"
    state[row][col] = current
    return state


def calculate_result(state: List[List[str]]) -> str:
    lines = []
    # Rows and cols
    for i in range(3):
        lines.append(state[i])
        lines.append([state[0][i], state[1][i], state[2][i]])
    # Diagonals
    lines.append([state[0][0], state[1][1], state[2][2]])
    lines.append([state[0][2], state[1][1], state[2][0]])

    for line in lines:
        if line[0] and line[0] == line[1] == line[2]:
            # Treat X as player win, O as lose for now
            return "win" if line[0] == "X" else "lose"

    if all(cell for row in state for cell in row):
        return "draw"

    return "in_progress"

