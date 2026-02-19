import { createContext, useEffect, useState, useContext } from "react";
import { supabase } from "../supabaseClient";

const AuthContext = createContext();

export const AuthContextProvider = ({ children }) => {
  const [session, setSession] = useState(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on load
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session || null);
      setLoading(false);
    };

    init();

    // Listen for changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // --- ADDED HELPER FUNCTIONS ---

  // Sign up a new user
  const signUp = (email, password, options = {}) => {
    return supabase.auth.signUp({ email, password, options });
  };

  // Sign in an existing user
  const signIn = (email, password) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  // Sign out
  const signOut = () => {
    return supabase.auth.signOut();
  };

  // Include these functions in the context value
  const value = {
    session,
    loading,
    signUp,
    signIn,
    signOut,
    user: session?.user || null // Helper to get user data directly
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const UserAuth = () => {
  return useContext(AuthContext);
};