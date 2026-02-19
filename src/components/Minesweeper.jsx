import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MinesweeperEngine, GameStatus } from '../engines/minesweeperEngine';
import { UserAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { AppShell } from './AppShell';

const C_QUIZ_QUESTIONS = [
    {
        q: "What is the size of 'int' in standard C on a 32-bit system?",
        options: ["1 Byte", "2 Bytes", "4 Bytes", "8 Bytes"],
        correct: 2
    },
    {
        q: "Which keyword is used to prevent a variable from being modified?",
        options: ["static", "volatile", "const", "restrict"],
        correct: 2
    },
    {
        q: "What does 'malloc' return if it fails to allocate memory?",
        options: ["0", "NULL", "-1", "A random pointer"],
        correct: 1
    },
    {
        q: "Which operator is used to access a member of a struct via a pointer?",
        options: [".", "*", "&", "->"],
        correct: 3
    },
    {
        q: "What is the index of the first element in a C array?",
        options: ["0", "1", "-1", "It depends on the compiler"],
        correct: 0
    }
];

const Minesweeper = () => {
    const { user } = UserAuth();
    const navigate = useNavigate();
    const [engine, setEngine] = useState(null);
    const [gameState, setGameState] = useState(null);
    const [gameStatus, setGameStatus] = useState('PLAYING'); // PLAYING, LIFELINE, FINISHED
    const [message, setMessage] = useState('');
    const [roast, setRoast] = useState('');
    const [userBalance, setUserBalance] = useState(0);
    const [currentQuiz, setCurrentQuiz] = useState(null);

    const fetchBalance = useCallback(async () => {
        if (!user) return;
        const { data } = await supabase.from('profiles').select('coin_balance').eq('id', user.id).single();
        if (data) setUserBalance(data.coin_balance || 0);
    }, [user]);

    useEffect(() => {
        let isMounted = true;
        const init = async () => {
            await fetchBalance();
            if (isMounted) {
                const newEngine = new MinesweeperEngine();
                setEngine(newEngine);
                setGameState(newEngine.getGameState());
            }
        };
        init();
        return () => { isMounted = false; };
    }, [fetchBalance]);

    const handleCellClick = async (r, c) => {
        if (!engine || gameStatus !== 'PLAYING' || gameState.board[r][c].isRevealed) return;

        const oldCount = gameState.revealedCount;
        const status = engine.revealCell(r, c);
        const newState = engine.getGameState();
        const newCount = newState.revealedCount;

        const newlyCleared = newCount - oldCount;

        // Reward 1 coin per cell cleared (handles flood fill too)
        if (newlyCleared > 0 && !newState.lifelinePending) {
            const reward = newlyCleared;
            const updatedBalance = userBalance + reward;
            await supabase.from('profiles').update({ coin_balance: updatedBalance }).eq('id', user.id);
            setUserBalance(updatedBalance);

            if (newlyCleared > 1) {
                setMessage(`CHAIN REACTION! AREA SECURED (+${reward} COINS)`);
            } else {
                setMessage('CELL SECURED (+1 COIN)');
            }
        }

        setGameState(newState);

        if (status === GameStatus.LIFELINE_TRIGGERED) {
            const randomQuiz = C_QUIZ_QUESTIONS[Math.floor(Math.random() * C_QUIZ_QUESTIONS.length)];
            setCurrentQuiz(randomQuiz);
            setGameStatus('LIFELINE');
            setMessage('MINE HIT! QUANTUM C-SHIELD INITIATED.');
        } else if (status === GameStatus.GAME_OVER) {
            handleGameOver(false);
        } else if (status === GameStatus.WIN) {
            handleGameOver(true);
        }
    };

    const handleResolveLifeline = (answerIndex) => {
        const success = answerIndex === currentQuiz.correct;
        const status = engine.resolveLifeline(success);
        const newState = engine.getGameState();
        setGameState(newState);

        if (status === GameStatus.GAME_OVER) {
            handleGameOver(false);
        } else {
            setGameStatus('PLAYING');
            setMessage('LIFELINE SUCCESSFUL. C-SHIELD HELD.');
            setCurrentQuiz(null);
        }
    };

    const handleGameOver = async (fullyCleared) => {
        setGameStatus('FINISHED');

        const totalCleared = gameState?.revealedCount || 0;
        const reachedTarget = totalCleared > 5;
        const isWin = fullyCleared || reachedTarget;

        // Rewards: 50 for full clear, 10 for reaching the 5-cell target, 0 otherwise
        const winAmount = fullyCleared ? 50 : (reachedTarget ? 10 : 0);
        const result = isWin ? 'win' : 'lose';

        if (isWin) {
            if (fullyCleared) {
                setMessage('VETERAN SWEEPER! COMPLETION BONUS: 50 COINS.');
            } else {
                setMessage('STRATEGIC WIN! TARGET REACHED: 10 COINS.');
            }
            const newBalance = userBalance + winAmount;
            await supabase.from('profiles').update({ coin_balance: newBalance }).eq('id', user.id);
            setUserBalance(newBalance);
        } else {
            const newRoast = engine.getRoast();
            setRoast(newRoast);
            setMessage('BOOM! GRID COLLAPSED.');
        }

        await supabase.from('game_sessions').insert({
            user_id: user.id,
            game_id: 'minesweeper',
            coins_won: winAmount + totalCleared,
            result: result,
            cells_cleared: totalCleared
        });
    };

    if (!gameState) return <AppShell><div className="flex items-center justify-center min-h-screen text-muted font-black">INITIALIZING QUANTUM GRID...</div></AppShell>;

    return (
        <AppShell>
            <div className="max-w-4xl mx-auto py-8 px-4 flex flex-col items-center">
                <div className="glass-strong card-xl p-8 flex flex-col items-center relative overflow-hidden min-h-[600px] w-full max-w-2xl">
                    <div className="absolute inset-0 bg-gradient-to-t from-green-900/10 to-transparent pointer-events-none" />

                    <div className="text-center mb-8 relative z-10">
                        <h2 className="text-5xl font-black text-white italic tracking-tighter mb-2">MINESWEEPER</h2>
                        <div className="flex gap-4 items-center justify-center">
                            <span className="text-[10px] text-green-400 font-bold tracking-[0.3em] uppercase">Headless C Engine v1.0</span>
                            <div className={`px-2 py-0.5 rounded text-[8px] font-black ${gameState.lifelineUsed ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                {gameState.lifelineUsed ? 'LIFELINE EXHAUSTED' : 'LIFELINE READY'}
                            </div>
                        </div>
                    </div>

                    <div className="w-full overflow-x-auto flex justify-center p-2">
                        <div className="grid grid-cols-6 gap-1 md:gap-2 bg-black/40 p-2 md:p-4 rounded-2xl border border-white/5 shadow-2xl relative z-10 min-w-fit">
                            {gameState.board.map((row, r) => row.map((cell, c) => (
                                <button
                                    key={`${r}-${c}`}
                                    onClick={() => handleCellClick(r, c)}
                                    className={`w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-md md:rounded-lg transition-all flex items-center justify-center text-sm md:text-xl font-black border md:border-2 touch-manipulation
                                        ${cell.isRevealed
                                            ? (cell.isMine
                                                ? 'bg-red-500/20 border-red-500/50 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                                                : 'bg-white/5 border-transparent text-green-400')
                                            : 'bg-white/10 border-white/5 hover:bg-white/20 hover:border-white/10 cursor-pointer active:scale-95'
                                        }`}
                                >
                                    {cell.isRevealed ? (cell.isMine ? '💣' : (cell.adjacentMines || '')) : ''}
                                </button>
                            )))}
                        </div>
                    </div>

                    <div className="mt-8 text-center space-y-4 relative z-10">
                        {message && <p className={`text-xl font-black italic ${gameStatus === 'FINISHED' ? 'text-red-400 underline decoration-2' : 'text-white'}`}>{message}</p>}
                        {roast && <p className="text-sm text-red-400/60 font-medium max-w-xs italic">"{roast}"</p>}
                    </div>

                    {gameStatus === 'LIFELINE' && currentQuiz && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                            <div className="glass card-xl p-8 max-w-sm w-full text-center border-yellow-500/30 shadow-[0_0_50px_rgba(234,179,8,0.2)]">
                                <span className="text-4xl mb-4 block">🛡️</span>
                                <h3 className="text-2xl font-black text-yellow-500 mb-2 uppercase tracking-tighter">C-SHIELD CHALLENGE</h3>
                                <p className="text-xs text-muted mb-6 uppercase tracking-widest font-bold">Question to defuse mine:</p>

                                <div className="bg-black/40 p-4 rounded-xl mb-6 text-left border border-white/5">
                                    <p className="text-sm font-bold text-white leading-relaxed">{currentQuiz.q}</p>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    {currentQuiz.options.map((option, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleResolveLifeline(idx)}
                                            className="w-full p-3 bg-white/5 border border-white/10 text-white text-xs font-bold rounded-lg hover:bg-white hover:text-black transition-all"
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-6 text-[10px] text-muted italic">Failure results in immediate detonation.</p>
                            </div>
                        </div>
                    )}

                    {gameStatus === 'FINISHED' && (
                        <div className="mt-8 flex gap-4">
                            <button onClick={() => window.location.reload()} className="px-8 py-3 bg-white text-black font-black rounded-xl hover:brightness-110 transition-all">NEW GRID</button>
                            <button onClick={() => navigate('/dashboard')} className="px-8 py-3 bg-white/5 text-white font-black rounded-xl border border-white/10 hover:bg-white/10 transition-all">LOBBY</button>
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
};

export default Minesweeper;
