'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { useAuth } from '@/hooks/use-auth';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading } = useAuth();
  
  // Telas que NÃO devem exibir a barra lateral de navegação
  const isAuthRoute = pathname === '/login' || pathname === '/criar-adm';

  if (loading) {
    return (
      <div className="min-screen w-full flex items-center justify-center bg-slate-950 text-slate-100 h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-400">Verificando credenciais...</p>
        </div>
      </div>
    );
  }

  if (isAuthRoute) {
    return <div className="min-h-screen bg-slate-950 text-slate-100">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />
      {/* Margem superior no mobile para não ficar por baixo da barra fixa */}
      <main className="flex-1 p-4 md:p-8 md:pl-72 pt-20 md:pt-8 overflow-x-hidden">
        <div className="max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
