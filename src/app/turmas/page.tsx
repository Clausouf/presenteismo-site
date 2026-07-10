'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Turma, Colaborador, DiarioPresenca, TipoRegistroDiario } from '@/types/database.types';

const STATUS_OPTIONS: TipoRegistroDiario[] = [
  'Presença', 'Falta Injustificada', 'Falta Integração', 'Desistência', 
  'Desligamento a Pedido', 'Atestado', 'Observação'
];

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Presença': { bg: 'bg-emerald-500/10', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Falta Injustificada': { bg: 'bg-rose-500/10', text: 'text-rose-700', border: 'border-rose-200' },
  'Atestado': { bg: 'bg-amber-500/10', text: 'text-amber-700', border: 'border-amber-200' },
  'Falta Integração': { bg: 'bg-violet-500/10', text: 'text-violet-700', border: 'border-violet-200' },
  'Desistência': { bg: 'bg-orange-500/10', text: 'text-orange-700', border: 'border-orange-200' },
  'Desligamento a Pedido': { bg: 'bg-slate-500/10', text: 'text-slate-700', border: 'border-slate-300' },
  'Observação': { bg: 'bg-sky-500/10', text: 'text-sky-700', border: 'border-sky-200' }
};

function DiarioPresencaContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [operacoes, setOperacoes] = useState<any[]>([]); // Adicionado
  const [selectedOperacaoId, setSelectedOperacaoId] = useState<string>('todos'); // Filtro Op
  const [selectedTurmaNumero, setSelectedTurmaNumero] = useState<string>('');
  
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [presencas, setPresencas] = useState<Record<string, DiarioPresenca>>({}); 
  const [datasLista, setDatasLista] = useState<string[]>([]);
  
  const [loadingTurmas, setLoadingTurmas] = useState(true);
  const [loadingDiario, setLoadingDiario] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Carrega Turmas e Operações
  useEffect(() => {
    async function fetchData() {
      setLoadingTurmas(true);
      const [resTurmas, resOps] = await Promise.all([
        supabase.from('turmas').select('*').order('numero_turma'),
        supabase.from('operacoes').select('*')
      ]);
      
      if (resTurmas.data) setTurmas(resTurmas.data as Turma[]);
      if (resOps.data) setOperacoes(resOps.data);
      
      const queryNum = searchParams.get('turma');
      if (queryNum) setSelectedTurmaNumero(queryNum);
      
      setLoadingTurmas(false);
    }
    fetchData();
  }, []);

  // 2. Carrega Diário quando seleciona turma
  useEffect(() => {
    if (!selectedTurmaNumero) return;

    async function loadDiario() {
      setLoadingDiario(true);
      setError(null);
      try {
        const { data: turma } = await supabase.from('turmas').select('*').eq('numero_turma', selectedTurmaNumero).single();
        if (!turma) return;

        const datas = gerarArrayDatas(turma.data_inicio, turma.data_fim);
        setDatasLista(datas);

        const { data: colabs } = await supabase.from('colaboradores').select('*').eq('turma_numero', selectedTurmaNumero).order('nome');
        setColaboradores(colabs || []);

        const { data: regs } = await supabase.from('diario_presenca').select('*').eq('turma_numero', selectedTurmaNumero);
        const mapa: Record<string, DiarioPresenca> = {};
        regs?.forEach(r => mapa[`${r.matricula}_${r.data}`] = r);
        setPresencas(mapa);
      } catch (err) { setError('Erro ao carregar dados do diário.'); } finally { setLoadingDiario(false); }
    }
    loadDiario();
  }, [selectedTurmaNumero]);

  const gerarArrayDatas = (inicio: string, fim: string) => {
    const arr = [];
    let d = new Date(inicio + 'T00:00:00');
    const f = new Date(fim + 'T00:00:00');
    while (d <= f) {
      arr.push(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + 1);
    }
    return arr;
  };

  const handleUpdatePresence = async (matricula: string, nome: string, dataStr: string, novoStatus: TipoRegistroDiario) => {
    const chave = `${matricula}_${dataStr}`;
    const { data, error } = await supabase
      .from('diario_presenca')
      .upsert({
        turma_numero: selectedTurmaNumero,
        matricula: matricula,
        colaborador_nome: nome,
        data: dataStr,
        tipo_registro: novoStatus
      })
      .select()
      .single();

    if (!error && data) {
      setPresencas(prev => ({ ...prev, [chave]: data }));
    }
  };

  // Filtragem das turmas baseado na operação escolhida
  const turmasFiltradas = selectedOperacaoId === 'todos' 
    ? turmas 
    : turmas.filter(t => t.operacao_id === Number(selectedOperacaoId));

  if (loadingTurmas) return <div className="p-8 text-center">Carregando dados...</div>;

  return (
    <div className="space-y-6">
      {/* Cabeçalho com Filtros */}
      <div className="bg-white border p-6 rounded-xl shadow-sm space-y-4">
        <h1 className="text-xl font-bold text-slate-900">Diário de Presença</h1>
        
        <div className="flex gap-4">
          {/* Filtro Operação */}
          <div className="flex-1">
             <label className="block text-xs font-bold text-slate-500 mb-1">FILTRAR POR OPERAÇÃO</label>
             <select 
               className="w-full border border-slate-300 rounded-lg p-2 text-sm"
               value={selectedOperacaoId}
               onChange={(e) => {
                 setSelectedOperacaoId(e.target.value);
                 setSelectedTurmaNumero(''); // Reseta a turma ao mudar op
               }}
             >
               <option value="todos">Todas as Operações</option>
               {operacoes.map(op => <option key={op.id} value={op.id}>{op.nome}</option>)}
             </select>
          </div>

          {/* Filtro Turma */}
          <div className="flex-1">
             <label className="block text-xs font-bold text-slate-500 mb-1">SELECIONAR TURMA</label>
             <select 
               value={selectedTurmaNumero} 
               onChange={(e) => {
                 setSelectedTurmaNumero(e.target.value);
                 router.replace(`/turmas?turma=${e.target.value}`);
               }}
               className="w-full border border-slate-300 rounded-lg p-2 text-sm"
             >
               <option value="">Selecione uma turma...</option>
               {turmasFiltradas.map(t => <option key={t.numero_turma} value={t.numero_turma}>Turma {t.numero_turma} ({t.status})</option>)}
             </select>
          </div>
        </div>
      </div>

      {/* Tabela de Diário */}
      {selectedTurmaNumero && (loadingDiario ? <div className="p-10 text-center text-slate-400">Carregando registros...</div> : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-200">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 w-64 text-xs font-bold uppercase text-slate-500">Operador</th>
                {datasLista.map(d => <th key={d} className="p-2 text-center text-xs font-bold text-slate-500">{d.split('-')[2]}</th>)}
              </tr>
            </thead>
            <tbody>
              {colaboradores.map(c => (
                <tr key={c.matricula} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3 text-sm font-semibold text-slate-800">{c.nome}</td>
                  {datasLista.map(d => {
                    const chave = `${c.matricula}_${d}`;
                    const status = presencas[chave]?.tipo_registro || 'Presença';
                    return (
                      <td key={d} className="p-1">
                        <select 
                          value={status} 
                          onChange={(e) => handleUpdatePresence(c.matricula, c.nome, d, e.target.value as TipoRegistroDiario)}
                          className={`w-full p-1.5 rounded text-[10px] font-bold ${STATUS_COLORS[status]?.bg} ${STATUS_COLORS[status]?.text}`}
                        >
                          {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export default function DiarioPresencaPage() {
  return <Suspense fallback={<div>Carregando...</div>}><DiarioPresencaContent /></Suspense>;
}
