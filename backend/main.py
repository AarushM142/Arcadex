import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

# Import the actual objects from your new files
from backend.services.supabase_client import supabase 
from backend.auth_utils import get_current_user
from backend.routes import auth, wallet, games

app = FastAPI(title="Arcade Platform Backend", root_path="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "https://fycproj.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

@app.get("/test-db")
async def test_db():
    # This verifies your backend can talk to Supabase
    try:
        response = supabase.table("games").select("*").execute()
        return {"games": response.data}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/me")
async def read_users_me(current_user: dict = Depends(auth.auth_dependency)):
    # Testing the RLS and JWT verification
    return {"user_id": current_user["id"], "message": "You are authenticated!"}

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(wallet.router, prefix="/api/wallet", tags=["wallet"])
app.include_router(games.router, prefix="/api/games", tags=["games"])