import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { AppShell } from './AppShell';
import { socket } from '../socket';
import { TrialEngine, CLASS_COLORS, CLASS_NAMES, CLASS_MOVES, MOVE_TYPES, MOVE_COSTS, CHARGE_GAINS } from '../engines/trialEngine';
import InviteModal from './InviteModal';

const FighterSprite = ({ isP1, classId, isAttacking, isHit }) => {
    // Determine sprite path (Mocking based on prompt instructions to use public PNGs)
    const classStr = CLASS_NAMES[classId]?.toLowerCase() || 'knight';
    const numStr = isP1 ? 'p1' : 'p2';
    const imgSrc = `/${numStr}_${classStr}.png`;

    // Create a fallback colored box if image is missing
    const fallbackColor = classId === 0 ? 'bg-blue-500' : classId === 1 ? 'bg-green-500' : classId === 2 ? 'bg-purple-500' : 'bg-gray-500';

    return (
        <div className={`relative transition-transform duration-200 
            ${isAttacking ? (isP1 ? 'translate-x-12' : '-translate-x-12') : ''}
            ${isHit ? 'animate-pulse translate-y-1' : ''}
            w-32 h-48 md:w-48 md:h-64 flex items-center justify-center`}
        >
            {/* Try loading image, gracefully fallback to colored box */}
            <img
                src={imgSrc}
                alt={`${numStr} ${classStr}`}
                className="w-full h-full object-contain filter drop-shadow-xl"
                onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                }}
            />
            <div className={`hidden absolute inset-0 ${fallbackColor} rounded-lg border-2 border-white/20 items-center justify-center flex-col`}>
                <span className="text-4xl font-black opacity-50">{isP1 ? 'P1' : 'P2'}</span>
                <span className="text-xs font-bold mt-2 uppercase">{CLASS_NAMES[classId]}</span>
            </div>
        </div>
    );
};

