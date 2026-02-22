from backend.services.supabase_client import supabase
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "backend", ".env"))

try:
    res = supabase.table("games").select("*").execute()
    print("Games in DB:", res.data)
except Exception as e:
    print("Error:", e)
