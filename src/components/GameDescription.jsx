import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { UserAuth } from '../context/AuthContext';
import { AppShell } from './AppShell';

const gameData = {
    blackjack: {
        name: 'BLACKJACK',
        description: "Step into the high-stakes world of the Arcadex Casino. In this classic game of Blackjack, your goal is to beat the dealer by getting a hand value as close to 21 as possible without going over. Test your strategy and nerve as you decide whether to hit, stand, or double down. The backend logic is powered by a high-performance C engine to ensure fair and randomized shuffling. Can you outsmart the house and walk away a winner?",
        thumbnail: '/blacki.png',
        entryFee: 5,
        accent: 'cyan'
    },
    minesweeper: {
        name: 'MINESWEEPER',
        description: "Clear the digital battlefield in this pulse-pounding strategy classic. You are tasked with uncovering all the safe tiles on a grid while avoiding hidden mines that could end your run in an instant. Use logic and deduction to flag potential threats and navigate the minefield safely. Each successful sweep brings you closer to victory and arcade glory. Perfect for players who love a mix of calm calculation and sudden intensity.",
        thumbnail: '/minsweep.png',
        entryFee: 5,
        accent: 'green'
    },
    tictactoe: {
        name: 'TIC TAC TOE',
        description: "The timeless game of strategy and anticipation is back with a futuristic twist. Outmaneuver your opponent by forming a line of three symbols in any direction on the 3x3 grid. While it seems simple, every move is a tactical decision that could lead to triumph or a stalemate. Our advanced AI opponent will challenge even the most seasoned players. It is the perfect arena to sharpen your reflexes and strategic thinking for higher stakes games.",
        thumbnail: '/tictic.png',
        entryFee: 5,
        accent: 'purple'
    },
    trialbycombat: {
        name: 'TRIAL BY COMBAT',
        description: "Enter the arena of legends in Trial by Combat. Choose between the resilient Knight, the mystical Magician, or the cunning Alchemist. Master a complex system of charges, buffs, and status effects in intense turn-based duels. Face off against the computer, a friend, or attempt the legendary Gauntlet— a 3v1 survival mode that only the truest champions can conquer. Strategy is your only weapon; every turn counts.",
        thumbnail: '/nandangame/p1_knight.png',
        entryFee: 10,
        accent: 'orange'
    }
};

const accentClasses = {
    cyan: {
        text: 'text-cyan-400',
        border: 'border-cyan-400/20',
        bg: 'bg-cyan-500',
        bgHover: 'hover:bg-cyan-400',
        shadow: 'shadow-cyan-500/20'
    },
    green: {
        text: 'text-green-400',
        border: 'border-green-400/20',
        bg: 'bg-green-500',
        bgHover: 'hover:bg-green-400',
        shadow: 'shadow-green-500/20'
    },
    purple: {
        text: 'text-purple-400',
        border: 'border-purple-400/20',
        bg: 'bg-purple-500',
        bgHover: 'hover:bg-purple-400',
        shadow: 'shadow-purple-500/20'
    },
    orange: {
        text: 'text-orange-400',
        border: 'border-orange-400/20',
        bg: 'bg-orange-500',
        bgHover: 'hover:bg-orange-400',
        shadow: 'shadow-orange-500/20'
    }
};

