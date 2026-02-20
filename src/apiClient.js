let API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "";
if (API_BASE_URL && !API_BASE_URL.endsWith('/api')) {
  API_BASE_URL = `${API_BASE_URL.replace(/\/$/, '')}/api`;
} else if (!API_BASE_URL) {
  API_BASE_URL = "/api";
}

async function withAuth(options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = options.accessToken;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return {
    ...options,
    headers,
  };
}

export async function getWalletBalance(accessToken) {
  const opts = await withAuth({ accessToken });
  const res = await fetch(`${API_BASE_URL}/wallet/balance`, opts);
  if (!res.ok) throw new Error("Failed to fetch balance");
  return res.json();
}

export async function getWalletTransactions(accessToken) {
  const opts = await withAuth({ accessToken });
  const res = await fetch(`${API_BASE_URL}/wallet/transactions`, opts);
  if (!res.ok) throw new Error("Failed to fetch transactions");
  return res.json();
}

export async function submitUpiPayment(accessToken, payload) {
  const opts = await withAuth({
    accessToken,
    method: "POST",
    body: JSON.stringify(payload),
  });
  const res = await fetch(`${API_BASE_URL}/wallet/upi/submit`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to submit UPI payment");
  }
  return res.json();
}

export async function startTicTacToe(accessToken) {
  const opts = await withAuth({
    accessToken,
    method: "POST",
  });
  const res = await fetch(`${API_BASE_URL}/games/tictactoe/start`, opts);
  if (!res.ok) throw new Error("Failed to start game");
  return res.json();
}

export async function ticTacToeMove(accessToken, payload) {
  const opts = await withAuth({
    accessToken,
    method: "POST",
    body: JSON.stringify(payload),
  });
  const res = await fetch(`${API_BASE_URL}/games/tictactoe/move`, opts);
  if (!res.ok) throw new Error("Failed to play move");
  return res.json();
}

// Admin functions
export async function adminGetPendingTransactions(accessToken) {
  const opts = await withAuth({ accessToken });
  const res = await fetch(`${API_BASE_URL}/wallet/admin/transactions`, opts);
  if (!res.ok) throw new Error("Failed to fetch pending transactions");
  return res.json();
}

export async function adminApproveTransaction(accessToken, transactionId) {
  const opts = await withAuth({ accessToken, method: "POST" });
  const res = await fetch(`${API_BASE_URL}/wallet/admin/transactions/${transactionId}/approve`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to approve transaction");
  }
  return res.json();
}

export async function adminRejectTransaction(accessToken, transactionId) {
  const opts = await withAuth({ accessToken, method: "POST" });
  const res = await fetch(`${API_BASE_URL}/wallet/admin/transactions/${transactionId}/reject`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to reject transaction");
  }
  return res.json();
}

export async function adminGetAllUsers(accessToken) {
  const opts = await withAuth({ accessToken });
  const res = await fetch(`${API_BASE_URL}/wallet/admin/users`, opts);
  if (!res.ok) throw new Error("Failed to fetch all users");
  return res.json();
}

export async function adminToggleUserBan(accessToken, userId, isBanned) {
  const opts = await withAuth({
    accessToken,
    method: "POST",
    body: JSON.stringify({ is_banned: isBanned })
  });
  const res = await fetch(`${API_BASE_URL}/wallet/admin/users/${userId}/ban`, opts);
  if (!res.ok) throw new Error("Failed to toggle user ban");
  return res.json();
}

export async function adminGrantCoins(accessToken, userId, amount) {
  const opts = await withAuth({
    accessToken,
    method: "POST",
    body: JSON.stringify({ amount: amount })
  });
  const res = await fetch(`${API_BASE_URL}/wallet/admin/users/${userId}/grant`, opts);
  if (!res.ok) throw new Error("Failed to grant coins");
  return res.json();
}
