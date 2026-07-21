'use client';

export const runtime = 'edge';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';

// ── ÍCONE SVG DA LOGO (igual à sidebar) ─────────────────────────────────────
function LogoIcon({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
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

export default function LoginPage() {
  const router = useRouter();
  const [matricula, setMatricula] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!matricula || !password) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      setLoading(false);
      return;
    }

    try {
      const emailAutenticacao = `${matricula.trim()}@presenteismo.local`;

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: emailAutenticacao,
        password,
      });

      if (authError) {
        if (authError.message === 'Invalid login credentials') {
          setError('Matrícula ou senha incorretos. Tente novamente.');
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError('Ocorreu um erro inesperado. Verifique sua conexão de rede.');
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #031a0e 0%, #052e16 50%, #031a0e 100%)' }}
    >
      {/* Elementos decorativos de fundo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at top right, rgba(74,222,128,0.07) 0%, transparent 55%), radial-gradient(ellipse at bottom left, rgba(20,83,45,0.15) 0%, transparent 55%)',
        }}
      />
      {/* Grade sutil */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(74,222,128,1) 1px, transparent 1px), linear-gradient(90deg, rgba(74,222,128,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Card */}
      <div
        className="relative w-full max-w-md rounded-2xl p-8 sm:p-10 shadow-2xl"
        style={{
          background: 'rgba(3,26,14,0.85)',
          border: '1px solid rgba(74,222,128,0.12)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(74,222,128,0.06)',
        }}
      >
        {/* Logo + Título */}
        <div className="flex flex-col items-center mb-8 gap-4">
          <LogoIcon size={56} />
          <div className="text-center">
            <h1 className="text-2xl font-extrabold tracking-tight text-white leading-tight">
              PRESENTE<span style={{ color: '#4ade80' }}>ISMO</span>
            </h1>
            <p
              className="text-[10px] font-bold tracking-widest uppercase mt-0.5"
              style={{ color: 'rgba(134,239,172,0.5)' }}
            >
              Softmarketing · T&amp;D-R&amp;S
            </p>
          </div>
          <p className="text-sm text-center" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Insira suas credenciais para acessar a plataforma
          </p>
        </div>

        {/* Alerta de erro */}
        {error && (
          <div
            className="mb-6 flex items-start gap-3 p-4 rounded-xl text-sm"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#fca5a5',
            }}
          >
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleLogin} className="space-y-5">
          {/* Matrícula */}
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'rgba(134,239,172,0.7)' }}
            >
              Matrícula
            </label>
            <div className="relative">
              <div
                className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"
                style={{ color: 'rgba(74,222,128,0.4)' }}
              >
                <User size={17} />
              </div>
              <input
                type="text"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                placeholder="Digite sua matrícula"
                disabled={loading}
                required
                className="w-full rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-transparent transition-all outline-none"
                style={{
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid rgba(74,222,128,0.15)',
                  caretColor: '#4ade80',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = '1px solid rgba(74,222,128,0.45)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(74,222,128,0.08)';
                  e.currentTarget.placeholder = 'Digite sua matrícula';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = '1px solid rgba(74,222,128,0.15)';
                  e.currentTarget.style.boxShadow = 'none';
                  if (!e.currentTarget.value) e.currentTarget.placeholder = 'Digite sua matrícula';
                }}
              />
            </div>
          </div>

          {/* Senha */}
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'rgba(134,239,172,0.7)' }}
            >
              Senha de Acesso
            </label>
            <div className="relative">
              <div
                className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"
                style={{ color: 'rgba(74,222,128,0.4)' }}
              >
                <Lock size={17} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                required
                className="w-full rounded-xl pl-10 pr-10 py-3 text-sm text-white transition-all outline-none"
                style={{
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid rgba(74,222,128,0.15)',
                  caretColor: '#4ade80',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = '1px solid rgba(74,222,128,0.45)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(74,222,128,0.08)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = '1px solid rgba(74,222,128,0.15)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center transition-colors"
                style={{ color: 'rgba(74,222,128,0.4)' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#4ade80')}
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = 'rgba(74,222,128,0.4)')
                }
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {/* Botão */}
          <button
            type="submit"
            disabled={loading}
            className="w-full font-semibold py-3 rounded-xl text-sm transition-all duration-150 flex items-center justify-center gap-2 mt-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            style={{
              background: loading
                ? 'rgba(22,101,52,0.6)'
                : 'linear-gradient(135deg, #166534 0%, #14532d 100%)',
              color: '#ffffff',
              boxShadow: '0 4px 20px rgba(20,83,45,0.4)',
              border: '1px solid rgba(74,222,128,0.2)',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                (e.currentTarget as HTMLElement).style.background =
                  'linear-gradient(135deg, #15803d 0%, #166534 100%)';
                (e.currentTarget as HTMLElement).style.boxShadow =
                  '0 6px 24px rgba(20,83,45,0.55)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                (e.currentTarget as HTMLElement).style.background =
                  'linear-gradient(135deg, #166534 0%, #14532d 100%)';
                (e.currentTarget as HTMLElement).style.boxShadow =
                  '0 4px 20px rgba(20,83,45,0.4)';
              }
            }}
          >
            {loading ? (
              <>
                <div
                  className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: '#4ade80', borderTopColor: 'transparent' }}
                />
                Validando Acesso...
              </>
            ) : (
              'Autenticar no Sistema'
            )}
          </button>
        </form>

        {/* Rodapé */}
        <div
          className="mt-8 pt-6 text-center"
          style={{ borderTop: '1px solid rgba(74,222,128,0.08)' }}
        >
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Novo na equipe operacional?{' '}
            <button
              onClick={() => router.push('/criar-adm')}
              className="font-semibold transition-colors"
              style={{ color: 'rgba(74,222,128,0.7)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#4ade80')}
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.color = 'rgba(74,222,128,0.7)')
              }
            >
              Cadastrar Administrador
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
