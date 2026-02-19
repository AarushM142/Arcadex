import React, { useEffect, useState } from 'react';
import { UserAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { AppShell } from './AppShell';
import { getWalletBalance, getWalletTransactions, submitUpiPayment } from '../apiClient';

const Wallet = () => {
  const { user, session } = UserAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [upiId, setUpiId] = useState('');
  const [submitError, setSubmitError] = useState('');

  const coinPackages = [
    { rupees: 10, coins: 100, bonus: 0 },
    { rupees: 50, coins: 600, bonus: 100 },
    { rupees: 100, coins: 1300, bonus: 300 },
  ];

  useEffect(() => {
    const fetchWalletData = async () => {
      if (!user || !session?.access_token) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Fetch balance
        const balanceData = await getWalletBalance(session.access_token);
        if (balanceData?.coin_balance !== undefined) {
          setBalance(balanceData.coin_balance);
        }

        // Fetch transactions
        const txnData = await getWalletTransactions(session.access_token);
        if (txnData?.transactions) {
          setTransactions(txnData.transactions);
        }
      } catch (error) {
        console.error('Error fetching wallet data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWalletData();
  }, [user, session]);

  const handlePurchase = async (packageData) => {
    if (!session?.access_token) {
      alert('Please sign in to purchase coins');
      return;
    }

    setSelectedAmount(packageData);
    setUpiId('');
  };

  const handleSubmitPayment = async () => {
    if (!upiId.trim()) {
      alert('Please enter UPI transaction ID');
      return;
    }

    if (!selectedAmount) return;

    try {
      setSubmitting(true);
      setSubmitError('');
      const result = await submitUpiPayment(session.access_token, {
        amount_rupees: selectedAmount.rupees,
        upi_transaction_id: upiId.trim(),
      });

      if (result?.transaction) {
        setSelectedAmount(null);
        setUpiId('');
        setSubmitError('');

        // Refresh wallet data
        const balanceData = await getWalletBalance(session.access_token);
        if (balanceData?.coin_balance !== undefined) {
          setBalance(balanceData.coin_balance);
        }

        const txnData = await getWalletTransactions(session.access_token);
        if (txnData?.transactions) {
          setTransactions(txnData.transactions);
        }

        alert('Payment submitted! It will be reviewed and approved shortly.');
      }
    } catch (error) {
      console.error('Error submitting payment:', error);
      setSubmitError(error.message || 'Failed to submit payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  const getTransactionIcon = (type) => {
    const t = type?.toLowerCase() || '';
    if (t.includes('purchased') || t.includes('win') || t.includes('approved') || t.includes('pending')) {
      return '↑';
    }
    return '↓';
  };

  const getTransactionColor = (type) => {
    const t = type?.toLowerCase() || '';
    if (t.includes('purchased') || t.includes('win') || t.includes('approved') || t.includes('pending')) {
      return 'text-green-400';
    }
    return 'text-red-400';
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        {/* Balance Section */}
        <div className="text-center mb-8">
          <p className="text-sm text-muted uppercase tracking-wide mb-2">YOUR BALANCE</p>
          <div className="flex items-center justify-center gap-3">
            <img src="/currency.png" alt="coins" className="w-12 h-12 object-contain" />
            <p className="text-5xl font-bold text-yellow-400">
              {loading ? '...' : balance.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Buy Coins Section */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-foreground mb-4 uppercase tracking-wide">
            BUY COINS
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {coinPackages.map((pkg) => (
              <button
                key={pkg.rupees}
                onClick={() => handlePurchase(pkg)}
                className={`glass card-xl p-6 text-center relative transition-all duration-200 hover:scale-105 ${selectedAmount?.rupees === pkg.rupees ? 'border-2 border-cyan-400/50' : ''
                  }`}
              >
                {pkg.bonus > 0 && (
                  <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                    {pkg.bonus} bonus
                  </span>
                )}
                <p className="text-3xl font-bold text-foreground mb-2">₹ {pkg.rupees}</p>
                <p className="text-yellow-400 font-semibold">{pkg.coins} coins</p>
              </button>
            ))}
          </div>

          {/* Payment Form */}
          {selectedAmount && (
            <div className="glass card-xl p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">
                Purchase ₹{selectedAmount.rupees} ({selectedAmount.coins} coins)
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted uppercase tracking-wide mb-2 block">
                    UPI Transaction ID
                  </label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => { setUpiId(e.target.value); setSubmitError(''); }}
                    placeholder="Enter your UPI transaction ID"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/20 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-colors"
                  />
                </div>
                {submitError && (
                  <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                    ⚠️ {submitError}
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={handleSubmitPayment}
                    disabled={submitting || !upiId.trim()}
                    className="btn-primary flex-1 disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Submit Payment'}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedAmount(null);
                      setUpiId('');
                      setSubmitError('');
                    }}
                    className="btn-ghost"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* History Section */}
        <div>
          <h2 className="text-xl font-bold text-foreground mb-4 uppercase tracking-wide">
            HISTORY
          </h2>

          <div className="space-y-3">
            {loading ? (
              <div className="text-center text-muted py-8">Loading transactions...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center text-muted py-8">No transactions yet</div>
            ) : (
              transactions.map((txn) => (
                <div
                  key={txn.id}
                  className="glass card-xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <span className={`text-2xl ${getTransactionColor(txn.type || txn.status)}`}>
                      {getTransactionIcon(txn.type || txn.status)}
                    </span>
                    <div>
                      <p className="text-foreground font-medium">
                        {txn.type ||
                          (txn.status === 'approved' ? 'Purchased' : 'Pending Purchase')}
                        {txn.amount_rupees && ` (₹${txn.amount_rupees})`}
                        {txn.game_id && ` - ${txn.game_id}`}
                      </p>
                      <p className="text-sm text-muted">
                        {formatDate(txn.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${getTransactionColor(txn.type || txn.status)}`}>
                      {txn.coins_added || txn.coins_won ? '+' : '-'}
                      {Math.abs(txn.coins_added || txn.coins_won || 0)}
                    </p>
                    <p className="text-xs text-muted capitalize">
                      {txn.status || 'completed'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default Wallet;
