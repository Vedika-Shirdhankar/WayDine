/**
 * @file supabaseClient.js
 * Supabase client factory for the WayDine frontend.
 * Only initializes and returns a Supabase client if BOTH VITE_SUPABASE_URL
 * and VITE_SUPABASE_ANON_KEY exist in environment variables. Otherwise returns null.
 *
 * SECURITY: Uses only the anon public key, NEVER the service-role key.
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Safely retrieves an environment variable from import.meta.env or process.env.
 * @param {string} key
 * @returns {string | null}
 */
export function getEnvVar(key) {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return null;
}

/**
 * Checks whether Supabase is configured with real credentials.
 * @returns {boolean}
 */
export function isSupabaseConfigured() {
  const url = getEnvVar('VITE_SUPABASE_URL');
  const key = getEnvVar('VITE_SUPABASE_ANON_KEY');
  return Boolean(
    url &&
    key &&
    url.trim() !== '' &&
    key.trim() !== '' &&
    url !== 'YOUR_SUPABASE_URL' &&
    key !== 'your-anon-key' &&
    url !== 'https://your-project-id.supabase.co' &&
    key !== 'your-anon-public-key'
  );
}

/**
 * Creates a Supabase client instance or returns null if credentials are missing.
 * @param {string} [urlOverride]
 * @param {string} [keyOverride]
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
export function createSupabaseClient(urlOverride, keyOverride) {
  const url = urlOverride || getEnvVar('VITE_SUPABASE_URL');
  const anonKey = keyOverride || getEnvVar('VITE_SUPABASE_ANON_KEY');

  const isValid = Boolean(
    url &&
    anonKey &&
    url.trim() !== '' &&
    anonKey.trim() !== '' &&
    url !== 'YOUR_SUPABASE_URL' &&
    anonKey !== 'your-anon-key' &&
    url !== 'https://your-project-id.supabase.co' &&
    anonKey !== 'your-anon-public-key'
  );

  if (!isValid) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: typeof window !== 'undefined',
      autoRefreshToken: typeof window !== 'undefined',
      detectSessionInUrl: typeof window !== 'undefined'
    }
  });
}

/** Default singleton instance (null if env vars missing) */
export const supabase = isSupabaseConfigured() ? createSupabaseClient() : null;

/**
 * Returns the active Supabase client or null if not configured.
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  return supabase || createSupabaseClient();
}

export default supabase;
