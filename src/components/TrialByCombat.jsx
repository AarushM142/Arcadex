import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TrialByCombatEngine, ClassType, MoveType, GameScreen } from '../engines/trialByCombatEngine';
import { AppShell } from './AppShell';
import { UserAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { socket, sendMove } from '../socket';
import InviteModal from './InviteModal';

const SPRITE_BASE_PATH = '/nandangame';

const TrialByCombat = () => {
    const [engine] = useState(new TrialByCombatEngine());
    const [gameState, setGameState] = useState(engine.getState());
    const [currentScreen, setCurrentScreen] = useState(GameScreen.MENU);
    const [hoverClass, setHoverClass] = useState(0);
    const [selectedMove, setSelectedMove] = useState(null);
    const [animating, setAnimating] = useState(false);
    const logEndRef = useRef(null);
    const hasAutoJoined = useRef(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = UserAuth();
    const [userBalance, setUserBalance] = useState(0);
    const [coinsWonThisSession, setCoinsWonThisSession] = useState(0);
    const [onlineRoom, setOnlineRoom] = useState(null);
    const [mySymbol, setMySymbol] = useState(null);
    const [opponentProfile, setOpponentProfile] = useState(null);
    const [message, setMessage] = useState('');
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [opponentClass, setOpponentClass] = useState(null);
    const [opponentMove, setOpponentMove] = useState(null);
    const [myClassChosen, setMyClassChosen] = useState(false);
    const [myProfilePic, setMyProfilePic] = useState('');

    const fetchProfileData = useCallback(async () => {
        if (!user) return;
        const { data } = await supabase
            .from('profiles')
            .select('coin_balance, avatar_url')
            .eq('id', user.id)
            .single();
        if (data) {
            setUserBalance(data.coin_balance || 0);
            setMyProfilePic(data.avatar_url || '');
        }
    }, [user]);

    useEffect(() => {
        fetchProfileData();
    }, [fetchProfileData]);

    useEffect(() => {
        if (user && location.state?.autoJoin && !hasAutoJoined.current) {
            hasAutoJoined.current = true;

            const joinRoom = async () => {
                const { data } = await supabase.from('profiles').select('coin_balance').eq('id', user.id).single();
                if (data && data.coin_balance >= 10) {
                    const newBalance = data.coin_balance - 10;
                    await supabase.from('profiles').update({ coin_balance: newBalance }).eq('id', user.id);
                    setUserBalance(newBalance);

                    const roomId = location.state.autoJoin;
                    setCurrentScreen('MATCHMAKING');
                    setMessage("Joining friend's match...");
                    const fn = () => socket.emit('join_private_tbc', {
                        room_id: roomId,
                        profile: { username: user.email?.split('@')[0], avatar_url: myProfilePic }
                    });
                    socket.connected ? fn() : (socket.connect(), socket.once("connect", fn));

                    window.history.replaceState({}, document.title);
                }
            };
            joinRoom();
        }
    }, [user, location.state, myProfilePic]);

    useEffect(() => {
        if (!socket) return;
        socket.on("waiting_for_opponent", (data) => {
            setMessage(data.message || "Waiting for opponent...");
            if (data.room_id) setOnlineRoom(data.room_id);
        });
        socket.on("match_start", (data) => {
            setMySymbol(data.symbol);
            setOnlineRoom(data.room_id);
            setOpponentProfile(data.opponent);
            engine.vsComputer = 3;
            setOpponentClass(null);
            setOpponentMove(null);
            setSelectedMove(null);
            setMyClassChosen(false);
            engine.reset(data.seed);
            engine.vsComputer = 3;
            setCurrentScreen('MATCH_FOUND');
            setTimeout(() => {
                setCurrentScreen(GameScreen.SELECT_CLASS_P1);
            }, 2000);
            setMessage("");
        });
        socket.on("receive_move", (data) => {
            if (data.type === 'class_select') {
                setOpponentClass(data.classId);
            } else if (data.type === 'move_select') {
                setOpponentMove(data.moveId);
            }
        });
        return () => {
            socket.off("waiting_for_opponent");
            socket.off("match_start");
            socket.off("receive_move");
        };
    }, [engine]);

    const handleGameOver = async (winAmount, sessionResult) => {
        setCoinsWonThisSession(winAmount);
        if (!user) return;
        try {
            if (winAmount > 0) {
                const newBalance = userBalance + winAmount;
                await supabase.from('profiles').update({ coin_balance: newBalance }).eq('id', user.id);
                setUserBalance(newBalance);
            }

            await supabase.from('game_sessions').insert({
                user_id: user.id,
                game_id: 'trialbycombat',
                coins_won: winAmount,
                result: sessionResult
            });
        } catch (error) {
            console.error("Error saving game results:", error);
        }
    };

    const scrollToBottom = () => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [gameState.log]);

    const updateState = useCallback(() => {
        setGameState(engine.getState());
    }, [engine]);

    const handleClassSelect = (classId) => {
        if (engine.vsComputer === 3) {
            if (mySymbol === 1) {
                engine.p1 = engine._createFighter(user.email?.split('@')[0] || 'Player 1', classId);
            } else {
                engine.p2 = engine._createFighter(user.email?.split('@')[0] || 'Player 2', classId);
            }
            sendMove(onlineRoom, { type: 'class_select', classId });
            setMyClassChosen(true);
            updateState();
            return;
        }
        if (engine.vsComputer === 2) {
            engine.initGauntlet(classId);
            setCurrentScreen(GameScreen.GAUNTLET_BATTLE);
        } else if (currentScreen === GameScreen.SELECT_CLASS_P1) {
            engine.p1 = engine._createFighter(engine.vsComputer ? "Player" : "Player 1", classId);
            if (engine.vsComputer) {
                setCurrentScreen(GameScreen.SELECT_OPPONENT);
            } else {
                setCurrentScreen(GameScreen.SELECT_CLASS_P2);
            }
        } else if (currentScreen === GameScreen.SELECT_CLASS_P2) {
            engine.p2 = engine._createFighter("Player 2", classId);
            engine.turn = 1;
            engine.log = [];
            setCurrentScreen(GameScreen.BATTLE);
        }
        updateState();
    };

    const handleOpponentSelect = (classId) => {
        const names = ["Knight", "Magician", "Alchemist"];
        engine.p2 = engine._createFighter(names[classId], classId);
        engine.turn = 1;
        engine.log = [];
        setCurrentScreen(GameScreen.BATTLE);
        updateState();
    };


    const handleStartOnline = async (mode) => {
        if (userBalance < 10) return;
        const newBalance = userBalance - 10;
        await supabase.from('profiles').update({ coin_balance: newBalance }).eq('id', user.id);
        setUserBalance(newBalance);

        setCurrentScreen('MATCHMAKING');
        const profilePayload = { username: user.email?.split('@')[0], avatar_url: myProfilePic };
        if (mode === 'PRIVATE') {
            setMessage("Waiting for friend...");
            const fn = () => socket.emit('create_private_tbc', { profile: profilePayload });
            socket.connected ? fn() : (socket.connect(), socket.once("connect", fn));
        } else {
            setMessage("Finding opponent...");
            const fn = () => socket.emit('request_match_tbc', { profile: profilePayload });
            socket.connected ? fn() : (socket.connect(), socket.once("connect", fn));
        }
    };

    useEffect(() => {
        if (engine.vsComputer === 3 && currentScreen === GameScreen.SELECT_CLASS_P1) {
            if (opponentClass !== null && myClassChosen) {
                if (mySymbol === 1) {
                    engine.p2 = engine._createFighter(opponentProfile?.username || 'Player 2', opponentClass);
                } else {
                    engine.p1 = engine._createFighter(opponentProfile?.username || 'Player 1', opponentClass);
                }
                engine.turn = 1;
                engine.log = [];
                setCurrentScreen(GameScreen.BATTLE);
                updateState();
            }
        }
    }, [opponentClass, myClassChosen, currentScreen, engine, mySymbol, opponentProfile, updateState]);

    useEffect(() => {
        if (engine.vsComputer === 3 && currentScreen === GameScreen.BATTLE) {
            if (opponentMove !== null && selectedMove !== null && typeof selectedMove === 'number') {
                let m1 = mySymbol === 1 ? selectedMove : opponentMove;
                let m2 = mySymbol === 1 ? opponentMove : selectedMove;
                setOpponentMove(null);
                setSelectedMove(null); // Reset for next turn
                engine.resolveTurn(m1, m2);
                setCurrentScreen(GameScreen.RESOLVE);
                updateState();
            }
        }
    }, [opponentMove, selectedMove, currentScreen, engine, mySymbol, updateState]);

    const handleMove = (moveIdx) => {
        if (engine.vsComputer === 3) {
            setSelectedMove(moveIdx);
            sendMove(onlineRoom, { type: 'move_select', moveId: moveIdx });
            return;
        }
        if (animating) return;

        const cf = (!engine.vsComputer && engine.p1chosen) ? engine.p2 : engine.p1;
        const moves = engine.getMoves(cf.classId);
        if (cf.charge < moves[moveIdx].cost) return;

        if (engine.vsComputer === 1) {
            engine.moveP1 = moveIdx;
            engine.moveP2 = engine.chooseMoveAI(engine.p2, engine.p1);
            engine.resolveTurn(engine.moveP1, engine.moveP2);
            setCurrentScreen(GameScreen.RESOLVE);
        } else if (engine.vsComputer === 0) {
            if (!engine.p1chosen) {
                engine.moveP1 = moveIdx;
                engine.p1chosen = true;
                setSelectedMove(0);
            } else {
                engine.moveP2 = moveIdx;
                engine.p1chosen = false;
                engine.resolveTurn(engine.moveP1, engine.moveP2);
                setCurrentScreen(GameScreen.RESOLVE);
            }
        }
        updateState();
    };

    const handleGauntletMove = (moveIdx) => {
        if (animating) return;
        const moves = engine.getMoves(engine.p1.classId);
        if (engine.p1.charge < moves[moveIdx].cost) return;

        engine.resolveGauntletTurn(moveIdx, engine.selectedTarget);
        setCurrentScreen(GameScreen.GAUNTLET_RESOLVE);
        updateState();
    };

    const nextTurn = () => {
        const d1 = engine.p1.hp <= 0;
        const d2 = engine.p2.hp <= 0;

        if (d1 || d2 || engine.turn >= 25) {
            let winDetails = "";
            let sessionResult = 'lose';
            let winAmount = 0;
            const isAI = engine.vsComputer === 1;

            if (d1 && d2) {
                engine.resultMsg = "DRAW! Both fell!";
                sessionResult = 'push';
                if (isAI || engine.vsComputer === 3) {
                    winAmount = 10;
                    winDetails = "MATCH TIED - BET REFUNDED";
                }
            } else if (d1) {
                if (engine.vsComputer === 3) {
                    if (mySymbol === 1) { // Player 1 (you) died. Defeat.
                        engine.resultMsg = "DEFEAT";
                        winDetails = `${engine.p2.name} won by ${engine.p2.hp} HP`;
                        sessionResult = 'lose';
                    } else { // Player 1 (opponent) died. You (Player 2) won.
                        engine.resultMsg = "VICTORY";
                        winDetails = `Victory with ${engine.p2.hp} HP remaining`;
                        sessionResult = 'win';
                        winAmount = 20;
                    }
                } else {
                    engine.resultMsg = engine.vsComputer === 0 ? "PLAYER 2 HAS WON" : `${engine.p2.name} WINS!`;
                    winDetails = `Victory with ${engine.p2.hp} HP remaining`;
                    sessionResult = 'lose';
                }
            } else if (d2) {
                if (engine.vsComputer === 3) {
                    if (mySymbol === 2) { // Player 2 (you) died. Defeat.
                        engine.resultMsg = "DEFEAT";
                        winDetails = `${engine.p1.name} won by ${engine.p1.hp} HP`;
                        sessionResult = 'lose';
                    } else { // Player 2 (opponent) died. You (Player 1) won.
                        engine.resultMsg = "VICTORY";
                        winDetails = `Victory with ${engine.p1.hp} HP remaining`;
                        sessionResult = 'win';
                        winAmount = 20;
                    }
                } else {
                    engine.resultMsg = engine.vsComputer === 0 ? "PLAYER 1 HAS WON" : `${engine.p1.name} WINS!`;
                    winDetails = `Victory with ${engine.p1.hp} HP remaining`;
                    sessionResult = 'win';
                    if (isAI) winAmount = 20;
                }
            } else if (engine.turn >= 25) {
                if (engine.p1.hp > engine.p2.hp) {
                    if (engine.vsComputer === 3) {
                        if (mySymbol === 1) {
                            engine.resultMsg = "VICTORY";
                            winDetails = `Led by ${engine.p1.hp - engine.p2.hp} HP at limit`;
                            sessionResult = 'win';
                            winAmount = 20;
                        } else {
                            engine.resultMsg = "DEFEAT";
                            winDetails = `${engine.p1.name} won by ${engine.p1.hp - engine.p2.hp} HP at limit`;
                            sessionResult = 'lose';
                        }
                    } else {
                        engine.resultMsg = engine.vsComputer === 0 ? "PLAYER 1 HAS WON" : `${engine.p1.name} WINS by HP!`;
                        winDetails = `Led by ${engine.p1.hp - engine.p2.hp} HP at the limit`;
                        sessionResult = 'win';
                        if (isAI) winAmount = 20;
                    }
                } else if (engine.p2.hp > engine.p1.hp) {
                    if (engine.vsComputer === 3) {
                        if (mySymbol === 2) {
                            engine.resultMsg = "VICTORY";
                            winDetails = `Led by ${engine.p2.hp - engine.p1.hp} HP at limit`;
                            sessionResult = 'win';
                            winAmount = 20;
                        } else {
                            engine.resultMsg = "DEFEAT";
                            winDetails = `${engine.p2.name} won by ${engine.p2.hp - engine.p1.hp} HP at limit`;
                            sessionResult = 'lose';
                        }
                    } else {
                        engine.resultMsg = engine.vsComputer === 0 ? "PLAYER 2 HAS WON" : `${engine.p2.name} WINS by HP!`;
                        winDetails = `Led by ${engine.p2.hp - engine.p1.hp} HP at the limit`;
                        sessionResult = 'lose';
                    }
                } else {
                    engine.resultMsg = "DRAW! Equal HP!";
                    sessionResult = 'push';
                    if (isAI || engine.vsComputer === 3) {
                        winAmount = 10;
                        winDetails = "MATCH TIED - BET REFUNDED";
                    }
                }
            }
            engine.winDetails = winDetails;
            setCurrentScreen(GameScreen.RESULT);
            handleGameOver(winAmount, sessionResult);
        } else {
            engine.turn++;
            engine.log = [];
            setCurrentScreen(GameScreen.BATTLE);
        }
        updateState();
    };

    const nextGauntletTurn = () => {
        const playerDead = engine.p1.hp <= 0;
        const allDead = engine.enemies.every(e => e.hp <= 0);

        if (playerDead) {
            engine.resultMsg = "You fell... The Gauntlet wins.";
            setCurrentScreen(GameScreen.RESULT);
            handleGameOver(0, 'lose');
        } else if (allDead) {
            engine.resultMsg = "GAUNTLET CLEARED! Champion stands alone!";
            setCurrentScreen(GameScreen.RESULT);
            handleGameOver(50, 'win'); // Mega Gauntlet Reward
        } else if (engine.turn >= 25) {
            engine.resultMsg = "Time expired. The Gauntlet is unfinished.";
            setCurrentScreen(GameScreen.RESULT);
            handleGameOver(0, 'lose');
        } else {
            engine.turn++;
            engine.log = [];
            // Auto select next living target
            if (engine.enemies[engine.selectedTarget].hp <= 0) {
                engine.selectedTarget = engine.enemies.findIndex(e => e.hp > 0);
            }
            setCurrentScreen(GameScreen.GAUNTLET_BATTLE);
        }
        updateState();
    };

    // Helper to get sprite URL
    const getSprite = (playerIdx, classId) => {
        const prefix = playerIdx === 0 ? 'p1' : 'p2';
        const className = ['knight', 'magician', 'alchemist'][classId];
        return `${SPRITE_BASE_PATH}/${prefix}_${className}.png`;
    };

    return (
        <AppShell>
            <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-5xl glass card-xl p-8 relative overflow-hidden bg-black/40 backdrop-blur-xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">

                    {/* Background visual element */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>

                    {currentScreen === GameScreen.MENU && (
                        <div className="flex flex-col items-center gap-12 py-12">
                            <h1 className="text-6xl font-black text-white tracking-widest text-center">
                                TRIAL BY COMBAT
                            </h1>
                            <div className="flex flex-col gap-4 w-64">
                                <button
                                    onClick={() => { engine.vsComputer = 1; setCurrentScreen(GameScreen.SELECT_CLASS_P1); }}
                                    className="px-6 py-4 bg-white/5 border border-white/10 text-white font-bold hover:bg-white hover:text-black transition-all duration-300 uppercase tracking-tighter rounded-lg"
                                >
                                    VS Computer
                                </button>
                                <button
                                    onClick={() => { engine.vsComputer = 0; setCurrentScreen(GameScreen.SELECT_CLASS_P1); }}
                                    className="px-6 py-4 bg-white/5 border border-white/10 text-white font-bold hover:bg-white hover:text-black transition-all duration-300 uppercase tracking-tighter rounded-lg"
                                >
                                    VS Player
                                </button>

                                <button
                                    onClick={() => handleStartOnline('ONLINE_PVP')}
                                    className="px-6 py-4 bg-purple-500/20 border border-purple-500/30 text-purple-400 font-bold hover:bg-purple-500 hover:text-white transition-all duration-300 uppercase tracking-tighter rounded-lg"
                                >
                                    Online PvP
                                </button>
                                <button
                                    onClick={() => handleStartOnline('PRIVATE')}
                                    className="px-6 py-4 bg-pink-500/20 border border-pink-500/30 text-pink-400 font-bold hover:bg-pink-500 hover:text-white transition-all duration-300 uppercase tracking-tighter rounded-lg"
                                >
                                    Play with Friend
                                </button>
                                <button
                                    onClick={() => { engine.vsComputer = 2; setCurrentScreen(GameScreen.SELECT_CLASS_P1); }}
                                    className="px-6 py-4 bg-primary/20 border border-primary/30 text-primary font-bold hover:bg-primary hover:text-black transition-all duration-300 uppercase tracking-tighter rounded-lg"
                                >
                                    Gauntlet Mode
                                </button>

                            </div>
                        </div>
                    )}

                    {(currentScreen === GameScreen.SELECT_CLASS_P1 || currentScreen === GameScreen.SELECT_CLASS_P2) && (
                        <div className="flex flex-col items-center gap-6">
                            <h2 className="text-3xl font-bold text-white uppercase tracking-wider text-center flex flex-col items-center gap-2">
                                {currentScreen === GameScreen.SELECT_CLASS_P1
                                    ? (engine.vsComputer === 3 && myClassChosen
                                        ? `Waiting for ${opponentProfile?.username || 'Opponent'}...`
                                        : "Choose Your Champion")
                                    : "Player 2 - Choose Your Champion"}
                            </h2>

                            {engine.vsComputer === 3 && opponentProfile && (
                                <div className="flex items-center gap-3 bg-black/40 border border-white/10 px-4 py-2 rounded-full shadow-lg">
                                    <span className="text-[10px] font-black uppercase text-white/50 tracking-widest">VERSUS</span>
                                    {opponentProfile.avatar_url && <img src={opponentProfile.avatar_url} className="w-6 h-6 rounded-full object-cover" />}
                                    <span className="text-sm font-bold text-cyan-400">{opponentProfile.username}</span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-2">
                                {[
                                    { id: 0, name: "Knight", desc: "High Health & Armor", color: "text-blue-400" },
                                    { id: 1, name: "Magician", desc: "Fast & High Sustain", color: "text-purple-400" },
                                    { id: 2, name: "Alchemist", desc: "Strong Dots & Buffs", color: "text-green-400" }
                                ].map(cls => (
                                    <button
                                        key={cls.id}
                                        onClick={() => handleClassSelect(cls.id)}
                                        className="group relative glass p-6 border border-white/10 hover:border-white/40 transition-all rounded-xl flex flex-col items-center gap-4"
                                    >
                                        <div className="w-32 h-32 flex items-center justify-center p-2 rounded-full bg-white/5 group-hover:scale-110 transition-transform duration-500">
                                            <img src={getSprite(currentScreen === GameScreen.SELECT_CLASS_P1 ? 0 : 1, cls.id)} alt={cls.name} className="w-full h-full object-contain pixelatedScale" />
                                        </div>
                                        <div className="text-center">
                                            <h3 className={`text-xl font-black ${cls.color} uppercase`}>{cls.name}</h3>
                                            <p className="text-xs text-muted mt-1">{cls.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}


                    {currentScreen === 'MATCHMAKING' && (
                        <div className="flex flex-col items-center gap-8 py-12 text-white">
                            <h2 className="text-4xl font-black italic tracking-widest text-cyan-400">{message}</h2>
                            {onlineRoom && (
                                <button onClick={() => setIsInviteModalOpen(true)} className="px-8 py-3 bg-pink-500/20 hover:bg-pink-500 text-pink-400 hover:text-white font-black rounded-xl transition-all border border-pink-500/50">
                                    INVITE FRIEND
                                </button>
                            )}
                            <button onClick={() => {
                                setCurrentScreen(GameScreen.MENU);
                                hasAutoJoined.current = false;
                                socket.emit('leave_tbc_queue');
                            }} className="px-8 py-3 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white font-black rounded-xl transition-all border border-red-500/50">
                                CANCEL
                            </button>
                        </div>
                    )}

                    {currentScreen === 'MATCH_FOUND' && (
                        <div className="flex flex-col items-center gap-8 py-12 text-white">
                            <div className="relative w-40 h-40 mx-auto flex flex-col items-center justify-center">
                                <div className="absolute inset-0 border-4 border-green-500/30 rounded-full animate-pulse"></div>
                                <div className="absolute inset-0 border-4 border-t-green-500 rounded-full animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center text-5xl drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]">⚔️</div>
                            </div>
                            <h2 className="text-4xl font-black italic tracking-widest text-green-400">MATCH FOUND!</h2>
                            <p className="text-sm font-bold text-white/50 animate-pulse">Entering arena...</p>
                        </div>
                    )}

                    {currentScreen === GameScreen.SELECT_OPPONENT && (
                        <div className="flex flex-col items-center gap-8">
                            <h2 className="text-3xl font-bold text-white uppercase tracking-wider">Choose Opponent</h2>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                                {[
                                    { id: 0, name: "Knight", color: "border-blue-400/30 text-blue-400" },
                                    { id: 1, name: "Magician", color: "border-purple-400/30 text-purple-400" },
                                    { id: 2, name: "Alchemist", color: "border-green-400/30 text-green-400" },
                                    { id: Math.floor(Math.random() * 3), name: "Random", color: "border-white/30 text-white" }
                                ].map((opp, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleOpponentSelect(opp.id)}
                                        className={`p-6 border glass rounded-xl uppercase font-black text-sm tracking-tighter hover:bg-white hover:text-black transition-all ${opp.color}`}
                                    >
                                        {opp.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {(currentScreen === GameScreen.BATTLE || currentScreen === GameScreen.RESOLVE) && (
                        <div className="flex flex-col gap-8">
                            <div className="flex justify-between items-center mb-4">
                                <div className="text-white font-black tracking-tighter bg-white/5 px-4 py-1 rounded-full border border-white/10">
                                    TURN {gameState.turn} / 25
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative h-[300px]">
                                {/* Middle visual separator */}
                                <div className="hidden md:block absolute left-1/2 top-0 h-full w-px bg-gradient-to-b from-transparent via-white/10 to-transparent"></div>

                                {/* Player 1 */}
                                <div className="flex flex-col items-center gap-6">
                                    <div className="w-full space-y-2">
                                        <div className="flex justify-between text-xs font-bold text-white uppercase tracking-widest px-1">
                                            <span className="flex items-center gap-2">
                                                {engine.vsComputer === 3 && mySymbol === 1 && myProfilePic && <img src={myProfilePic} className="w-5 h-5 rounded-full object-cover" />}
                                                {engine.vsComputer === 3 && mySymbol !== 1 && opponentProfile?.avatar_url && <img src={opponentProfile.avatar_url} className="w-5 h-5 rounded-full object-cover" />}
                                                {gameState.p1.name}
                                            </span>
                                            <span>{Math.max(0, gameState.p1.hp)} / {gameState.p1.maxHp} HP</span>
                                        </div>
                                        <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-0.5">
                                            <div
                                                className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-500 rounded-full"
                                                style={{ width: `${(Math.max(0, gameState.p1.hp) / gameState.p1.maxHp) * 100}%` }}
                                            />
                                        </div>
                                        <div className="flex gap-1 justify-start h-1.5 mt-2">
                                            {Array.from({ length: 10 }).map((_, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`w-4 rounded-full border border-white/10 ${idx < gameState.p1.charge ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]' : 'bg-white/5'}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="relative group">
                                        <img
                                            src={getSprite(0, gameState.p1.classId)}
                                            alt="Hero"
                                            className={`w-36 h-36 object-contain pixelatedScale transition-transform ${gameState.p1.hp <= 0 ? 'opacity-0 scale-0 grayscale' : 'scale-125'}`}
                                        />
                                        <div className="absolute -bottom-4 flex gap-2">
                                            {gameState.p1.buffActive && <span className="px-2 py-0.5 bg-blue-500/80 text-[10px] font-black text-white rounded uppercase italic">Buff {gameState.p1.buffTurns}T</span>}
                                            {gameState.p1.dotStacks > 0 && <span className="px-2 py-0.5 bg-orange-500/80 text-[10px] font-black text-white rounded uppercase italic">Burn {gameState.p1.dotStacks}x</span>}
                                        </div>
                                    </div>
                                </div>

                                {/* Player 2 / AI */}
                                <div className="flex flex-col items-center gap-6">
                                    <div className="w-full space-y-2">
                                        <div className="flex justify-between text-xs font-bold text-white uppercase tracking-widest px-1">
                                            <span>{Math.max(0, gameState.p2.hp)} / {gameState.p2.maxHp} HP</span>
                                            <span className="flex items-center gap-2">
                                                {gameState.p2.name}
                                                {engine.vsComputer === 3 && mySymbol === 2 && myProfilePic && <img src={myProfilePic} className="w-5 h-5 rounded-full object-cover" />}
                                                {engine.vsComputer === 3 && mySymbol !== 2 && opponentProfile?.avatar_url && <img src={opponentProfile.avatar_url} className="w-5 h-5 rounded-full object-cover" />}
                                            </span>
                                        </div>
                                        <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-0.5">
                                            <div
                                                className="h-full bg-gradient-to-l from-red-500 via-yellow-500 to-green-500 transition-all duration-500 rounded-full ml-auto"
                                                style={{ width: `${(Math.max(0, gameState.p2.hp) / gameState.p2.maxHp) * 100}%` }}
                                            />
                                        </div>
                                        <div className="flex gap-1 justify-end h-1.5 mt-2">
                                            {Array.from({ length: 10 }).map((_, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`w-4 rounded-full border border-white/10 ${idx < (10 - gameState.p2.charge) ? 'bg-white/5' : 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]'}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="relative group">
                                        <img
                                            src={getSprite(1, gameState.p2.classId)}
                                            alt="Enemy"
                                            className={`w-36 h-36 object-contain pixelatedScale transition-transform ${gameState.p2.hp <= 0 ? 'opacity-0 scale-0 grayscale' : 'scale-125'}`}
                                        />
                                        <div className="absolute -bottom-4 right-0 flex gap-2">
                                            {gameState.p2.buffActive && <span className="px-2 py-0.5 bg-blue-500/80 text-[10px] font-black text-white rounded uppercase italic">Buff {gameState.p2.buffTurns}T</span>}
                                            {gameState.p2.dotStacks > 0 && <span className="px-2 py-0.5 bg-orange-500/80 text-[10px] font-black text-white rounded uppercase italic">Burn {gameState.p2.dotStacks}x</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Interactions Area */}
                            <div className={`mt-8 ${currentScreen === GameScreen.BATTLE ? 'grid grid-cols-1 md:grid-cols-2' : 'flex flex-col items-center'} gap-8 ring-1 ring-white/5 bg-white/5 p-6 rounded-2xl backdrop-blur-md relative`}>
                                {currentScreen === GameScreen.BATTLE ? (
                                    <>
                                        <div className="flex flex-col gap-4">
                                            <p className="text-xs font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                                                {engine.vsComputer === 3
                                                    ? `${mySymbol === 1 ? gameState.p1.name : gameState.p2.name}'s Choice`
                                                    : (!gameState.vsComputer && gameState.p1chosen) ? `${gameState.p2.name}'s Choice` : `${gameState.p1.name}'s Choice`}
                                            </p>
                                            <div className="grid grid-cols-1 gap-2">
                                                {engine.getMoves(engine.vsComputer === 3 ? (mySymbol === 1 ? gameState.p1.classId : gameState.p2.classId) : (!gameState.vsComputer && gameState.p1chosen) ? gameState.p2.classId : gameState.p1.classId).map((move, idx) => {
                                                    const cf = engine.vsComputer === 3 ? (mySymbol === 1 ? gameState.p1 : gameState.p2) : (!gameState.vsComputer && gameState.p1chosen) ? gameState.p2 : gameState.p1;
                                                    const locked = cf.charge < move.cost || (engine.vsComputer === 3 && selectedMove !== null);
                                                    return (
                                                        <button
                                                            key={idx}
                                                            disabled={locked}
                                                            onClick={() => handleMove(idx)}
                                                            className={`flex justify-between items-center p-3 rounded-lg border transition-all duration-200 group ${locked ? 'opacity-40 grayscale border-white/5 bg-white/5 cursor-not-allowed' : 'bg-white/5 border-white/10 hover:bg-white hover:text-black hover:border-white'}`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <span className={`w-10 text-[10px] py-0.5 text-center rounded font-black ${move.type === MoveType.ATK ? 'bg-red-500/20 text-red-400 group-hover:bg-red-500 group-hover:text-white' :
                                                                    move.type === MoveType.DEF ? 'bg-blue-500/20 text-blue-400 group-hover:bg-blue-500 group-hover:text-white' :
                                                                        move.type === MoveType.DOT ? 'bg-orange-500/20 text-orange-400 group-hover:bg-orange-500 group-hover:text-white' :
                                                                            move.type === MoveType.BUFF ? 'bg-green-500/20 text-green-400 group-hover:bg-green-500 group-hover:text-white' : 'bg-yellow-500/20 text-yellow-500 group-hover:bg-yellow-500 group-hover:text-white'
                                                                    }`}>{['ATK', 'DEF', 'DOT', 'BUFF', 'ULT'][move.type]}</span>
                                                                <span className="text-sm font-bold uppercase tracking-tighter">{move.name}</span>
                                                            </div>
                                                            <span className="text-[10px] font-black opacity-60">COST {move.cost}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Battle Log Panel */}
                                        <div className="flex flex-col gap-3 h-full max-h-[250px]">
                                            <div className="flex justify-between items-center border-b border-white/10 pb-2">
                                                <span className="text-xs font-black text-white/40 uppercase tracking-widest italic">Battle Log</span>
                                            </div>
                                            <div className="flex-grow overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-white/10">
                                                {gameState.log.map((line, idx) => (
                                                    <div key={idx} className="text-[11px] font-medium text-white/70 border-l-2 border-white/10 pl-3 leading-relaxed">
                                                        {line}
                                                    </div>
                                                ))}
                                                {gameState.log.length === 0 && <div className="text-[11px] text-white/20 italic">Waiting for initial engagement...</div>}
                                                <div ref={logEndRef} />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex flex-col gap-6 justify-center items-center py-6 w-full max-w-lg">
                                            {(gameState.p1.hp <= 0 || gameState.p2.hp <= 0 || gameState.turn >= 25) ? (
                                                <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 w-full">
                                                    <div className="text-center p-8 rounded-3xl bg-white/5 border border-primary/20 shadow-[0_0_30px_rgba(var(--primary-rgb),0.2)] w-full">
                                                        <p className="text-4xl font-black text-primary uppercase tracking-tighter mb-2">BATTLE COMPLETE</p>
                                                        <p className="text-sm font-bold text-white/40 italic">A champion has been decided in the arena.</p>
                                                    </div>
                                                    <button
                                                        onClick={nextTurn}
                                                        className="w-full py-6 bg-primary text-black font-black text-2xl uppercase tracking-widest rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_10px_20px_rgba(var(--primary-rgb),0.3)] border-b-4 border-black/20"
                                                    >
                                                        SHOW RESULTS
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="text-sm text-center font-bold text-white/60 italic">Combat encounter resolved.</p>
                                                    <button
                                                        onClick={nextTurn}
                                                        className="px-12 py-4 bg-white text-black font-black text-lg uppercase tracking-widest rounded-full hover:scale-105 transition-transform shadow-xl"
                                                    >
                                                        Next Round
                                                    </button>
                                                </>
                                            )}
                                        </div>

                                        {/* Centered Battle Log Panel for Resolve screen */}
                                        <div className="flex flex-col gap-3 w-full max-w-lg mt-4 animate-in fade-in duration-1000">
                                            <div className="flex justify-center items-center border-b border-white/10 pb-2">
                                                <span className="text-xs font-black text-white/40 uppercase tracking-widest italic">Engagement Summary</span>
                                            </div>
                                            <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-white/10">
                                                {gameState.log.map((line, idx) => (
                                                    <div key={idx} className="text-center text-[13px] font-bold text-white border-b border-white/5 pb-1 last:border-0 leading-relaxed">
                                                        {line}
                                                    </div>
                                                ))}
                                                <div ref={logEndRef} />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {(currentScreen === GameScreen.GAUNTLET_BATTLE || currentScreen === GameScreen.GAUNTLET_RESOLVE) && (
                        <div className="flex flex-col gap-8">
                            <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest text-primary">
                                <span>GAUNTLET VS 3 ENEMIES</span>
                                <span>TURN {gameState.turn} / 25</span>
                            </div>

                            {/* Player Bar (Large) */}
                            <div className="w-full max-w-xl mx-auto space-y-2 mb-4">
                                <div className="flex justify-between text-[10px] font-black text-white uppercase px-1">
                                    <span>Champion Heart</span>
                                    <span>{gameState.p1.hp} / {gameState.p1.maxHp} HP</span>
                                </div>
                                <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-0.5">
                                    <div className="h-full bg-primary transition-all duration-700 rounded-full" style={{ width: `${(gameState.p1.hp / gameState.p1.maxHp) * 100}%` }} />
                                </div>
                            </div>

                            {/* Enemies Row */}
                            <div className="grid grid-cols-3 gap-8">
                                {gameState.enemies.map((enemy, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => currentScreen === GameScreen.GAUNTLET_BATTLE && enemy.hp > 0 && setGameState(s => ({ ...s, selectedTarget: idx }))}
                                        className={`flex flex-col items-center gap-4 p-4 rounded-xl border transition-all duration-300 relative ${enemy.hp <= 0 ? 'opacity-20 grayscale border-transparent' :
                                            gameState.selectedTarget === idx ? 'border-primary/50 bg-primary/5 shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]' : 'border-white/5 hover:border-white/20'
                                            }`}
                                    >
                                        {gameState.selectedTarget === idx && enemy.hp > 0 && <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-full animate-pulse shadow-[0_0_10px_#fff]"></div>}
                                        <div className="w-20 h-20 flex items-center justify-center pixelatedScale">
                                            <img src={getSprite(1, enemy.classId)} alt={enemy.name} className={`w-full h-full object-contain ${enemy.hp <= 0 ? 'scale-75 opacity-50' : 'scale-110'}`} />
                                        </div>
                                        <div className="w-full space-y-1">
                                            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                                <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }} />
                                            </div>
                                            <p className="text-[10px] font-bold text-center text-white/50 uppercase">{enemy.hp > 0 ? enemy.name : 'FALLEN'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Interactions Area */}
                            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8 ring-1 ring-white/5 bg-white/5 p-6 rounded-2xl relative">
                                {currentScreen === GameScreen.GAUNTLET_BATTLE ? (
                                    <div className="flex flex-col gap-4">
                                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Select Attack vs Target</p>
                                        <div className="grid grid-cols-1 gap-2">
                                            {engine.getMoves(gameState.p1.classId).map((move, idx) => {
                                                const locked = gameState.p1.charge < move.cost;
                                                return (
                                                    <button
                                                        key={idx}
                                                        disabled={locked}
                                                        onClick={() => handleGauntletMove(idx)}
                                                        className={`flex justify-between items-center p-3 rounded-lg border transition-all group ${locked ? 'opacity-40 grayscale border-white/5 bg-white/5' : 'bg-white/5 border-white/10 hover:bg-white hover:text-black hover:border-white'}`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <span className={`w-10 text-[10px] py-0.5 text-center rounded font-black ${move.type === MoveType.ATK ? 'bg-red-500/20 text-red-400 group-hover:bg-red-500 group-hover:text-white' :
                                                                move.type === MoveType.DEF ? 'bg-blue-500/20 text-blue-400 group-hover:bg-blue-500 group-hover:text-white' :
                                                                    move.type === MoveType.DOT ? 'bg-orange-500/20 text-orange-400 group-hover:bg-orange-500 group-hover:text-white' :
                                                                        move.type === MoveType.BUFF ? 'bg-green-500/20 text-green-400 group-hover:bg-green-500 group-hover:text-white' : 'bg-yellow-500/20 text-yellow-500 group-hover:bg-yellow-500 group-hover:text-white'
                                                                }`}>{['ATK', 'DEF', 'DOT', 'BUFF', 'ULT'][move.type]}</span>
                                                            <span className="text-xs font-bold uppercase">{move.name}</span>
                                                        </div>
                                                        <span className="text-[10px] font-black opacity-60">COST {move.cost}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4 justify-center items-center">
                                        {(gameState.p1.hp <= 0 || engine.enemies.every(e => e.hp <= 0) || gameState.turn >= 25) && (
                                            <div className="text-center animate-in fade-in zoom-in duration-500 mb-4">
                                                <p className="text-3xl font-black text-primary uppercase tracking-tighter mb-1">GAUNTLET ENDED</p>
                                                <p className="text-[10px] font-bold text-white/60">
                                                    {gameState.p1.hp <= 0 ? "The Champion has fallen." : "The Gauntlet has been cleared!"}
                                                </p>
                                            </div>
                                        )}
                                        <button
                                            onClick={nextGauntletTurn}
                                            className="px-8 py-3 bg-white text-black font-black uppercase tracking-widest rounded-full"
                                        >
                                            {(gameState.p1.hp <= 0 || engine.enemies.every(e => e.hp <= 0) || gameState.turn >= 25) ? "View Final Score" : "Next Round"}
                                        </button>
                                    </div>
                                )}

                                <div className="overflow-y-auto max-h-[220px] space-y-1.5 scrollbar-hide">
                                    {gameState.log.map((line, idx) => (
                                        <div key={idx} className="text-[10px] font-bold text-white/60 border-l border-white/10 pl-2">
                                            {line}
                                        </div>
                                    ))}
                                    <div ref={logEndRef} />
                                </div>
                            </div>
                        </div>
                    )}

                    {currentScreen === GameScreen.RESULT && (
                        <div className="flex flex-col items-center justify-center gap-8 py-12 text-center">
                            <div className="relative">
                                <h2 className="text-7xl font-black text-white uppercase tracking-tighter animate-in zoom-in-50 duration-500">
                                    {gameState.resultMsg}
                                </h2>
                                {engine.winDetails && (
                                    <p className="text-2xl font-bold text-primary mt-4 uppercase tracking-widest bg-primary/10 px-6 py-2 rounded-full border border-primary/20 backdrop-blur-sm shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)]">
                                        {engine.winDetails} {coinsWonThisSession > 0 ? `| +${coinsWonThisSession} COINS` : ""}
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl mt-12">
                                <button
                                    onClick={() => {
                                        const c1 = engine.p1.classId;
                                        if (engine.vsComputer === 3) {
                                            engine.reset();
                                            setCurrentScreen('MATCHMAKING');
                                            const fn = () => socket.emit('request_match_tbc', { profile: { username: user.email?.split('@')[0], avatar_url: '' } });
                                            socket.connected ? fn() : (socket.connect(), socket.once("connect", fn));
                                        } else if (engine.gauntletMode) {
                                            engine.initGauntlet(c1);
                                            setCurrentScreen(GameScreen.GAUNTLET_BATTLE);
                                        } else {
                                            const c2 = engine.p2.classId;
                                            engine.p1 = engine._createFighter(engine.p1.name, c1);
                                            engine.p2 = engine._createFighter(engine.p2.name, c2);
                                            engine.turn = 1;
                                            engine.log = [];
                                            setCurrentScreen(GameScreen.BATTLE);
                                        }
                                        updateState();
                                    }}
                                    className="px-8 py-4 bg-primary text-black font-black uppercase rounded-2xl hover:scale-105 transition-transform shadow-lg shadow-primary/20"
                                >
                                    REMATCH
                                </button>
                                <button
                                    onClick={() => { engine.reset(); setCurrentScreen(GameScreen.MENU); updateState(); }}
                                    className="px-8 py-4 bg-white/5 border border-white/20 text-white font-black uppercase rounded-2xl hover:bg-white/10 transition-all font-bold"
                                >
                                    MAIN MENU
                                </button>
                                <button
                                    onClick={() => navigate('/dashboard')}
                                    className="px-8 py-4 bg-white/5 border border-white/20 text-cyan-400 font-black uppercase rounded-2xl hover:bg-cyan-400/10 transition-all shadow-[0_0_15px_rgba(34,211,238,0.1)] hover:border-cyan-400/30"
                                >
                                    BACK TO LOBBY
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
            <style>
                {`
                    .pixelatedScale {
                        image-rendering: pixelated;
                        image-rendering: crisp-edges;
                    }
                `}
            </style>
            <InviteModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} gameName="trialbycombat" roomId={onlineRoom} />
        </AppShell>
    );
};

export default TrialByCombat;
