'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import {
  LayoutDashboard, PlusCircle, CalendarDays, Users, Sliders,
  LogOut, Menu, X, BookOpen, UserPlus, UserCircle,
} from 'lucide-react';

// ── ÍCONE SVG EMBUTIDO (não precisa de arquivo de imagem) ─────────────────────
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
      {/* Fundo circular verde-escuro */}
      <circle cx="24" cy="24" r="24" fill="#14532d" />
      {/* Círculo interno com borda verde */}
      <circle cx="24" cy="24" r="18" fill="#166534" stroke="#4ade80" strokeWidth="1.5" />
      {/* Check mark estilizado */}
      <path
        d="M14 24.5L20.5 31L34 17"
        stroke="#4ade80"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Ponto de presença */}
      <circle cx="24" cy="24" r="2.5" fill="#86efac" opacity="0.6" />
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { logout, user, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const baseMenuItems = [
    { name: 'Treinamento',        href: '/dashboard/treinamento', icon: LayoutDashboard },
    { name: 'Recrutamento',       href: '/dashboard/recrutamento', icon: UserCircle      },
    { name: 'Criar Turmas',       href: '/cadastro',               icon: PlusCircle      },
    { name: 'Diário de Presença', href: '/turmas',                 icon: BookOpen        },
    { name: 'Calendário',         href: '/calendario',             icon: CalendarDays    },
    { name: 'Colaboradores',      href: '/colaboradores',          icon: Users           },
    { name: 'Configurações',      href: '/configuracoes',          icon: Sliders         },
  ];

  const isGerente = !loading && user?.perfil?.toLowerCase() === 'gerente';
  const menuItems = isGerente
    ? [...baseMenuItems, { name: 'Novo Administrador', href: '/criar-adm', icon: UserPlus }]
    : baseMenuItems;

  // ── BLOCO DE LOGO ─────────────────────────────────────────────────────────
  const LogoBlock = () => (
    <div className="flex items-center gap-3">
      <LogoIcon size={38} />
      <div className="min-w-0">
        <p
          className="font-extrabold text-base leading-tight tracking-tight"
          style={{ color: '#ffffff' }}
        >
          PRESENTE<span style={{ color: '#4ade80' }}>ISMO</span>
        </p>
        <p
          className="text-[10px] font-bold tracking-widest uppercase"
          style={{ color: 'rgba(134,239,172,0.6)' }}
        >
          Softmarketing
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* ── TOPBAR MOBILE ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3 md:hidden fixed top-0 left-0 right-0 z-50 shadow-lg"
        style={{ background: 'linear-gradient(135deg, #052e16 0%, #0a3d1f 100%)' }}
      >
        <LogoBlock />
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'rgba(255,255,255,0.7)' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
        >
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* ── OVERLAY MOBILE ────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ── SIDEBAR ───────────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed top-0 bottom-0 left-0 z-40 w-64 flex flex-col
          transition-transform duration-300 ease-in-out
          md:translate-x-0 pt-14 md:pt-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          background: 'linear-gradient(180deg, #052e16 0%, #0a3d1f 55%, #052e16 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* ── HEADER DESKTOP ──────────────────────────────────────────────── */}
        <div
          className="hidden md:flex flex-col px-5 py-5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <LogoBlock />
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mt-3"
            style={{ color: 'rgba(134,239,172,0.45)' }}
          >
            Recrutamento &amp; Treinamento
          </p>
        </div>

        {/* ── USUÁRIO LOGADO ──────────────────────────────────────────────── */}
        {!loading && user && (
          <div
            className="px-5 py-3.5 flex items-center gap-3"
            style={{
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(0,0,0,0.25)',
            }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm"
              style={{
                background: 'rgba(74,222,128,0.15)',
                color: '#4ade80',
                border: '1px solid rgba(74,222,128,0.25)',
              }}
            >
              {user.nome?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p
                className="text-sm font-semibold truncate leading-tight"
                style={{ color: '#ffffff' }}
              >
                {user.nome}
              </p>
              <p
                className="text-[10px] font-bold tracking-wider uppercase mt-0.5"
                style={{ color: '#34d399' }}
              >
                {user.perfil}
              </p>
            </div>
          </div>
        )}

        {/* ── NAVEGAÇÃO ───────────────────────────────────────────────────── */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto" style={{ gap: '2px', display: 'flex', flexDirection: 'column' }}>
          {menuItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
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
                        background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                        color: '#ffffff',
                        boxShadow: '0 4px 16px rgba(22,163,74,0.3)',
                      }
                    : { color: 'rgba(255,255,255,0.5)' }
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
                    (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)';
                  }
                }}
              >
                {/* Barra indicadora esquerda no item ativo */}
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                    style={{ background: '#86efac' }}
                  />
                )}
                <Icon
                  size={17}
                  style={{ color: isActive ? '#ffffff' : 'rgba(255,255,255,0.38)' }}
                  className="flex-shrink-0"
                />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* ── RODAPÉ / LOGOUT ─────────────────────────────────────────────── */}
        <div
          className="p-3"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          <button
            onClick={() => { logout(); setIsOpen(false); }}
            className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
            style={{ color: 'rgba(252,165,165,0.75)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)';
              (e.currentTarget as HTMLElement).style.color = '#fca5a5';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'rgba(252,165,165,0.75)';
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
