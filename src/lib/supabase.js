import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase environment variables. Copy .env.example to .env and fill in your project credentials.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'wolfpack-auth',
    persistSession: true,
    autoRefreshToken: true,
  },
});

// ─── Session refresh helper ───
// Call this at the start of any save/create/delete operation.
// If the JWT is expired or about to expire, Supabase will silently refresh it
// here — before the save timeout starts — so the 45-second timeout only
// counts actual database write time, not token-refresh latency.
export async function ensureFreshSession() {
  // Race the session check against an 8-second timeout.
  // IMPORTANT: on timeout we do NOT throw — we return null and let the save
  // proceed anyway. After just a few minutes of inactivity the JWT is still
  // fully valid (it lasts 3600s), so the Supabase database call will succeed
  // even without an explicit session refresh. Only throw if Supabase positively
  // confirms the session is gone (i.e. the check completed and returned nothing).
  let timeoutId;
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise((resolve) => {
        timeoutId = setTimeout(() => resolve({ timeout: true }), 8000);
      }),
    ]);
    if (result.timeout) {
      // Connection is sluggish — proceed with the save and let Supabase handle auth.
      console.warn('ensureFreshSession: check timed out, proceeding with save attempt');
      return null;
    }
    if (result.error || !result.data?.session) {
      // Don't throw here — the JWT is valid for 3600 s and the Supabase client
      // may transiently return a null session while its internal lock is held
      // (e.g. during an auto-refresh or a cold reconnect after tab inactivity).
      // Proceeding lets the actual DB write attempt succeed with the stored JWT.
      console.warn('ensureFreshSession: no active session in client cache, proceeding with save attempt');
      return null;
    }
    return result.data.session;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Auth helpers ───
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ─── Storage helpers for design images ───
export async function uploadDesignImage(designId, file) {
  const ext = file.name.split('.').pop();
  const path = `designs/${designId}.${ext}`;

  const { data, error } = await supabase.storage
    .from('design-images')
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('design-images')
    .getPublicUrl(path);

  return urlData.publicUrl;
}

export async function deleteDesignImage(imagePath) {
  if (!imagePath) return;
  // imagePath may be a full public URL — extract just the relative storage path
  const relativePath = imagePath.includes('/object/public/design-images/')
    ? imagePath.split('/object/public/design-images/')[1]
    : imagePath;
  const { error } = await supabase.storage
    .from('design-images')
    .remove([relativePath]);
  if (error) console.error('Error deleting image:', error);
}

export const logActivity = async (userId, activityType, entityType, entityId, details = {}) => {
  try {
    const { error } = await supabase
      .from('activity_log')
      .insert([
        {
          actor_id: userId,
          action: activityType,
          entity_type: entityType,
          entity_id: entityId,
          details: details,
          created_at: new Date().toISOString()
        }
      ]);

    if (error) throw error;
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};