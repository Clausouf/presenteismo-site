'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { BookOpen, Calendar, User, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, Info } from 'lucide-react';
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
  const [selectedTurmaNumero, setSelectedTurmaNumero] = useState<string>('');
  const [currentTurma, setCurrentTurma] = useState<Turma | null>(null);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [presencas, setPresencas] = useState<Record<string, DiarioPresenca>>({}); 

  const [datasLista, setDatasLista] = useState<string[]>([]);
  const [mobileActiveDate, setMobileActiveDate] = useState<string>('');
  const [loadingTurmas, setLoadingTurmas] = useState(true);
  const [loadingDiario, setLoadingDiario] = useState(false);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTurmas() {
      const { data } = await supabase.from('turmas').select('*').order('numero_turma');
      if (data) {
        setTurmas(data as Turma[]);
        const queryNum = searchParams.get('turma');
        if (queryNum) setSelectedTurmaNumero(queryNum);
        else if (data.length > 0) setSelectedTurmaNumero(data[0].numero_turma);
      }
      setLoadingTurmas(false);
    }
    fetchTurmas();
  }, [searchParams]);

  useEffect(() => {
    if (!selectedTurmaNumero) return;

    async function loadDiario() {
      setLoadingDiario(true);
      try {
        const { data: turma } = await supabase.from('turmas').select('*').eq('numero_turma', selectedTurmaNumero).single();
        if (!turma) return;
        setCurrentTurma(turma);

        const datas = gerarArrayDatas(turma.data_inicio, turma.data_fim);
        setDatasLista(datas);
        if (datas.length > 0) setMobileActiveDate(datas[0]);

        const { data: colabs } = await supabase.from('colaboradores').select('*').eq('turma_numero', selectedTurmaNumero).order('nome');
        setColaboradores(colabs || []);

        const { data: regs } = await supabase.from('diario_presenca').select('*').eq('turma_numero', selectedTurmaNumero);
        const mapa: Record<string, DiarioPresenca> = {};
        regs?.forEach(r => mapa[`${r.matricula}_${r.data}`] = r);
        setPresencas(mapa);
      } catch (err) { setError('Erro ao carregar dados.'); } finally { setLoadingDiario(false); }
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
    setSavingCell(chave);
    
    // .upsert() resolve tanto insert quanto update automaticamente com base na PK composta
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
    setTimeout(() => setSavingCell(null), 500);
  };

  if (loadingTurmas) return <div>Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white border p-6 rounded-xl flex justify-between">
        <h1 className="text-xl font-bold">Diário de Presença</h1>
        <select 
          value={selectedTurmaNumero} 
          onChange={(e) => {
            setSelectedTurmaNumero(e.target.value);
            router.replace(`/turmas?turma=${e.target.value}`);
          }}
          className="border rounded p-2"
        >
          {turmas.map(t => <option key={t.numero_turma} value={t.numero_turma}>Turma {t.numero_turma}</option>)}
        </select>
      </div>

      {loadingDiario ? <div>Carregando diário...</div> : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-3 w-64">Operador</th>
                {datasLista.map(d => <th key={d} className="p-2 text-center text-xs">{d.split('-')[2]}</th>)}
              </tr>
            </thead>
            <tbody>
              {colaboradores.map(c => (
                <tr key={c.matricula} className="border-b">
                  <td className="p-3 font-semibold">{c.nome}</td>
                  {datasLista.map(d => {
                    const chave = `${c.matricula}_${d}`;
                    const status = presencas[chave]?.tipo_registro || 'Presença';
                    return (
                      <td key={d} className="p-1">
                        <select 
                          value={status} 
                          onChange={(e) => handleUpdatePresence(c.matricula, c.nome, d, e.target.value as TipoRegistroDiario)}
                          className={`w-full p-1 rounded text-[10px] ${STATUS_COLORS[status]?.bg} ${STATUS_COLORS[status]?.text}`}
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
      )}
    </div>
  );
}

export default function DiarioPresencaPage() {
  return <Suspense fallback={<div>Carregando...</div>}><DiarioPresencaContent /></Suspense>;
}
