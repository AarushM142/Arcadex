import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { AnimatedBackground } from './AnimatedBackground';

const Singin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // This function is triggered when the user clicks the "Sign In" button
  const handleLogin = async (e) => {
    e.preventDefault(); // Stops the browser from reloading the page when the form is submitted
    setError('');       // Clears any old red error messages off the screen
    setLoading(true);   // Changes the button to say "Signing in..." so the user knows it's working

    // Send the email and password to the Supabase backend for verification
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      // If Supabase rejects the login, display their specific error message
      setError(error.message);
    } else {
      // If success, use React Router to instantly jump to the Dashboard without a page refresh
      navigate('/dashboard');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 relative overflow-hidden">
      <AnimatedBackground />

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-500 text-2xl font-bold text-white mb-4 shadow-lg shadow-cyan-500/50">
            🎮
          </div>
          <h1 className="text-4xl font-display mb-2 bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
            Welcome Back
          </h1>
          <p className="text-muted text-sm">
            Sign in to continue your journey
          </p>
        </div>

        {/* Form Card */}
        <div className="glass-strong card-xl p-8 backdrop-blur-xl">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center mt-0.5">
                <span className="text-red-400 text-xs">!</span>
              </div>
              <p className="text-red-400 text-sm flex-1">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted flex items-center gap-2">
                <span>📧</span>
                Email Address
              </label>
              <input
                type="email"
                placeholder="player@arcade.gg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3.5 rounded-xl glass border-border-subtle text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all duration-200 bg-white/5"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted flex items-center gap-2">
                <span>🔒</span>
                Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3.5 rounded-xl glass border-border-subtle text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all duration-200 bg-white/5"
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-border-subtle accent-accent" />
                <span className="text-muted">Remember me</span>
              </label>
              <a href="#" className="text-accent hover:text-accent-soft transition-colors">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full btn-primary text-base py-3.5 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border-subtle text-center">
            <p className="text-sm text-muted">
              Don't have an account?{' '}
              <Link
                to="/signup"
                className="text-accent hover:text-accent-soft font-medium transition-colors"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted mt-6">
          Secure login powered by Supabase
        </p>
      </div>
    </div>
  );
};

export default Singin;