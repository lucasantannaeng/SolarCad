import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isGuest: boolean;
  loginAsGuest: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isGuest, setIsGuest] = useState(() => {
    return typeof window !== 'undefined' && localStorage.getItem('SOLARCAD_GUEST_MODE') === 'true';
  });
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const guestUser: User = {
    id: 'local-guest-user',
    app_metadata: { provider: 'local' },
    user_metadata: { name: 'Engenheiro Solar (Modo Local)' },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    email: 'local@solarcad.app',
  } as any;

  useEffect(() => {
    if (isGuest) {
      setUser(guestUser);
      setLoading(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: initial } }) => {
      setSession(initial);
      setUser(initial?.user ?? null);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [isGuest]);

  const loginAsGuest = () => {
    setIsGuest(true);
    setUser(guestUser);
    localStorage.setItem('SOLARCAD_GUEST_MODE', 'true');
  };

  const signOut = async () => {
    localStorage.removeItem('SOLARCAD_GUEST_MODE');
    setIsGuest(false);
    setUser(null);
    setSession(null);
    try {
      await supabase.auth.signOut();
    } catch (_) {}
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isGuest, loginAsGuest, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de um <AuthProvider>.');
  return ctx;
};
