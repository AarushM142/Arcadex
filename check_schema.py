from backend.services.supabase_client import supabase
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "backend", ".env"))

try:
    # Try to fetch one row from game_sessions to see the columns and data types
    res = supabase.table("game_sessions").select("*").limit(1).execute()
    print("Game session sample:", res.data)
except Exception as e:
    print("Error:", e)
