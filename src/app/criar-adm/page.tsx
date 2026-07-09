'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { UserPlus, User, Mail, Lock, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { PerfilUsuario } from '@/types/database.types';

export default function CriarAdmPage() {
  const router = useRouter();
  
  // Estados de formulário
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [perfil, setPerfil] = useState<PerfilUsuario>('Recrutamento');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Estados operacionais
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validações Básicas Frontend
    if (!nome || !email || !password || !confirmPassword) {
      setError('Preencha todos os campos da ficha cadastral.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas digitadas não coincidem. Ajuste e tente novamente.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Para sua segurança, a senha deve conter no mínimo 6 dígitos.');
      setLoading(false);
      return;
    }

    try {
      // Cria a autenticação injetando no user_metadata os dados que o trigger SQL espera
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nome: nome.trim(),
            perfil: perfil,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);

      // Aguarda 3 segundos exibindo a mensagem visual de sucesso e envia ao login
      setTimeout(() => {
        router.push('/login');
      }, 3000);

    } catch (err) {
      setError('Erro interno de processamento ao registrar perfil.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.06),transparent_45%)]" />

      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-2xl">
        
        {/* Título de Cabeçalho */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600/10 border border-blue-500/20 text-blue-500 rounded-xl mb-4">
            <UserPlus size={22} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Novo Perfil Administrativo</h2>
          <p className="text-sm text-slate-400 mt-1.5">Crie acessos para a equipe técnica de gerenciamento</p>
        </div>

        {/* Feedback Visual de Sucesso */}
        {success ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-6 rounded-xl flex flex-col items-center text-center gap-3 animate-fadeIn">
            <CheckCircle2 size={32} className="text-emerald-400" />
            <h3 className="font-semibold text-lg text-white">Cadastro Efetuado!</h3>
            <p className="text-sm text-slate-400 max-w-xs">
              As diretrizes e permissões de segurança foram salvas. Redirecionando para a tela de login...
            </p>
          </div>
        ) : (
          /* Formulário de Cadastro Ativo */
          <form onSubmit={handleRegister} className="space-y-5">
            
            {error && (
              <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 p-4 rounded-xl text-sm animate-fadeIn">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Nome Completo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: João Silva Santos"
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                E-mail Corporativo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="joao.silva@empresa.com"
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Nível de Perfil (Acesso RLS)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <ShieldCheck size={18} />
                </div>
                <select
                  value={perfil}
                  onChange={(e) => setPerfil(e.target.value as PerfilUsuario)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all appearance-none cursor-pointer"
                  disabled={loading}
                >
                  <option value="Recrutamento" className="bg-slate-900">Recrutamento e Seleção (R&S)</option>
                  <option value="Treinamento" className="bg-slate-900">Treinamento e Desenvolvimento (T&D)</option>
                  <option value="Gerente" className="bg-slate-900">Gerência Geral</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-500 text-xs">
                  ▼
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Senha
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                    disabled={loading}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="w-full sm:w-1/3 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/40 font-medium py-3 rounded-xl text-sm transition-colors"
                disabled={loading}
              >
                Voltar
              </button>
              
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-2/3 bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl text-sm shadow-lg shadow-blue-600/10 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Registrando...
                  </>
                ) : (
                  'Salvar Administrador'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
