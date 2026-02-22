import asyncio
import os
import sys

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

from backend.auth_utils import get_current_user

async def test():
    token = "INVALID_TOKEN" # We just want to see if it behaves as expected
    try:
        print("Testing get_current_user with invalid token...")
        user = await get_current_user(token)
        print(f"Success? {user}")
    except Exception as e:
        print(f"Caught expected error: {e}")
        if hasattr(e, 'status_code'):
            print(f"Status Code: {e.status_code}")
        if hasattr(e, 'detail'):
            print(f"Detail: {e.detail}")

if __name__ == "__main__":
    asyncio.run(test())
