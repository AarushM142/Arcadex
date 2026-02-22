import ctypes
import os

# Define the C structures in Python using ctypes
class Fighter(ctypes.Structure):
    _fields_ = [
        ("name", ctypes.c_char * 32),
        ("classId", ctypes.c_int),
        ("hp", ctypes.c_int),
        ("maxHp", ctypes.c_int),
        ("baseAtk", ctypes.c_int),
        ("baseDef", ctypes.c_int),
        ("baseSpd", ctypes.c_int),
        ("crt", ctypes.c_int),
        ("charge", ctypes.c_int),
        ("buffActive", ctypes.c_int),
        ("buffTurns", ctypes.c_int),
        ("buffStat", ctypes.c_int),
        ("buffAmt", ctypes.c_int),
        ("dotStacks", ctypes.c_int),
        ("dotTurns", ctypes.c_int),
        ("defPenalty", ctypes.c_int),
    ]

# Load the DLL
dll_path = os.path.join(os.path.dirname(__file__), "..", "game_engine", "trial_by_combat.dll")
tbc_lib = ctypes.CDLL(dll_path)

# Setup function signatures
tbc_lib.init_fighter.argtypes = [ctypes.POINTER(Fighter), ctypes.c_char_p, ctypes.c_int]
tbc_lib.init_fighter.restype = None

tbc_lib.resolve_turn.argtypes = [
    ctypes.POINTER(Fighter), 
    ctypes.POINTER(Fighter), 
    ctypes.c_int, 
    ctypes.c_int, 
    ctypes.POINTER(ctypes.c_uint32)
]
tbc_lib.resolve_turn.restype = None

tbc_lib.choose_move_ai.argtypes = [ctypes.POINTER(Fighter), ctypes.POINTER(Fighter), ctypes.POINTER(ctypes.c_uint32)]
tbc_lib.choose_move_ai.restype = ctypes.c_int

tbc_lib.resolve_gauntlet_turn.argtypes = [
    ctypes.POINTER(Fighter),
    ctypes.POINTER(Fighter),
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.POINTER(ctypes.c_uint32)
]
tbc_lib.resolve_gauntlet_turn.restype = None

def create_fighter(name: str, class_id: int):
    f = Fighter()
    tbc_lib.init_fighter(ctypes.byref(f), name.encode('utf-8'), class_id)
    return f

def resolve_turn(p1: Fighter, p2: Fighter, move1: int, move2: int, seed: int):
    c_seed = ctypes.c_uint32(seed)
    tbc_lib.resolve_turn(ctypes.byref(p1), ctypes.byref(p2), move1, move2, ctypes.byref(c_seed))
    return c_seed.value

def resolve_gauntlet_turn(player: Fighter, enemies: list[Fighter], player_move: int, target_idx: int, seed: int):
    c_seed = ctypes.c_uint32(seed)
    # Create a C array of Fighters
    enemy_count = len(enemies)
    enemy_array = (Fighter * enemy_count)(*enemies)
    tbc_lib.resolve_gauntlet_turn(ctypes.byref(player), enemy_array, enemy_count, player_move, target_idx, ctypes.byref(c_seed))
    
    # Copy back results
    for i in range(enemy_count):
        enemies[i] = enemy_array[i]
    return c_seed.value

def get_ai_move(ai: Fighter, opp: Fighter, seed: int):
    c_seed = ctypes.c_uint32(seed)
    move = tbc_lib.choose_move_ai(ctypes.byref(ai), ctypes.byref(opp), ctypes.byref(c_seed))
    return move, c_seed.value
