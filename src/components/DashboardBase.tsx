'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function DashboardBase({ tipo }: { tipo: 'treinamento' | 'recrutamento' }) {
  const [loading, setLoading] = useState(true);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [colabs, setColabs] = useState<any[]>([]);
  const [diario, setDiario] = useState<any[]>([]);
  const [salas, setSalas] = useState<any[]>([]);
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  const [selectedOp, setSelectedOp] = useState('Todas');
  const [selectedTurma, setSelectedTurma] = useState('Todas');

  useEffect(() => {
    async function carregarDados() {
      setLoading(true);
      const [t, c, d, s] = await Promise.all([
        supabase.from('turmas').select('*, operacoes(nome)'),
        supabase.from('colaboradores').select('*'),
        supabase.from('diario_presenca').select('*'),
        supabase.from('salas').select('*')
      ]);
      if (t.data) setTurmas(t.data);
      if (c.data) setColabs(c.data);
      if (d.data) setDiario(d.data);
      if (s.data) setSalas(s.data);
      setLoading(false);
    }
    carregarDados();
  }, []);

  const data = useMemo(() => {
    if (loading) return null;

    const [year, month] = selectedMonth.split('-').map(Number);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    const normalizar = (s: string) => s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim();
    
    // Filtragem Básica de UI (Op e Turma)
    const basePool = colabs.filter(c => {
        const turma = turmas.find(t => t.numero_turma === c.numero_turma);
        if (!turma) return false;
        const opMatch = selectedOp === 'Todas' || turma.operacoes?.nome === selectedOp;
        const turmaMatch = selectedTurma === 'Todas' || c.numero_turma === selectedTurma;
        return opMatch && turmaMatch;
    });

    // Classificação por Tipo
    const poolFinal = basePool.filter(c => {
        const logs = diario.filter(l => l.colaborador_id === c.id && new Date(l.data) >= startOfMonth && new Date(l.data) <= endOfMonth);
        const types = logs.map(l => normalizar(l.tipo_registro));
        const hasPresenca = types.some(t => ['presente', 'presenca', 'acompanhamento'].includes(t));
        
        return tipo === 'treinamento' ? hasPresenca : !hasPresenca;
    });

    let absCount = 0;
    let toCount = 0;

    if (tipo === 'recrutamento') {
        poolFinal.forEach(c => {
            const logs = diario.filter(l => l.colaborador_id === c.id && new Date(l.data) >= startOfMonth && new Date(l.data) <= endOfMonth);
            const types = logs.map(l => normalizar(l.tipo_registro));
            
            const hasFaltaInt = types.includes('falta integracao');
            const hasFaltaInj = types.includes('falta injustificada');
            const hasDeslig = types.some(t => ['desistencia', 'desligamento', 'desligamento a pedido'].includes(t));
            
            // Regra RECRUTAMENTO: Deve ter Falta Int + Falta Inj E NADA MAIS.
            const allowedTypes = ['falta integracao', 'falta injustificada', 'desistencia', 'desligamento', 'desligamento a pedido'];
            const hasUnknown = types.some(t => !allowedTypes.includes(t));

            const qualifiesForABS = hasFaltaInt && hasFaltaInj && !hasUnknown;
            const qualifiesForTO = qualifiesForABS && hasDeslig;

            if (qualifiesForABS) absCount++;
            if (qualifiesForTO) toCount++;
        });
    } else {
        // Regra TREINAMENTO: Tem presença
        const trainingPoolIds = poolFinal.map(c => c.id);
        const logsDoMes = diario.filter(l => trainingPoolIds.includes(l.colaborador_id));
        
        // ABS: Pessoas com pelo menos uma falta
        absCount = new Set(logsDoMes.filter(l => normalizar(l.tipo_registro).includes('falta')).map(l => l.colaborador_id)).size;
        // TO: Pessoas com desligamento
        toCount = new Set(logsDoMes.filter(l => ['desistencia', 'desligamento', 'desligamento a pedido'].includes(normalizar(l.tipo_registro))).map(l => l.colaborador_id)).size;
    }

    // Salas e Ranking
    const opsAtivas = [...new Set(turmas.map(t => t.operacoes?.nome).filter(Boolean))];
    const ranking = opsAtivas.map(op => ({ nome: op, abs: (absCount/Math.max(1, poolFinal.length))*100, to: (toCount/Math.max(1, poolFinal.length))*100 }));
    
    const salaStats = salas.map(sala => {
        const turmasNaSala = turmas.filter(t => t.sala === sala.nome && (selectedOp === 'Todas' || t.operacoes?.nome === selectedOp));
        return { name: sala.nome, dias: turmasNaSala.length > 0 ? 1 : 0, ops: [...new Set(turmasNaSala.map(t => t.operacoes?.nome).filter(Boolean))] };
    }).filter(s => s.dias > 0);

    return {
        ativas: turmas.filter(t => t.status === 'Em Andamento').length,
        finalizadas: turmas.filter(t => t.status === 'Finalizada').length,
        abs: poolFinal.length > 0 ? (absCount / poolFinal.length) * 100 : 0,
        to: poolFinal.length > 0 ? (toCount / poolFinal.length) * 100 : 0,
        ranking,
        salaStats
    };
  }, [loading, selectedMonth, selectedOp, selectedTurma, tipo, turmas, colabs, diario, salas]);

  if (loading) return <div className="p-10 text-center">Carregando...</div>;

  return (
    <div className="p-6 space-y-6">
        <div className="flex gap-2 mb-6">
            <Link href="/dashboard/treinamento" className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tipo === 'treinamento' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-emerald-600 border border-emerald-200'}`}>Treinamento</Link>
            <Link href="/dashboard/recrutamento" className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tipo === 'recrutamento' ? 'bg-purple-600 text-white shadow-lg' : 'bg-white text-purple-600 border border-purple-200'}`}>Recrutamento</Link>
        </div>

        <div className="flex flex-wrap items-center bg-white p-4 rounded-lg shadow gap-4">
            <h1 className="text-xl font-bold capitalize mr-auto">Dashboard {tipo}</h1>
            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="border p-2 rounded" />
            <select onChange={(e) => setSelectedOp(e.target.value)} className="border p-2 rounded"><option value="Todas">Todas Operações</option>{[...new Set(turmas.map(t => t.operacoes?.nome).filter(Boolean))].map(op => <option key={op} value={op}>{op}</option>)}</select>
            <select onChange={(e) => setSelectedTurma(e.target.value)} className="border p-2 rounded"><option value="Todas">Todas Turmas</option>{[...new Set(turmas.map(t => t.numero_turma).filter(Boolean))].map(num => <option key={num} value={num}>{num}</option>)}</select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card title="Ativas" value={data?.ativas || 0} color="border-blue-500" />
            <Card title="Finalizadas" value={data?.finalizadas || 0} color="border-green-500" />
            <Card title="ABS Geral" value={`${(data?.abs || 0).toFixed(1)}%`} color="border-yellow-500" />
            <Card title="TO Geral" value={`${(data?.to || 0).toFixed(1)}%`} color="border-red-500" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded shadow border border-slate-200">
                <h2 className="font-bold mb-4">Ocupação de Salas</h2>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={data?.salaStats} dataKey="dias" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                {data?.salaStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white p-4 rounded shadow border border-slate-200">
                <h2 className="font-bold mb-4">Detalhes de Ocupação</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase border-b">
                            <tr><th className="py-2">Sala</th><th className="py-2">Dias</th><th className="py-2">Operações</th></tr>
                        </thead>
                        <tbody>
                            {data?.salaStats.map((s, i) => (
                                <tr key={i} className="border-b last:border-0">
                                    <td className="py-3 font-medium">{s.name}</td>
                                    <td className="py-3">{s.dias}</td>
                                    <td className="py-3 text-gray-600">{s.ops.join(', ') || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
  );
}

function Card({ title, value, color }: { title: string, value: string | number, color: string }) {
    return <div className={`bg-white p-4 rounded shadow border-l-4 ${color}`}><p className="text-[10px] font-bold text-gray-500 uppercase">{title}</p><p className="text-xl font-bold">{value}</p></div>;
}
