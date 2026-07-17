'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// Funções de Cálculo Isoladas (Fácil de ajustar se a regra mudar)
const getTreinamentoMetrics = (types: string[]) => {
  const isPresente = types.some(t => ['presente', 'presenca', 'acompanhamento'].includes(t));
  const isAbs = types.some(t => t.includes('falta'));
  const isTO = types.some(t => ['desistencia', 'desligamento', 'desligamento a pedido'].includes(t));
  return { included: isPresente, abs: isAbs, to: isTO };
};

const getRecrutamentoMetrics = (types: string[]) => {
  const isPresente = types.some(t => ['presente', 'presenca', 'acompanhamento'].includes(t));
  // Recrutamento só entra se NÃO tiver presença
  if (isPresente) return { included: false, abs: false, to: false };

  const hasInt = types.includes('falta integracao');
  const hasInj = types.includes('falta injustificada');
  const hasDeslig = types.some(t => ['desistencia', 'desligamento', 'desligamento a pedido'].includes(t));
  
  // Regra Estrita: ABS é Falta Int + Falta Inj
  const isAbs = hasInt && hasInj;
  const isTO = isAbs && hasDeslig;
  
  return { included: true, abs: isAbs, to: isTO };
};

export default function DashboardBase({ tipo }: { tipo: 'treinamento' | 'recrutamento' }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  
  // Estados de Filtro
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

      if (!t.data || !c.data || !d.data || !s.data) return;

      const [year, month] = selectedMonth.split('-').map(Number);
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59);
      const normalizar = (s: string) => s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim();

      // 1. Processamento por Colaborador
      const stats = c.data.map(colab => {
        const turma = t.data.find(x => x.numero_turma === colab.numero_turma);
        const logs = d.data.filter(l => l.colaborador_id === colab.id && new Date(l.data) >= startOfMonth && new Date(l.data) <= endOfMonth);
        const types = logs.map(l => normalizar(l.tipo_registro));
        
        const metrics = tipo === 'treinamento' ? getTreinamentoMetrics(types) : getRecrutamentoMetrics(types);
        return { ...colab, ...metrics, op: turma?.operacoes?.nome, turma: colab.numero_turma, sala: turma?.sala };
      }).filter(x => x.included);

      // 2. Filtros de UI
      const filtered = stats.filter(x => 
        (selectedOp === 'Todas' || x.op === selectedOp) &&
        (selectedTurma === 'Todas' || x.turma === selectedTurma)
      );

      // 3. Agregações
      const total = filtered.length;
      const absCount = filtered.filter(x => x.abs).length;
      const toCount = filtered.filter(x => x.to).length;

      // Ranking
      const ops = [...new Set(filtered.map(x => x.op).filter(Boolean))];
      const ranking = ops.map(op => {
        const group = filtered.filter(x => x.op === op);
        const gTotal = group.length;
        return { 
          nome: op, 
          abs: (group.filter(x => x.abs).length / Math.max(1, gTotal)) * 100, 
          to: (group.filter(x => x.to).length / Math.max(1, gTotal)) * 100 
        };
      });

      // Salas
      const salaStats = s.data.map(sala => {
        const turmasNaSala = t.data.filter(tm => tm.sala === sala.nome && (selectedOp === 'Todas' || tm.operacoes?.nome === selectedOp));
        return { name: sala.nome, dias: turmasNaSala.length, ops: [...new Set(turmasNaSala.map(tm => tm.operacoes?.nome).filter(Boolean))] };
      }).filter(s => s.dias > 0);

      setData({
        ativas: t.data.filter(x => x.status === 'Em Andamento').length,
        finalizadas: t.data.filter(x => x.status === 'Finalizada').length,
        abs: total > 0 ? (absCount / total) * 100 : 0,
        to: total > 0 ? (toCount / total) * 100 : 0,
        ranking,
        salaStats
      });
      setLoading(false);
    }
    carregarDados();
  }, [selectedMonth, selectedOp, selectedTurma, tipo]);

  if (loading || !data) return <div className="p-10 text-center">Carregando...</div>;

  return (
    <div className="p-4 space-y-4">
        {/* Switcher & Filtros */}
        <div className="flex gap-2">
            <Link href="/dashboard/treinamento" className={`px-4 py-2 rounded-lg text-sm font-bold ${tipo === 'treinamento' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-600 border'}`}>Treinamento</Link>
            <Link href="/dashboard/recrutamento" className={`px-4 py-2 rounded-lg text-sm font-bold ${tipo === 'recrutamento' ? 'bg-purple-600 text-white' : 'bg-white text-purple-600 border'}`}>Recrutamento</Link>
        </div>

        <div className="flex flex-wrap items-center bg-white p-3 rounded-lg shadow gap-3">
            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="border p-1.5 text-sm rounded" />
            <select onChange={(e) => setSelectedOp(e.target.value)} className="border p-1.5 text-sm rounded"><option value="Todas">Todas Operações</option>{[...new Set(data.ranking.map((r:any) => r.nome))].map(op => <option key={op} value={op}>{op}</option>)}</select>
            <select onChange={(e) => setSelectedTurma(e.target.value)} className="border p-1.5 text-sm rounded"><option value="Todas">Todas Turmas</option></select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded shadow border-l-4 border-blue-500"><p className="text-[10px] font-bold text-gray-500">ATIVAS</p><p className="text-lg font-bold">{data.ativas}</p></div>
            <div className="bg-white p-3 rounded shadow border-l-4 border-green-500"><p className="text-[10px] font-bold text-gray-500">FINALIZADAS</p><p className="text-lg font-bold">{data.finalizadas}</p></div>
            <div className="bg-white p-3 rounded shadow border-l-4 border-yellow-500"><p className="text-[10px] font-bold text-gray-500">ABS</p><p className="text-lg font-bold">{data.abs.toFixed(1)}%</p></div>
            <div className="bg-white p-3 rounded shadow border-l-4 border-red-500"><p className="text-[10px] font-bold text-gray-500">TO</p><p className="text-lg font-bold">{data.to.toFixed(1)}%</p></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-3 rounded shadow">
                <h2 className="font-bold text-sm mb-2">Ocupação de Salas</h2>
                <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart><Pie data={data.salaStats} dataKey="dias" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>{data.salaStats.map((_:any, i:number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white p-3 rounded shadow overflow-hidden">
                <h2 className="font-bold text-sm mb-2">Detalhes da Ocupação</h2>
                <table className="w-full text-xs text-left">
                    <thead><tr className="border-b"><th className="py-1">Sala</th><th className="py-1">Dias</th><th className="py-1">Op</th></tr></thead>
                    <tbody>{data.salaStats.map((s:any, i:number) => <tr key={i} className="border-b"><td className="py-1.5 font-medium">{s.name}</td><td className="py-1.5">{s.dias}</td><td className="py-1.5 truncate">{s.ops.join(', ')}</td></tr>)}</tbody>
                </table>
            </div>
        </div>

        <div className="bg-white p-3 rounded shadow">
            <h2 className="font-bold text-sm mb-2">Ranking por Operação</h2>
            {data.ranking.map((o:any, i:number) => (
                <div key={i} className="flex justify-between py-1 border-b text-xs"><span>{o.nome}</span><span className="text-yellow-600 font-bold">{o.abs.toFixed(0)}% ABS</span><span className="text-red-600 font-bold">{o.to.toFixed(0)}% TO</span></div>
            ))}
        </div>
    </div>
  );
}
