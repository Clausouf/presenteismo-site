'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Turma, Colaborador, DiarioPresenca } from '@/types/database.types';

// Garante que a página seja renderizada dinamicamente para evitar erro de build
export const dynamic = 'force-dynamic';

const STATUS_OPTIONS = [
  { value: '', label: '--' },
  { value: 'Presença', label: 'Presença' },
  { value: 'Folga', label: 'Folga' },
  { value: 'Falta Injustificada', label: 'Falta Injustificada' },
  { value: 'Falta Integração', label: 'Falta Integração' },
  { value: 'Desistência', label: 'Desistência' },
  { value: 'Desligamento a Pedido', label: 'Desligamento' },
  { value: 'Atestado', label: 'Atestado' }
];

function DiarioPresencaContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [operacoes, setOperacoes] = useState<any[]>([]);
  const [selectedOperacaoId, setSelectedOperacaoId] = useState<string>('todos');
  const [selectedTurma, setSelectedTurma] = useState<Turma | null>(null);
  
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [presencas, setPresencas] = useState<Record<string, DiarioPresenca>>({}); 
  const [datasLista, setDatasLista] = useState<string[]>([]);
  
  const [novaObs, setNovaObs] = useState('');
  const [historicoObs, setHistoricoObs] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadInitialData() {
      const [resTurmas, resOps] = await Promise.all([
        supabase.from('turmas').select('*'),
        supabase.from('operacoes').select('*')
      ]);
      if (resTurmas.data) setTurmas(resTurmas.data);
      if (resOps.data) setOperacoes(resOps.data);
      
      const queryNum = searchParams.get('turma');
      if (queryNum) carregarDadosTurma(queryNum);
    }
    loadInitialData();
  }, []);

  async function carregarDadosTurma(num: string) {
    setLoading(true);
    const { data: turma } = await supabase.from('turmas').select('*').eq('numero_turma', num).single();
    if (turma) {
      setSelectedTurma(turma);
      const datas = gerarArrayDatas(turma.data_inicio, turma.data_fim);
      setDatasLista(datas);
      
      const { data: colabs } = await supabase.from('colaboradores').select('*').eq('turma_numero', num);
      setColaboradores(colabs || []);
      
      const { data: regs } = await supabase.from('diario_presenca').select('*').eq('turma_numero', num);
      const mapa: Record<string, DiarioPresenca> = {};
      regs?.forEach(r => mapa[`${r.matricula}_${r.data}`] = r);
      setPresencas(mapa);

      const { data: obs } = await supabase.from('turma_observacoes').select('*').eq('turma_numero', num).order('created_at', { ascending: false });
      setHistoricoObs(obs || []);
    }
    setLoading(false);
  }

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

  const handleUpdatePresence = async (matricula: string, nome: string, dataStr: string, status: string) => {
    const chave = `${matricula}_${dataStr}`;
    if (status === '') {
      await supabase.from('diario_presenca').delete().eq('turma_numero', selectedTurma?.numero_turma).eq('matricula', matricula).eq('data', dataStr);
      setPresencas(prev => { const next = { ...prev }; delete next[chave]; return next; });
    } else {
      const { data } = await supabase.from('diario_presenca').upsert({
        turma_numero: selectedTurma?.numero_turma, matricula, colaborador_nome: nome, data: dataStr, tipo_registro: status
      }).select().single();
      if (data) setPresencas(prev => ({ ...prev, [chave]: data }));
    }
  };

  const handleSalvarObs = async () => {
    if (!novaObs.trim() || !selectedTurma) return;
    const { data } = await supabase.from('turma_observacoes').insert({
      turma_numero: selectedTurma.numero_turma, texto: novaObs
    }).select().single();
    if (data) {
      setHistoricoObs([data, ...historicoObs]);
      setNovaObs('');
    }
  };

  const calcularIndicadores = (dataStr: string) => {
    const registrosDoDia = colaboradores.map(c => presencas[`${c.matricula}_${dataStr}`]?.tipo_registro);
    const total = colaboradores.length;
    if (total === 0) return { absPercent: "0", desligamentosPercent: "0" };
    const faltas = registrosDoDia.filter(s => s === 'Falta Injustificada' || s === 'Falta Integração').length;
    const absPercent = ((faltas / total) * 100).toFixed(0);
    const desligamentos = registrosDoDia.filter(s => s === 'Desistência' || s === 'Desligamento a Pedido').length;
    const desligamentosPercent = ((desligamentos / total) * 100).toFixed(0);
    return { absPercent, desligamentosPercent };
  };

  const turmasFiltradas = selectedOperacaoId === 'todos' ? turmas : turmas.filter(t => t.operacao_id === Number(selectedOperacaoId));

  return (
    <div className="space-y-6 p-4">
      <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-lg border shadow-sm">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">OPERAÇÃO</label>
          <select className="w-full p-2 border rounded-lg text-sm" onChange={(e) => { setSelectedOperacaoId(e.target.value); setSelectedTurma(null); }}>
            <option value="todos">Todas as Operações</option>
            {operacoes.map(op => <option key={op.id} value={op.id}>{op.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">TURMA</label>
          <select value={selectedTurma?.numero_turma || ''} className="w-full p-2 border rounded-lg text-sm" onChange={(e) => { if (e.target.value) { carregarDadosTurma(e.target.value); router.replace(`/turmas?turma=${e.target.value}`); } }}>
            <option value="">Selecione uma turma...</option>
            {turmasFiltradas.map(t => <option key={t.numero_turma} value={t.numero_turma}>Turma {t.numero_turma} ({t.status})</option>)}
          </select>
        </div>
      </div>

      {selectedTurma && !loading && (
        <div className="space-y-4">
          <div className="overflow-x-auto bg-white rounded-lg border">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-100">
                  <th className="p-2 text-xs text-slate-600"></th>
                  <th colSpan={datasLista.length} className="text-center text-sm font-bold text-slate-800 p-2 uppercase">Turma {selectedTurma.numero_turma}</th>
                </tr>
                <tr>
                   <th className="p-2 text-[10px] text-slate-400">OPERADOR</th>
                   {datasLista.map((d, i) => (
                     <th key={d} className="text-center">
                        <div className="text-[9px] text-blue-600 font-bold uppercase">{i === 0 ? 'Integração' : (i >= datasLista.length - 3 ? 'Acomp.' : 'Treinamento')}</div>
                        <div className="text-xs">{d.split('-')[2]}</div>
                     </th>
                   ))}
                </tr>
              </thead>
              <tbody>
                {colaboradores.map(c => (
                  <tr key={c.matricula} className="border-t">
                    <td className="p-2 text-sm font-medium">{c.nome}</td>
                    {datasLista.map(d => (
                      <td key={d} className="p-1">
                        <select 
                          value={presencas[`${c.matricula}_${d}`]?.tipo_registro || ''} 
                          onChange={(e) => handleUpdatePresence(c.matricula, c.nome, d, e.target.value)}
                          className="w-full text-[10px] border rounded p-1"
                        >
                          {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td className="p-2 font-bold text-xs">ABS (%)</td>
                  {datasLista.map(d => { const { absPercent } = calcularIndicadores(d); return <td key={d} className="text-center text-xs font-bold text-rose-600">{absPercent}%</td> })}
                </tr>
                <tr>
                  <td className="p-2 font-bold text-xs text-slate-500">Deslig./Desist. (%)</td>
                  {datasLista.map(d => { const { desligamentosPercent } = calcularIndicadores(d); return <td key={d} className="text-center text-xs text-slate-600">{desligamentosPercent}%</td> })}
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <label className="block text-sm font-bold text-slate-700 mb-2">Adicionar Observação</label>
            <textarea 
              value={novaObs}
              onChange={(e) => setNovaObs(e.target.value)}
              className="w-full h-24 p-3 border rounded-lg text-sm mb-2"
              placeholder="Digite aqui observações..."
            />
            <button onClick={handleSalvarObs} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700">
              Salvar Observação
            </button>

            <div className="mt-6 space-y-2">
              <h3 className="font-bold text-sm text-slate-600">Histórico de Observações:</h3>
              {historicoObs.map((obs) => (
                <div key={obs.id} className="p-3 bg-slate-50 border rounded text-sm text-slate-700">
                  <span className="text-[10px] text-slate-400 block">{new Date(obs.created_at).toLocaleString()}</span>
                  {obs.texto}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DiarioPresencaPage() {
  return <Suspense fallback={<div>Carregando...</div>}><DiarioPresencaContent /></Suspense>;
}
