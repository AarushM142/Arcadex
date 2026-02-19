import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TicTacToeEngine, GameMode, Player } from '../engines/tictactoeEngine';
import { UserAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { AppShell } from './AppShell';

const TicTacToe = () => {
    const { user } = UserAuth();
    const navigate = useNavigate();
    const [engine, setEngine] = useState(null);
    const [gameState, setGameState] = useState(null);
    const [gameStatus, setGameStatus] = useState('SETUP'); // SETUP, PLAYING, FINISHED
    const [hint, setHint] = useState(null);
    const [message, setMessage] = useState('');
    const [userBalance, setUserBalance] = useState(0);

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
    }, [fetchBalance]);

    const startGame = async (mode) => {
        const entryFee = 5;
        const isAI = mode === GameMode.PV_AI;

        if (isAI && userBalance < entryFee) {
            setMessage('Insufficient coins! Need 5 to play against AI.');
            return;
        }

        try {
            if (isAI) {
                const newBalance = userBalance - entryFee;
                const { error: deductError } = await supabase
                    .from('profiles')
                    .update({ coin_balance: newBalance })
                    .eq('id', user.id);

                if (deductError) throw deductError;
                setUserBalance(newBalance);
            }

            const newEngine = new TicTacToeEngine(mode);
            setEngine(newEngine);
            setGameState(newEngine.getState());
            setGameStatus('PLAYING');
            setMessage('');
        } catch (err) {
            console.error(err);
            setMessage('Failed to start game.');
        }
    };

    const handleCellClick = async (index) => {
        if (!engine || gameStatus !== 'PLAYING' || gameState.board[index] !== Player.EMPTY) return;

        const newState = engine.makeMove(index);
        if (newState) {
            setGameState(newState);
            if (newState.isGameOver) {
                handleGameOver(newState);
            }
        }
    };

    const handleGameOver = async (finalState) => {
        setGameStatus('FINISHED');
        const isAI = engine.gameMode === GameMode.PV_AI;

        if (!isAI) {
            // Local PvP: No database, no coins
            if (finalState.winner === Player.X) setMessage('PLAYER X WINS (LOCAL)');
            else if (finalState.winner === Player.O) setMessage('PLAYER O WINS (LOCAL)');
            else setMessage('DRAW! (PVP)');
            return;
        }

        // AI Mode: Record results and rewards
        let sessionResult = 'lose';
        let winAmount = 0;

        if (finalState.winner === Player.X) {
            winAmount = 10;
            sessionResult = 'win';
            setMessage('YOU BEAT THE AI! +10 COINS');

            const newBalance = userBalance + winAmount;
            await supabase.from('profiles').update({ coin_balance: newBalance }).eq('id', user.id);
            setUserBalance(newBalance);
        } else if (finalState.winner === Player.O) {
            setMessage('AI WINS. TRY STRATEGIC HINTS!');
        } else {
            winAmount = 5; // Return entry fee on draw
            sessionResult = 'push';
            setMessage('DRAW! COINS RETURNED.');

            const newBalance = userBalance + winAmount;
            await supabase.from('profiles').update({ coin_balance: newBalance }).eq('id', user.id);
            setUserBalance(newBalance);
        }

        await supabase.from('game_sessions').insert({
            user_id: user.id,
            game_id: 'tictactoe',
            coins_won: winAmount,
            result: sessionResult
        });
    };

    const showHint = () => {
        if (engine) setHint(engine.getHint());
    };

    return (
        <AppShell>
            <div className="max-w-4xl mx-auto py-8 px-4">
                <div className="glass-strong card-xl p-8 min-h-[600px] flex flex-col items-center justify-center relative overflow-hidden">

                    <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 to-transparent pointer-events-none" />

                    {gameStatus === 'SETUP' && (
                        <div className="text-center space-y-12 animate-in fade-in zoom-in duration-700">
                            <div>
                                <h2 className="text-6xl font-black text-white italic tracking-tighter mb-4">TIC TAC TOE</h2>
                                <p className="text-xs text-purple-400 font-bold tracking-[0.3em] uppercase">Core Engine Logic Virtualized</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-md mx-auto">
                                <button
                                    onClick={() => startGame(GameMode.PV_AI)}
                                    className="p-8 glass group hover:bg-white transition-all rounded-2xl border border-white/10 flex flex-col items-center gap-4"
                                >
                                    <span className="text-4xl group-hover:scale-110 transition-transform">🤖</span>
                                    <span className="font-black group-hover:text-black">PLAYER VS AI</span>
                                    <span className="text-[10px] text-muted group-hover:text-black/60 font-bold">UNBEATABLE MINIMAX</span>
                                </button>
                                <button
                                    onClick={() => startGame(GameMode.PVP)}
                                    className="p-8 glass group hover:bg-white transition-all rounded-2xl border border-white/10 flex flex-col items-center gap-4"
                                >
                                    <span className="text-4xl group-hover:scale-110 transition-transform">👥</span>
                                    <span className="font-black group-hover:text-black">LOCAL PVP</span>
                                    <span className="text-[10px] text-muted group-hover:text-black/60 font-bold">PASS & PLAY</span>
                                </button>
                            </div>

                            <div className="flex flex-col items-center gap-2">
                                <div className="text-xs text-muted uppercase font-bold tracking-widest">Entry Fee: 5 Coins</div>
                                {message && <p className="text-red-400 text-sm font-bold">{message}</p>}
                            </div>
                        </div>
                    )}

                    {gameStatus === 'PLAYING' && (
                        <div className="w-full flex flex-col items-center gap-12 animate-in fade-in duration-500">
                            <div className="flex justify-between w-full max-w-xs items-center">
                                <div className={`flex flex-col items-center gap-2 transition-opacity ${gameState.currentPlayer === Player.X ? 'opacity-100' : 'opacity-30'}`}>
                                    <span className="text-4xl font-black text-cyan-400">X</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Player 1</span>
                                </div>
                                <div className="text-xs font-black text-muted italic">VS</div>
                                <div className={`flex flex-col items-center gap-2 transition-opacity ${gameState.currentPlayer === Player.O ? 'opacity-100' : 'opacity-30'}`}>
                                    <span className="text-4xl font-black text-purple-400">O</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest">{engine.gameMode === GameMode.PV_AI ? 'AI BOT' : 'Player 2'}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                {gameState.board.map((cell, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleCellClick(i)}
                                        className={`w-24 h-24 rounded-2xl border-2 transition-all flex items-center justify-center text-5xl font-black ${cell === Player.EMPTY
                                            ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                                            : cell === Player.X
                                                ? 'bg-cyan-500/10 border-cyan-400/30 text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.2)]'
                                                : 'bg-purple-500/10 border-purple-400/30 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                                            } ${hint === i ? 'animate-pulse bg-yellow-400/20 border-yellow-400/50' : ''}`}
                                    >
                                        {cell === Player.X ? 'X' : cell === Player.O ? 'O' : ''}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={showHint}
                                className="px-6 py-2 bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-yellow-400/30 transition-all"
                            >
                                Get Strategic Hint
                            </button>
                        </div>
                    )}

                    {gameStatus === 'FINISHED' && (
                        <div className="text-center space-y-8 animate-in zoom-in duration-500">
                            <h2 className="text-5xl font-black text-white italic tracking-tighter">{message}</h2>
                            <button
                                onClick={() => setGameStatus('SETUP')}
                                className="px-12 py-4 bg-white hover:bg-gray-200 text-black font-black rounded-xl shadow-xl transition-all"
                            >
                                REMATCH
                            </button>
                        </div>
                    )}
                </div>

                <div className="mt-8 flex justify-between items-center text-muted">
                    <button onClick={() => navigate('/dashboard')} className="hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">← Return to Lobby</button>
                    <div className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-40 italic">C-Logic Cluster Alpha v1.0</div>
                </div>
            </div>
        </AppShell>
    );
};

export default TicTacToe;
