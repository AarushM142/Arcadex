import React, { useEffect, useState } from 'react';
import { UserAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { AppShell } from './AppShell';

// Pointing to images in the 'public' folder
const blackjackThumbnail = '/blacki.png';
const minesweeperThumbnail = '/minsweep.png';
const tictactoeThumbnail = '/tictic.png';

const Dashboard = () => {
  const { user, signOut } = UserAuth();
  const [balance, setBalance] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [coinsWon, setCoinsWon] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const navigate = useNavigate();

  // useEffect: This is a core React feature. It runs code "on the side" after the page is drawn.
  // The empty array [] at the end means "run this once when the Dashboard first loads".
  // The [user] array means "run this again anytime the logged-in User's data changes".
  // Fetch the real coin balance from the database
  useEffect(() => {
    const fetchBalance = async () => {
      if (user) {
        // Use the Supabase tool we configured to query the 'profiles' SQL table over the internet.
        // Similar to writing: SELECT coin_balance FROM profiles WHERE id = user.id LIMIT 1;
        const { data } = await supabase
          .from('profiles')
          .select('coin_balance')
          .eq('id', user.id)
          .single();

        if (data) setBalance(data.coin_balance ?? 100);
        else setBalance(100);
      }
    };
    fetchBalance();
  }, [user]);

  // Fetch total players count from profiles table
  useEffect(() => {
    const fetchTotalPlayers = async () => {
      try {
        // Query the database but ask only for the total row count instead of downloading every user's data
        const { count, error } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        if (!error && count !== null) {
          setTotalPlayers(count);
        }
      } catch (err) {
        console.error('Error fetching total players:', err);
      }
    };
    fetchTotalPlayers();
  }, []);

  // Fetch user's games played and coins won
  useEffect(() => {
    const fetchUserStats = async () => {
      if (!user) {
        setLoadingStats(false);
        return;
      }

      try {
        setLoadingStats(true);

        const { count: gamesCount } = await supabase
          .from('game_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (gamesCount !== null) setGamesPlayed(gamesCount);

        const { data: sessionsData } = await supabase
          .from('game_sessions')
          .select('coins_won')
          .eq('user_id', user.id);

        if (sessionsData) {
          const totalCoins = sessionsData.reduce((sum, session) => sum + (session.coins_won || 0), 0);
          setCoinsWon(totalCoins);
        }
      } catch (err) {
        console.error('Error fetching user stats:', err);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchUserStats();
  }, [user]);

  const games = [
    {
      id: 'blackjack',
      name: 'BLACKJACK',
      titleColor: 'text-cyan-400',
      borderColor: 'border-cyan-400/30',
      glowColor: 'shadow-[0_0_20px_rgba(34,211,238,0.3)]',
      description: 'Beat the dealer. Hit 21 or go bust. Classic casino card game with C powered logic.',
      players: '1-4 Players',
      thumbnail: blackjackThumbnail,
    },
    {
      id: 'minesweeper',
      name: 'MINESWEEPER',
      titleColor: 'text-green-400',
      borderColor: 'border-green-400/30',
      glowColor: 'shadow-[0_0_20px_rgba(74,222,128,0.3)]',
      description: 'Clear the field without detonating mines. Strategy meets nerve in this classic puzzler.',
      players: '1 Player',
      thumbnail: minesweeperThumbnail,
    },
    {
      id: 'tictactoe',
      name: 'TIC TAC TOE',
      titleColor: 'text-purple-400',
      borderColor: 'border-purple-400/30',
      glowColor: 'shadow-[0_0_20px_rgba(168,85,247,0.3)]',
      description: 'Outsmart your opponent in the ultimate strategy showdown. Future multiplayer support.',
      players: '1-2 Players',
      thumbnail: tictactoeThumbnail,
    },
    {
      id: 'trial-combat',
      name: 'TRIAL BY COMBAT',
      titleColor: 'text-red-400',
      borderColor: 'border-red-400/30',
      glowColor: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]',
      description: 'Enter the arena and fight for glory. High risk, high reward.',
      players: '1-2 Players',
      thumbnail: '/TbCTitleKrita.jpg',
    },
  ];

  return (
    <AppShell>
      {/* Statistics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Games Available', value: '4', icon: '🎮' },
          { label: 'Total Players', value: totalPlayers, icon: '🛡️' },
          { label: 'Games Played', value: gamesPlayed, icon: '⚡' },
          { label: 'Coins Won', value: coinsWon, icon: '💰' }
        ].map((stat, idx) => (
          <div key={idx} className="glass card-xl p-4 flex items-center gap-3">
            <div className="text-2xl">{stat.icon}</div>
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">{stat.label}</p>
              <p className="text-lg font-bold text-foreground">
                {loadingStats ? <span className="animate-pulse">...</span> : stat.value.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Featured Games Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-foreground uppercase tracking-widest border-l-4 border-primary pl-4">
            FEATURED GAMES
          </h2>
          <span className="text-sm text-muted font-medium bg-white/5 px-3 py-1 rounded-full border border-white/10">
            3 AVAILABLE
          </span>
        </div>

        {/* Resized Widgets Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {games.map((game) => (
            <button
              key={game.id}
              type="button"
              onClick={() => navigate(`/games/${game.id}`)}
              className={`relative group glass card-xl overflow-hidden border ${game.borderColor} ${game.glowColor} transition-all duration-300 ease-out hover:-translate-y-2 hover:scale-[1.01] flex flex-col`}
            >
              <div className="p-5 flex flex-col gap-5 h-full">
                {/* Game Thumbnail - Improved Containment & Rounding */}
                <div className="flex justify-center relative h-64 overflow-hidden group-hover:bg-white/5 transition-colors">
                  <img
                    src={game.thumbnail}
                    alt={game.name}
                    className="w-full h-full object-contain transform transition-transform duration-500 group-hover:scale-110"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      const fallback = e.target.parentElement.querySelector('.fallback-icon');
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div className="fallback-icon text-6xl hidden items-center justify-center w-full h-full">
                    🎮
                  </div>
                </div>

                {/* Game Info Area */}
                <div className="flex flex-col flex-grow gap-2">
                  <h3 className={`text-xl font-black ${game.titleColor} text-center uppercase tracking-tighter`}>
                    {game.name}
                  </h3>

                  <p className="text-sm text-muted text-center leading-relaxed px-2 font-medium">
                    {game.description}
                  </p>
                </div>

                {/* Footer Info */}
                <div className="mt-auto pt-4 border-t border-white/5 flex flex-col gap-3">
                  <div className="flex justify-center items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                    <p className="text-[10px] text-muted text-center uppercase tracking-widest font-bold">
                      {game.players}
                    </p>
                  </div>

                  <div className={`w-full py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black text-center group-hover:bg-white group-hover:text-black transition-all duration-300`}>
                    PLAY NOW
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  );
};

export default Dashboard;