import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { UserAuth } from "../context/AuthContext";
import { AnimatedBackground } from "./AnimatedBackground";
import { supabase } from "../supabaseClient";
import FriendsSidebar from "./FriendsSidebar";
import { wakeUpBackend } from "../socket";

const ADMIN_EMAIL = 'am2007144@gmail.com';

const navItems = [
  { to: "/dashboard", label: "Home", icon: "🏠" },
  { to: "/wallet", label: "Wallet", icon: "💳" },
  { to: "/profile", label: "Profile", icon: "👤" },
];

export function AppShell({ children }) {
  const { user, session } = UserAuth();
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [profile, setProfile] = useState({ username: '', avatar_url: '' });
  const [isBanned, setIsBanned] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [friendsSidebarOpen, setFriendsSidebarOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    wakeUpBackend();
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        // Try to fetch existing profile
        const { data, error } = await supabase
          .from('profiles')
          .select('coin_balance, username, avatar_url, is_banned')
          .eq('id', user.id)
          .single();

        if (error && error.code === 'PGRST116') {
          // Profile doesn't exist, create it with 100 coins
          const newProfile = {
            id: user.id,
            coin_balance: 100,
            username: user.user_metadata?.username || user.email.split('@')[0],
            email: user.email,
            avatar_url: '',
            is_banned: false
          };

          const { data: createdData, error: insertError } = await supabase
            .from('profiles')
            .insert(newProfile)
            .select()
            .single();

          if (!insertError && createdData) {
            setBalance(createdData.coin_balance);
            setProfile({ username: createdData.username, avatar_url: createdData.avatar_url });
          }
        } else if (data) {
          if (data.is_banned) {
            setIsBanned(true);
            return;
          }
          let finalBalance = data.coin_balance;

          // SPECIAL FIX: If user has 0 coins, check if they are NEW (0 games played)
          if (finalBalance === 0) {
            const { count } = await supabase
              .from('game_sessions')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id);

            if (count === 0) {
              // They are new! Give the 100 coin bonus
              const { data: updatedData } = await supabase
                .from('profiles')
                .update({ coin_balance: 100 })
                .eq('id', user.id)
                .select()
                .single();

              if (updatedData) finalBalance = 100;
            }
          }

          setBalance(finalBalance);
          setProfile({ username: data.username, avatar_url: data.avatar_url });
        }
      }
    };
    fetchProfile();
  }, [user]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  if (isBanned) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
        <AnimatedBackground />
        <div className="relative z-10 max-w-md glass-strong p-12 border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.2)]">
          <div className="text-7xl mb-6">🚫</div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">ACCESS DENIED</h1>
          <p className="text-red-400 font-medium mb-8">
            Your Arcadex account has been suspended for violating our terms of service.
          </p>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate('/signin');
              setIsBanned(false);
            }}
            className="w-full btn-primary bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20"
          >
            LOG OUT
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Reactive Animated Background */}
      <AnimatedBackground />

      {/* Mobile Sidebar (Drawer) */}
      <div
        className={`fixed inset-0 z-50 transition-visibility duration-300 ${mobileMenuOpen ? 'visible' : 'invisible'}`}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={closeMobileMenu}
        />

        {/* Sidebar Content */}
        <aside
          className={`absolute left-0 top-0 h-full w-72 bg-black/80 backdrop-blur-2xl border-r border-white/10 p-6 transition-transform duration-300 ease-out shadow-2xl ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="flex items-center justify-between mb-10">
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => { navigate('/dashboard'); closeMobileMenu(); }}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-purple-500 text-sm font-bold text-white shadow-lg">
                🎮
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                ARCADEX
              </span>
            </div>
            <button
              onClick={closeMobileMenu}
              className="text-muted hover:text-white text-2xl"
            >
              ✕
            </button>
          </div>

          <nav className="flex flex-col gap-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={closeMobileMenu}
                className={({ isActive }) =>
                  [
                    "px-4 py-3 text-sm font-medium transition-all rounded-xl flex items-center gap-4",
                    isActive
                      ? "text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                      : "text-muted hover:text-foreground hover:bg-white/5",
                  ].join(" ")
                }
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
            {user?.email === ADMIN_EMAIL && (
              <NavLink
                to="/admin"
                onClick={closeMobileMenu}
                className={({ isActive }) =>
                  [
                    "px-4 py-3 text-sm font-medium transition-all rounded-xl flex items-center gap-4",
                    isActive
                      ? "text-purple-400 bg-purple-400/10 border border-purple-400/20 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                      : "text-muted hover:text-foreground hover:bg-white/5",
                  ].join(" ")
                }
              >
                <span className="text-xl">🛡️</span>
                <span>Admin</span>
              </NavLink>
            )}
          </nav>

          <div className="absolute bottom-10 left-6 right-6">
            <div className="glass p-4 rounded-2xl border-white/5 bg-cyan-500/5">
              <p className="text-[10px] text-muted uppercase font-bold tracking-widest mb-1">Current Balance</p>
              <div className="flex items-center gap-2">
                <img src="/currency.png" alt="coins" className="w-5 h-5 object-contain" />
                <span className="text-lg font-black text-white">{balance.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-border-subtle bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">

          {/* Left: Hamburger (Mobile) + Logo */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex flex-col gap-1.5 md:hidden p-2 group"
            >
              <div className="w-6 h-0.5 bg-muted group-hover:bg-cyan-400 transition-colors rounded-full" />
              <div className="w-6 h-0.5 bg-muted group-hover:bg-cyan-400 transition-colors rounded-full" />
              <div className="w-4 h-0.5 bg-muted group-hover:bg-cyan-400 transition-colors rounded-full" />
            </button>

            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => navigate('/dashboard')}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-500 text-lg font-bold text-white shadow-lg group-hover:shadow-cyan-500/50 transition-all group-hover:-rotate-6">
                🎮
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent hidden sm:block">
                ARCADEX
              </span>
            </div>
          </div>

          {/* Center: Tab Navigation (Desktop) */}
          <nav className="hidden gap-2 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "relative px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg flex items-center gap-2",
                    isActive
                      ? "text-cyan-400 bg-white/5 border border-cyan-400/30 shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                      : "text-muted hover:text-foreground/80 hover:bg-white/5",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="text-base">{item.icon}</span>
                    <span>{item.label}</span>
                    {isActive && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-8 bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
            {user?.email === ADMIN_EMAIL && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  [
                    "relative px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg flex items-center gap-2",
                    isActive
                      ? "text-purple-400 bg-white/5 border border-purple-400/30 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                      : "text-muted hover:text-foreground/80 hover:bg-white/5",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="text-base">🛡️</span>
                    <span>Admin</span>
                    {isActive && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-8 bg-gradient-to-r from-transparent via-purple-400 to-transparent" />
                    )}
                  </>
                )}
              </NavLink>
            )}
          </nav>


          {/* Right: Wallet & User Pill */}
          <div className="flex items-center gap-4">
            <div className="glass card-xl pill flex items-center gap-3 px-4 py-2 md:py-2.5">
              <div className="flex items-center gap-2">
                <img src="/currency.png" alt="coins" className="w-5 h-5 md:w-6 md:h-6 object-contain" />
                <span className="text-sm md:text-base font-bold text-foreground">
                  {balance.toLocaleString()}
                </span>
              </div>
            </div>

            <button onClick={() => setFriendsSidebarOpen(true)} className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl glass hover:bg-white/10 transition-all border border-white/10 group relative">
              <span className="text-lg md:text-xl group-hover:scale-110 transition-transform text-white/80 group-hover:text-cyan-400">👥</span>
              <span className="text-sm font-bold text-white/80 group-hover:text-cyan-400 hidden sm:block">Friends</span>
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg border-2 border-black animate-in zoom-in">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>

            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-3 p-1.5 pr-4 glass rounded-xl hover:bg-white/10 transition-all group"
            >
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/20 group-hover:border-cyan-400/50 transition-colors">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="User" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center text-xs">
                    👤
                  </div>
                )}
              </div>
              <span className="text-sm font-medium text-muted group-hover:text-foreground transition-colors hidden lg:block">
                {profile.username || user?.email?.split('@')[0]}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-6">
        {children}
      </main>

      {/* Friends & Chat Sidebar */}
      <FriendsSidebar
        isOpen={friendsSidebarOpen}
        onClose={() => setFriendsSidebarOpen(false)}
        onNotificationChange={setNotificationCount}
      />
    </div>
  );
}
