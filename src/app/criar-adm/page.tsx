'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { UserPlus, User, CheckCircle2 } from 'lucide-react';
import { PerfilUsuario } from '@/types/database.types';

export default function CriarAdmPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [nome, setNome] = useState('');
  const [matricula, setMatricula] = useState('');
  const [perfil, setPerfil] = useState<PerfilUsuario>('Recrutamento');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  // CORREÇÃO: Só redireciona quando o carregamento (authLoading) terminar
  useEffect(() => {
    if (!authLoading) {
      if (!user || user.perfil?.toLowerCase() !== 'gerente') {
        router.replace('/dashboard');
      }
    }
  }, [user, authLoading, router]);

  // Se estiver carregando, mostra uma tela vazia ou um loader para não redirecionar incorretamente
  if (authLoading) return <div className="min-h-screen bg-slate-950" />;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      setLoading(false);
      return;
    }

    const emailGerado = `${matricula.trim()}@presenteismo.local`;

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: emailGerado,
        password,
        options: { data: { nome: nome.trim(), perfil: perfil } },
      });

      if (signUpError) throw signUpError;
      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-6">Novo Administrador</h2>
        
        {success ? (
          <div className="text-emerald-400 text-center">Cadastro realizado com sucesso!</div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            {error && <div className="text-rose-400 text-sm">{error}</div>}
            
            <input type="text" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-lg text-white" required />
            <input type="text" placeholder="Matrícula" value={matricula} onChange={(e) => setMatricula(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-lg text-white" required />
            
            <select value={perfil} onChange={(e) => setPerfil(e.target.value as PerfilUsuario)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-lg text-white">
              <option value="Recrutamento">Recrutamento</option>
              <option value="Treinamento">Treinamento</option>
              <option value="Gerente">Gerente</option>
            </select>

            <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-lg text-white" required />
            <input type="password" placeholder="Confirmar Senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-lg text-white" required />
            
            <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-lg" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
