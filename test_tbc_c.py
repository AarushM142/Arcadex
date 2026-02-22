from backend.services import tbc_engine

def test_tbc():
    print("Testing Trial By Combat C Engine...")
    p1 = tbc_engine.create_fighter("C-Knight", 0)
    p2 = tbc_engine.create_fighter("C-Magician", 1)
    
    print(f"P1: {p1.name.decode()}, HP: {p1.hp}")
    print(f"P2: {p2.name.decode()}, HP: {p2.hp}")
    
    seed = 42
    print("\nResolving Turn 1 (Both Attack)...")
    seed = tbc_engine.resolve_turn(p1, p2, 0, 0, seed)
    
    print(f"P1 HP: {p1.hp}, P1 Charge: {p1.charge}")
    print(f"P2 HP: {p2.hp}, P2 Charge: {p2.charge}")
    print(f"Next Seed: {seed}")
    
    if p1.hp < 115 or p2.hp < 105:
        print("\nSUCCESS: Damage calculated by C engine!")
    else:
        print("\nFAILURE: No damage dealt?")

if __name__ == "__main__":
    test_tbc()
