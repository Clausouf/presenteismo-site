'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const STATUS_OPTIONS = [
  { value: '', label: '--' },
  { value: 'Presença', label: 'Presença' },
  { value: 'Folga', label: 'Folga' },
  { value: 'Falta Injustificada', label: 'Falta Injustificada' },
  { value: 'Desistência', label: 'Desistência' },
  { value: 'Desligamento a Pedido', label: 'Desligamento' },
  { value: 'Atestado', label: 'Atestado' }
];

// --- COMPONENTE DE TABELA (REUTILIZÁVEL) ---
function TabelaTurma({ turma, colaboradores, presencas, onUpdate, onSaveObs }: any) {
  const [novaObs, setNovaObs] = useState('');
  
  const datas = gerarArrayDatas(turma.data_inicio, turma.data_fim);

  const calcularIndicadores = (dataStr: string) => {
    const registrosDoDia = colaboradores.map((c: any) => presencas[`${c.matricula}_${dataStr}`]?.tipo_registro);
    const total = colaboradores.length;
    if (total === 0) return { absPercent: "0", desligamentosPercent: "0" };
    const faltas = registrosDoDia.filter((s: string) => s === 'Falta Injustificada' || s === 'Falta Integração').length;
    return { 
      absPercent: ((faltas / total) * 100).toFixed(0),
      desligamentosPercent: ((registrosDoDia.filter((s: string) => s === 'Desistência' || s === 'Desligamento a Pedido').length / total) * 100).toFixed(0)
    };
  };

  return (
    <div className="mb-8 border rounded-lg bg-white shadow-sm overflow-hidden">
      <div className="p-3 bg-slate-50 border-b font-bold text-slate-700">Turma {turma.numero_turma} - {turma.status}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr>
              <th className="p-2">OPERADOR</th>
              {datas.map(d => <th key={d} className="p-1 text-center">{d.split('-')[2]}</th>)}
            </tr>
          </thead>
          <tbody>
            {colaboradores.map((c: any) => (
              <tr key={c.matricula} className="border-t">
                <td className="p-2 font-medium">{c.nome}</td>
                {datas.map(d => (
                  <td key={d} className="p-1">
                    <select 
                      value={presencas[`${c.matricula}_${d}`]?.tipo_registro || ''} 
                      onChange={(e) => onUpdate(turma.numero_turma, c.matricula, c.nome, d, e.target.value)}
                      className="w-full border rounded text-[10px]"
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
    </div>
  );
}

// --- PÁGINA PRINCIPAL ---
export default function DiarioPresencaPage() {
  const [operacoes, setOperacoes] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  
  const [selectedOperacaoId, setSelectedOperacaoId] = useState<string>('todos');
  const [selectedTurmaNum, setSelectedTurmaNum] = useState<string>('');
  
  // Dados centralizados por turma: { 'numTurma': { colabs: [], presencas: {} } }
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

  // Quando muda operação ou turma, buscamos os dados necessários
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
        const { data: colabs } = await supabase.from('colaboradores').select('*').eq('turma_numero', t.numero_turma);
        const { data: regs } = await supabase.from('diario_presenca').select('*').eq('turma_numero', t.numero_turma);
        
        const mapaPresencas: any = {};
        regs?.forEach(r => mapaPresencas[`${r.matricula}_${r.data}`] = r);
        
        novosDados[t.numero_turma] = { colabs: colabs || [], presencas: mapaPresencas };
      }
      setDadosDasTurmas(novosDados);
    }
    carregarDados();
  }, [selectedOperacaoId, selectedTurmaNum, turmas]);

  const handleUpdatePresence = async (turmaNum: string, matricula: string, nome: string, dataStr: string, status: string) => {
    // Atualiza no banco
    if (status === '') await supabase.from('diario_presenca').delete().eq('turma_numero', turmaNum).eq('matricula', matricula).eq('data', dataStr);
    else await supabase.from('diario_presenca').upsert({ turma_numero: turmaNum, matricula, colaborador_nome: nome, data: dataStr, tipo_registro: status });
    
    // Atualiza o estado local
    setDadosDasTurmas(prev => {
        const newData = { ...prev };
        if (status === '') delete newData[turmaNum].presencas[`${matricula}_${dataStr}`];
        else newData[turmaNum].presencas[`${matricula}_${dataStr}`] = { ...newData[turmaNum].presencas[`${matricula}_${dataStr}`], tipo_registro: status };
        return newData;
    });
  };

  const turmasFiltradas = selectedOperacaoId === 'todos' 
    ? [] 
    : turmas.filter(t => t.operacao_id === Number(selectedOperacaoId));

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

      {/* Renderização das tabelas */}
      {selectedOperacaoId !== 'todos' && Object.keys(dadosDasTurmas).map(numTurma => {
        const turmaObj = turmas.find(t => t.numero_turma === numTurma);
        if (!turmaObj || !dadosDasTurmas[numTurma]) return null;
        
        return (
          <TabelaTurma 
            key={numTurma}
            turma={turmaObj}
            colaboradores={dadosDasTurmas[numTurma].colabs}
            presencas={dadosDasTurmas[numTurma].presencas}
            onUpdate={handleUpdatePresence}
          />
        );
      })}
    </div>
  );
}

// Utilitário fora do componente
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
