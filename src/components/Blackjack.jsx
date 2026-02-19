import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BlackjackEngine, GameResult, GameActions } from '../engines/blackjackEngine';
import { UserAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { AppShell } from './AppShell';

const CARD_SUITS = ['♠', '♣', '♥', '♦'];
const CARD_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const Card = ({ card, hidden }) => {
    if (hidden) {
        return (
            <div className="w-20 h-28 bg-gradient-to-br from-indigo-900 to-purple-900 rounded-lg border-2 border-white/20 flex items-center justify-center shadow-xl transform hover:-rotate-2 transition-transform">
                <div className="w-16 h-24 border border-white/10 rounded flex items-center justify-center text-4xl opacity-20">🎮</div>
            </div>
        );
    }

    const rank = CARD_RANKS[card % 13];
    const suit = CARD_SUITS[Math.floor(card / 13)];
    const isRed = suit === '♥' || suit === '♦';

    return (
        <div className={`w-20 h-28 bg-white rounded-lg border-2 border-gray-200 flex flex-col justify-between p-2 shadow-xl transform transition-transform hover:-translate-y-1 ${isRed ? 'text-red-600' : 'text-black'}`}>
            <div className="text-lg font-bold leading-none">{rank}<br /><span className="text-sm">{suit}</span></div>
            <div className="text-3xl self-center">{suit}</div>
            <div className="text-lg font-bold leading-none self-end text-right">{rank}<br /><span className="text-sm">{suit}</span></div>
        </div>
    );
};

const Blackjack = () => {
    const { user } = UserAuth();
    const navigate = useNavigate();
    const [engine] = useState(() => new BlackjackEngine());
    const [gameState, setGameState] = useState(null);
    const [hint, setHint] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [gameStatus, setGameStatus] = useState('BETTING'); // BETTING, PLAYING, FINISHED
    const [results, setResults] = useState([]);
    const [message, setMessage] = useState('');
    const [currentBet, setCurrentBet] = useState(10);
    const [userBalance, setUserBalance] = useState(0);

    const [leaderboard, setLeaderboard] = useState([]);

    const fetchLeaderboard = useCallback(async () => {
        const { data } = await supabase
            .from('profiles')
            .select('username, avatar_url, coin_balance')
            .order('coin_balance', { ascending: false })
            .limit(5);
        if (data) setLeaderboard(data);
    }, []);

    const fetchBalance = useCallback(async () => {
        if (!user) return;
        const { data } = await supabase
            .from('profiles')
            .select('coin_balance')
            .eq('id', user.id)
            .single();
        if (data) setUserBalance(data.coin_balance || 0);
    }, [user]);

    useEffect(() => {
        fetchBalance();
        fetchLeaderboard();
    }, [fetchBalance, fetchLeaderboard]);

    const refreshState = useCallback(() => {
        setGameState({
            dealerHand: { ...engine.dealerHand, score: engine._calculateScore(engine.dealerHand) },
            playerHands: engine.playerHands.map(h => ({ ...h, score: engine._calculateScore(h) })),
            activeHandIndex: engine.activeHandIndex
        });
        setHint(null);
    }, [engine]);

    const startNewGame = async () => {
        if (userBalance < currentBet) {
            setMessage('Insufficient balance to place this bet!');
            return;
        }

        setIsProcessing(true);
        try {
            // Deduct the bet amount immediately
            const newBalance = userBalance - currentBet;
            const { error: deductError } = await supabase
                .from('profiles')
                .update({ coin_balance: newBalance })
                .eq('id', user.id);

            if (deductError) throw deductError;
            setUserBalance(newBalance);

            // Start game
            engine.startDeal(currentBet);
            refreshState();
            setGameStatus('PLAYING');
            setMessage('');
            setResults([]);

            if (engine.playerHands[0].isDone) {
                handleDealerTurn(newBalance);
            }
        } catch (err) {
            console.error(err);
            setMessage('Failed to start game.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAction = async (action) => {
        if (isProcessing || gameStatus !== 'PLAYING') return;

        // Handle double down deduction
        if (action === GameActions.DOUBLE) {
            if (userBalance < currentBet) {
                setMessage('Not enough coins to double!');
                return;
            }
            const newBalance = userBalance - currentBet;
            await supabase.from('profiles').update({ coin_balance: newBalance }).eq('id', user.id);
            setUserBalance(newBalance);
        }

        // Handle split deduction
        if (action === GameActions.SPLIT) {
            if (userBalance < currentBet) {
                setMessage('Not enough coins to split!');
                return;
            }
            const newBalance = userBalance - currentBet;
            await supabase.from('profiles').update({ coin_balance: newBalance }).eq('id', user.id);
            setUserBalance(newBalance);
        }

        setIsProcessing(true);
        switch (action) {
            case GameActions.HIT: engine.hit(); break;
            case GameActions.STAND: engine.stand(); break;
            case GameActions.DOUBLE: engine.double(); break;
            case GameActions.SPLIT: engine.split(); break;
        }

        refreshState();

        if (engine.playerHands[engine.activeHandIndex].isDone) {
            if (engine.activeHandIndex < engine.playerHands.length - 1) {
                engine.activeHandIndex++;
                refreshState();
            } else {
                // Determine current balance to pass forward
                let currentRunningBalance = userBalance;
                if (action === GameActions.DOUBLE || action === GameActions.SPLIT) {
                    currentRunningBalance -= currentBet;
                }
                handleDealerTurn(currentRunningBalance);
            }
        }
        setIsProcessing(false);
    };

    const handleDealerTurn = async (latestBalance) => {
        engine.dealerPlay();
        const gameResults = engine.getResult();
        setResults(gameResults);
        setGameStatus('FINISHED');
        refreshState();

        let totalWin = 0;
        gameResults.forEach((res, idx) => {
            const bet = engine.playerHands[idx].bet;
            if (res === GameResult.WIN) totalWin += bet * 2;
            else if (res === GameResult.PUSH) totalWin += bet;
            else if (res === GameResult.BLACKJACK) totalWin += Math.floor(bet * 2.5);
        });

        if (totalWin > 0) {
            const finalBalance = latestBalance + totalWin;
            const { error: winError } = await supabase
                .from('profiles')
                .update({ coin_balance: finalBalance })
                .eq('id', user.id);

            if (!winError) {
                setUserBalance(finalBalance);
                setMessage(`YOU WON ${totalWin} COINS!`);
                fetchLeaderboard();
            }
        } else {
            setMessage('HOUSE WINS.');
        }

        // Logic to determine session result string
        let sessionResult = 'lose';
        if (totalWin > engine.playerHands.reduce((s, h) => s + h.bet, 0)) sessionResult = 'win';
        else if (totalWin > 0) sessionResult = 'push';

        // Finalize session with result tracking
        const { error: sessionError } = await supabase.from('game_sessions').insert({
            user_id: user.id.toString(), // Ensure ID is string
            game_id: "blackjack",        // Force string literal
            coins_won: parseInt(totalWin) || 0,
            result: sessionResult.toString()
        });

        if (sessionError) {
            console.error("DATABASE ERROR: Could not save Blackjack session.", sessionError);
            console.log("Check if 'game_id' column in 'game_sessions' table is set to TEXT type.");
        }
    };

    const showHint = () => {
        setHint(engine.getHint());
    };

    return (
        <AppShell>
            <div className="max-w-4xl mx-auto py-4 px-4 pb-32">
                <div className="glass-strong card-xl p-8 min-h-[650px] flex flex-col relative overflow-hidden">

                    <div className="absolute inset-0 bg-gradient-to-b from-green-900/10 to-transparent pointer-events-none" />

                    {/* Dealer Section */}
                    <div className="flex flex-col lg:flex-row gap-8 relative z-10">
                        <div className="flex-1 flex flex-col items-center">
                            <div className="text-[10px] font-black text-muted uppercase tracking-[0.3em] mb-4 bg-white/5 px-4 py-1 rounded-full border border-white/5">HOUSE</div>
                            <div className="flex gap-4 justify-center">
                                {gameState?.dealerHand.cards.map((card, i) => (
                                    <Card key={i} card={card} hidden={gameStatus === 'PLAYING' && i === 1} />
                                ))}
                            </div>
                            {gameStatus === 'FINISHED' && (
                                <div className="mt-4 px-3 py-1 bg-white/10 rounded-lg text-xs font-bold text-white/80">
                                    DEALER SCORE: {gameState.dealerHand.score}
                                </div>
                            )}
                        </div>

                        {/* Cash Leaderboard Overlay */}
                        <div className="w-full lg:w-48 glass p-4 rounded-xl border-white/5 max-h-[140px] overflow-hidden">
                            <h3 className="text-[8px] font-black text-cyan-400 uppercase tracking-widest mb-2">Cash Leaders</h3>
                            <div className="space-y-1.5">
                                {leaderboard.map((player, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-[10px]">
                                        <span className="text-white/40 truncate w-20">{player.username || 'Anon'}</span>
                                        <span className="font-bold text-white">${player.coin_balance}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Middle Info / Entry Area */}
                    <div className="flex-1 flex flex-col items-center justify-center py-10">
                        {gameStatus === 'BETTING' && (
                            <div className="text-center space-y-8 animate-in fade-in duration-700">
                                <div>
                                    <h2 className="text-5xl font-black text-white italic tracking-tighter mb-2">BLACKJACK</h2>
                                    <p className="text-[10px] text-cyan-400 font-bold tracking-[0.2em] uppercase">Engine V1.0 - Core Verified</p>
                                </div>

                                <div className="space-y-4">
                                    <p className="text-xs text-muted uppercase font-bold tracking-widest">Select Your Bet</p>
                                    <div className="flex flex-wrap items-center justify-center gap-4">
                                        {[10, 25, 50, 100].map(amount => (
                                            <button
                                                key={amount}
                                                onClick={() => setCurrentBet(amount)}
                                                className={`w-14 h-14 rounded-full border-2 flex items-center justify-center font-black transition-all ${currentBet === amount
                                                    ? 'bg-cyan-500 border-cyan-400 text-black shadow-lg shadow-cyan-500/40 scale-110'
                                                    : 'bg-white/5 border-white/10 text-white/40 hover:border-white/30'
                                                    }`}
                                            >
                                                {amount}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => setCurrentBet(userBalance)}
                                            className={`px-6 h-14 rounded-full border-2 flex items-center justify-center font-black transition-all ${currentBet === userBalance && userBalance > 0
                                                ? 'bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/40 scale-110'
                                                : 'bg-white/5 border-white/10 text-white/40 hover:border-white/30'
                                                }`}
                                        >
                                            ALL IN
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-center gap-2 text-muted">
                                        <span className="text-xs font-bold uppercase">Balance:</span>
                                        <span className="text-xs font-black text-white">{userBalance}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={startNewGame}
                                    className="px-16 py-4 bg-white hover:bg-cyan-400 text-black font-black rounded-xl shadow-xl transition-all hover:-translate-y-1"
                                >
                                    DEAL CARDS
                                </button>
                                {message && <p className="text-red-400 text-xs font-bold mt-4">{message}</p>}
                            </div>
                        )}

                        {gameStatus === 'FINISHED' && (
                            <div className="text-center space-y-6 animate-in zoom-in duration-500">
                                <h3 className={`text-4xl font-black tracking-tighter italic ${message.includes('WON') ? 'text-green-400' : 'text-white'}`}>
                                    {message}
                                </h3>
                                <button
                                    onClick={() => setGameStatus('BETTING')}
                                    className="px-10 py-3 bg-white hover:bg-gray-200 text-black font-black rounded-xl shadow-lg"
                                >
                                    NEXT ROUND
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Player Section */}
                    <div className="relative flex flex-col items-center mt-auto pb-12">
                        <div className="flex flex-wrap gap-8 justify-center mb-8">
                            {gameState?.playerHands.map((hand, idx) => (
                                <div key={idx} className={`flex flex-col items-center gap-4 transition-all duration-300 ${gameState.activeHandIndex === idx ? 'scale-110' : 'opacity-60 grayscale'}`}>
                                    <div className="flex gap-3">
                                        {hand.cards.map((card, i) => <Card key={i} card={card} />)}
                                    </div>
                                    <div className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black tracking-widest text-white/60">
                                        HAND {idx + 1}: {hand.score} {results[idx] && <span className={`ml-2 ${results[idx] === 'WIN' || results[idx] === 'BLACKJACK' ? 'text-green-400' : 'text-red-400'}`}>{results[idx]}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Controls - Moved out of absolute positioning to prevent overlap */}
                        {gameStatus === 'PLAYING' && (
                            <div className="flex flex-wrap gap-3 w-full justify-center px-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <button onClick={() => handleAction(GameActions.HIT)} className="min-w-[100px] h-14 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold transition-all text-xs tracking-widest hover:-translate-y-0.5">HIT</button>
                                <button onClick={() => handleAction(GameActions.STAND)} className="min-w-[100px] h-14 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold transition-all text-xs tracking-widest hover:-translate-y-0.5">STAND</button>

                                {gameState.playerHands[gameState.activeHandIndex].cards.length === 2 && (
                                    <button onClick={() => handleAction(GameActions.DOUBLE)} className="min-w-[100px] h-14 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/30 text-cyan-400 rounded-xl font-bold transition-all text-xs tracking-widest hover:-translate-y-0.5">DOUBLE</button>
                                )}

                                {gameState.playerHands[gameState.activeHandIndex].cards.length === 2 &&
                                    (gameState.playerHands[gameState.activeHandIndex].cards[0] % 13) === (gameState.playerHands[gameState.activeHandIndex].cards[1] % 13) && (
                                        <button onClick={() => handleAction(GameActions.SPLIT)} className="min-w-[100px] h-14 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/30 text-purple-400 rounded-xl font-bold transition-all text-xs tracking-widest hover:-translate-y-0.5">SPLIT</button>
                                    )}

                                <button onClick={showHint} className="min-w-[80px] h-14 bg-yellow-500/5 hover:bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 rounded-xl font-bold transition-all text-[10px] tracking-widest hover:-translate-y-0.5 border-dashed">HINT</button>
                            </div>
                        )}
                    </div>

                    {/* Hint Overlay */}
                    {hint && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-8 py-4 bg-yellow-400 text-black font-black rounded-xl shadow-[0_0_50px_rgba(250,204,21,0.3)] animate-bounce z-50 text-center">
                            <div className="text-[10px] uppercase tracking-[0.2em] mb-1 opacity-60">Strategy Hint</div>
                            <div className="text-xl italic">"{hint}"</div>
                        </div>
                    )}
                </div>

                <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-muted border-t border-white/5 pt-6">
                    <button onClick={() => navigate('/dashboard')} className="hover:text-white transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                        <span>←</span> EXIT TO LOBBY
                    </button>
                    <div className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-40">Arcadex Dealer Protocol v1.02</div>
                </div>
            </div>
        </AppShell>
    );
};

export default Blackjack;
