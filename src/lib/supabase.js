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
  // Race the session check against a 10-second timeout.
  // If the browser just woke up from throttling and the network is slow,
  // we fail fast with a clear message rather than silently hanging until
  // the 45-second save timeout fires.
  let timeoutId;
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Connection is slow — please wait a moment and try again.')),
          10000
        );
      }),
    ]);
    if (result.error || !result.data?.session) {
      throw new Error('Your session has expired. Please sign in again.');
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