'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { useRouter, usePathname } from 'next/navigation';

export type AppUser = User & {
  perfil?: string | null;
  nome?: string | null;
};

const AuthContext = createContext<{
  user: AppUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}>({ user: null, loading: true, logout: async () => {} });

async function fetchPerfil(userId: string): Promise<{ role: string | null; nome: string | null }> {
  const { data, error } = await supabase
    .from('profile')
    .select('role, nome')
    .eq('id', userId)
    .single();

  if (error || !data) return { role: null, nome: null };
  return { role: data.role ?? null, nome: data.nome ?? null };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  async function hydrateUser(baseUser: User | null) {
    if (!baseUser) {
      setUser(null);
      setLoading(false);
      return;
    }

    const { role, nome } = await fetchPerfil(baseUser.id);
    setUser({ ...baseUser, perfil: role, nome });
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      hydrateUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        setLoading(false);
        if (pathname !== '/login') router.push('/login');
      } else {
        hydrateUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [router, pathname]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
