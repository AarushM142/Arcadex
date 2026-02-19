import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TicTacToeEngine, GameMode, Player } from '../engines/tictactoeEngine';
import { UserAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { AppShell } from './AppShell';
import { socket, joinGameRoom, sendMove } from '../socket';

const TicTacToe = () => {
    const { user } = UserAuth();
    const navigate = useNavigate();
    const [engine, setEngine] = useState(null);
    const [gameState, setGameState] = useState(null);
    const [gameStatus, setGameStatus] = useState('SETUP');
    const [hint, setHint] = useState(null);
    const [message, setMessage] = useState('');
    const [userBalance, setUserBalance] = useState(0);
    const [myProfile, setMyProfile] = useState({ username: '', avatar_url: '' });

    // Online specific states
    const [onlineRoom, setOnlineRoom] = useState(null);
    const [mySymbol, setMySymbol] = useState(null);
    const [opponentProfile, setOpponentProfile] = useState(null);

    const fetchProfileData = useCallback(async () => {
        if (!user) return;
        const { data } = await supabase
            .from('profiles')
            .select('coin_balance, username, avatar_url')
            .eq('id', user.id)
            .single();
        if (data) {
            setUserBalance(data.coin_balance || 0);
            setMyProfile({
                username: data.username || user.email.split('@')[0],
                avatar_url: data.avatar_url
            });
        }
    }, [user]);

    useEffect(() => {
        fetchProfileData();
    }, [fetchProfileData]);

    // Socket Listeners
    useEffect(() => {
        if (!socket) return;

        socket.on("waiting_for_opponent", (data) => {
            setMessage(data.message || "Waiting for opponent...");
        });

        socket.on("match_start", (data) => {
            // data: { room_id, symbol, opponent: { username, avatar_url } }
            setMySymbol(data.symbol);
            setOnlineRoom(data.room_id);
            setOpponentProfile(data.opponent);
            setGameStatus('PLAYING');
            setMessage("");
        });

        socket.on("receive_move", (data) => {
            if (engine) {
                const newState = engine.makeMove(data.index);
                if (newState) {
                    setGameState(newState);
                    if (newState.isGameOver) {
                        handleGameOver(newState);
                    }
                }
            }
        });

        return () => {
            socket.off("match_start");
            socket.off("receive_move");
        };
    }, [engine]);

    const startGame = async (mode) => {
        const entryFee = 5;
        const isAI = mode === GameMode.PV_AI;
        const isOnline = mode === GameMode.ONLINE_PVP;

        if ((isAI || isOnline) && userBalance < entryFee) {
            setMessage('Insufficient coins! Need 5 to play.');
            return;
        }

        try {
            if (isAI || isOnline) {
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

            if (isOnline) {
                setGameStatus('MATCHMAKING');
                setMessage("Finding an opponent...");
                const emitRequest = () => {
                    socket.emit("request_match", {
                        profile: {
                            username: myProfile.username,
                            avatar_url: myProfile.avatar_url
                        }
                    });
                };
                if (socket.connected) emitRequest();
                else {
                    socket.connect();
                    socket.once("connect", emitRequest);
                }
            } else {
                setGameStatus('PLAYING');
                setMessage('');
                setOpponentProfile(isAI ? { username: 'AI BOT', avatar_url: 'bot' } : { username: 'Guest', avatar_url: '' });
                setMySymbol(Player.X);
            }
        } catch (err) {
            console.error(err);
            setMessage('Failed to start game.');
        }
    };

    const handleCellClick = async (index) => {
        if (!engine || gameStatus !== 'PLAYING' || gameState.board[index] !== Player.EMPTY) return;

        if (engine.gameMode === GameMode.ONLINE_PVP) {
            if (gameState.currentPlayer !== mySymbol) {
                setMessage("Wait for opponent...");
                setTimeout(() => setMessage(''), 2000);
                return;
            }
            sendMove(onlineRoom, { index });
        }

        const newState = engine.makeMove(index);
        if (newState) {
            setGameState(newState);
            setMessage("");
            if (newState.isGameOver) {
                handleGameOver(newState);
            }
        }
    };

    const handleGameOver = async (finalState) => {
        setGameStatus('FINISHED');
        const isAI = engine.gameMode === GameMode.PV_AI;
        const isOnline = engine.gameMode === GameMode.ONLINE_PVP;

        let sessionResult = 'lose';
        let winAmount = 0;

        if (finalState.winner === mySymbol || (!isOnline && !isAI && finalState.winner === Player.X)) {
            winAmount = (isAI || isOnline) ? 10 : 0;
            sessionResult = 'win';
            setMessage(isOnline ? 'VICTORY!' : (isAI ? 'YOU BEAT THE AI!' : 'PLAYER X WINS!'));
        } else if (finalState.winner === 3) {
            winAmount = (isAI || isOnline) ? 5 : 0;
            sessionResult = 'push';
            setMessage('DRAW!');
        } else {
            setMessage(isOnline ? 'DEFEAT!' : (isAI ? 'AI WINS!' : 'PLAYER O WINS!'));
        }

        if ((isAI || isOnline) && winAmount > 0) {
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

    const Avatar = ({ src, name, size = "w-12 h-12" }) => (
        <div className={`${size} rounded-xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shrink-0 shadow-lg`}>
            {src && src !== 'bot' ? (
                <img src={src} alt={name} className="w-full h-full object-cover" />
            ) : src === 'bot' ? (
                <span className="text-2xl">🤖</span>
            ) : (
                <span className="text-xl font-black text-white/20">{name?.[0]?.toUpperCase()}</span>
            )}
        </div>
    );

    const showHint = () => {
        if (!engine) return;
        const bestMove = engine.getHint();
        if (bestMove !== -1) {
            setHint(bestMove);
            setTimeout(() => setHint(null), 2000);
        }
    };

    return (
        <AppShell>
            <div className="max-w-4xl mx-auto py-8 px-4">
                <div className="glass-strong card-xl p-8 min-h-[600px] flex flex-col items-center justify-center relative overflow-hidden text-white">

                    <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-transparent pointer-events-none" />

                    {gameStatus === 'SETUP' && (
                        <div className="text-center space-y-12 animate-in fade-in zoom-in duration-700 w-full">
                            <div>
                                <h2 className="text-7xl font-black italic tracking-tighter mb-2">TIC TAC TOE</h2>
                                <p className="text-[10px] text-cyan-400 font-bold tracking-[0.4em] uppercase opacity-70">Multiplayer Cluster v2.0</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                                <button onClick={() => startGame(GameMode.ONLINE_PVP)} className="p-8 glass-strong group hover:scale-[1.02] transition-all rounded-3xl border border-cyan-500/20 flex flex-col items-center gap-4 text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-3xl group-hover:bg-cyan-500 group-hover:text-black transition-colors">🌐</div>
                                    <div>
                                        <span className="block font-black text-lg">ONLINE COMPETITIVE</span>
                                        <span className="text-[10px] text-cyan-400 font-bold uppercase">Win 10 Coins (Fee: 5)</span>
                                    </div>
                                </button>
                                <button onClick={() => startGame(GameMode.PV_AI)} className="p-8 glass group hover:scale-[1.02] transition-all rounded-3xl border border-white/5 flex flex-col items-center gap-4 text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-3xl group-hover:bg-white group-hover:text-black transition-colors">🤖</div>
                                    <div>
                                        <span className="block font-black text-lg">VS AI ENGINE</span>
                                        <span className="text-[10px] text-muted font-bold uppercase underline decoration-purple-500">Unbeatable Minimax</span>
                                    </div>
                                </button>
                                <button onClick={() => startGame(GameMode.PVP)} className="p-8 glass group hover:scale-[1.02] transition-all rounded-3xl border border-white/5 flex flex-col items-center gap-4 text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-3xl group-hover:bg-white group-hover:text-black transition-colors">👥</div>
                                    <div>
                                        <span className="block font-black text-lg">LOCAL PASS-PLAY</span>
                                        <span className="text-[10px] text-muted font-bold uppercase opacity-50">Zero Cost</span>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    {gameStatus === 'MATCHMAKING' && (
                        <div className="text-center space-y-10 animate-in fade-in zoom-in w-full max-w-md">
                            <div className="relative w-40 h-40 mx-auto">
                                <div className="absolute inset-0 border-4 border-cyan-500/10 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-t-cyan-500 rounded-full animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center text-5xl">📡</div>
                            </div>
                            <div className="space-y-2">
                                <h1 className="text-4xl font-black italic tracking-tighter uppercase">Initializing Link...</h1>
                                <p className="text-cyan-400 text-xs font-bold tracking-widest uppercase animate-pulse">{message}</p>
                            </div>
                            <button onClick={() => setGameStatus('SETUP')} className="px-8 py-3 glass pill text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 hover:text-red-400 border-red-500/10 transition-all">Abort Search</button>
                        </div>
                    )}

                    {gameStatus === 'PLAYING' && (
                        <div className="w-full flex flex-col items-center gap-10 animate-in fade-in duration-500">
                            {/* Players HUD */}
                            <div className="flex justify-between w-full max-w-md items-center glass p-6 rounded-3xl border-white/5 shadow-2xl relative">
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-black text-white/10 italic">MODERN ARCADE</div>

                                <div className={`flex items-center gap-4 transition-all duration-500 ${gameState.currentPlayer === mySymbol ? 'scale-105' : 'opacity-40 grayscale-[0.5]'}`}>
                                    <div className="relative">
                                        <Avatar src={myProfile.avatar_url} name={myProfile.username} />
                                        <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-lg ${mySymbol === Player.X ? 'bg-cyan-500 text-black' : 'bg-purple-500 text-white'} flex items-center justify-center text-xs font-black shadow-lg`}>
                                            {mySymbol === Player.X ? 'X' : 'O'}
                                        </div>
                                    </div>
                                    <div className="hidden sm:block">
                                        <p className="text-xs font-black uppercase text-white/50">{mySymbol === Player.X ? 'Player 1' : 'Player 2'}</p>
                                        <p className="font-black text-sm truncate max-w-[80px]">{myProfile.username}</p>
                                    </div>
                                </div>

                                <div className="h-10 w-px bg-white/10 mx-2" />

                                <div className={`flex items-center flex-row-reverse gap-4 transition-all duration-500 ${gameState.currentPlayer !== mySymbol ? 'scale-105' : 'opacity-40 grayscale-[0.5]'}`}>
                                    <div className="relative">
                                        <Avatar src={opponentProfile?.avatar_url} name={opponentProfile?.username} />
                                        <div className={`absolute -top-1 -left-1 w-6 h-6 rounded-lg ${mySymbol === Player.X ? 'bg-purple-500 text-white' : 'bg-cyan-500 text-black'} flex items-center justify-center text-xs font-black shadow-lg`}>
                                            {mySymbol === Player.X ? 'O' : 'X'}
                                        </div>
                                    </div>
                                    <div className="hidden sm:block text-right">
                                        <p className="text-xs font-black uppercase text-white/50">{mySymbol === Player.X ? 'Player 2' : 'Player 1'}</p>
                                        <p className="font-black text-sm truncate max-w-[80px]">{opponentProfile?.username || 'Opponent'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Game Board */}
                            <div className="grid grid-cols-3 gap-3 p-4 glass-strong rounded-[2.5rem] border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                                {gameState.board.map((cell, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleCellClick(i)}
                                        className={`w-28 h-28 sm:w-32 sm:h-32 rounded-[2rem] border-2 transition-all duration-300 flex items-center justify-center text-5xl font-black ${cell === Player.EMPTY
                                            ? 'bg-white/[0.03] border-white/[0.05] hover:bg-white/[0.08] hover:border-white/20 active:scale-95'
                                            : cell === Player.X
                                                ? 'bg-cyan-400/10 border-cyan-400/40 text-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.3)]'
                                                : 'bg-purple-500/10 border-purple-500/40 text-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.3)]'
                                            } ${hint === i ? 'animate-pulse bg-yellow-400/20 border-yellow-400/50' : ''}`}
                                    >
                                        {cell === Player.X ? 'X' : cell === Player.O ? 'O' : ''}
                                    </button>
                                ))}
                            </div>

                            <div className="flex gap-4">
                                {engine.gameMode === GameMode.PV_AI && (
                                    <button onClick={showHint} className="px-10 py-3 glass pill text-[10px] font-black uppercase tracking-[0.2em] hover:bg-yellow-400 hover:text-black hover:shadow-[0_0_20px_rgba(250,204,21,0.4)] border-yellow-400/30 transition-all">Oracle Hint</button>
                                )}
                                {message && <div className="px-10 py-3 glass pill text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 border-cyan-500/30 animate-pulse">{message}</div>}
                            </div>
                        </div>
                    )}

                    {gameStatus === 'FINISHED' && (
                        <div className="text-center space-y-12 animate-in zoom-in duration-500 py-10">
                            <div className="relative">
                                <div className="text-[120px] font-black italic text-white/5 absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap tracking-tighter uppercase select-none">GAME OVER</div>
                                <h2 className="text-7xl sm:text-8xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40 drop-shadow-2xl">{message}</h2>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <button onClick={() => setGameStatus('SETUP')} className="px-16 py-5 bg-white text-black font-black rounded-3xl shadow-[0_15px_30px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all uppercase tracking-widest text-sm">Play Again</button>
                                <button onClick={() => navigate('/dashboard')} className="px-12 py-5 glass-strong text-white font-black rounded-3xl hover:bg-white/10 transition-all uppercase tracking-widest text-sm italic">Lobby</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
};

export default TicTacToe;
