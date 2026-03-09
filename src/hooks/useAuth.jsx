import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [teamMember, setTeamMember] = useState(null);
  const [loading, setLoading] = useState(true);
  // Google access token — stored in sessionStorage so it survives soft refreshes
  const [googleAccessToken, setGoogleAccessToken] = useState(
    () => sessionStorage.getItem('_gat') || null
  );

  useEffect(() => {
    // Safety timeout — if Supabase never responds (e.g. network issue),
    // unblock the UI after 10 seconds so users aren't stuck forever.
    const timeout = setTimeout(() => {
      console.warn('Auth timed out — forcing loading to false');
      setLoading(false);
    }, 10000);

    // In Supabase v2, onAuthStateChange fires immediately with INITIAL_SESSION,
    // so we don't need a separate getSession() call.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        // Capture the Google OAuth access token whenever it's present.
        // It's only available right after sign-in (not on every refresh),
        // so we persist it in sessionStorage to survive page reloads.
        if (session?.provider_token) {
          setGoogleAccessToken(session.provider_token);
          sessionStorage.setItem('_gat', session.provider_token);
        }
        if (session?.user) {
          await loadTeamMember(session.user);
        } else {
          setTeamMember(null);
          setGoogleAccessToken(null);
          sessionStorage.removeItem('_gat');
          setLoading(false);
        }
      }
    );

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  async function loadTeamMember(authUser) {
    try {
      // First try to find by auth_id
      let { data } = await supabase
        .from('team_members')
        .select('*')
        .eq('auth_id', authUser.id)
        .single();

      if (!data) {
        // Try matching by email (first login — link the account)
        const { data: emailMatch } = await supabase
          .from('team_members')
          .select('*')
          .eq('email', authUser.email)
          .single();

        if (emailMatch) {
          // Link this Google account to the team member
          await supabase
            .from('team_members')
            .update({ auth_id: authUser.id })
            .eq('id', emailMatch.id);
          data = { ...emailMatch, auth_id: authUser.id };
        }
      }

      setTeamMember(data);
    } catch (err) {
      console.error('Error loading team member:', err);
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        // drive.file  — create/upload files via the REST API
        // drive.readonly — read/pick existing files via the Picker
        scopes: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
      },
    });
    if (error) console.error('Sign in error:', error);
  }

  async function signOut() {
    // Clear local state FIRST — this makes the UI respond instantly
    // regardless of network conditions. The user is returned to the
    // login screen immediately without waiting for the API call.
    setUser(null);
    setTeamMember(null);

    // Clear the Drive access token too
    setGoogleAccessToken(null);
    sessionStorage.removeItem('_gat');

    // Then fire the server-side sign-out in the background.
    // We don't await it, so a slow/failed network call can't block the UI.
    supabase.auth.signOut().catch(err => {
      console.warn('signOut API call failed (local session already cleared):', err);
    });
  }

  return (
    <AuthContext.Provider value={{ user, teamMember, loading, googleAccessToken, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
