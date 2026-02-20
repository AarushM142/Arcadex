import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BlackjackEngine } from '../engines/blackjackEngine';
import { UserAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { AppShell } from './AppShell';
import { socket } from '../socket';
import InviteModal from './InviteModal';

const CARD_SUITS = ['♠', '♣', '♥', '♦'];
const CARD_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const Card = ({ card, hidden }) => {
    if (hidden || card === -1) {
        return (
            <div className="w-12 h-16 md:w-20 md:h-28 bg-gradient-to-br from-slate-800 to-black rounded-md md:rounded-lg border md:border-2 border-white/10 flex items-center justify-center shadow-md md:shadow-xl">
                <div className="text-xl md:text-2xl opacity-20 font-bold">?</div>
            </div>
        );
    }
    const rank = CARD_RANKS[card % 13];
    const suit = CARD_SUITS[Math.floor(card / 13)];
    const isRed = suit === '♥' || suit === '♦';
    return (
        <div className={`w-12 h-16 md:w-20 md:h-28 bg-white rounded-md md:rounded-lg border md:border-2 border-gray-200 flex flex-col justify-between p-1 md:p-2 shadow-sm md:shadow-md transform transition-transform hover:-translate-y-1 ${isRed ? 'text-red-600' : 'text-black'}`}>
            <div className="text-[8px] md:text-xs font-bold leading-none">{rank}<br /><span>{suit}</span></div>
            <div className="text-lg md:text-2xl self-center">{suit}</div>
            <div className="text-[8px] md:text-xs font-bold leading-none self-end text-right">{rank}<br /><span>{suit}</span></div>
        </div>
    );
};

const Avatar = ({ src, name, size = "w-10 h-10" }) => (
    <div className={`${size} rounded-lg overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shrink-0`}>
        {src ? <img src={src} alt={name} className="w-full h-full object-cover" /> : <span className="text-white/20 text-sm font-black">{name?.[0]?.toUpperCase()}</span>}
    </div>
);

const Blackjack = () => {
    const { user } = UserAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [engine] = useState(() => new BlackjackEngine());
    const [gameStatus, setGameStatus] = useState('MODE_SELECT');
    const [message, setMessage] = useState('');
    const [currentBet, setCurrentBet] = useState(10);
    const [userBalance, setUserBalance] = useState(0);
    const [myProfile, setMyProfile] = useState({ username: '', avatar_url: '' });

    // State 
    const [players, setPlayers] = useState([]);
    const [turnIndex, setTurnIndex] = useState(0);
    const [dealerHand, setDealerHand] = useState({ cards: [], score: 0 });
    const [isOnline, setIsOnline] = useState(false);
    const [onlineRoom, setOnlineRoom] = useState(null);
    const [isWaitingForNextRound, setIsWaitingForNextRound] = useState(false);

    // New State for Room Browsing
    const [availableRooms, setAvailableRooms] = useState([]);
    const [showRoomBrowser, setShowRoomBrowser] = useState(false);

    // Invite Modal
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const hasAutoJoined = useRef(false);

    const fetchProfile = useCallback(async () => {
        if (!user) return;
        const { data } = await supabase.from('profiles').select('coin_balance, username, avatar_url').eq('id', user.id).single();
        if (data) {
            setUserBalance(data.coin_balance || 0);
            setMyProfile({ username: data.username || user.email.split('@')[0], avatar_url: data.avatar_url });
        }
    }, [user]);

    useEffect(() => { fetchProfile(); }, [fetchProfile]);

    useEffect(() => {
        if (myProfile.username && location.state?.autoJoin && !hasAutoJoined.current) {
            hasAutoJoined.current = true;
            const roomId = location.state.autoJoin;
            // Clear location state so refresh doesn't auto join again
            navigate('/play/blackjack', { replace: true, state: {} });
            if (userBalance >= currentBet) {
                setIsOnline(true);
                socket.emit("join_room", { room_id: roomId, profile: myProfile });
            } else {
                setMessage('Insufficient balance to join!');
            }
        }
    }, [myProfile, location.state, navigate, userBalance, currentBet]);

    useEffect(() => {
        if (!socket) return;
        socket.on("waiting_for_opponent", (data) => setMessage(data.message));

        socket.on("room_list_update", (rooms) => {
            setAvailableRooms(rooms);
        });

        socket.on("error", (data) => {
            setMessage(data.message);
            if (data.message.includes("Room not found") || data.message.includes("Table closed")) {
                setTimeout(() => setGameStatus('MODE_SELECT'), 2000);
            }
            setTimeout(() => setMessage(''), 3000);
        });

        socket.on("bj_match_start", (data) => {
            setOnlineRoom(data.room_id);
            setGameStatus('PLAYING');
            setShowRoomBrowser(false);
            setMessage("Joined Table! Placing bet...");

            // Auto Bet on join logic is tricky if game in progress, but we handle start state in backend
            // For now assume join = ready to play next hand or waiting

            const newBalance = userBalance - currentBet;
            supabase.from('profiles').update({ coin_balance: newBalance }).eq('id', user.id).then(() => {
                setUserBalance(newBalance);
                socket.emit("bj_place_bet", { room_id: data.room_id, bet: currentBet });
            });
        });

        socket.on("bj_update", (data) => {
            setPlayers(data.players);
            const dealerCards = data.dealer_hand;
            const visibleDealerCards = dealerCards.filter(c => c !== -1);
            setDealerHand({
                cards: dealerCards,
                score: engine._calculateScore({ cards: visibleDealerCards })
            });

            setTurnIndex(data.turn_index);
            setGameStatus(data.status);


            if (data.status === "FINISHED") {
                const me = data.players.find(p => p.sid === socket.id);
                if (me) {
                    const dScore = engine._calculateScore({ cards: dealerCards });
                    resolveOnlineGameOver(me, dScore);
                }
                setIsWaitingForNextRound(true);
            }
        });

        socket.on("player_disconnected", (data) => {
            setMessage(`${data.username} left.`);
            setTimeout(() => setMessage(''), 3000);
        });

        return () => {
            socket.off("waiting_for_opponent");
            socket.off("room_list_update");
            socket.off("error");
            socket.off("bj_match_start");
            socket.off("bj_update");
            socket.off("player_disconnected");
        };
    }, [currentBet, engine, userBalance, user]);

    const resolveOnlineGameOver = async (myPlayerObj, dealerScore) => {
        let totalWin = 0;
        let anyWin = false;

        for (const hand of myPlayerObj.hands) {
            let win = 0;
            if (hand.status === "BUST") { }
            else if (dealerScore > 21 || hand.score > dealerScore) { win = hand.bet * 2; anyWin = true; }
            else if (hand.score === dealerScore) { win = hand.bet; } // Push
            else if (hand.status === "BLACKJACK") { win = Math.floor(hand.bet * 2.5); anyWin = true; }

            totalWin += win;
        }

        if (totalWin > 0) {
            const newBalance = userBalance + totalWin;
            await supabase.from('profiles').update({ coin_balance: newBalance }).eq('id', user.id);
            setUserBalance(newBalance);
            setMessage(anyWin ? `WON ${totalWin} COINS!` : `PUSH! Coins returned.`);
        } else {
            setMessage("HOUSE WINS");
        }

        await supabase.from('game_sessions').insert({
            user_id: user.id,
            game_id: "blackjack",
            coins_won: totalWin,
            result: totalWin > currentBet ? "win" : (totalWin > 0 ? "push" : "lose")
        });
    };

    const joinRoom = (roomId) => {
        if (userBalance < currentBet) { setMessage('Insufficient balance!'); return; }
        setIsOnline(true);
        socket.emit("join_room", { room_id: roomId, profile: myProfile });
    }

    const createRoom = () => {
        if (userBalance < currentBet) { setMessage('Insufficient balance!'); return; }
        setIsOnline(true);
        const name = `${myProfile.username}'s Table`;
        socket.emit("create_room", { name, profile: myProfile });
    }

    const startLocalGame = async () => {
        if (userBalance < currentBet) { setMessage('Insufficient balance!'); return; }
        const newBalance = userBalance - currentBet;
        await supabase.from('profiles').update({ coin_balance: newBalance }).eq('id', user.id);
        setUserBalance(newBalance);

        setIsOnline(false);
        engine.startDeal(currentBet);
        const localPlayer = {
            sid: 'local',
            profile: myProfile,
            hands: engine.playerHands.map(h => ({
                cards: h.cards,
                score: engine._calculateScore(h),
                bet: h.bet,
                status: "PLAYING"
            })),
            active_hand_index: engine.activeHandIndex
        };

        setPlayers([localPlayer]);
        setDealerHand({ cards: [engine.dealerHand.cards[0], -1], score: engine._getCardValue(engine.dealerHand.cards[0]) });
        setTurnIndex(0);
        setGameStatus('PLAYING');
    };

    const openRoomBrowser = () => {
        setShowRoomBrowser(true);
        socket.connect();
        socket.emit("get_rooms");
    }

    const handleNextRound = async () => {
        if (userBalance < currentBet) { setMessage("Insufficient funds!"); return; }
        setIsWaitingForNextRound(false);
        if (isOnline) {
            const newBalance = userBalance - currentBet;
            await supabase.from('profiles').update({ coin_balance: newBalance }).eq('id', user.id);
            setUserBalance(newBalance);
            socket.emit("bj_place_bet", { room_id: onlineRoom, bet: currentBet });
            setMessage("Bet placed! Waiting...");
        } else {
            startLocalGame();
        }
    };

    const handleAction = (action) => {
        if (isOnline) {
            socket.emit("bj_action", { room_id: onlineRoom, action });
        } else {
            if (action === "HIT") engine.hit();
            else if (action === "STAND") engine.stand();
            else if (action === "DOUBLE") engine.double();
            else if (action === "SPLIT") engine.split();

            const state = engine.getState();
            const localPlayer = {
                sid: 'local',
                profile: myProfile,
                hands: engine.playerHands.map(h => ({
                    cards: h.cards,
                    score: engine._calculateScore(h),
                    bet: h.bet,
                    status: h.score > 21 ? "BUST" : "PLAYING"
                })),
                active_hand_index: engine.activeHandIndex
            };
            setPlayers([localPlayer]);

            if (state.isGameOver) {
                engine.dealerPlay();
                const dScore = engine._calculateScore(engine.dealerHand);
                setDealerHand({ cards: engine.dealerHand.cards, score: dScore });
                setGameStatus('FINISHED');
                resolveLocalGameOver(engine.playerHands, dScore);
                setIsWaitingForNextRound(true);
            }
        }
    };

    const resolveLocalGameOver = async (hands, dealerScore) => {
        let totalWin = 0;
        let anyWin = false;
        for (const hand of hands) {
            const pScore = engine._calculateScore(hand);
            let win = 0;
            if (pScore > 21) { }
            else if (dealerScore > 21 || pScore > dealerScore) { win = hand.bet * 2; anyWin = true; }
            else if (pScore === dealerScore) { win = hand.bet; }
            totalWin += win;
        }

        if (totalWin > 0) {
            const newBalance = userBalance + totalWin;
            await supabase.from('profiles').update({ coin_balance: newBalance }).eq('id', user.id);
            setUserBalance(newBalance);
            setMessage(anyWin ? `WON ${totalWin} COINS!` : `PUSH! Coins returned.`);
        } else { setMessage("HOUSE WINS"); }

        await supabase.from('game_sessions').insert({
            user_id: user.id,
            game_id: "blackjack",
            coins_won: totalWin,
            result: totalWin > currentBet ? "win" : (totalWin > 0 ? "push" : "lose")
        });
    };

    const getActiveHand = () => {
        if (!players[turnIndex]) return null;
        const p = players[turnIndex];
        return p.hands[p.active_hand_index || 0];
    };

    const activeHand = getActiveHand();
    const isPlayingHand = activeHand && activeHand.score < 21 && activeHand.status !== "BUST" && activeHand.status !== "BLACKJACK";
    const isMyTurn = gameStatus === 'PLAYING' && players[turnIndex] && (players[turnIndex].sid === socket.id || players[turnIndex].sid === 'local') && !isWaitingForNextRound && isPlayingHand;
    const canSplit = isMyTurn && activeHand && activeHand.cards.length === 2 && (activeHand.cards[0] % 13 === activeHand.cards[1] % 13);
    const canDouble = isMyTurn && activeHand && activeHand.cards.length === 2;

    return (
        <AppShell>
            <div className="max-w-7xl mx-auto py-6 px-4 pt-20 md:pt-6">
                <div className="glass-strong card-xl p-6 min-h-[800px] flex flex-col relative overflow-hidden text-white">
                    <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/30 to-black/80 pointer-events-none" />

                    {/* Room Browser Overlay - Full Screen Fixed */}
                    {showRoomBrowser && (
                        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center p-4 md:p-12 overflow-y-auto animate-in fade-in pt-24 pb-32 md:pt-12 md:pb-12">
                            <div className="w-full max-w-4xl space-y-8">
                                <div className="flex justify-between items-center sticky top-0 bg-black/95 py-4 z-10 backdrop-blur-sm">
                                    <h2 className="text-2xl md:text-4xl font-black italic text-emerald-500">SELECT A TABLE</h2>
                                    <button onClick={() => setShowRoomBrowser(false)} className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full text-xs font-bold uppercase transition-colors">Back</button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button onClick={createRoom} className="p-8 border-2 border-dashed border-white/10 rounded-3xl hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all group text-left relative z-10">
                                        <h3 className="text-2xl font-black text-white group-hover:text-emerald-400">+ CREATE NEW TABLE</h3>
                                        <p className="text-sm text-white/40 mt-2">Start your own high-stakes room</p>
                                    </button>
                                    {availableRooms.map(room => (
                                        <div key={room.id} className="relative group">
                                            <button onClick={() => joinRoom(room.id)} disabled={room.players >= room.max_players}
                                                className={`w-full p-6 glass rounded-2xl border border-white/5 text-left transition-all relative overflow-hidden z-10 ${room.players >= room.max_players ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] hover:bg-white/5'}`}>
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <h3 className="text-xl font-bold text-white max-w-[150px] truncate">{room.name}</h3>
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${room.status === 'PLAYING' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/20 text-green-500'}`}>{room.status}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-xs font-black text-white/40">PLAYERS</span>
                                                        <p className="text-2xl font-black text-emerald-400">{room.players}/{room.max_players}</p>
                                                    </div>
                                                </div>
                                                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                                    <div className="h-full bg-emerald-500" style={{ width: `${(room.players / room.max_players) * 100}%` }} />
                                                </div>
                                            </button>
                                            {/* Admin Delete Button - visible if user email is specific admin (or for all in dev) */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); socket.emit("delete_room", { room_id: room.id }); }}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white w-8 h-8 rounded-full z-20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-bold text-xs shadow-lg hover:scale-110"
                                                title="Delete Table"
                                            >
                                                X
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                {availableRooms.length === 0 && (
                                    <div className="text-center py-12 text-white/30 font-bold italic">NO ACTIVE TABLES FOUND</div>
                                )}
                            </div>
                        </div>
                    )}

                    {!showRoomBrowser && gameStatus === 'MODE_SELECT' && (
                        <div className="text-center space-y-12 animate-in fade-in zoom-in w-full my-auto z-20 relative">
                            <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">BLACKJACK</h1>
                            <div className="flex flex-col md:flex-row flex-wrap justify-center gap-6 md:gap-8 px-4">
                                <button onClick={openRoomBrowser} className="w-full md:w-64 py-6 md:py-8 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-3xl shadow-2xl transition-all active:scale-95 hover:-translate-y-2 text-xl relative z-30">🌐 BROWSE TABLES</button>
                                <button onClick={startLocalGame} className="w-full md:w-64 py-6 md:py-8 glass hover:bg-white hover:text-black font-black rounded-3xl transition-all active:scale-95 hover:-translate-y-2 text-xl relative z-30">🤖 VS BOT</button>
                            </div>
                            <button onClick={() => navigate('/dashboard')} className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white font-bold rounded-xl text-xs uppercase tracking-widest transition-all mt-4 border border-white/10">
                                BACK TO LOBBY
                            </button>
                            {message && <p className="text-red-400 font-bold uppercase tracking-widest">{message}</p>}
                        </div>
                    )}

                    {(gameStatus === 'PLAYING' || gameStatus === 'FINISHED') && (
                        <div className="flex-1 flex flex-col items-center gap-4 md:gap-8 z-10 w-full">
                            {/* Dealer */}
                            <div className="flex flex-col items-center gap-2 md:gap-4">
                                <div className="flex items-center gap-2 md:gap-3 bg-black/40 px-4 py-1 md:px-6 md:py-2 rounded-full border border-white/5">
                                    <Avatar src="" name="D" size="w-8 h-8 md:w-10 md:h-10" />
                                    <span className="text-xs md:text-sm font-black tracking-widest text-emerald-400">HOUSE</span>
                                </div>
                                <div className="flex gap-2">
                                    {dealerHand.cards.map((card, i) => <Card key={i} card={card} hidden={gameStatus === 'PLAYING' && i === 1} />)}
                                </div>
                                {gameStatus === 'FINISHED' && <div className="text-2xl md:text-3xl font-black text-white italic">{dealerHand.score}</div>}
                            </div>

                            {/* Game Table Area - Mobile: Grid, Desktop: Flex Row */}
                            <div className="w-full flex-1 grid grid-cols-2 md:flex md:justify-center md:items-end gap-2 md:gap-4 pb-32 md:pb-24 content-start md:content-end">
                                {players.map((p, pIdx) => (
                                    <div key={pIdx} className={`bg-black/20 rounded-xl md:rounded-2xl p-2 md:p-4 border transition-all duration-300 flex flex-col items-center md:block ${turnIndex === pIdx && gameStatus === 'PLAYING' ? 'border-emerald-500/50 bg-emerald-900/10 shadow-[0_0_15px_rgba(16,185,129,0.1)] scale-100 md:scale-105' : 'border-white/5 opacity-80'}`}>
                                        <div className="flex items-center justify-between mb-2 md:mb-4 w-full">
                                            <div className="flex items-center gap-2 md:gap-3">
                                                <Avatar src={p.profile.avatar_url} name={p.profile.username} size="w-6 h-6 md:w-10 md:h-10" />
                                                <div className="text-left">
                                                    <div className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-white/50 max-w-[60px] md:max-w-none truncate">{p.sid === socket.id || p.sid === 'local' ? 'YOU' : p.profile.username}</div>
                                                    <div className="text-[10px] md:text-xs font-bold text-emerald-400">${p.hands.reduce((acc, h) => acc + h.bet, 0)}</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Hands Container */}
                                        <div className="flex gap-2 md:gap-4 justify-center">
                                            {p.hands.map((hand, hIdx) => (
                                                <div key={hIdx} className={`flex flex-col items-center gap-1 md:gap-2 transition-opacity ${p.active_hand_index === hIdx ? 'opacity-100' : 'opacity-40'}`}>
                                                    <div className="flex -space-x-6 md:-space-x-8">
                                                        {hand.cards.map((c, cIdx) => (
                                                            <div key={cIdx} className="transform hover:-translate-y-2 transition-transform" style={{ marginLeft: cIdx > 0 ? '' : '0' }}>
                                                                <Card card={c} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className={`text-[8px] md:text-[10px] font-black px-1.5 py-0.5 rounded ${hand.score > 21 ? 'bg-red-500 text-white' : 'bg-white/10 text-white/70'}`}>
                                                        {hand.score}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Action Bar */}
                            {/* Action Bar - Fixed Bottom for Mobile */}

                            {/* Post-Round Actions - Non-blocking UI */}
                            {isWaitingForNextRound && (
                                <div className="fixed bottom-0 left-0 right-0 z-[300] p-6 flex justify-center animate-in slide-in-from-bottom-full duration-500 pointer-events-none">
                                    <div className="glass-strong bg-black/80 backdrop-blur-xl rounded-3xl p-6 border border-emerald-500/30 shadow-[0_-10px_50px_rgba(0,0,0,0.5)] pointer-events-auto flex flex-col md:flex-row items-center gap-6 max-w-4xl justify-between">

                                        <div className="text-left flex-1">
                                            <h2 className={`text-4xl font-black italic tracking-tighter uppercase ${message.includes('WON') ? 'text-emerald-400' : 'text-white'}`}>{message || "Round Over"}</h2>
                                            <div className="flex flex-wrap items-center gap-2 mt-4">
                                                {[10, 50, 100, 500].map(amt => (
                                                    <button key={amt} onClick={() => setCurrentBet(amt)}
                                                        className={`h-10 px-3 min-w-[40px] rounded-lg font-black text-xs border transition-all ${currentBet === amt ? 'bg-emerald-500 border-emerald-400 text-black' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}>
                                                        {amt}
                                                    </button>
                                                ))}
                                                <button onClick={() => setCurrentBet(userBalance)}
                                                    className={`h-10 px-4 rounded-lg font-black text-xs border transition-all ${currentBet === userBalance ? 'bg-emerald-500 border-emerald-400 text-black' : 'bg-white/5 border-white/10 text-emerald-400 hover:bg-white/10'}`}>
                                                    ALL IN
                                                </button>
                                                <div className="relative flex items-center h-10 ml-2">
                                                    <span className="absolute left-3 text-white/50 text-xs font-bold">$</span>
                                                    <input
                                                        type="number"
                                                        value={currentBet}
                                                        onChange={(e) => setCurrentBet(Math.max(0, parseInt(e.target.value) || 0))}
                                                        className="w-24 h-full bg-black/50 border border-white/10 rounded-lg pl-7 pr-3 text-xs font-black text-white focus:outline-none focus:border-emerald-500"
                                                        placeholder="Custom"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-3 mt-4 md:mt-0">
                                            {isOnline && onlineRoom && (
                                                <button onClick={() => setIsInviteModalOpen(true)} className="px-6 py-4 bg-cyan-500/20 hover:bg-cyan-500 text-cyan-400 hover:text-black font-black rounded-xl transition-all text-xs uppercase tracking-widest border border-cyan-500/50 shadow-lg hover:-translate-y-1 group">
                                                    <span className="hidden md:inline mr-2">👥</span> Invite
                                                </button>
                                            )}
                                            <button onClick={handleNextRound} className="px-8 py-4 bg-white hover:bg-emerald-400 text-black font-black rounded-xl transition-all text-sm uppercase tracking-widest shadow-lg hover:-translate-y-1">
                                                Deal Again
                                            </button>
                                            <button onClick={() => { setGameStatus('MODE_SELECT'); setMessage(''); }} className="px-6 py-4 glass hover:bg-red-500/20 text-white/60 hover:text-white font-bold rounded-xl text-xs uppercase tracking-widest transition-all">
                                                Leave
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Action Bar - Fixed Bottom for Mobile - Moved outside container to avoid clipping */}
                {isMyTurn && (
                    <div className="fixed bottom-0 left-0 right-0 z-[200] p-4 bg-gradient-to-t from-black via-black/90 to-transparent pb-8 md:pb-8 flex justify-center pointer-events-auto">
                        <div className="flex gap-2 md:gap-4 bg-black/60 backdrop-blur-md p-2 md:p-4 rounded-2xl md:rounded-3xl border border-white/10 shadow-2xl animate-in slide-in-from-bottom-10 opacity-100">
                            <button onClick={() => handleAction('HIT')} className="w-16 h-12 md:w-24 md:h-16 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-lg md:rounded-xl text-xs md:text-lg transition-transform active:scale-95 shadow-lg shadow-emerald-500/20">HIT</button>
                            <button onClick={() => handleAction('STAND')} className="w-16 h-12 md:w-24 md:h-16 bg-red-500 hover:bg-red-400 text-white font-black rounded-lg md:rounded-xl text-xs md:text-lg transition-transform active:scale-95 shadow-lg shadow-red-500/20">STAND</button>
                            {canDouble && <button onClick={() => handleAction('DOUBLE')} className="w-16 h-12 md:w-24 md:h-16 bg-yellow-400 hover:bg-yellow-300 text-black font-black rounded-lg md:rounded-xl text-xs md:text-lg transition-transform active:scale-95 shadow-lg shadow-yellow-400/20">X2</button>}
                            {canSplit && <button onClick={() => handleAction('SPLIT')} className="w-16 h-12 md:w-24 md:h-16 bg-purple-500 hover:bg-purple-400 text-white font-black rounded-lg md:rounded-xl text-xs md:text-lg transition-transform active:scale-95 shadow-lg shadow-purple-500/20">SPLIT</button>}
                        </div>
                    </div>
                )}

                <InviteModal
                    isOpen={isInviteModalOpen}
                    onClose={() => setIsInviteModalOpen(false)}
                    gameName="blackjack"
                    roomId={onlineRoom}
                />
            </div>
        </AppShell>
    );
};

export default Blackjack;
