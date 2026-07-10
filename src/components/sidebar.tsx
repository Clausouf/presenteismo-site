'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { 
  LayoutDashboard, PlusCircle, CalendarDays, Users, Sliders, 
  LogOut, Menu, X, BookOpen, UserPlus
} from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const { logout, user, loading } = useAuth(); // Adicionamos 'loading'
  const [isOpen, setIsOpen] = useState(false);

  const baseMenuItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Criar Turmas', href: '/cadastro', icon: PlusCircle },
    { name: 'Diário de Presença', href: '/turmas', icon: BookOpen },
    { name: 'Calendário', href: '/calendario', icon: CalendarDays },
    { name: 'Colaboradores', href: '/colaboradores', icon: Users },
    { name: 'Configurações', href: '/configuracoes', icon: Sliders },
  ];

  // Verifica se é Gerente APENAS após o carregamento terminar
  const isGerente = !loading && user?.perfil?.toLowerCase() === 'gerente';

  const menuItems = isGerente 
    ? [...baseMenuItems, { name: 'Novo Administrador', href: '/criar-adm', icon: UserPlus }]
    : baseMenuItems;

  return (
    <>
      <div className="bg-slate-900 text-white flex items-center justify-between p-4 md:hidden fixed top-0 left-0 right-0 z-50 shadow-md">
        <h1 className="font-bold text-lg tracking-wide">Presenteísmo T&D</h1>
        <button onClick={() => setIsOpen(!isOpen)} className="p-1 hover:bg-slate-800 rounded">
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <aside className={`
        fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 text-slate-100 flex flex-col transition-transform duration-300 ease-in-out border-r border-slate-800
        md:translate-x-0 pt-16 md:pt-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="hidden md:flex flex-col p-6 border-b border-slate-800">
          <h1 className="font-extrabold text-xl tracking-tight text-white">Presenteísmo</h1>
        </div>

        {/* Informação do usuário só aparece se não estiver carregando */}
        {!loading && user && (
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/40">
            <p className="text-sm font-medium text-white truncate">{user.nome}</p>
            <p className="text-xs text-blue-400 font-medium tracking-wider uppercase mt-0.5">{user.perfil}</p>
          </div>
        )}

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'}
                `}
              >
                <Icon size={18} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-950/20">
          <button onClick={() => { logout(); setIsOpen(false); }} className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-rose-400 hover:bg-rose-500/10 rounded-lg">
            <LogOut size={18} /> Sair
          </button>
        </div>
      </aside>

      {isOpen && <div onClick={() => setIsOpen(false)} className="fixed inset-0 bg-black/50 z-30 md:hidden" />}
    </>
  );
}
