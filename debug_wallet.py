import asyncio
import os
import sys

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

from backend.services.wallet_service import list_all_pending_transactions, list_all_users

async def test():
    try:
        print("Testing list_all_pending_transactions...")
        txns = await list_all_pending_transactions()
        print(f"Success! Found {len(txns)} pending transactions.")
        if txns:
            print(f"Transaction keys: {txns[0].keys()}")
            print(f"Transaction data: {txns[0]}")
        
        print("Testing list_all_users...")
        users = await list_all_users()
        print(f"Success! Found {len(users)} users.")
        for u in users:
            print(f"User: {u.get('username')} - Email: {u.get('email')}")
    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(test())
