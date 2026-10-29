/**
 * @file supabaseClient.js
 * Supabase client factory for the WayDine frontend.
 * Only initializes and returns a Supabase client if BOTH VITE_SUPABASE_URL
 * and VITE_SUPABASE_ANON_KEY exist in environment variables. Otherwise returns null.
 *
 * Zero external dependencies — communicates directly via standard PostgREST / Auth fetch.
 * SECURITY: Uses only the anon public key, NEVER the service-role key.
 */

/**
 * Chainable query builder for Supabase PostgREST endpoints.
 */
class SupabaseQueryBuilder {
  constructor(baseUrl, anonKey, table) {
    this.baseUrl = (baseUrl || '').replace(/\/+$/, '');
    this.anonKey = anonKey;
    this.table = table;
    this.method = 'GET';
    this.queryParams = [];
    this.headers = {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json'
    };
    this.body = null;
  }

  select(columns = '*') {
    this.method = 'GET';
    this.queryParams.push(`select=${encodeURIComponent(columns)}`);
    return this;
  }

  eq(column, value) {
    this.queryParams.push(`${encodeURIComponent(column)}=eq.${encodeURIComponent(value)}`);
    return this;
  }

  neq(column, value) {
    this.queryParams.push(`${encodeURIComponent(column)}=neq.${encodeURIComponent(value)}`);
    return this;
  }

  in(column, values) {
    const list = Array.isArray(values) ? values.map(encodeURIComponent).join(',') : values;
    this.queryParams.push(`${encodeURIComponent(column)}=in.(${list})`);
    return this;
  }

  insert(values) {
    this.method = 'POST';
    this.body = JSON.stringify(values);
    this.headers.Prefer = 'return=representation';
    return this;
  }

  upsert(values, options = {}) {
    this.method = 'POST';
    this.body = JSON.stringify(values);
    this.headers.Prefer = 'resolution=merge-duplicates,return=representation';
    if (options.onConflict) {
      this.queryParams.push(`on_conflict=${encodeURIComponent(options.onConflict)}`);
    }
    return this;
  }

  /**
   * Make the query builder awaitable as a Promise.
   */
  async then(resolve, reject) {
    try {
      const qs = this.queryParams.length ? `?${this.queryParams.join('&')}` : '';
      const url = `${this.baseUrl}/rest/v1/${this.table}${qs}`;
      const res = await fetch(url, {
        method: this.method,
        headers: this.headers,
        body: this.body
      });

      if (!res.ok) {
        let errMsg = `Supabase HTTP ${res.status}: ${res.statusText}`;
        try {
          const errJson = await res.json();
          if (errJson && errJson.message) errMsg = errJson.message;
        } catch {}
        return resolve({ data: null, error: new Error(errMsg) });
      }

      const data = await res.json();
      return resolve({ data, error: null });
    } catch (err) {
      return resolve({ data: null, error: err });
    }
  }
}

/**
 * Creates a zero-dependency Supabase client instance.
 * @param {string} url
 * @param {string} anonKey
 * @param {object} [options]
 */
export function createClient(url, anonKey, options = {}) {
  const cleanUrl = (url || '').replace(/\/+$/, '');
  return {
    auth: {
      async getSession() {
        if (typeof window !== 'undefined') {
          try {
            const raw = localStorage.getItem('supabase_auth_session');
            if (raw) {
              const session = JSON.parse(raw);
              return { data: { session }, error: null };
            }
          } catch {}
        }
        return { data: { session: null }, error: null };
      },
      async getUser() {
        if (typeof window !== 'undefined') {
          try {
            const raw = localStorage.getItem('supabase_auth_session');
            if (raw) {
              const session = JSON.parse(raw);
              return { data: { user: session?.user || null }, error: null };
            }
          } catch {}
        }
        return { data: { user: null }, error: null };
      },
      onAuthStateChange(callback) {
        return {
          data: {
            subscription: {
              unsubscribe: () => {}
            }
          }
        };
      },
      async signInWithPassword({ email, password }) {
        try {
          const res = await fetch(`${cleanUrl}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
          });
          const json = await res.json();
          if (!res.ok) {
            return { data: null, error: new Error(json.msg || json.error_description || 'Sign in failed') };
          }
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('supabase_auth_session', JSON.stringify(json));
            } catch {}
          }
          return { data: { session: json, user: json.user }, error: null };
        } catch (err) {
          return { data: null, error: err };
        }
      },
      async signUp({ email, password, options = {} }) {
        try {
          const res = await fetch(`${cleanUrl}/auth/v1/signup`, {
            method: 'POST',
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password, data: options.data || {} })
          });
          const json = await res.json();
          if (!res.ok) {
            return { data: null, error: new Error(json.msg || json.error_description || 'Sign up failed') };
          }
          return { data: { session: json.session || null, user: json.user || json }, error: null };
        } catch (err) {
          return { data: null, error: err };
        }
      },
      async signOut() {
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('supabase_auth_session');
          } catch {}
        }
        return { error: null };
      }
    },
    from(table) {
      return new SupabaseQueryBuilder(cleanUrl, anonKey, table);
    }
  };
}

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
  if (typeof process !== 'undefined' && process.env && process.env.VITEST && !process.env.FORCE_TEST_SUPABASE) {
    return false;
  }
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
 * @returns {any | null}
 */
export function createSupabaseClient(urlOverride, keyOverride) {
  const url = urlOverride !== undefined ? urlOverride : getEnvVar('VITE_SUPABASE_URL');
  const anonKey = keyOverride !== undefined ? keyOverride : getEnvVar('VITE_SUPABASE_ANON_KEY');

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
 * @returns {any | null}
 */
export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  return supabase || createSupabaseClient();
}

export default supabase;
