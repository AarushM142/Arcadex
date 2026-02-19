import React, { useEffect, useState } from 'react';
import { UserAuth } from '../context/AuthContext';
import { AppShell } from './AppShell';
import {
    adminGetPendingTransactions,
    adminApproveTransaction,
    adminRejectTransaction,
    adminGetAllUsers,
    adminToggleUserBan,
    adminGrantCoins
} from '../apiClient';

const ADMIN_EMAIL = 'am2007144@gmail.com';

const Admin = () => {
    const { user, session } = UserAuth();
    const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' or 'users'
    const [transactions, setTransactions] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState({});
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // For granting coins
    const [grantAmount, setGrantAmount] = useState({});

    const isAdmin = user?.email === ADMIN_EMAIL;

    const fetchData = async () => {
        if (!session?.access_token) return;
        setLoading(true);
        setError('');
        try {
            if (activeTab === 'transactions') {
                const data = await adminGetPendingTransactions(session.access_token);
                setTransactions(data?.transactions || []);
            } else {
                const data = await adminGetAllUsers(session.access_token);
                setUsers(data?.users || []);
            }
        } catch (err) {
            setError(err.message || `Failed to load ${activeTab}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAdmin && session?.access_token) {
            fetchData();
        } else {
            setLoading(false);
        }
    }, [user, session, activeTab]);

    const handleApprove = async (txnId) => {
        setActionLoading(prev => ({ ...prev, [txnId]: 'approving' }));
        setError('');
        try {
            await adminApproveTransaction(session.access_token, txnId);
            setSuccessMsg(`Approved! Coins credited.`);
            setTransactions(prev => prev.filter(t => t.id !== txnId));
            setTimeout(() => setSuccessMsg(''), 4000);
        } catch (err) {
            setError(err.message || 'Failed to approve');
        } finally {
            setActionLoading(prev => ({ ...prev, [txnId]: null }));
        }
    };

    const handleReject = async (txnId) => {
        setActionLoading(prev => ({ ...prev, [txnId]: 'rejecting' }));
        setError('');
        try {
            await adminRejectTransaction(session.access_token, txnId);
            setSuccessMsg(`Transaction rejected.`);
            setTransactions(prev => prev.filter(t => t.id !== txnId));
            setTimeout(() => setSuccessMsg(''), 4000);
        } catch (err) {
            setError(err.message || 'Failed to reject');
        } finally {
            setActionLoading(prev => ({ ...prev, [txnId]: null }));
        }
    };

    const handleToggleBan = async (userId, currentlyBanned) => {
        setActionLoading(prev => ({ ...prev, [userId]: 'banning' }));
        setError('');
        try {
            await adminToggleUserBan(session.access_token, userId, !currentlyBanned);
            setSuccessMsg(`User ${currentlyBanned ? 'unbanned' : 'banned'} successfully.`);
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_banned: !currentlyBanned } : u));
            setTimeout(() => setSuccessMsg(''), 4000);
        } catch (err) {
            setError(err.message || 'Failed to toggle ban');
        } finally {
            setActionLoading(prev => ({ ...prev, [userId]: null }));
        }
    };

    const handleGrantCoins = async (userId) => {
        const amount = parseInt(grantAmount[userId] || 0);
        if (isNaN(amount) || amount === 0) return;

        setActionLoading(prev => ({ ...prev, [`grant-${userId}`]: true }));
        setError('');
        try {
            const data = await adminGrantCoins(session.access_token, userId, amount);
            setSuccessMsg(`Granted ${amount} coins. New balance: ${data.new_balance}`);
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, coin_balance: data.new_balance } : u));
            setGrantAmount(prev => ({ ...prev, [userId]: '' }));
            setTimeout(() => setSuccessMsg(''), 4000);
        } catch (err) {
            setError(err.message || 'Failed to grant coins');
        } finally {
            setActionLoading(prev => ({ ...prev, [`grant-${userId}`]: false }));
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleString();
    };

    if (!isAdmin) {
        return (
            <AppShell>
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                    <span className="text-6xl">🚫</span>
                    <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
                    <p className="text-muted">This page is only accessible to administrators.</p>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-foreground uppercase tracking-widest">
                            🛡️ Admin Palace
                        </h1>
                        <p className="text-muted text-sm mt-1">Total control over Arcadex ecosystem</p>
                    </div>

                    {/* Tab Switcher */}
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                        <button
                            onClick={() => setActiveTab('transactions')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'transactions' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30' : 'text-muted hover:text-white'}`}
                        >
                            TRANSACTIONS
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-purple-500 text-black shadow-lg shadow-purple-500/30' : 'text-muted hover:text-white'}`}
                        >
                            USER MANAGEMENT
                        </button>
                    </div>
                </div>

                {/* Messages */}
                {error && (
                    <div className="glass card-xl p-4 mb-6 border border-red-500/30 bg-red-500/10 text-red-400">
                        ⚠️ {error}
                    </div>
                )}
                {successMsg && (
                    <div className="glass card-xl p-4 mb-6 border border-green-500/30 bg-green-500/10 text-green-400">
                        ✅ {successMsg}
                    </div>
                )}

                {activeTab === 'transactions' ? (
                    <>
                        {/* Transactions Section */}
                        <div className="glass card-xl p-5 mb-6 flex items-center gap-4">
                            <span className="text-3xl">⏳</span>
                            <div>
                                <p className="text-xs text-muted uppercase tracking-widest">Pending Approvals</p>
                                <p className="text-4xl font-black text-yellow-400">{loading ? '...' : transactions.length}</p>
                            </div>
                        </div>

                        <div className="glass card-xl overflow-hidden">
                            <div className="p-5 border-b border-white/10 flex justify-between items-center">
                                <h2 className="text-lg font-bold text-foreground uppercase tracking-wide">
                                    Pending Transactions
                                </h2>
                                <button onClick={fetchData} disabled={loading} className="text-xs text-cyan-400 hover:underline">
                                    REFRESH LIST
                                </button>
                            </div>

                            {loading ? (
                                <div className="p-12 text-center text-muted animate-pulse">Loading...</div>
                            ) : transactions.length === 0 ? (
                                <div className="p-12 text-center text-muted">No pending transactions.</div>
                            ) : (
                                <div className="divide-y divide-white/5">
                                    {transactions.map((txn) => (
                                        <div key={txn.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/5 transition-colors">
                                            <div className="flex-1 space-y-1">
                                                <p className="text-foreground font-semibold">
                                                    ₹{txn.amount_rupees} → <span className="text-yellow-400">{txn.coins_added} coins</span>
                                                </p>
                                                <p className="text-sm text-muted">
                                                    UPI ID: <span className="text-foreground font-mono">{txn.upi_transaction_id}</span>
                                                </p>
                                                <p className="text-xs text-muted">User: {txn.user_id}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleApprove(txn.id)} disabled={actionLoading[txn.id]} className="px-4 py-2 rounded-lg bg-green-500/20 text-green-400 text-xs font-bold border border-green-500/30 hover:bg-green-500/30">APPROVE</button>
                                                <button onClick={() => handleReject(txn.id)} disabled={actionLoading[txn.id]} className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/30 hover:bg-red-500/30">REJECT</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        {/* Users Management Section */}
                        <div className="glass card-xl overflow-hidden">
                            <div className="p-5 border-b border-white/10 flex justify-between items-center">
                                <h2 className="text-lg font-bold text-foreground uppercase tracking-wide">
                                    Registered Players
                                </h2>
                                <button onClick={fetchData} disabled={loading} className="text-xs text-purple-400 hover:underline">
                                    REFRESH LIST
                                </button>
                            </div>

                            {loading ? (
                                <div className="p-12 text-center text-muted animate-pulse">Loading Players...</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-white/5 text-xs text-muted uppercase">
                                                <th className="p-4 border-b border-white/10">Player</th>
                                                <th className="p-4 border-b border-white/10">Balance</th>
                                                <th className="p-4 border-b border-white/10">Status</th>
                                                <th className="p-4 border-b border-white/10">Grant Coins</th>
                                                <th className="p-4 border-b border-white/10">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {users.map((u) => (
                                                <tr key={u.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center text-xs">
                                                                {u.username?.[0]?.toUpperCase() || 'P'}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-foreground">{u.username || 'Unnamed'}</p>
                                                                <p className="text-[10px] text-muted">{u.email}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="text-sm font-mono text-yellow-400 font-bold">
                                                            {u.coin_balance?.toLocaleString() || 0}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        {u.is_banned ? (
                                                            <span className="text-[10px] bg-red-500/20 text-red-500 px-2 py-0.5 rounded-full font-bold">BANNED</span>
                                                        ) : (
                                                            <span className="text-[10px] bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full font-bold">ACTIVE</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="number"
                                                                placeholder="Amt"
                                                                className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-cyan-500 outline-none"
                                                                value={grantAmount[u.id] || ''}
                                                                onChange={(e) => setGrantAmount(prev => ({ ...prev, [u.id]: e.target.value }))}
                                                            />
                                                            <button
                                                                onClick={() => handleGrantCoins(u.id)}
                                                                disabled={actionLoading[`grant-${u.id}`]}
                                                                className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-all border border-cyan-500/30"
                                                            >
                                                                {actionLoading[`grant-${u.id}`] ? '...' : 'ADD'}
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <button
                                                            onClick={() => handleToggleBan(u.id, u.is_banned)}
                                                            disabled={actionLoading[u.id]}
                                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${u.is_banned ? 'bg-green-500/20 text-green-500 border-green-500/30 hover:bg-green-500/40' : 'bg-red-500/20 text-red-500 border-red-500/30 hover:bg-red-500/40'}`}
                                                        >
                                                            {actionLoading[u.id] === 'banning' ? '...' : u.is_banned ? 'UNBAN' : 'BAN'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </AppShell>
    );
};

export default Admin;
