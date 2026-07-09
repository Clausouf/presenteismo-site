'use client';

export const runtime = 'edge';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { Trash2 } from 'lucide-react';

interface NovoColaboradorItem {
  matricula: string;
  nome: string;
  cpf: string;
  data_admissao: string;
  jornada: string;
  grupo_30_horas: boolean;
}

export default function CadastroTurmaPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [equipe, setEquipe] = useState<any[]>([]);
  const [operacoes, setOperacoes] = useState<any[]>([]);

  const [numeroTurma, setNumeroTurma] = useState('');
  const [operacaoNome, setOperacaoNome] = useState(''); // Alterado para string conforme nova tabela
  const [responsavelMatricula, setResponsavelMatricula] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataAlo, setDataAlo] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [horario, setHorario] = useState('');
  const [sala, setSala] = useState('');

  const [colaboradores, setColaboradores] = useState<NovoColaboradorItem[]>([]);
  const [excelPasteText, setExcelPasteText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [resEquipe, resOps] = await Promise.all([
          supabase.from('equipe').select('*'),
          supabase.from('operacoes').select('*')
        ]);
        if (resEquipe.data) setEquipe(resEquipe.data);
        if (resOps.data) setOperacoes(resOps.data);
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, []);

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Inserir a Turma
      const { error: errorTurma } = await supabase
        .from('turmas')
        .insert({
          numero_turma: numeroTurma.trim(),
          responsavel_matricula: responsavelMatricula,
          operacao_nome: operacaoNome,
          data_inicio: dataInicio,
          data_alo: dataAlo,
          data_fim: dataFim,
          horario: horario,
          sala: sala,
          status: 'Em Andamento'
        });

      if (errorTurma) throw errorTurma;

      // 2. Inserir os Colaboradores vinculados ao numero_turma
      const loteInclusao = colaboradores.map((c) => ({
        turma_numero: numeroTurma.trim(), // Link via FK
        matricula: c.matricula.trim(),
        nome: c.nome.trim(),
        cpf: c.cpf.replace(/\D/g, ''),
        data_admissao: c.data_admissao,
        jornada: c.jornada,
        grupo_30_horas: c.grupo_30_horas,
        status: 'Ativo'
      }));

      const { error: errorColaboradores } = await supabase.from('colaboradores').insert(loteInclusao);
      if (errorColaboradores) throw errorColaboradores;

      setSuccess(true);
    } catch (err: any) {
      setError(`Erro ao salvar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) return <div className="p-10 text-center">Carregando...</div>;

  if (success) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center">
        <h2 className="text-2xl font-bold">Turma Cadastrada com Sucesso!</h2>
        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">Nova Turma</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Criação de Turmas</h1>
      {error && <div className="p-4 bg-rose-50 text-rose-700 rounded-lg">{error}</div>}
      <form onSubmit={handleSaveAll} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white p-6 rounded-xl border space-y-4">
          <label className="block text-sm font-bold">Número da Turma *</label>
          <input type="text" value={numeroTurma} onChange={(e) => setNumeroTurma(e.target.value)} className="w-full border rounded p-2" required />
          
          <label className="block text-sm font-bold">Responsável *</label>
          <select value={responsavelMatricula} onChange={(e) => setResponsavelMatricula(e.target.value)} className="w-full border rounded p-2" required>
            <option value="">Selecione...</option>
            {equipe.map((membro) => <option key={membro.matricula} value={membro.matricula}>{membro.nome} ({membro.cargo})</option>)}
          </select>

          <label className="block text-sm font-bold">Operação *</label>
          <input type="text" value={operacaoNome} onChange={(e) => setOperacaoNome(e.target.value)} className="w-full border rounded p-2" required />

          <label className="block text-sm font-bold">Data Início</label>
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-full border rounded p-2" />
          
          <label className="block text-sm font-bold">Data 1º Alo</label>
          <input type="date" value={dataAlo} onChange={(e) => setDataAlo(e.target.value)} className="w-full border rounded p-2" />

          <label className="block text-sm font-bold">Sala</label>
          <input type="text" value={sala} onChange={(e) => setSala(e.target.value)} className="w-full border rounded p-2" />
        </div>

        <div className="lg:col-span-2 space-y-4">
           {/* ... manter a lógica de colaboradores conforme estava ... */}
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold">
            {loading ? 'Salvando...' : 'Salvar Turma'}
          </button>
        </div>
      </form>
    </div>
  );
}
