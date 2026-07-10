'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth'; // Importação necessária
import { UserPlus, User, CheckCircle2 } from 'lucide-react';
import { PerfilUsuario } from '@/types/database.types';

export default function CriarAdmPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth(); // Hook para verificar permissão
  
  // Estados de formulário
  const [nome, setNome] = useState('');
  const [matricula, setMatricula] = useState('');
  const [perfil, setPerfil] = useState<PerfilUsuario>('Recrutamento');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Estados operacionais
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  // Efeito de segurança: Redireciona se não for Gerente
  useEffect(() => {
    if (!authLoading && (!user || user.perfil !== 'Gerente')) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!nome || !matricula || !password || !confirmPassword) {
      setError('Preencha todos os campos da ficha cadastral.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      setLoading(false);
      return;
    }

    const emailGerado = `${matricula.trim()}@presenteismo.local`;

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: emailGerado,
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

      setTimeout(() => {
        router.push('/dashboard');
      }, 3000);

    } catch (err) {
      setError('Erro interno ao registrar perfil.');
      setLoading(false);
    }
  };

  // Enquanto verifica o acesso, exibe um carregamento neutro
  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">Verificando permissões...</div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-2xl">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white">Novo Perfil Administrativo</h2>
        </div>

        {success ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-6 rounded-xl flex flex-col items-center text-center gap-3">
            <CheckCircle2 size={32} />
            <h3 className="font-semibold text-white">Cadastro Efetuado!</h3>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-5">
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-4 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">Nome Completo</label>
              <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white" required />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">Matrícula</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500"><User size={18} /></div>
                <input type="text" value={matricula} onChange={(e) => setMatricula(e.target.value)} placeholder="Ex: 58501" className="w-full bg-slate-950/50 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white" required />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">Nível de Perfil</label>
              <select value={perfil} onChange={(e) => setPerfil(e.target.value as PerfilUsuario)} className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white">
                <option value="Recrutamento" className="bg-slate-900">Recrutamento e Seleção</option>
                <option value="Treinamento" className="bg-slate-900">Treinamento e Desenvolvimento</option>
                <option value="Gerente" className="bg-slate-900">Gerência Geral</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white" required />
              <input type="password" placeholder="Confirmar Senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white" required />
            </div>

            <button type="submit" className="w-full bg-blue-600 py-3 rounded-xl text-white font-medium" disabled={loading}>
              {loading ? 'Registrando...' : 'Salvar Administrador'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
