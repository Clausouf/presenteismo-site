'use client';

export const runtime = 'edge';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { 
  PlusCircle, 
  Users, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  Table, 
  HelpCircle
} from 'lucide-react';
import { Operacao, Analista, Instrutor } from '@/types/database.types';

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

  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [analistas, setAnalistas] = useState<Analista[]>([]);
  const [instrutores, setInstrutores] = useState<Instrutor[]>([]);

  const [numeroTurma, setNumeroTurma] = useState('');
  const [operacaoId, setOperacaoId] = useState('');
  const [analistaId, setAnalistaId] = useState('');
  const [instrutorId, setInstrutorId] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [diasTreinamento, setDiasTreinamento] = useState(12);
  const [diasAlo, setDiasAlo] = useState(3);

  const [colaboradores, setColaboradores] = useState<NovoColaboradorItem[]>([]);
  const [excelPasteText, setExcelPasteText] = useState('');
  const [showPasteHelper, setShowPasteHelper] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successTurmaId, setSuccessTurmaId] = useState<string | null>(null);

  useEffect(() => {
    async function loadSelectData() {
      try {
        const [resOps, resAnas, resInsts] = await Promise.all([
          supabase.from('operacoes').select('*').order('nome'),
          supabase.from('analistas').select('*').eq('status', 'Ativo').order('nome'),
          supabase.from('instrutores').select('*').eq('status', 'Ativo').order('nome')
        ]);

        if (resOps.data) setOperacoes(resOps.data as Operacao[]);
        if (resAnas.data) setAnalistas(resAnas.data as Analista[]);
        if (resInsts.data) setInstrutores(resInsts.data as Instrutor[]);
      } catch (err) {
        console.error('Erro ao carregar seletores:', err);
      } finally {
        setLoadingData(false);
      }
    }
    loadSelectData();
  }, []);

  const handleProcessExcelPaste = () => {
    if (!excelPasteText.trim()) return;
    const linhas = excelPasteText.split('\n');
    const novosColaboradores: NovoColaboradorItem[] = [];

    linhas.forEach((linha) => {
      if (!linha.trim()) return;
      const colunas = linha.split('\t');
      const matricula = colunas[0]?.trim() || '';
      const nome = colunas[1]?.trim() || '';
      const cpf = colunas[2]?.trim() || '';
      const data_admissao = colunas[3]?.trim() || '';
      const jornada = colunas[4]?.trim() || 'Ope Seg-Sab';
      const is30hRaw = colunas[5]?.toLowerCase().trim() || 'n';
      const grupo_30_horas = is30hRaw === 's' || is30hRaw === 'sim' || is30hRaw === 'y' || is30hRaw === 'true';

      if (matricula && nome) {
        novosColaboradores.push({
          matricula,
          nome,
          cpf: formatCPF(cpf),
          data_admissao: formatDateForInput(data_admissao),
          jornada,
          grupo_30_horas
        });
      }
    });

    if (novosColaboradores.length > 0) {
      setColaboradores([...colaboradores, ...novosColaboradores]);
      setExcelPasteText('');
      setError(null);
    } else {
      setError('Não conseguimos identificar colunas válidas.');
    }
  };

  const formatCPF = (rawCpf: string) => {
    const clean = rawCpf.replace(/\D/g, '');
    if (clean.length !== 11) return clean;
    return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
  };

  const formatDateForInput = (rawDate: string) => {
    if (!rawDate) return '';
    const parts = rawDate.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    return rawDate;
  };

  const handleRemoveColaborador = (index: number) => {
    setColaboradores(colaboradores.filter((_, idx) => idx !== index));
  };

  const handleAddColaboradorManual = () => {
    setColaboradores([...colaboradores, { matricula: '', nome: '', cpf: '', data_admissao: dataInicio || '', jornada: 'Ope Seg-Sab 13:50 - 20:10', grupo_30_horas: false }]);
  };

  const handleUpdateColaboradorRow = (index: number, field: keyof NovoColaboradorItem, val: any) => {
    const updated = [...colaboradores];
    updated[index] = { ...updated[index], [field]: val };
    setColaboradores(updated);
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!numeroTurma || !operacaoId || !analistaId || !instrutorId || !dataInicio || !dataFim) {
      setError('Por favor, preencha todas as informações cadastrais.');
      setLoading(false);
      return;
    }

    try {
      const { data: turmaCriada, error: errorTurma } = await supabase
        .from('turmas')
        .insert({
          numero_turma: numeroTurma.trim(),
          operacao_id: operacaoId,
          analista_id: analistaId,
          instrutor_id: instrutorId,
          data_inicio: dataInicio,
          data_fim: dataFim,
          dias_treinamento: diasTreinamento,
          dias_alo: diasAlo,
          status: 'Em Andamento',
          user_criador: user?.id || null
        })
        .select()
        .single();

      if (errorTurma) throw errorTurma;

      const loteInclusao = colaboradores.map((c) => ({
        turma_id: turmaCriada.id,
        matricula: c.matricula.trim(),
        nome: c.nome.trim(),
        cpf: c.cpf.replace(/\D/g, ''),
        data_admissao: c.data_admissao,
        jornada: c.jornada,
        grupo_30_horas: c.grupo_30_horas,
        status: 'Ativo'
      }));

      const { error: errorColaboradores } = await supabase.from('colaboradores').insert(loteInclusao);
      if (errorColaboradores) {
        await supabase.from('turmas').delete().eq('id', turmaCriada.id);
        throw errorColaboradores;
      }

      setSuccessTurmaId(turmaCriada.id);
    } catch (err: any) {
      setError(`Erro ao salvar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) return <div className="flex justify-center p-10">Carregando...</div>;

  if (successTurmaId) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center">
        <h2 className="text-2xl font-bold text-slate-900">Turma Cadastrada!</h2>
        <button onClick={() => { setSuccessTurmaId(null); setNumeroTurma(''); setColaboradores([]); }} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">Cadastrar Nova</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Criação de Turmas</h1>
      {error && <div className="p-4 bg-rose-50 text-rose-700 rounded-lg">{error}</div>}
      <form onSubmit={handleSaveAll} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white p-6 rounded-xl border">
          <label className="block text-sm font-bold mb-1">Número da Turma *</label>
          <input type="text" value={numeroTurma} onChange={(e) => setNumeroTurma(e.target.value)} className="w-full border rounded p-2 mb-4" required />
          
          <label className="block text-sm font-bold mb-1">Operação / Conta *</label>
          <select value={operacaoId} onChange={(e) => setOperacaoId(e.target.value)} className="w-full border rounded p-2 mb-4" required>
            <option value="">Selecione...</option>
            {operacoes.map((op) => <option key={op.id} value={op.id}>{op.nome}</option>)}
          </select>
          
          <label className="block text-sm font-bold mb-1">Analista *</label>
          <select value={analistaId} onChange={(e) => setAnalistaId(e.target.value)} className="w-full border rounded p-2 mb-4" required>
             <option value="">Selecione...</option>
             {analistas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>

          <label className="block text-sm font-bold mb-1">Instrutor *</label>
          <select value={instrutorId} onChange={(e) => setInstrutorId(e.target.value)} className="w-full border rounded p-2 mb-4" required>
             <option value="">Selecione...</option>
             {instrutores.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
          </select>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-6 rounded-xl border">
             <h2 className="font-semibold mb-4">Lista de Operadores</h2>
             <button type="button" onClick={handleAddColaboradorManual} className="mb-4 text-sm bg-slate-100 p-2 rounded">+ Adicionar Manual</button>
             <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead><tr><th>Matrícula</th><th>Nome</th><th>Ação</th></tr></thead>
                    <tbody>
                        {colaboradores.map((col, idx) => (
                           <tr key={idx}>
                              <td><input type="text" value={col.matricula} onChange={(e) => handleUpdateColaboradorRow(idx, 'matricula', e.target.value)} className="w-full border p-1" /></td>
                              <td><input type="text" value={col.nome} onChange={(e) => handleUpdateColaboradorRow(idx, 'nome', e.target.value)} className="w-full border p-1" /></td>
                              <td><button type="button" onClick={() => handleRemoveColaborador(idx)} className="text-red-500"><Trash2 size={16} /></button></td>
                           </tr>
                        ))}
                    </tbody>
                </table>
             </div>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold">
            {loading ? 'Salvando...' : 'Salvar Turma'}
          </button>
        </div>
      </form>
    </div>
  );
}
