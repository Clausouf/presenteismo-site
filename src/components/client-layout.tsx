'use client';

import React, { useState } from 'react';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import {
  LayoutDashboard, PlusCircle, CalendarDays,
  LogOut, Menu, X, BookOpen, UserPlus,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ── ÍCONE SVG DA LOGO ────────────────────────────────────────────────────────
function LogoIcon({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <circle cx="24" cy="24" r="24" fill="#052e16" />
      <circle cx="24" cy="24" r="18" fill="#14532d" stroke="#166534" strokeWidth="1.5" />
      <path
        d="M14 24.5L20.5 31L34 17"
        stroke="#4ade80"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── BLOCO DE LOGO ────────────────────────────────────────────────────────────
function LogoBlock() {
  return (
    <div className="flex items-center gap-3">
      <LogoIcon size={38} />
      <div className="min-w-0">
        <p className="font-extrabold text-base leading-tight tracking-tight text-white">
          PRESENTE<span style={{ color: '#4ade80' }}>ISMO</span>
        </p>
        <p
          className="text-[10px] font-bold tracking-widest uppercase"
          style={{ color: 'rgba(134,239,172,0.5)' }}
        >
          Softmarketing
        </p>
      </div>
    </div>
  );
}

// ── SIDEBAR ──────────────────────────────────────────────────────────────────
function AppSidebar() {
  const pathname = usePathname();
  const { logout, user, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Dashboard é item único — ativo quando estiver em qualquer sub-rota /dashboard/*
  const baseMenuItems = [
    { name: 'Dashboard',          href: '/dashboard/treinamento', icon: LayoutDashboard, matchPrefix: '/dashboard' },
    { name: 'Criar Turmas',       href: '/cadastro',               icon: PlusCircle,      matchPrefix: '/cadastro'  },
    { name: 'Diário de Presença', href: '/turmas',                 icon: BookOpen,        matchPrefix: '/turmas'    },
    { name: 'Calendário',         href: '/calendario',             icon: CalendarDays,    matchPrefix: '/calendario'},
  ];

  const isGerente = !loading && user?.perfil?.toLowerCase() === 'gerente';
  const menuItems = isGerente
    ? [...baseMenuItems, { name: 'Novo Administrador', href: '/criar-adm', icon: UserPlus, matchPrefix: '/criar-adm' }]
    : baseMenuItems;

  const sidebarBg   = 'linear-gradient(180deg, #031a0e 0%, #052e16 50%, #031a0e 100%)';
  const borderColor = 'rgba(255,255,255,0.06)';
  const activeGreen = 'linear-gradient(135deg, #166534 0%, #14532d 100%)';
  const activeShadow = '0 4px 16px rgba(20,83,45,0.5)';

  return (
    <>
      {/* ── TOPBAR MOBILE ── */}
      <div
        className="flex items-center justify-between px-4 py-3 md:hidden fixed top-0 left-0 right-0 z-50 shadow-lg"
        style={{ background: '#031a0e' }}
      >
        <LogoBlock />
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'rgba(255,255,255,0.7)' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
        >
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* ── OVERLAY MOBILE ── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          style={{ background: 'rgba(0,0,0,0.6)' }}
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
        style={{ background: sidebarBg, borderRight: `1px solid ${borderColor}` }}
      >
        {/* HEADER DESKTOP */}
        <div
          className="hidden md:flex flex-col px-5 py-5"
          style={{ borderBottom: `1px solid ${borderColor}` }}
        >
          <LogoBlock />
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mt-3"
            style={{ color: 'rgba(134,239,172,0.35)' }}
          >
            Recrutamento &amp; Treinamento
          </p>
        </div>

        {/* USUÁRIO LOGADO */}
        {!loading && user && (
          <div
            className="px-5 py-3.5 flex items-center gap-3"
            style={{
              borderBottom: `1px solid ${borderColor}`,
              background: 'rgba(0,0,0,0.3)',
            }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm"
              style={{
                background: 'rgba(74,222,128,0.12)',
                color: '#4ade80',
                border: '1px solid rgba(74,222,128,0.2)',
              }}
            >
              {(user.nome ?? user.email ?? '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate leading-tight text-white">
                {user.nome ?? user.email?.split('@')[0]}
              </p>
              <p
                className="text-[10px] font-bold tracking-wider uppercase mt-0.5"
                style={{ color: '#34d399' }}
              >
                {user.perfil ?? 'Instrutor'}
              </p>
            </div>
          </div>
        )}

        {/* NAVEGAÇÃO */}
        <nav
          className="flex-1 px-3 py-4 overflow-y-auto"
          style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}
        >
          {menuItems.map((item) => {
            const isActive = pathname.startsWith(item.matchPrefix);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                style={
                  isActive
                    ? {
                        background: activeGreen,
                        color: '#ffffff',
                        boxShadow: activeShadow,
                      }
                    : { color: 'rgba(255,255,255,0.48)' }
                }
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                    (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.85)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.48)';
                  }
                }}
              >
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                    style={{ background: '#4ade80' }}
                  />
                )}
                <Icon
                  size={17}
                  style={{ color: isActive ? '#86efac' : 'rgba(255,255,255,0.35)' }}
                  className="flex-shrink-0"
                />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* RODAPÉ / LOGOUT */}
        <div
          className="p-3"
          style={{
            borderTop: `1px solid ${borderColor}`,
            background: 'rgba(0,0,0,0.25)',
          }}
        >
          <button
            onClick={() => { logout(); setIsOpen(false); }}
            className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
            style={{ color: 'rgba(252,165,165,0.7)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)';
              (e.currentTarget as HTMLElement).style.color = '#fca5a5';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'rgba(252,165,165,0.7)';
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

// ── CONTEÚDO DO LAYOUT ───────────────────────────────────────────────────────
function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center"
        style={{ background: '#031a0e' }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: '#4ade80', borderTopColor: 'transparent' }}
          />
          <p className="text-sm font-medium" style={{ color: 'rgba(134,239,172,0.7)' }}>
            Verificando credenciais...
          </p>
        </div>
      </div>
    );
  }

  const isAuthRoute = pathname === '/login' || pathname === '/criar-adm';

  if (isAuthRoute || !user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <AppSidebar />
      <main className="flex-1 p-4 md:p-8 md:pl-72 pt-20 md:pt-8 overflow-x-hidden">
        <div className="max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}

// ── EXPORT DEFAULT ───────────────────────────────────────────────────────────
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppLayoutContent>{children}</AppLayoutContent>
    </AuthProvider>
  );
}
