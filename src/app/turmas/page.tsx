'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

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

// --- COMPONENTE DA TURMA (Tabela + Observações) ---
function TabelaTurma({ turma, colaboradores, presencas, obsInicial, onUpdate }: any) {
  const [observacoes, setObservacoes] = useState(obsInicial || []);
  const [novaObs, setNovaObs] = useState('');
  
  const datas = gerarArrayDatas(turma.data_inicio, turma.data_fim);

  const handleSalvarObs = async () => {
    if (!novaObs.trim()) return;
    const { data } = await supabase.from('turma_observacoes').insert({
      turma_numero: turma.numero_turma, texto: novaObs
    }).select().single();
    
    if (data) {
      setObservacoes([data, ...observacoes]);
      setNovaObs('');
    }
  };

  return (
    <div className="mb-10 border rounded-lg bg-white shadow-sm overflow-hidden">
      <div className="p-4 bg-slate-50 border-b font-bold text-slate-800 text-lg">
        Turma {turma.numero_turma} - {turma.status}
      </div>
      
      {/* Tabela de Presença */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr>
              <th className="p-3 bg-white">OPERADOR</th>
              {datas.map((d, i) => (
                <th key={d} className="p-1 text-center min-w-[60px]">
                  <div className={`text-[9px] font-bold uppercase ${i === 0 ? 'text-blue-600' : (i >= datas.length - 3 ? 'text-orange-600' : 'text-slate-500')}`}>
                    {i === 0 ? 'Integração' : (i >= datas.length - 3 ? 'Acomp.' : 'Treinamento')}
                  </div>
                  <div className="text-xs">{d.split('-')[2]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {colaboradores.map((c: any) => (
              <tr key={c.matricula} className="border-t">
                <td className="p-3 font-medium text-slate-700">{c.nome}</td>
                {datas.map(d => (
                  <td key={d} className="p-1">
                    <select 
                      value={presencas[`${c.matricula}_${d}`]?.tipo_registro || ''} 
                      onChange={(e) => onUpdate(turma.numero_turma, c.matricula, c.nome, d, e.target.value)}
                      className="w-full border rounded text-[10px] p-1"
                    >
                      {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Observações */}
      <div className="p-4 bg-slate-50 border-t">
        <label className="block text-sm font-bold text-slate-700 mb-2">Adicionar Observação</label>
        <textarea 
          value={novaObs}
          onChange={(e) => setNovaObs(e.target.value)}
          className="w-full h-20 p-2 border rounded-lg text-sm"
          placeholder="Digite aqui..."
        />
        <button onClick={handleSalvarObs} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold mt-2 hover:bg-blue-700">
          Salvar Observação
        </button>

        <div className="mt-4 space-y-2">
          <h3 className="font-bold text-xs text-slate-500 uppercase">Histórico:</h3>
          {observacoes.map((obs: any) => (
            <div key={obs.id} className="p-2 bg-white border rounded text-xs text-slate-600 shadow-sm">
              <span className="text-[10px] text-slate-400 block">{new Date(obs.created_at).toLocaleString()}</span>
              {obs.texto}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- PÁGINA PRINCIPAL ---
export default function DiarioPresencaPage() {
  const [operacoes, setOperacoes] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [selectedOperacaoId, setSelectedOperacaoId] = useState<string>('todos');
  const [selectedTurmaNum, setSelectedTurmaNum] = useState<string>('');
  const [dadosDasTurmas, setDadosDasTurmas] = useState<Record<string, any>>({});

  useEffect(() => {
    async function init() {
      const { data: o } = await supabase.from('operacoes').select('*');
      const { data: t } = await supabase.from('turmas').select('*');
      if (o) setOperacoes(o);
      if (t) setTurmas(t);
    }
    init();
  }, []);

  useEffect(() => {
    async function carregarDados() {
      if (selectedOperacaoId === 'todos') {
        setDadosDasTurmas({});
        return;
      }

      const turmasDaOp = selectedTurmaNum 
        ? turmas.filter(t => t.numero_turma === selectedTurmaNum)
        : turmas.filter(t => t.operacao_id === Number(selectedOperacaoId));

      const novosDados: any = {};
      
      for (const t of turmasDaOp) {
        const [colabs, regs, obs] = await Promise.all([
          supabase.from('colaboradores').select('*').eq('turma_numero', t.numero_turma),
          supabase.from('diario_presenca').select('*').eq('turma_numero', t.numero_turma),
          supabase.from('turma_observacoes').select('*').eq('turma_numero', t.numero_turma).order('created_at', { ascending: false })
        ]);
        
        const mapaPresencas: any = {};
        regs.data?.forEach(r => mapaPresencas[`${r.matricula}_${r.data}`] = r);
        
        novosDados[t.numero_turma] = { colabs: colabs.data || [], presencas: mapaPresencas, obs: obs.data || [] };
      }
      setDadosDasTurmas(novosDados);
    }
    carregarDados();
  }, [selectedOperacaoId, selectedTurmaNum, turmas]);

  const handleUpdatePresence = async (turmaNum: string, matricula: string, nome: string, dataStr: string, status: string) => {
    if (status === '') await supabase.from('diario_presenca').delete().eq('turma_numero', turmaNum).eq('matricula', matricula).eq('data', dataStr);
    else await supabase.from('diario_presenca').upsert({ turma_numero: turmaNum, matricula, colaborador_nome: nome, data: dataStr, tipo_registro: status });
    
    setDadosDasTurmas(prev => {
        const newData = { ...prev };
        if (status === '') delete newData[turmaNum].presencas[`${matricula}_${dataStr}`];
        else newData[turmaNum].presencas[`${matricula}_${dataStr}`] = { ...newData[turmaNum].presencas[`${matricula}_${dataStr}`], tipo_registro: status };
        return { ...newData };
    });
  };

  const turmasFiltradas = selectedOperacaoId === 'todos' ? [] : turmas.filter(t => t.operacao_id === Number(selectedOperacaoId));

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-lg shadow">
        <div>
          <label className="block text-xs font-bold text-slate-500">OPERAÇÃO</label>
          <select className="w-full border p-2 rounded" onChange={(e) => { setSelectedOperacaoId(e.target.value); setSelectedTurmaNum(''); }}>
            <option value="todos">Selecione uma Operação...</option>
            {operacoes.map(op => <option key={op.id} value={op.id}>{op.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500">TURMA</label>
          <select className="w-full border p-2 rounded" value={selectedTurmaNum} onChange={(e) => setSelectedTurmaNum(e.target.value)}>
            <option value="">Todas as Turmas</option>
            {turmasFiltradas.map(t => <option key={t.numero_turma} value={t.numero_turma}>Turma {t.numero_turma}</option>)}
          </select>
        </div>
      </div>

      {selectedOperacaoId !== 'todos' && Object.keys(dadosDasTurmas).map(numTurma => {
        const turmaObj = turmas.find(t => t.numero_turma === numTurma);
        if (!turmaObj || !dadosDasTurmas[numTurma]) return null;
        
        return (
          <TabelaTurma 
            key={numTurma}
            turma={turmaObj}
            colaboradores={dadosDasTurmas[numTurma].colabs}
            presencas={dadosDasTurmas[numTurma].presencas}
            obsInicial={dadosDasTurmas[numTurma].obs}
            onUpdate={handleUpdatePresence}
          />
        );
      })}
    </div>
  );
}

function gerarArrayDatas(inicio: string, fim: string) {
  const arr = [];
  let d = new Date(inicio + 'T00:00:00');
  const f = new Date(fim + 'T00:00:00');
  while (d <= f) {
    arr.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return arr;
}
