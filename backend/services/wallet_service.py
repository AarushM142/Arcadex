import asyncio
from typing import Dict, List
from backend.services.supabase_client import supabase

def _compute_coins(amount_rupees: int) -> int:
    if amount_rupees == 10: return 100
    if amount_rupees == 50: return 600
    if amount_rupees == 100: return 1300
    return 0

async def get_balance(user_id: str):
    response = await asyncio.to_thread(supabase.table("profiles").select("coin_balance").eq("id", user_id).single().execute)
    return response.data.get("coin_balance", 100) if response.data else 100

async def list_transactions(user_id: str):
    response = await asyncio.to_thread(supabase.table("transactions").select("*").eq("user_id", user_id).order("created_at", desc=True).execute)
    return response.data if response.data else []

async def update_balance(user_id: str, amount: int):
    current_balance = await get_balance(user_id)
    new_balance = current_balance + amount
    await asyncio.to_thread(supabase.table("profiles").update({"coin_balance": new_balance}).eq("id", user_id).execute)
    return new_balance

async def create_pending_transaction(user_id: str, amount_rupees: int, upi_transaction_id: str) -> Dict:
    coins = _compute_coins(amount_rupees)
    
    # Save directly to Supabase 'transactions' table
    data = {
        "user_id": user_id,
        "amount_rupees": amount_rupees,
        "coins_added": coins,
        "upi_transaction_id": upi_transaction_id, # Matches your DB column name
        "status": "pending"
    }
    
    response = await asyncio.to_thread(supabase.table("transactions").insert(data).execute)
    return response.data[0] if response.data else {}

async def approve_transaction(transaction_id: str) -> Dict:
    # 1. Fetch the transaction from DB
    response = await asyncio.to_thread(supabase.table("transactions").select("*").eq("id", transaction_id).single().execute)
    txn = response.data
    
    if not txn:
        raise ValueError("Transaction not found")
    if txn["status"] != "pending":
        return txn

    # 2. Update transaction status to approved
    await asyncio.to_thread(supabase.table("transactions").update({"status": "approved"}).eq("id", transaction_id).execute)
    
    # 3. Add the coins to the user's profile balance
    await update_balance(txn["user_id"], txn["coins_added"])
    
    txn["status"] = "approved"
    return txn

async def add_game_reward(user_id: str, coins: int) -> int:
    if coins <= 0:
        return await get_balance(user_id)
    # Update balance in the profiles table
    return await update_balance(user_id, coins)

async def list_all_pending_transactions() -> list:
    response = await asyncio.to_thread(
        supabase.table("transactions").select("*").eq("status", "pending").order("created_at", desc=False).execute
    )
    return response.data if response.data else []

async def reject_transaction(transaction_id: str) -> Dict:
    response = await asyncio.to_thread(
        supabase.table("transactions").select("*").eq("id", transaction_id).single().execute
    )
    txn = response.data
    if not txn:
        raise ValueError("Transaction not found")
    if txn["status"] != "pending":
        return txn
    await asyncio.to_thread(
        supabase.table("transactions").update({"status": "rejected"}).eq("id", transaction_id).execute
    )
    txn["status"] = "rejected"
    return txn

async def list_all_users() -> list:
    response = await asyncio.to_thread(
        supabase.table("profiles").select("*").order("created_at", desc=True).execute
    )
    return response.data if response.data else []

async def toggle_user_ban(user_id: str, is_banned: bool) -> dict:
    # This assumes there is an 'is_banned' column in the profiles table
    response = await asyncio.to_thread(
        supabase.table("profiles").update({"is_banned": is_banned}).eq("id", user_id).execute
    )
    return response.data[0] if response.data else {}

async def grant_coins_to_user(user_id: str, amount: int) -> int:
    # amount can be positive or negative
    return await update_balance(user_id, amount)