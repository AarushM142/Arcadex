import React, { useEffect, useState } from 'react';
import { UserAuth } from '../context/AuthContext';
import { AppShell } from './AppShell';
import { adminGetPendingTransactions, adminApproveTransaction, adminRejectTransaction } from '../apiClient';

const ADMIN_EMAIL = 'am2007144@gmail.com';

const Admin = () => {
    const { user, session } = UserAuth();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState({});
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const isAdmin = user?.email === ADMIN_EMAIL;

    const fetchTransactions = async () => {
        if (!session?.access_token) return;
        try {
            setLoading(true);
            setError('');
            const data = await adminGetPendingTransactions(session.access_token);
            setTransactions(data?.transactions || []);
        } catch (err) {
            setError(err.message || 'Failed to load transactions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAdmin && session?.access_token) {
            fetchTransactions();
        } else {
            setLoading(false);
        }
    }, [user, session]);

    const handleApprove = async (txnId) => {
        setActionLoading(prev => ({ ...prev, [txnId]: 'approving' }));
        setError('');
        try {
            await adminApproveTransaction(session.access_token, txnId);
            setSuccessMsg(`Transaction ${txnId.slice(0, 8)}... approved! Coins credited.`);
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
            setSuccessMsg(`Transaction ${txnId.slice(0, 8)}... rejected.`);
            setTransactions(prev => prev.filter(t => t.id !== txnId));
            setTimeout(() => setSuccessMsg(''), 4000);
        } catch (err) {
            setError(err.message || 'Failed to reject');
        } finally {
            setActionLoading(prev => ({ ...prev, [txnId]: null }));
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
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-foreground uppercase tracking-widest">
                            🛡️ Admin Panel
                        </h1>
                        <p className="text-muted text-sm mt-1">Manage pending UPI payment approvals</p>
                    </div>
                    <button
                        onClick={fetchTransactions}
                        disabled={loading}
                        className="btn-primary px-5 py-2.5 text-sm"
                    >
                        {loading ? '⟳ Refreshing...' : '⟳ Refresh'}
                    </button>
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

                {/* Stats */}
                <div className="glass card-xl p-5 mb-6 flex items-center gap-4">
                    <span className="text-3xl">⏳</span>
                    <div>
                        <p className="text-xs text-muted uppercase tracking-widest">Pending Approvals</p>
                        <p className="text-4xl font-black text-yellow-400">{loading ? '...' : transactions.length}</p>
                    </div>
                </div>

                {/* Transactions Table */}
                <div className="glass card-xl overflow-hidden">
                    <div className="p-5 border-b border-white/10">
                        <h2 className="text-lg font-bold text-foreground uppercase tracking-wide">
                            Pending Transactions
                        </h2>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-muted">
                            <div className="text-4xl mb-3 animate-pulse">⏳</div>
                            Loading transactions...
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="p-12 text-center text-muted">
                            <div className="text-4xl mb-3">✅</div>
                            No pending transactions. All clear!
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {transactions.map((txn) => (
                                <div key={txn.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/5 transition-colors">
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-mono text-muted bg-white/5 px-2 py-0.5 rounded">
                                                {txn.id?.slice(0, 12)}...
                                            </span>
                                            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-semibold uppercase">
                                                {txn.status}
                                            </span>
                                        </div>
                                        <p className="text-foreground font-semibold">
                                            ₹{txn.amount_rupees} → <span className="text-yellow-400">{txn.coins_added} coins</span>
                                        </p>
                                        <p className="text-sm text-muted">
                                            UPI ID: <span className="text-foreground font-mono">{txn.upi_id}</span>
                                        </p>
                                        <p className="text-xs text-muted">
                                            User: {txn.user_id?.slice(0, 16)}... · {formatDate(txn.created_at)}
                                        </p>
                                    </div>

                                    <div className="flex gap-3 shrink-0">
                                        <button
                                            onClick={() => handleApprove(txn.id)}
                                            disabled={!!actionLoading[txn.id]}
                                            className="px-5 py-2 rounded-xl bg-green-500/20 border border-green-500/40 text-green-400 font-semibold text-sm hover:bg-green-500/30 transition-colors disabled:opacity-50"
                                        >
                                            {actionLoading[txn.id] === 'approving' ? '...' : '✓ Approve'}
                                        </button>
                                        <button
                                            onClick={() => handleReject(txn.id)}
                                            disabled={!!actionLoading[txn.id]}
                                            className="px-5 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 font-semibold text-sm hover:bg-red-500/30 transition-colors disabled:opacity-50"
                                        >
                                            {actionLoading[txn.id] === 'rejecting' ? '...' : '✕ Reject'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
};

export default Admin;
