'use client';

import './globals.css';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { LayoutDashboard, Calendar, Users, PlusCircle, LogOut, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();

  // Se estiver carregando ou na tela de login, não mostra o menu lateral
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-medium">
        Carregando ecossistema...
      </div>
    );
  }

  if (!user || pathname === '/login') {
    return <>{children}</>;
  }

  const menuItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Diário de Presença', href: '/turmas', icon: Users },
    { name: 'Calendário Mensal', href: '/calendario', icon: Calendar },
    { name: 'Criar Turma/Lote', href: '/cadastro', icon: PlusCircle },
    { name: 'Novo Administrador', href: '/criar-adm', icon: UserPlus },
  ];

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      {/* Sidebar Fixo */}
      <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col justify-between border-r border-slate-800 shadow-xl shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-2 font-black text-lg tracking-wider text-white uppercase">
            <span className="text-blue-500">⚡</span> CallCenter OS
          </div>
          <p className="text-[10px] text-slate-500 mt-1 font-bold">RECRUTAMENTO & TREINAMENTO</p>
          
          <nav className="mt-8 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                      : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon size={16} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Rodapé do Perfil com Logout */}
        <div className="p-4 border-t border-slate-800/60 bg-slate-950/40 flex items-center justify-between gap-2">
          <div className="truncate pr-2">
            <p className="text-xs font-bold text-white truncate">{user.email?.split('@')[0]}</p>
            <p className="text-[10px] text-slate-500 font-medium truncate">Instrutor Conectado</p>
          </div>
          <button 
            onClick={logout}
            className="p-2 rounded-lg bg-slate-800 hover:bg-red-950/40 hover:text-red-400 text-slate-400 transition-colors"
            title="Sair do Sistema"
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* Área de Conteúdo da Página */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased selection:bg-blue-500 selection:text-white">
        <AuthProvider>
          <AppLayoutContent>{children}</AppLayoutContent>
        </AuthProvider>
      </body>
    </html>
  );
}
