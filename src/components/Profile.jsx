import React, { useEffect, useState } from 'react';
import { UserAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { AppShell } from './AppShell';

const Profile = () => {
  const { user, signOut } = UserAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [totalWins, setTotalWins] = useState(0);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Fetch profile data
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileData) {
          setProfile(profileData);
        }

        // Fetch games played count
        const { count: gamesCount } = await supabase
          .from('game_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (gamesCount !== null) {
          setGamesPlayed(gamesCount);
        }

        // Fetch total wins (sessions where result = 'win')
        const { count: winsCount } = await supabase
          .from('game_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('result', 'win');

        if (winsCount !== null) {
          setTotalWins(winsCount);
        }

        // Fetch total coins earned
        const { data: sessionsData } = await supabase
          .from('game_sessions')
          .select('coins_won')
          .eq('user_id', user.id);

        if (sessionsData) {
          const totalCoins = sessionsData.reduce((sum, session) => {
            return sum + (session.coins_won || 0);
          }, 0);
          setCoinsEarned(totalCoins);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin');
  };

  const getMemberSince = () => {
    if (!user?.created_at) return 'Member since Feb 2026';
    const date = new Date(user.created_at);
    const month = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();
    return `Member since ${month} ${year}`;
  };

  const winRate = gamesPlayed > 0 ? ((totalWins / gamesPlayed) * 100).toFixed(1) : 0;

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse text-muted">Loading profile...</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        {/* Profile Card */}
        <div className="glass card-xl p-8 mb-6">
          <div className="flex flex-col items-center text-center">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 overflow-hidden flex items-center justify-center text-4xl mb-4 border-4 border-cyan-400/30 shadow-xl shadow-cyan-500/20">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="p-4">👤</span>
              )}
            </div>

            {/* Username */}
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {profile?.username || user?.email?.split('@')[0]?.toUpperCase() || 'PLAYER_001'}
            </h1>

            {/* Email */}
            <p className="text-muted mb-2">{user?.email || 'player00@email.com'}</p>

            {/* Member Since */}
            <p className="text-sm text-muted">{getMemberSince()}</p>
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="glass card-xl p-6 text-center">
            <div className="text-3xl mb-2">🎮</div>
            <p className="text-2xl font-bold text-foreground mb-1">{gamesPlayed}</p>
            <p className="text-xs text-muted uppercase tracking-wide">Games Played</p>
          </div>

          <div className="glass card-xl p-6 text-center">
            <div className="text-3xl mb-2">🏆</div>
            <p className="text-2xl font-bold text-foreground mb-1">{totalWins}</p>
            <p className="text-xs text-muted uppercase tracking-wide">Total Wins</p>
          </div>

          <div className="glass card-xl p-6 text-center">
            <div className="text-3xl mb-2">🛡️</div>
            <p className="text-2xl font-bold text-foreground mb-1">{winRate}%</p>
            <p className="text-xs text-muted uppercase tracking-wide">Win Rate</p>
          </div>

          <div className="glass card-xl p-6 text-center">
            <div className="text-3xl mb-2">💰</div>
            <p className="text-2xl font-bold text-foreground mb-1">{coinsEarned.toLocaleString()}</p>
            <p className="text-xs text-muted uppercase tracking-wide">Coins Earned</p>
          </div>
        </div>

        {/* Account Actions */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/settings')}
            className="w-full glass card-xl p-4 flex items-center gap-3 hover:bg-white/5 transition-colors"
          >
            <span className="text-xl">⚙️</span>
            <span className="text-foreground font-medium">Account Settings</span>
          </button>

          <button
            onClick={handleSignOut}
            className="w-full glass card-xl p-4 flex items-center gap-3 hover:bg-red-500/10 hover:border-red-500/30 transition-colors border border-transparent"
          >
            <span className="text-xl">→</span>
            <span className="text-foreground font-medium">Sign Out</span>
          </button>
        </div>
      </div>
    </AppShell>
  );
};

export default Profile;
