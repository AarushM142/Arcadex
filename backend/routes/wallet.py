from fastapi import APIRouter, Depends, Header, HTTPException, status
from backend.routes.auth import auth_dependency
from backend.services import wallet_service

ADMIN_EMAIL = "am2007144@gmail.com"

router = APIRouter()


@router.get("/balance")
async def get_balance(user=Depends(auth_dependency)):
    """Return the user's coin balance."""
    balance = await wallet_service.get_balance(user_id=user["id"])
    return {"coin_balance": balance}


@router.get("/transactions")
async def list_transactions(user=Depends(auth_dependency)):
    """List the user's coin transactions (pending/approved/rejected)."""
    items = await wallet_service.list_transactions(user_id=user["id"])
    return {"transactions": items}


@router.get("/admin/transactions")
async def admin_list_all_transactions(user=Depends(auth_dependency)):
    """Admin-only: list ALL pending transactions."""
    if user.get("email") != ADMIN_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    items = await wallet_service.list_all_pending_transactions()
    return {"transactions": items}


@router.get("/admin/users")
async def admin_list_all_users(user=Depends(auth_dependency)):
    """Admin-only: list all registered users."""
    if user.get("email") != ADMIN_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    users = await wallet_service.list_all_users()
    return {"users": users}


@router.post("/admin/users/{user_id}/ban")
async def admin_ban_user(user_id: str, payload: dict, user=Depends(auth_dependency)):
    """Admin-only: ban or unban a user."""
    if user.get("email") != ADMIN_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    is_banned = payload.get("is_banned", True)
    updated_user = await wallet_service.toggle_user_ban(user_id, is_banned)
    return {"user": updated_user}


@router.post("/admin/users/{user_id}/grant")
async def admin_grant_coins(user_id: str, payload: dict, user=Depends(auth_dependency)):
    """Admin-only: grant or deduct coins from a user."""
    if user.get("email") != ADMIN_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    amount = int(payload.get("amount", 0))
    new_balance = await wallet_service.grant_coins_to_user(user_id, amount)
    return {"new_balance": new_balance}


@router.post("/upi/submit")
async def submit_upi_payment(
    payload: dict,
    user=Depends(auth_dependency),
):
    """Create a pending UPI transaction and proposed coin amount."""
    amount_rupees = int(payload.get("amount_rupees", 0))
    upi_txn_id = (payload.get("upi_transaction_id") or "").strip()
    if amount_rupees not in (10, 50, 100) or not upi_txn_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid amount or UPI transaction ID",
        )

    txn = await wallet_service.create_pending_transaction(
        user_id=user["id"],
        amount_rupees=amount_rupees,
        upi_transaction_id=upi_txn_id,
    )
    return {"transaction": txn}


@router.post("/admin/transactions/{transaction_id}/approve")
async def approve_transaction(
    transaction_id: str,
    user=Depends(auth_dependency),
):
    """Admin-only endpoint to approve a pending transaction and credit coins."""
    if user.get("email") != ADMIN_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    txn = await wallet_service.approve_transaction(transaction_id=transaction_id)
    return {"transaction": txn}


@router.post("/admin/transactions/{transaction_id}/reject")
async def reject_transaction(
    transaction_id: str,
    user=Depends(auth_dependency),
):
    """Admin-only endpoint to reject a pending transaction."""
    if user.get("email") != ADMIN_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    txn = await wallet_service.reject_transaction(transaction_id=transaction_id)
    return {"transaction": txn}
