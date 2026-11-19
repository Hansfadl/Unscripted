import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  testConnection,
} from '../lib/firebase';
import { DEFAULT_SITE_SETTINGS } from '../data/defaults';
import {
  fetchPublicSettings,
  seedInitialAdminDataIfNeeded,
  verifyBackendAdminAccess,
} from '../services/firestoreService';
import type { SiteSettings } from '../types/unscripted';

interface FirebaseContextValue {
  user: User | null;
  isAdmin: boolean;
  authReady: boolean;
  connectionOk: boolean;
  settings: SiteSettings;
  refreshSettings: () => Promise<void>;
  signInWithGoogle: () => Promise<{ user: User; isAdmin: boolean }>;
  signOutAdmin: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | undefined>(undefined);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [connectionOk, setConnectionOk] = useState(true);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);

  const refreshSettings = useCallback(async () => {
    try {
      const loaded = await fetchPublicSettings();
      setSettings(loaded);
    } catch (err) {
      console.error('Unable to load settings:', err);
    }
  }, []);

  useEffect(() => {
    testConnection().then(setConnectionOk);

    // Live subscription to public brand & contact settings
    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'public'),
      (snap) => {
        if (snap.exists()) {
          setSettings({
            ...DEFAULT_SITE_SETTINGS,
            ...(snap.data() as Partial<SiteSettings>),
          });
        } else {
          setSettings(DEFAULT_SITE_SETTINGS);
        }
      },
      (err) => {
        console.error('Settings snapshot listener error:', err);
      }
    );

    return () => unsubSettings();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const adminStatus = await verifyBackendAdminAccess(currentUser);
        setIsAdmin(adminStatus);
        if (adminStatus) {
          try {
            await seedInitialAdminDataIfNeeded(currentUser);
            await refreshSettings();
          } catch (err) {
            console.error('Admin bootstrap check error:', err);
          }
        }
      } else {
        setIsAdmin(false);
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, [refreshSettings]);

  const signInWithGoogle = useCallback(async () => {
    const result = await signInWithPopup(auth, googleProvider);
    const adminStatus = await verifyBackendAdminAccess(result.user);
    setUser(result.user);
    setIsAdmin(adminStatus);
    if (adminStatus) {
      await seedInitialAdminDataIfNeeded(result.user);
      await refreshSettings();
    }
    return { user: result.user, isAdmin: adminStatus };
  }, [refreshSettings]);

  const signOutAdmin = useCallback(async () => {
    await signOut(auth);
    setUser(null);
    setIsAdmin(false);
  }, []);

  return (
    <FirebaseContext.Provider
      value={{
        user,
        isAdmin,
        authReady,
        connectionOk,
        settings,
        refreshSettings,
        signInWithGoogle,
        signOutAdmin,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used inside FirebaseProvider');
  }
  return ctx;
}
