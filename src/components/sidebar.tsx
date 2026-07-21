'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import {
  LayoutDashboard, PlusCircle, CalendarDays, Users, Sliders,
  LogOut, Menu, X, BookOpen, UserPlus, UserCircle,
} from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const { logout, user, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const baseMenuItems = [
    { name: 'Treinamento',       href: '/dashboard/treinamento', icon: LayoutDashboard },
    { name: 'Recrutamento',      href: '/dashboard/recrutamento', icon: UserCircle      },
    { name: 'Criar Turmas',      href: '/cadastro',               icon: PlusCircle      },
    { name: 'Diário de Presença',href: '/turmas',                 icon: BookOpen        },
    { name: 'Calendário',        href: '/calendario',             icon: CalendarDays    },
    { name: 'Colaboradores',     href: '/colaboradores',          icon: Users           },
    { name: 'Configurações',     href: '/configuracoes',          icon: Sliders         },
  ];

  const isGerente = !loading && user?.perfil?.toLowerCase() === 'gerente';
  const menuItems = isGerente
    ? [...baseMenuItems, { name: 'Novo Administrador', href: '/criar-adm', icon: UserPlus }]
    : baseMenuItems;

  // ── LOGO BLOCK (reutilizado no mobile e desktop) ──────────────────────────
  const LogoBlock = () => (
    <div className="flex items-center gap-3">
      <img
        src="/assets/logo-presenteismo.png"
        alt="Presenteismo"
        className="h-10 w-10 object-contain flex-shrink-0 drop-shadow-md"
      />
      <div className="min-w-0">
        <p className="font-extrabold text-base leading-tight tracking-tight text-white">
          PRESENTE<span className="text-emerald-400">ISMO</span>
        </p>
        <p className="text-[10px] font-bold tracking-widest text-emerald-500/80 uppercase">
          Softmarketing
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* ── TOPBAR MOBILE ── */}
      <div
        className="flex items-center justify-between px-4 py-3 md:hidden fixed top-0 left-0 right-0 z-50 shadow-lg"
        style={{ background: 'linear-gradient(135deg, #0a2e1a 0%, #0d3b22 100%)' }}
      >
        <LogoBlock />
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
        >
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* ── OVERLAY MOBILE ── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside
        className={`
          fixed top-0 bottom-0 left-0 z-40 w-64 flex flex-col
          transition-transform duration-300 ease-in-out
          md:translate-x-0 pt-14 md:pt-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ background: 'linear-gradient(180deg, #0a2e1a 0%, #0c3520 60%, #0a2e1a 100%)' }}
      >

        {/* ── HEADER DESKTOP ── */}
        <div
          className="hidden md:flex flex-col px-5 py-5 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <LogoBlock />
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mt-3 pl-0.5"
            style={{ color: 'rgba(134,239,172,0.5)' }}
          >
            Recrutamento &amp; Treinamento
          </p>
        </div>

        {/* ── USUÁRIO LOGADO ── */}
        {!loading && user && (
          <div
            className="px-5 py-3.5 border-b flex items-center gap-3"
            style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)' }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm text-white"
              style={{ background: 'rgba(52,211,153,0.2)' }}
            >
              {user.nome?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-tight">{user.nome}</p>
              <p
                className="text-[10px] font-bold tracking-wider uppercase mt-0.5"
                style={{ color: '#34d399' }}
              >
                {user.perfil}
              </p>
            </div>
          </div>
        )}

        {/* ── NAVEGAÇÃO ── */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group"
                style={
                  isActive
                    ? {
                        background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                        color: '#ffffff',
                        boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
                      }
                    : {
                        color: 'rgba(255,255,255,0.55)',
                      }
                }
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
                    (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.9)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)';
                  }
                }}
              >
                {/* Barra lateral no item ativo */}
                {isActive && (
                  <span
                    className="absolute left-0 w-1 h-7 rounded-r-full"
                    style={{ background: '#4ade80' }}
                  />
                )}
                <Icon
                  size={17}
                  style={{ color: isActive ? '#ffffff' : 'rgba(255,255,255,0.4)' }}
                  className="flex-shrink-0 transition-colors duration-200"
                />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* ── RODAPÉ / LOGOUT ── */}
        <div
          className="p-3 border-t"
          style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.15)' }}
        >
          <button
            onClick={() => { logout(); setIsOpen(false); }}
            className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
            style={{ color: 'rgba(252,165,165,0.8)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)';
              (e.currentTarget as HTMLElement).style.color = '#fca5a5';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'rgba(252,165,165,0.8)';
            }}
          >
            <LogOut size={17} className="flex-shrink-0" />
            Sair do Sistema
          </button>
        </div>
      </aside>
    </>
  );
}
