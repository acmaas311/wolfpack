import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [teamMember, setTeamMember] = useState(null);
  const [loading, setLoading] = useState(true);
  // Set to true when Supabase silently drops a session (token refresh failure,
  // refresh token expiry, etc.) so the UI can show an explanatory prompt.
  const [sessionExpired, setSessionExpired] = useState(false);
  // Google access token — stored in sessionStorage so it survives soft refreshes
  const [googleAccessToken, setGoogleAccessToken] = useState(
    () => sessionStorage.getItem('_gat') || null
  );

  // ─── Page Visibility: reconnect when tab regains focus ────────────────────
  // Browsers (especially Chrome) throttle background tabs: they freeze JS timers
  // and can close idle TCP/WebSocket connections. When the user returns to the
  // tab after ~5 minutes, the Supabase Realtime WebSocket channels and the HTTP
  // connection pool may need to re-establish. By proactively calling getSession()
  // the moment the tab becomes visible, we kick off that reconnection in the
  // background — so by the time the user clicks Save (a second or two later)
  // the connection is already warm and the save completes instantly.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().catch(() => {
          // Session may have genuinely expired — onAuthStateChange will handle it
        });
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    // Safety timeout — if Supabase never responds (e.g. network issue),
    // unblock the UI after 10 seconds so users aren't stuck forever.
    const timeout = setTimeout(() => {
      console.warn('Auth timed out — forcing loading to false');
      setLoading(false);
    }, 10000);

    // Track whether we've ever had a signed-in session in this page load so we
    // can distinguish "user just opened the app while logged out" (not expired)
    // from "user was active and got silently signed out" (session expired).
    let hadSession = false;

    // In Supabase v2, onAuthStateChange fires immediately with INITIAL_SESSION,
    // so we don't need a separate getSession() call.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        // Capture the Google OAuth access token whenever it's present.
        // It's only available right after sign-in (not on every refresh),
        // so we persist it in sessionStorage to survive page reloads.
        if (session?.provider_token) {
          setGoogleAccessToken(session.provider_token);
          sessionStorage.setItem('_gat', session.provider_token);
        }
        if (session?.user) {
          hadSession = true;
          setSessionExpired(false);
          await loadTeamMember(session.user);
        } else {
          // SIGNED_OUT can fire either because the user clicked Sign Out
          // (hadSession may be true) or because the refresh token expired
          // while the tab sat in the background (TOKEN_REFRESH_FAILED fires
          // first, then SIGNED_OUT).  Only show the expiry banner when the
          // session was dropped silently — not on an explicit user sign-out
          // (which calls our signOut() function that sets hadSession guard).
          if (hadSession && event === 'SIGNED_OUT') {
            setSessionExpired(true);
          }
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
    setSessionExpired(false);   // hide the expiry banner if it was showing

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
    <AuthContext.Provider value={{ user, teamMember, loading, sessionExpired, googleAccessToken, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