const ResultModal = ({ isOpen, data, onBackToMenu }) => {
    if (!isOpen || !data) return null;
    const isWin = data.title === 'VICTORY!';

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative w-full max-w-lg glass card-xl p-12 border-white/10 flex flex-col items-center text-center shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                {/* Glow Effect */}
                <div className={`absolute -inset-1 rounded-[2.5rem] blur-2xl opacity-20 ${isWin ? 'bg-emerald-500' : 'bg-red-500'}`}></div>

                <div className="relative w-full">
                    <div className={`text-5xl md:text-7xl font-black italic uppercase tracking-tighter mb-2 ${isWin ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]' : 'text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]'}`}>
                        {data.title}
                    </div>
                    {data.coinsWon > 0 ? (
                        <div className="text-xl font-bold text-yellow-500 mb-6 drop-shadow-md">
                            +{data.coinsWon} Coins
                        </div>
                    ) : (
                        <div className="text-xl font-bold text-gray-500 mb-6 drop-shadow-md h-7">
                            {data.title === 'DRAW!' ? 'Tied match' : ''}
                        </div>
                    )}

                    <div className="flex items-center justify-center gap-8 my-8 w-full bg-black/20 p-6 rounded-3xl border border-white/5">
                        {/* Winner */}
                        <div className="flex flex-col items-center z-10 transition-transform hover:scale-105 flex-1">
                            <span className="text-emerald-400 text-[10px] font-black tracking-widest uppercase mb-3">Winner</span>
                            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden border-4 border-emerald-500 shadow-[0_0_20px_rgba(52,211,153,0.5)] ring-2 ring-emerald-500/20 bg-gray-900 flex items-center justify-center">
                                {data.winner?.avatar_url ? (
                                    <img src={data.winner.avatar_url} alt="Winner" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-emerald-900/50 flex items-center justify-center text-3xl font-black text-emerald-100">{data.winner?.username?.[0]?.toUpperCase() || '?'}</div>
                                )}
                            </div>
                            <span className="mt-3 font-bold text-sm md:text-base text-white truncate w-24">{data.winner?.username || 'Unknown'}</span>
                        </div>

                        <div className="text-2xl font-black text-white/20 italic">VS</div>

                        {/* Loser */}
                        <div className="flex flex-col items-center opacity-70 grayscale flex-1">
                            <span className="text-red-500 text-[10px] font-black tracking-widest uppercase mb-3">Loser</span>
                            <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden border-2 border-red-500 bg-gray-900 flex items-center justify-center">
                                {data.loser?.avatar_url ? (
                                    <img src={data.loser.avatar_url} alt="Loser" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-red-900/50 flex items-center justify-center text-xl font-black text-red-100">{data.loser?.username?.[0]?.toUpperCase() || '?'}</div>
                                )}
                            </div>
                            <span className="mt-2 font-bold text-xs md:text-sm text-gray-400 truncate w-20">{data.loser?.username || 'Unknown'}</span>
                        </div>
                    </div>

                    <p className="text-white/40 text-xs font-bold uppercase tracking-[0.2em] mb-8">
                        {data.title === 'DRAW!' ? "Neither warrior could claim the crown" : (isWin ? "The arena has chosen its champion" : "Your flame has been extinguished")}
                    </p>

                    <button
                        onClick={onBackToMenu}
                        className="group relative px-12 py-4 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-white/90 transition-all hover:scale-105 active:scale-95 shadow-xl w-full"
                    >
                        BACK TO LOBBY
                        <div className="absolute inset-x-0 -bottom-1 h-1 bg-black/20 rounded-full scale-x-0 group-hover:scale-x-100 transition-transform origin-center"></div>
                    </button>

                    <div className="mt-8 flex gap-2 justify-center">
                        <div className={`w-2 h-2 rounded-full ${isWin ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`}></div>
                        <div className={`w-2 h-2 rounded-full ${isWin ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse delay-75`}></div>
                        <div className={`w-2 h-2 rounded-full ${isWin ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse delay-150`}></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ChargePips = ({ charge, maxCharge, alignRight }) => {
    return (
        <div className={`flex gap-1 mt-2 ${alignRight ? 'justify-end' : 'justify-start'}`}>
            {Array.from({ length: maxCharge }).map((_, i) => (
                <div
                    key={i}
                    className={`w-3 h-2 md:w-5 md:h-3 rounded-[2px] border ${i < charge ? 'bg-yellow-400 border-yellow-200 shadow-[0_0_5px_rgba(250,204,21,0.8)]' : 'bg-gray-800 border-gray-600'}`}
                />
            ))}
            {charge >= maxCharge && <span className="text-[10px] md:text-xs font-black text-red-400 uppercase ml-2 animate-pulse">ULT READY!</span>}
        </div>
    );
};

const HPBar = ({ hp, maxHp, isP1, charge, maxCharge }) => {
    const percent = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    const isLow = percent < 30;
    return (
        <div className={`flex flex-col gap-1 w-full max-w-md ${isP1 ? 'items-start' : 'items-end'}`}>
            <span className="text-xs font-black uppercase text-white/50 tracking-widest">{hp} / {maxHp} HP</span>
            <div className="w-full h-3 bg-black/50 border border-white/10 rounded-full overflow-hidden relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
                <div
                    className={`h-full transition-all duration-500 rounded-full ${isLow ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : (isP1 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]')}`}
                    style={{ width: `${percent}%` }}
                />
            </div>
            {charge !== undefined && <ChargePips charge={charge} maxCharge={maxCharge} alignRight={!isP1} />}
        </div>
    );
};

const TrialByCombat = () => {
    const { user } = UserAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [gameStatus, setGameStatus] = useState('MODE_SELECT'); // MODE_SELECT, CLASS_SELECT, PLAYING, FINISHED
    const [message, setMessage] = useState('');
    const [isOnline, setIsOnline] = useState(false);
    const [onlineRoom, setOnlineRoom] = useState(null);
    const [isGauntlet, setIsGauntlet] = useState(false);
    const [gameModeType, setGameModeType] = useState(''); // 'ONLINE', 'PRIVATE', 'BOT', 'GAUNTLET'
    const [myClass, setMyClass] = useState(0);
    const [myProfile, setMyProfile] = useState({ username: '', avatar_url: '' });
    const [opponentProfile, setOpponentProfile] = useState(null);
    const [isPlayer1, setIsPlayer1] = useState(true);
    const [userBalance, setUserBalance] = useState(0);
    const [matchResultData, setMatchResultData] = useState(null);

    // Battle State
    const [p1State, setP1State] = useState({ hp: 100, maxHp: 100, classId: 0, charge: 0, maxCharge: 10 });
    const [p2State, setP2State] = useState({ hp: 100, maxHp: 100, classId: 0, charge: 0, maxCharge: 10 });
    const [battleLog, setBattleLog] = useState([]);

    // Animation triggers
    const [animatingP1, setAnimatingP1] = useState({ attack: false, hit: false });
    const [animatingP2, setAnimatingP2] = useState({ attack: false, hit: false });
    const [isWaitingForOpponentTurn, setIsWaitingForOpponentTurn] = useState(false);
    const [turnNumber, setTurnNumber] = useState(1);

    // Multi
    const [showRoomBrowser, setShowRoomBrowser] = useState(false);
    const [availableRooms, setAvailableRooms] = useState([]);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const logEndRef = useRef(null);
    const hasAutoJoined = useRef(false);

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

    useEffect(() => {
        if (myProfile.username && location.state?.autoJoin && !hasAutoJoined.current) {
            hasAutoJoined.current = true;
            const roomId = location.state.autoJoin;
            navigate('/play/trial-combat', { replace: true, state: {} });
            setIsOnline(true);
            setIsPlayer1(true);
            setGameModeType('PRIVATE');
            setGameStatus('MATCHMAKING');
            setMessage('Joining private room...');

            const joinFn = () => socket.emit("join_private_tbc", { room_id: roomId, profile: { username: myProfile.username, avatar_url: myProfile.avatar_url } });
            if (socket.connected) joinFn();
            else { socket.connect(); socket.once("connect", joinFn); }
        }
    }, [myProfile, location.state, navigate]);

    // Scrolls the battle log to the bottom seamlessly
    useEffect(() => {
        if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, [battleLog]);

    useEffect(() => {
        if (!socket) return;

        socket.on("waiting_for_opponent", (data) => {
            setMessage(data.message || "Waiting for opponent...");
            if (data.room_id) setOnlineRoom(data.room_id);
        });

        socket.on("tbc_match_start", (data) => {
            setOnlineRoom(data.room_id);
            if (data.opponent_profile) setOpponentProfile(data.opponent_profile);
            if (data.is_p1 !== undefined) setIsPlayer1(data.is_p1);
            setGameStatus('CLASS_SELECT');
            setMessage('');
            setShowRoomBrowser(false);
        });

        socket.on("tbc_classes_locked", (data) => {
            TrialEngine.initGame(false, data.seed, data.p1Class, data.p2Class);
            setP1State(TrialEngine.getP1State());
            setP2State(TrialEngine.getP2State());
            setTurnNumber(1);
            setBattleLog([{ msg: "Combat Begins! En garde!", turn: 0 }]);
            setGameStatus('PLAYING');
        });

        socket.on("tbc_turn_result", (data) => {
            setIsWaitingForOpponentTurn(false);
            // In online, frontend WASM must actually run the turn
            let turnData = TrialEngine.resolveTurn(data.p1Move, data.p2Move);
            processTurnResult(turnData, data.p1Move, data.p2Move);
        });

        return () => {
            socket.off("waiting_for_opponent");
            socket.off("tbc_match_start");
            socket.off("tbc_classes_locked");
            socket.off("tbc_turn_result");
        };
    }, [socket, isOnline, myProfile, opponentProfile, isPlayer1, onlineRoom, gameModeType, isGauntlet, p1State, p2State, gameStatus]); // Dependencies ensure closures stay fresh


    const processTurnResult = (result, p1Move, p2Move) => {
        if (!result) return;

        let p1Color = CLASS_COLORS[p1State.classId] || 'text-white';
        let p2Color = CLASS_COLORS[p2State.classId] || 'text-white';

        const p1Name = isOnline ? (isPlayer1 ? myProfile.username : opponentProfile?.username) : myProfile.username;
        const p2Name = isOnline ? (isPlayer1 ? opponentProfile?.username : myProfile.username) : (isGauntlet ? 'Gauntlet' : 'Bot');

        const p1DisplayName = p1Name || "Player 1";
        const p2DisplayName = p2Name || (isOnline ? "Opponent" : "Bot");

        // Map Engine Roles (P1/P2) to Visual Sides (Left/Right)
        // animatingP1 controls Left, animatingP2 controls Right
        const setP1Anim = isPlayer1 ? setAnimatingP1 : setAnimatingP2;
        const setP2Anim = isPlayer1 ? setAnimatingP2 : setAnimatingP1;

        // Engine P1 always attacks first in resolveTurn
        setP1Anim({ attack: true, hit: false });
        setTimeout(() => {
            setP1Anim({ attack: false, hit: false });
            setP2Anim({ attack: false, hit: true });

            const p1MoveName = CLASS_MOVES[p1State.classId]?.[p1Move] || `Move ${p1Move + 1}`;
            setBattleLog(prev => [...prev, { msg: `${p1DisplayName} uses ${p1MoveName} and deals ${result.p1DamageDealt} DMG.`, color: p1Color }]);

            setTimeout(() => {
                setP2Anim({ attack: false, hit: false });

                if (result.winnerStatus !== 1 && result.winnerStatus !== 3) {
                    // Engine P2 attacks second
                    setP2Anim({ attack: true, hit: false });
                    setTimeout(() => {
                        setP2Anim({ attack: false, hit: false });
                        setP1Anim({ attack: false, hit: true });
                        const p2MoveName = CLASS_MOVES[p2State.classId]?.[p2Move] || `Move ${p2Move + 1}`;
                        setBattleLog(prev => [...prev, { msg: `${p2DisplayName} strikes back with ${p2MoveName} dealing ${result.p2DamageDealt} DMG.`, color: p2Color }]);

                        setTimeout(() => {
                            setP1Anim({ attack: false, hit: false });
                            updateStateFromEngine(result);
                        }, 500);
                    }, 500);
                } else {
                    updateStateFromEngine(result);
                }
            }, 500);
        }, 500);
    };

    const updateStateFromEngine = async (result) => {
        setP1State(TrialEngine.getP1State());
        setP2State(TrialEngine.getP2State());
        setTurnNumber(TrialEngine.turnNumber);

        if (result.winnerStatus === 1 || result.winnerStatus === 2 || result.winnerStatus === 4) {
            const isTie = result.winnerStatus === 4;
            const isWin = !isTie && ((isPlayer1 && result.winnerStatus === 1) || (!isPlayer1 && result.winnerStatus === 2));
            const isLoss = !isTie && !isWin;

            let winAmount = 0;
            let sessionResult = isTie ? 'push' : (isWin ? 'win' : 'lose');

            if (isWin) {
                if (gameModeType === 'ONLINE' || gameModeType === 'BOT') {
                    winAmount = 20;
                }
            } else if (isTie) {
                if (gameModeType === 'ONLINE' || gameModeType === 'BOT') {
                    winAmount = 5; // consolation for tie
                }
            }

            if (isTie) {
                setBattleLog(prev => [...prev, { msg: "STALEMATE! Both warriors have fallen.", color: 'text-yellow-400' }]);
                setMessage('DRAW!');
                setMatchResultData({
                    title: 'DRAW!',
                    coinsWon: winAmount,
                    winner: myProfile,
                    loser: opponentProfile || { username: isGauntlet ? 'Gauntlet Foe' : 'Enemy bot', avatar_url: '' }
                });
            } else if (isWin) {
                setBattleLog(prev => [...prev, { msg: "VICTORY! You decimated the foe.", color: 'text-emerald-400' }]);
                setMessage('VICTORY!');
                setMatchResultData({
                    title: 'VICTORY!',
                    coinsWon: winAmount,
                    winner: myProfile,
                    loser: opponentProfile || { username: isGauntlet ? 'Gauntlet Foe' : 'Enemy bot', avatar_url: '' }
                });
            } else {
                setBattleLog(prev => [...prev, { msg: "DEFEAT! You have fallen in combat.", color: 'text-red-400' }]);
                setMessage('DEFEAT!');
                setMatchResultData({
                    title: 'DEFEAT!',
                    coinsWon: 0,
                    winner: opponentProfile || { username: isGauntlet ? 'Gauntlet Foe' : 'Enemy bot', avatar_url: '' },
                    loser: myProfile
                });
            }
            setGameStatus('FINISHED');

            // Update balance if they won coins
            if (winAmount > 0) {
                const newBalance = userBalance + winAmount;
                await supabase.from('profiles').update({ coin_balance: newBalance }).eq('id', user.id);
                setUserBalance(newBalance);
            }

            // Insert leaderboard session
            try {
                await supabase.from('game_sessions').insert({
                    user_id: user.id,
                    game_id: 'trial-combat',
                    coins_won: winAmount,
                    result: sessionResult
                });
            } catch (e) {
                console.error("Failed to commit game session", e);
            }

        } else if (result.winnerStatus === 3) {
            setBattleLog(prev => [...prev, { msg: "GAUNTLET: FOE VANQUISHED! NEXT CHALLENGER APPROACHES!", color: 'text-yellow-400' }]);
        }
    };

    const startGame = async (modeName, gauntlet = false) => {
        // Reset old state immediately
        setIsOnline(false);
        setOnlineRoom(null);
        setIsGauntlet(gauntlet);
        setGameModeType(modeName);
        setP1State({ hp: 100, maxHp: 100, classId: 0, charge: 0, maxCharge: 10 });
        setP2State({ hp: 100, maxHp: 100, classId: 0, charge: 0, maxCharge: 10 });
        setBattleLog([]);
        setAnimatingP1({ attack: false, hit: false });
        setAnimatingP2({ attack: false, hit: false });
        setIsWaitingForOpponentTurn(false);
        setTurnNumber(1);

        const entryFee = (modeName === 'ONLINE' || modeName === 'BOT') ? 10 : 0;

        if (entryFee > 0 && userBalance < entryFee) {
            setMessage('Insufficient coins! Need 10 to play.');
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        try {
            if (entryFee > 0) {
                const newBalance = userBalance - entryFee;
                const { error: deductError } = await supabase
                    .from('profiles')
                    .update({ coin_balance: newBalance })
                    .eq('id', user.id);

                if (deductError) throw deductError;
                setUserBalance(newBalance);
            }
        } catch (err) {
            console.error(err);
            setMessage('Failed to process entry fee.');
            return;
        }

        if (modeName === 'ONLINE' || modeName === 'PRIVATE') {
            setIsOnline(true);
            setGameStatus('MATCHMAKING');
            if (modeName === 'PRIVATE') {
                setMessage("Creating private room...");
                const emitPrivateRequest = () => {
                    socket.emit("create_private_tbc", { profile: myProfile });
                };
                if (socket.connected) emitPrivateRequest();
                else {
                    socket.connect();
                    socket.once("connect", emitPrivateRequest);
                }
            } else {
                setMessage("Finding opponent...");
                const emitRequest = () => {
                    socket.emit("request_tbc_match", {
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
            }
        } else {
            setGameStatus('CLASS_SELECT');
        }
    };

    const confirmClassSelection = () => {
        if (isOnline) {
            socket.emit("tbc_lock_class", { room_id: onlineRoom, classId: myClass });
            setMessage("Waiting for opponent to pick class...");
        } else {
            TrialEngine.initGame(isGauntlet, Date.now(), myClass, Math.floor(Math.random() * 3));
            setP1State(TrialEngine.getP1State());
            setP2State(TrialEngine.getP2State());
            setTurnNumber(1);
            setBattleLog([{ msg: "Combat Begins! En garde!", turn: 0 }]);
            setGameStatus('PLAYING');
        }
    };

    const handleAction = (moveIdx) => {
        if (isOnline) {
            socket.emit("tbc_action", { room_id: onlineRoom, move: moveIdx });
            setIsWaitingForOpponentTurn(true);
        } else {
            // Local turn logic (ONLY for Bot/Gauntlet)
            let p2Move = TrialEngine.chooseMoveAI();
            let result = TrialEngine.resolveTurn(moveIdx, p2Move);
            processTurnResult(result, moveIdx, p2Move);
        }
    };

    const localPlayerState = isPlayer1 ? p1State : p2State;
    const opponentState = isPlayer1 ? p2State : p1State;

    const localName = myProfile.username || "You";
    const opponentName = isOnline ? (opponentProfile?.username || "Opponent") : (isGauntlet ? (p2State.classId === undefined ? 'Gauntlet' : `Enemy ${TrialEngine.gauntletIndex + 1}/3`) : 'Bot');

    const localAvatar = myProfile.avatar_url;
    const opponentAvatar = isOnline ? opponentProfile?.avatar_url : null;

    const localAnim = isPlayer1 ? animatingP1 : animatingP2;
    const opponentAnim = isPlayer1 ? animatingP2 : animatingP1;

    return (
        <AppShell>
            <div className="max-w-7xl mx-auto py-6 px-4 pt-20 md:pt-6 h-[calc(100vh-80px)]">
                {/* Core Theming: #050505 background + dark glassmorphism */}
                <div className="bg-transparent rounded-3xl border border-white/10 p-6 min-h-full flex flex-col relative overflow-hidden text-white shadow-2xl font-sans">

                    {/* Dynamic Arena Background */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl z-0">
                        <div className="absolute inset-0 bg-slate-950 flex justify-center items-center">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-purple-900/10 to-transparent" />
                        </div>

                        {/* More visible, brighter animated glowing orbs for atmosphere */}
                        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-emerald-500/30 rounded-full blur-[100px] mix-blend-screen animate-[pulse_8s_ease-in-out_infinite]" />
                        <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] bg-blue-500/20 rounded-full blur-[100px] mix-blend-screen animate-[pulse_10s_ease-in-out_infinite]" />
                        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-rose-500/30 rounded-full blur-[100px] mix-blend-screen animate-[pulse_6s_ease-in-out_infinite]" />

                        {/* More visible Grid Overlay */}
                        <div
                            className="absolute inset-0 opacity-10"
                            style={{
                                backgroundImage: `linear-gradient(rgba(255, 255, 255, 1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 1) 1px, transparent 1px)`,
                                backgroundSize: '40px 40px'
                            }}
                        />

                        {/* Fog/Smoke effect at the bottom */}
                        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black via-slate-900/60 to-transparent" />
                    </div>

                    {gameStatus === 'MODE_SELECT' && (
                        <div className="text-center space-y-12 animate-in fade-in zoom-in w-full my-auto z-20 relative">
                            <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-gray-400 via-white to-gray-400 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">TRIAL BY COMBAT</h1>
                            <div className="flex flex-col md:flex-row flex-wrap justify-center gap-6 px-4 z-20">
                                <button onClick={() => startGame('ONLINE')} className="w-full md:w-64 py-8 bg-blue-900/20 backdrop-blur-2xl border-2 border-blue-500/30 hover:bg-blue-900/40 hover:border-blue-400 text-blue-100 font-black rounded-3xl shadow-[0_0_30px_rgba(59,130,246,0.3)] transition-all hover:scale-105 text-xl uppercase tracking-widest flex flex-col items-center gap-2 group">
                                    <span className="text-3xl group-hover:animate-bounce">⚔️</span>
                                    <span>DUEL (Online)</span>
                                    <span className="text-[10px] text-blue-400 font-bold uppercase mt-2">10 Coin Entry • Win 20</span>
                                </button>
                                <button onClick={() => startGame('PRIVATE')} className="w-full md:w-64 py-8 bg-pink-900/20 backdrop-blur-2xl border-2 border-pink-500/30 hover:bg-pink-900/40 hover:border-pink-400 text-pink-100 font-black rounded-3xl shadow-[0_0_30px_rgba(236,72,153,0.3)] transition-all hover:scale-105 text-xl uppercase tracking-widest flex flex-col items-center gap-2 group">
                                    <span className="text-3xl group-hover:scale-110 transition-transform">🤝</span>
                                    <span>WITH FRIEND</span>
                                    <span className="text-[10px] text-pink-400 font-bold uppercase underline mt-2">Free Match</span>
                                </button>
                                <button onClick={() => startGame('BOT')} className="w-full md:w-64 py-8 bg-emerald-900/20 backdrop-blur-2xl border-2 border-emerald-500/30 hover:bg-emerald-900/40 hover:border-emerald-400 text-emerald-100 font-black rounded-3xl shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all hover:scale-105 text-xl uppercase tracking-widest flex flex-col items-center gap-2 group">
                                    <span className="text-3xl group-hover:rotate-12 transition-transform">🎯</span>
                                    <span>1v1 BOT</span>
                                    <span className="text-[10px] text-emerald-400 font-bold uppercase mt-2">10 Coin Entry • Win 20</span>
                                </button>
                                <button onClick={() => startGame('GAUNTLET', true)} className="w-full md:w-64 py-8 bg-red-900/20 backdrop-blur-2xl border-2 border-red-500/30 hover:bg-red-900/40 hover:border-red-400 text-red-100 font-black rounded-3xl shadow-[0_0_30px_rgba(239,68,68,0.3)] transition-all hover:scale-105 text-xl uppercase tracking-widest flex flex-col items-center gap-2 group">
                                    <span className="text-3xl group-hover:scale-125 transition-transform">☠️</span>
                                    <span>GAUNTLET</span>
                                    <span className="text-[10px] text-red-400 font-bold uppercase mt-2">Free Run</span>
                                </button>
                            </div>
                            {message && <p className="text-emerald-400 font-bold uppercase tracking-widest">{message}</p>}
                            <button onClick={() => navigate('/dashboard')} className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white font-bold rounded-xl text-xs uppercase tracking-widest transition-all mt-4 border border-white/10">BACK TO LOBBY</button>
                        </div>
                    )}

                    {gameStatus === 'MATCHMAKING' && (
                        <div className="text-center space-y-10 animate-in fade-in zoom-in w-full max-w-md my-auto mx-auto z-20 relative">
                            <div className="relative w-40 h-40 mx-auto flex flex-col items-center justify-center">
                                <div className="absolute inset-0 border-4 border-emerald-500/10 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-t-emerald-500 rounded-full animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center text-5xl">⚔️</div>
                            </div>
                            <div className="space-y-4">
                                <p className="text-3xl font-black italic tracking-widest text-emerald-400">SEARCHING ARENA...</p>
                                <p className="text-sm text-gray-400">{message}</p>

                                {onlineRoom && (
                                    <button onClick={() => setIsInviteModalOpen(true)} className="mt-8 px-8 py-3 bg-pink-500/20 hover:bg-pink-500 text-pink-400 hover:text-white font-black rounded-xl transition-all border border-pink-500/50 shadow-lg text-sm group flex items-center gap-2 justify-center w-full">
                                        <span className="text-xl group-hover:scale-110 transition-transform">👥</span> INVITE FRIEND
                                    </button>
                                )}
                            </div>
                            <button onClick={async () => {
                                setGameStatus('MODE_SELECT');
                                setMessage('');
                                if (socket) socket.emit("leave_room", { room_id: onlineRoom });
                                setIsOnline(false);
                            }} className="px-8 py-3 bg-white/5 border border-red-500/10 text-red-500 font-black uppercase tracking-widest hover:bg-red-500/20 rounded-xl transition-all">Abort Search</button>
                        </div>
                    )}

                    {gameStatus === 'CLASS_SELECT' && (
                        <div className="flex flex-col items-center justify-center h-full relative z-10 animate-in fade-in text-center">
                            <h2 className="text-4xl font-black italic mb-8 uppercase text-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">Choose Your Fighter</h2>
                            <div className="flex gap-4 mb-12 flex-wrap justify-center">
                                {Object.keys(CLASS_NAMES).map((id) => {
                                    const numId = parseInt(id);
                                    const isSelected = myClass === numId;
                                    const classStr = CLASS_NAMES[numId].toLowerCase();
                                    return (
                                        <button
                                            key={numId}
                                            onClick={() => setMyClass(numId)}
                                            className={`relative p-6 rounded-2xl border-2 transition-all duration-300 w-40 h-56 flex flex-col items-center justify-between overflow-hidden group ${isSelected ? 'border-emerald-500 bg-emerald-500/20 scale-110 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/30'}`}
                                        >
                                            <div className="flex-1 w-full flex items-center justify-center p-2">
                                                <img
                                                    src={`/p1_${classStr}.png`}
                                                    alt={classStr}
                                                    className={`w-full h-full object-contain filter transition-transform duration-300 ${isSelected ? 'drop-shadow-[0_0_10px_rgba(255,255,255,0.4)] scale-110' : 'drop-shadow-lg group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]'}`}
                                                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                                />
                                                <div className={`hidden w-16 h-16 rounded shadow-inner items-center justify-center text-xl font-bold ${CLASS_COLORS[numId]}`.replace('text-', 'bg-').replace('-400', '-500/50')}>
                                                    ?
                                                </div>
                                            </div>
                                            <span className={`font-black uppercase tracking-widest text-sm z-10 ${CLASS_COLORS[numId]} ${isSelected ? 'drop-shadow-[0_0_5px_currentColor]' : ''}`}>{CLASS_NAMES[numId]}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <button onClick={confirmClassSelection} className="px-12 py-4 bg-emerald-500 text-black font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 transition-transform active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.4)]">LOCK IN</button>
                            {message && <p className="mt-4 text-white/50">{message}</p>}
                        </div>
                    )}

                    {(gameStatus === 'PLAYING' || gameStatus === 'FINISHED') && (
                        <div className="flex flex-col h-full relative z-10 animate-in fade-in">
                            {/* Top HUD */}
                            <div className="flex justify-between items-center bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4 md:p-6 shadow-lg mb-8 h-28">
                                <HPBar hp={localPlayerState.hp} maxHp={localPlayerState.maxHp} charge={localPlayerState.charge} maxCharge={localPlayerState.maxCharge} isP1={true} />
                                <div className="hidden md:flex flex-col items-center px-8">
                                    <span className="text-3xl font-black italic tracking-tighter text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">VS</span>
                                    <span className="text-xs text-white/50 tracking-widest mt-1">TURN {turnNumber}</span>
                                </div>
                                <HPBar hp={opponentState.hp} maxHp={opponentState.maxHp} charge={opponentState.charge} maxCharge={opponentState.maxCharge} isP1={false} />
                            </div>

                            {/* Arena */}
                            <div className="flex-1 flex items-center justify-between px-4 md:px-24">
                                {/* Local Player */}
                                <div className="flex flex-col items-center">
                                    <FighterSprite
                                        isP1={true}
                                        classId={localPlayerState.classId}
                                        isAttacking={localAnim.attack}
                                        isHit={localAnim.hit}
                                    />
                                    <span className={`mt-4 font-black text-xl md:text-2xl uppercase tracking-widest ${CLASS_COLORS[localPlayerState.classId]}`}>{CLASS_NAMES[localPlayerState.classId]}</span>
                                    <div className="flex items-center gap-2 mt-1">
                                        {localAvatar ? <img src={localAvatar} className="w-6 h-6 rounded-full border border-white/20" /> : <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">{localName?.[0]?.toUpperCase()}</div>}
                                        <span className="text-white/80 font-bold text-sm uppercase">{localName}</span>
                                    </div>
                                    {localPlayerState.isDead && <span className="bg-red-500 text-white font-black px-4 py-1 rounded-full uppercase mt-2">DEAD</span>}
                                </div>

                                {/* Opponent */}
                                <div className="flex flex-col items-center">
                                    <FighterSprite
                                        isP1={false}
                                        classId={opponentState.classId}
                                        isAttacking={opponentAnim.attack}
                                        isHit={opponentAnim.hit}
                                    />
                                    <span className={`mt-4 font-black text-xl md:text-2xl uppercase tracking-widest ${CLASS_COLORS[opponentState.classId]}`}>{opponentName.includes('Enemy') ? opponentName : CLASS_NAMES[opponentState.classId]}</span>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-white/80 font-bold text-sm uppercase">{opponentName}</span>
                                        {opponentAvatar ? <img src={opponentAvatar} className="w-6 h-6 rounded-full border border-white/20" /> : <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">{opponentName?.[0]?.toUpperCase()}</div>}
                                    </div>
                                    {opponentState.isDead && <span className="bg-red-500 text-white font-black px-4 py-1 rounded-full uppercase mt-2">DEAD</span>}
                                </div>
                            </div>

                            {/* Actions & Logs */}
                            <div className="mt-8 flex flex-col md:flex-row gap-4 h-48 md:h-56">
                                {/* Action Buttons */}
                                <div className="w-full md:w-1/2 p-2 bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl grid grid-cols-2 md:grid-cols-3 gap-2 shadow-inner">
                                    {gameStatus === 'PLAYING' && !isWaitingForOpponentTurn && !localPlayerState.isDead && (CLASS_MOVES[localPlayerState.classId] || []).map((moveName, i) => {
                                        const locked = localPlayerState.charge < MOVE_COSTS[i];
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => { if (!locked) handleAction(i) }}
                                                disabled={locked}
                                                className={`${locked ? 'opacity-50 grayscale cursor-not-allowed bg-white/5 border-white/5 text-gray-500' : 'bg-white/5 border-white/10 hover:bg-emerald-500/20 hover:border-emerald-500 text-white hover:scale-[1.02] active:scale-95'} border font-black rounded-xl transition-all uppercase tracking-widest text-xs md:text-sm flex flex-col items-center justify-between p-2 drop-shadow-md group`}
                                            >
                                                <div className="flex w-full justify-between items-center px-1 mb-1 relative">
                                                    <span className={`text-[9px] px-1 rounded ${MOVE_TYPES[i] === 'ULT' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-white/10'} font-bold`}>{MOVE_TYPES[i]}</span>
                                                    <div className="flex flex-col text-[8px] tracking-tight text-right opacity-60 font-mono">
                                                        <span className={locked ? 'text-red-400' : ''}>Cost: {MOVE_COSTS[i]}</span>
                                                        <span>Gain: +{CHARGE_GAINS[i]}</span>
                                                    </div>
                                                </div>
                                                <span className="text-center w-full leading-tight">{locked ? '[LOCKED]' : moveName}</span>
                                            </button>
                                        );
                                    })}
                                    {(isWaitingForOpponentTurn || gameStatus === 'FINISHED') && (
                                        <div className="col-span-full flex items-center justify-center text-white/50 font-bold uppercase tracking-widest animate-pulse">
                                            {gameStatus === 'FINISHED' ? 'Match Concluded' : "Awaiting opponent's strike..."}
                                        </div>
                                    )}
                                </div>

                                {/* Battle Log Container */}
                                <div className="w-full md:w-1/2 p-4 bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-inner overflow-y-auto font-mono text-sm leading-relaxed flex flex-col relative">
                                    <div className="sticky top-0 bg-black/80 backdrop-blur pb-2 z-10 border-b border-white/10 mb-2">
                                        <h3 className="text-white/40 font-black uppercase tracking-widest text-xs">Combat Log</h3>
                                    </div>
                                    <ul className="flex-1 space-y-2">
                                        {battleLog.map((log, idx) => (
                                            <li key={idx} className={`${log.color || 'text-gray-300'} animate-in fade-in slide-in-from-bottom-2`}>
                                                <span className="opacity-50 text-xs mr-2">[{idx > 0 ? idx : '*'}]</span>
                                                {log.msg}
                                            </li>
                                        ))}
                                        <div ref={logEndRef} />
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <InviteModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} gameName="trial-combat" roomId={onlineRoom} />
                <ResultModal
                    isOpen={gameStatus === 'FINISHED'}
                    data={matchResultData}
                    onBackToMenu={() => {
                        setGameStatus('MODE_SELECT');
                        setMessage('');
                        setMatchResultData(null);
                    }}
                />
            </div>
        </AppShell>
    );
};

export default TrialByCombat;