const GameDescription = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = UserAuth();
    const [loading, setLoading] = useState(false);
    const [leaderboard, setLeaderboard] = useState([]);
    const [userBalance, setUserBalance] = useState(0);
    const [error, setError] = useState('');

    const game = gameData[id];
    const accent = game ? accentClasses[game.accent] : accentClasses.cyan;

    useEffect(() => {
        if (user) {
            fetchUserBalance();
            fetchLeaderboard();
        }
    }, [id, user]);

    const fetchUserBalance = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('coin_balance')
            .eq('id', user.id)
            .single();
        if (data) setUserBalance(data.coin_balance || 0);
    };

    const fetchLeaderboard = async () => {
        try {
            // Fetch ALL sessions for this game to get accurate career stats
            const { data, error: fetchError } = await supabase
                .from('game_sessions')
                .select('user_id, coins_won, cells_cleared')
                .eq('game_id', id);

            if (fetchError) throw fetchError;

            if (data && data.length > 0) {
                // Aggregate stats per user
                const aggregates = data.reduce((acc, curr) => {
                    if (!acc[curr.user_id]) {
                        acc[curr.user_id] = { coins: 0, cells: 0 };
                    }
                    acc[curr.user_id].coins += (curr.coins_won || 0);
                    acc[curr.user_id].cells += (curr.cells_cleared || 0);
                    return acc;
                }, {});

                // Rank based on game type: Minesweeper ranks by cells, others by coins
                const sortedPlayers = Object.entries(aggregates)
                    .map(([userId, stats]) => ({
                        user_id: userId,
                        total_earned: stats.coins,
                        total_cells: stats.cells
                    }))
                    .sort((a, b) => {
                        if (id === 'minesweeper') {
                            return b.total_cells - a.total_cells; // Career cells
                        }
                        return b.total_earned - a.total_earned; // Career cash
                    })
                    .slice(0, 5);

                const userIds = sortedPlayers.map(u => u.user_id);

                // Fetch profiles for top performers
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url')
                    .in('id', userIds);

                const finalLeaderboard = sortedPlayers.map(entry => ({
                    coins_won: entry.total_earned,
                    cells_cleared: entry.total_cells,
                    profiles: profileData?.find(p => p.id === entry.user_id) || null
                }));

                setLeaderboard(finalLeaderboard);
            }
        } catch (err) {
            console.error('Hall of Fame aggregation failed:', err);
        }
    };

    const handleStartGame = async () => {
        if (userBalance < game.entryFee) {
            setError('Insufficient coins! Head to the wallet to top up.');
            return;
        }

        setLoading(true);
        try {
            // 1. Deduct entry fee
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ coin_balance: userBalance - game.entryFee })
                .eq('id', user.id);

            if (updateError) throw updateError;

            // 2. Navigate to the actual game
            navigate(`/play/${id}`);
        } catch (err) {
            setError('Failed to start game. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (!game) return <AppShell><div>Game not found</div></AppShell>;

    return (
        <AppShell>
            <div className="max-w-6xl mx-auto py-4">
                <div className="flex flex-col lg:flex-row gap-8">

                    {/* Left Side: Game Info */}
                    <div className="flex-1 space-y-6">
                        <div className={`glass card-xl p-2 ${accent.border} overflow-hidden`}>
                            <img src={game.thumbnail} alt={game.name} className="w-full h-[400px] object-contain bg-black/20 rounded-lg" />
                        </div>

                        <div className="glass card-xl p-8 space-y-4">
                            <h1 className={`text-4xl font-black ${accent.text} uppercase tracking-tighter ${id === 'trialbycombat' ? 'font-blackletter text-6xl' : ''}`}>{game.name}</h1>

                            <p className="text-muted leading-relaxed text-lg italic">
                                {game.description}
                            </p>

                            <div className="flex flex-col md:flex-row items-center justify-between pt-6 border-t border-white/5 gap-6">
                                <div className="flex flex-col items-center md:items-start">
                                    <span className="text-xs text-muted uppercase tracking-widest font-bold">Entry Fee</span>
                                    <div className="flex items-center gap-2">
                                        <img src="/currency.png" className="w-5 h-5" alt="coins" />
                                        <span className="text-2xl font-bold text-foreground">{game.entryFee} COINS</span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleStartGame}
                                    disabled={loading}
                                    className={`w-full md:w-auto px-16 py-4 ${accent.bg} hover:brightness-110 text-black font-black rounded-xl transition-all shadow-lg ${accent.shadow} transform hover:-translate-y-1 active:translate-y-0`}
                                >
                                    {loading ? 'STARTING...' : 'PLAY NOW'}
                                </button>
                            </div>
                            {error && <p className="text-red-400 text-sm text-center font-medium animate-pulse">{error}</p>}
                        </div>
                    </div>

                    {/* Right Side: Leaderboard */}
                    <div className="w-full lg:w-80 space-y-6">
                        <div className="glass card-xl p-6 border-white/10">
                            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                                <span>🏆</span> HALL OF FAME
                            </h2>

                            <div className="space-y-4">
                                {leaderboard.length > 0 ? leaderboard.map((entry, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 group hover:border-white/20 transition-all">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-sm font-bold ${index === 0 ? 'text-yellow-400' : 'text-muted'}`}>#{index + 1}</span>
                                            <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10">
                                                {entry.profiles?.avatar_url ? (
                                                    <img src={entry.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-[10px]">👤</div>
                                                )}
                                            </div>
                                            <span className="text-sm font-medium text-foreground truncate max-w-[100px]">
                                                {entry.profiles?.username || 'Player'}
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-end gap-0.5">
                                            <span className="text-sm font-bold text-cyan-400">+{entry.coins_won}</span>
                                            {id === 'minesweeper' && entry.cells_cleared > 0 && (
                                                <span className="text-[8px] font-black text-white/30 truncate">
                                                    {entry.cells_cleared} CELLS
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-center py-8">
                                        <p className="text-muted text-sm">No champions yet.</p>
                                        <p className="text-[10px] text-muted uppercase mt-2">Become the first!</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="glass card-xl p-6 bg-cyan-500/5 border-cyan-500/20">
                            <h3 className="text-xs font-bold text-cyan-400 uppercase mb-4 tracking-widest">Your Status</h3>
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-sm text-muted">Current Balance</p>
                                    <p className="text-2xl font-bold text-foreground">{userBalance}</p>
                                </div>
                                <div className="text-2xl">💰</div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </AppShell>
    );
};

export default GameDescription;
