import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { UserAuth } from "../context/AuthContext";
import { AnimatedBackground } from "./AnimatedBackground";
import { supabase } from "../supabaseClient";

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

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('coin_balance, username, avatar_url')
          .eq('id', user.id)
          .single();

        if (data) {
          setBalance(data.coin_balance || 0);
          setProfile({ username: data.username, avatar_url: data.avatar_url });
        }
      }
    };
    fetchProfile();
  }, [user]);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Reactive Animated Background */}
      <AnimatedBackground />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-border-subtle bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          {/* Left: Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-500 text-lg font-bold text-white shadow-lg shadow-cyan-500/50">
              🎮
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              ARCADEX
            </span>
          </div>

          {/* Center: Tab Navigation */}
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
            <div className="glass card-xl pill flex items-center gap-3 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <img src="/currency.png" alt="coins" className="w-6 h-6 object-contain" />
                <span className="text-base font-bold text-foreground">
                  {balance.toLocaleString()}
                </span>
              </div>
            </div>

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
              <span className="text-sm font-medium text-muted group-hover:text-foreground transition-colors hidden sm:block">
                {profile.username || user?.email?.split('@')[0]}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
