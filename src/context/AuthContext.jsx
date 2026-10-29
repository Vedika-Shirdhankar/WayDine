/**
 * @file AuthContext.jsx
 * Authentication state management using Supabase Auth with seamless Guest Mode fallback.
 * - Logged-in users persist state to Supabase.
 * - Guests persist state to browser localStorage.
 * - On login, automatically detects unmerged guest history and offers migration to Supabase.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient.js';
import { getRepository } from '../data/restaurantRepository.js';
import { showToast } from '../components/Toast.jsx';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showImportPrompt, setShowImportPrompt] = useState(false);
  const [guestHistoryCount, setGuestHistoryCount] = useState(0);

  // Check guest history count in localStorage
  const checkGuestHistory = useCallback(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const stored = JSON.parse(localStorage.getItem('waydine_history') || '[]');
      const count = Array.isArray(stored) ? stored.length : 0;
      setGuestHistoryCount(count);
      return count;
    } catch {
      return 0;
    }
  }, []);

  useEffect(() => {
    checkGuestHistory();

    if (!isSupabaseConfigured() || !supabase) {
      setUser(null);
      setSession(null);
      setLoading(false);
      return;
    }

    // Initial session load
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user || null);
      setLoading(false);
      if (initialSession?.user) {
        const count = checkGuestHistory();
        if (count > 0) {
          setShowImportPrompt(true);
        }
      }
    }).catch(err => {
      console.warn('[AuthContext] Session retrieval error:', err);
      setLoading(false);
    });

    // Listen to Auth State Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      const currentUser = newSession?.user || null;
      setUser(currentUser);
      setLoading(false);

      if (event === 'SIGNED_IN' && currentUser) {
        const count = checkGuestHistory();
        if (count > 0) {
          setShowImportPrompt(true);
        }
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [checkGuestHistory]);

  const signIn = useCallback(async (email, password) => {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured. Please continue as guest.');
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data?.user) {
      setUser(data.user);
      setSession(data.session);
    }
    return data;
  }, []);

  const signUp = useCallback(async (email, password, fullName = '') => {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured. Please continue as guest.');
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });
    if (error) throw error;
    if (data?.user && data?.session) {
      setUser(data.user);
      setSession(data.session);
    }
    return data;
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setShowImportPrompt(false);
    showToast('Signed out. Continuing in Guest mode.', 'info');
  }, []);

  const importGuestHistory = useCallback(async () => {
    if (typeof window === 'undefined') return { imported: 0 };
    try {
      const stored = JSON.parse(localStorage.getItem('waydine_history') || '[]');
      if (!Array.isArray(stored) || stored.length === 0) {
        setShowImportPrompt(false);
        return { imported: 0 };
      }

      const repo = getRepository();
      let imported = 0;
      for (const item of stored) {
        await repo.saveHistory({
          restaurantId: item.restaurantId || item.restaurant?.id || item.id,
          restaurantName: item.restaurantName || item.name,
          routeId: item.routeId,
          score: item.score,
          detourMeters: item.detourMeters,
          selectedAt: item.selectedAt || item.timestamp,
          notes: item.notes
        });
        imported++;
      }

      // Clear local history once imported into Supabase
      localStorage.removeItem('waydine_history');
      setGuestHistoryCount(0);
      setShowImportPrompt(false);
      showToast(`Successfully imported ${imported} guest pitstop(s) to your account!`, 'success');
      return { imported };
    } catch (err) {
      console.error('[AuthContext] Import guest history failed:', err);
      showToast('Failed to import guest history: ' + err.message, 'danger');
      throw err;
    }
  }, []);

  const dismissImportPrompt = useCallback(() => {
    setShowImportPrompt(false);
  }, []);

  const value = {
    user,
    session,
    loading,
    isGuest: !user,
    isConfigured: isSupabaseConfigured(),
    signIn,
    signUp,
    signOut,
    guestHistoryCount,
    showImportPrompt,
    importGuestHistory,
    dismissImportPrompt,
    checkGuestHistory
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
