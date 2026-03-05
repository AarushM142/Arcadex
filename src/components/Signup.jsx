import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserAuth } from '../context/AuthContext.jsx';
import { AnimatedBackground } from './AnimatedBackground';

const Signup = () => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signUp } = UserAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevents the browser from running a default page-refresh action
    setError('');       // Clears previous UI error logs
    setLoading(true);   // Locks the submit button and displays a loading spinner

    try {
      // Calls our global memory context to hit the Supabase Backend
      // We pass the username inside the "data" payload so it's instantly attached to their user profile
      await signUp(email, password, {
        data: { username: username.toLowerCase() }
      });
      // Email 2FA is removed for development, so we can route the user straight to the dashboard
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
      console.log(err.message);
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
            Join the Arcade
          </h1>
          <p className="text-muted text-sm">
            Create your account and start your journey
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted flex items-center gap-2">
                <span>👤</span>
                Username
              </label>
              <input
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl glass border-border-subtle text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all duration-200 bg-white/5"
                type="text"
                placeholder="Choose a screen name"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted flex items-center gap-2">
                <span>📧</span>
                Email Address
              </label>
              <input
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl glass border-border-subtle text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all duration-200 bg-white/5"
                type="email"
                placeholder="player@arcade.gg"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted flex items-center gap-2">
                <span>🔒</span>
                Password
              </label>
              <input
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl glass border-border-subtle text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all duration-200 bg-white/5"
                type="password"
                placeholder="Choose a strong password"
                required
              />
            </div>

            <button
              className="mt-6 w-full btn-primary text-base py-3.5 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Creating Account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border-subtle text-center">
            <p className="text-sm text-muted">
              Already have an account?{' '}
              <Link
                to="/signin"
                className="text-accent hover:text-accent-soft font-medium transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
};

export default Signup;