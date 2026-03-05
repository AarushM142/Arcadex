import { createContext, useEffect, useState, useContext } from "react";
import { supabase } from "../supabaseClient";

// 1. Create a blank "Global Memory" bubble called AuthContext. 
// Any component inside this bubble can read the data we put here.
const AuthContext = createContext();

// 2. The Provider is the actual component that wraps around our app (seen in main.jsx)
export const AuthContextProvider = ({ children }) => {
  // session holds the current user's login token and data
  const [session, setSession] = useState(undefined);

  // loading prevents the app from drawing on the screen until we know if the user is logged in
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // When the app first loads, check Supabase to see if the user was already logged in previously
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session || null);
      setLoading(false); // Stop the loading state so the app can draw
    };

    init();

    // Set up a listener: if the user logs in or out anywhere in the app, this triggers automatically
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session || null);
    });

    // Cleanup function when the component is destroyed
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // --- ADDED HELPER FUNCTIONS ---

  // Sends an email and password to Supabase to create a brand new account
  const signUp = (email, password, options = {}) => {
    return supabase.auth.signUp({ email, password, options });
  };

  // Checks the email and password against Supabase to log them in
  const signIn = (email, password) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  // Tells Supabase to destroy the current session token (Log out)
  const signOut = () => {
    return supabase.auth.signOut();
  };

  // This is the "Care Package" of data we are making available to every component in the app
  const value = {
    session,    // The raw session token
    loading,    // True/False if we are still checking login status
    signUp,     // The signup function
    signIn,     // The login function
    signOut,    // The logout function
    user: session?.user || null // Just a quick shortcut to explicitly get the user's data (like their ID and email)
  };

  return (
    // Wrap the rest of the application (children) inside this memory bubble, and pass them the 'value' Care Package
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// 3. A custom shortcut function (Hook) so other components can just write `const { user } = UserAuth();`
export const UserAuth = () => {
  return useContext(AuthContext);
};