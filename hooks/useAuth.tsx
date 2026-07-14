import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '../lib/types';
import { fetchProfile, signOut as apiSignOut } from '../lib/api/auth';
import { createDevProfile, isDevAuthEnabled, isDevAuthUser, loadDevSession, loadDevProfileOverrides, saveDevSession, clearDevSession } from '../lib/devAuth';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Set after successful OTP verify before navigation settles */
  setSessionLocal: (session: Session | null, profileOverride?: Profile | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (userId: string, phone?: string) => {
    const result = await fetchProfile(userId, phone);
    if (result.ok) {
      setProfile(result.data);
    } else {
      logger.warn('refreshProfile failed', result.error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    if (isDevAuthEnabled()) {
      void loadDevSession().then((stored) => {
        if (!mounted) return;
        if (stored?.user) {
          setSession(stored);
          setStatus('signedIn');
          if (isDevAuthUser(stored.user.id)) {
            void loadDevProfileOverrides(stored.user.id).then((overrides) => {
              if (!mounted) return;
              setProfile(
                createDevProfile(stored.user.phone ?? '+917043156067', overrides ?? undefined),
              );
            });
          }
        } else {
          setStatus('signedOut');
        }
      });
      return () => {
        mounted = false;
      };
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        logger.warn('getSession error', error);
        setStatus('signedOut');
        return;
      }
      setSession(data.session);
      setStatus(data.session ? 'signedIn' : 'signedOut');
      if (data.session?.user) {
        void loadProfile(data.session.user.id, data.session.user.phone);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setStatus(nextSession ? 'signedIn' : 'signedOut');
      if (nextSession?.user) {
        void loadProfile(nextSession.user.id, nextSession.user.phone);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    await loadProfile(session.user.id, session.user.phone);
  }, [loadProfile, session]);

  const signOut = useCallback(async () => {
    if (isDevAuthEnabled()) {
      await clearDevSession();
    } else {
      await apiSignOut();
    }
    queryClient.clear();
    setSession(null);
    setProfile(null);
    setStatus('signedOut');
  }, [queryClient]);

  const setSessionLocal = useCallback(
    (next: Session | null, profileOverride?: Profile | null) => {
      setSession(next);
      setStatus(next ? 'signedIn' : 'signedOut');
      if (next?.user) {
        if (profileOverride) {
          setProfile(profileOverride);
        } else if (isDevAuthUser(next.user.id)) {
          void loadDevProfileOverrides(next.user.id).then((overrides) => {
            setProfile(createDevProfile(next.user.phone ?? '+917043156067', overrides ?? undefined));
          });
        } else {
          void loadProfile(next.user.id, next.user.phone);
        }
        if (isDevAuthUser(next.user.id)) {
          void saveDevSession(next);
        }
      }
      if (!next) void clearDevSession();
    },
    [loadProfile],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      profile,
      refreshProfile,
      signOut,
      setSessionLocal,
    }),
    [status, session, profile, refreshProfile, signOut, setSessionLocal],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
