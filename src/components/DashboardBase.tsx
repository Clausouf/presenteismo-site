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

    // 1. Pool filtrado por Turma e Operação
    const basePool = colabs.filter(c => {
        const turma = turmas.find(t => t.numero_turma === c.numero_turma);
        if (!turma) return false;
        const opMatch = selectedOp === 'Todas' || turma.operacoes?.nome === selectedOp;
        const turmaMatch = selectedTurma === 'Todas' || c.numero_turma === selectedTurma;
        return opMatch && turmaMatch;
    });

    // 2. Classificação: Recrutamento (sem presença) vs Treinamento (com presença)
    const poolFinal = basePool.filter(c => {
        const logs = diario.filter(l => l.colaborador_id === c.id && new Date(l.data) >= startOfMonth && new Date(l.data) <= endOfMonth);
        const types = logs.map(l => normalizar(l.tipo_registro));
        const hasPresenca = types.some(t => ['presente', 'presenca', 'acompanhamento'].includes(t));
        return tipo === 'treinamento' ? hasPresenca : !hasPresenca;
    });

    // 3. Cálculos de ABS/TO (Regras Estritas)
    let absCount = 0;
    let toCount = 0;

    poolFinal.forEach(c => {
        const logs = diario.filter(l => l.colaborador_id === c.id && new Date(l.data) >= startOfMonth && new Date(l.data) <= endOfMonth);
        const types = logs.map(l => normalizar(l.tipo_registro));

        if (tipo === 'recrutamento') {
            const hasInt = types.includes('falta integracao');
            const hasInj = types.includes('falta injustificada');
            const hasDeslig = types.some(t => ['desistencia', 'desligamento', 'desligamento a pedido'].includes(t));
            const hasOther = types.some(t => !['falta integracao', 'falta injustificada', 'desistencia', 'desligamento', 'desligamento a pedido'].includes(t));
            
            if (hasInt && hasInj && !hasOther) {
                absCount++;
                if (hasDeslig) toCount++;
            }
        } else {
            if (types.some(t => t.includes('falta'))) absCount++;
            if (types.some(t => ['desistencia', 'desligamento', 'desligamento a pedido'].includes(t))) toCount++;
        }
    });

    // 4. Salas
    const salaStats = salas.map(sala => {
        const turmasNaSala = turmas.filter(t => t.sala === sala.nome && (selectedOp === 'Todas' || t.operacoes?.nome === selectedOp));
        const diasSet = new Set<string>();
        turmasNaSala.forEach(t => {
            const start = new Date(Math.max(new Date(t.data_inicio).getTime(), startOfMonth.getTime()));
            const end = new Date(Math.min(t.data_fim ? new Date(t.data_fim).getTime() : 9999999999999, endOfMonth.getTime()));
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) diasSet.add(d.toISOString().split('T')[0]);
        });
        return { name: sala.nome, dias: diasSet.size, ops: [...new Set(turmasNaSala.map(t => t.operacoes?.nome).filter(Boolean))] };
    }).filter(s => s.dias > 0);

    // 5. Ranking
    const opsAtivas = [...new Set(turmas.map(t => t.operacoes?.nome).filter(Boolean))];
    const ranking = opsAtivas.map(op => {
        const poolOp = poolFinal.filter(c => turmas.find(t => t.numero_turma === c.numero_turma)?.operacoes?.nome === op);
        return { nome: op, abs: (absCount/Math.max(1, poolFinal.length))*100, to: (toCount/Math.max(1, poolFinal.length))*100 };
    });

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
    <div className="p-4 space-y-4">
        {/* Switcher & Filtros */}
        <div className="flex gap-2">
            <Link href="/dashboard/treinamento" className={`px-4 py-2 rounded-lg text-sm font-bold ${tipo === 'treinamento' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-600 border'}`}>Treinamento</Link>
            <Link href="/dashboard/recrutamento" className={`px-4 py-2 rounded-lg text-sm font-bold ${tipo === 'recrutamento' ? 'bg-purple-600 text-white' : 'bg-white text-purple-600 border'}`}>Recrutamento</Link>
        </div>

        <div className="flex flex-wrap items-center bg-white p-3 rounded-lg shadow gap-3">
            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="border p-1.5 text-sm rounded" />
            <select onChange={(e) => setSelectedOp(e.target.value)} className="border p-1.5 text-sm rounded"><option value="Todas">Todas Operações</option>{[...new Set(turmas.map(t => t.operacoes?.nome).filter(Boolean))].map(op => <option key={op} value={op}>{op}</option>)}</select>
            <select onChange={(e) => setSelectedTurma(e.target.value)} className="border p-1.5 text-sm rounded"><option value="Todas">Todas Turmas</option>{[...new Set(turmas.map(t => t.numero_turma).filter(Boolean))].map(num => <option key={num} value={num}>{num}</option>)}</select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded shadow border-l-4 border-blue-500"><p className="text-[10px] font-bold text-gray-500">ATIVAS</p><p className="text-lg font-bold">{data?.ativas || 0}</p></div>
            <div className="bg-white p-3 rounded shadow border-l-4 border-green-500"><p className="text-[10px] font-bold text-gray-500">FINALIZADAS</p><p className="text-lg font-bold">{data?.finalizadas || 0}</p></div>
            <div className="bg-white p-3 rounded shadow border-l-4 border-yellow-500"><p className="text-[10px] font-bold text-gray-500">ABS</p><p className="text-lg font-bold">{data?.abs.toFixed(1)}%</p></div>
            <div className="bg-white p-3 rounded shadow border-l-4 border-red-500"><p className="text-[10px] font-bold text-gray-500">TO</p><p className="text-lg font-bold">{data?.to.toFixed(1)}%</p></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Ocupação (Gráfico + Tabela) */}
            <div className="bg-white p-3 rounded shadow">
                <h2 className="font-bold text-sm mb-2">Ocupação de Salas</h2>
                <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart><Pie data={data?.salaStats} dataKey="dias" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>{data?.salaStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white p-3 rounded shadow overflow-hidden">
                <h2 className="font-bold text-sm mb-2">Detalhes da Ocupação</h2>
                <table className="w-full text-xs text-left">
                    <thead><tr className="border-b"><th className="py-1">Sala</th><th className="py-1">Dias</th><th className="py-1">Op</th></tr></thead>
                    <tbody>{data?.salaStats.map((s, i) => <tr key={i} className="border-b"><td className="py-1.5 font-medium">{s.name}</td><td className="py-1.5">{s.dias}</td><td className="py-1.5 truncate">{s.ops.join(', ')}</td></tr>)}</tbody>
                </table>
            </div>
        </div>

        {/* Ranking por Operação */}
        <div className="bg-white p-3 rounded shadow">
            <h2 className="font-bold text-sm mb-2">Ranking por Operação</h2>
            {data?.ranking.map((o, i) => (
                <div key={i} className="flex justify-between py-1 border-b text-xs"><span>{o.nome}</span><span className="text-yellow-600 font-bold">{o.abs.toFixed(0)}% ABS</span><span className="text-red-600 font-bold">{o.to.toFixed(0)}% TO</span></div>
            ))}
        </div>
    </div>
  );
}
