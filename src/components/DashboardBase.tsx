'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function DashboardBase({ tipo }: { tipo: 'treinamento' | 'recrutamento' }) {
  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState({ turmas: [], colabs: [], diario: [], salas: [] });
  
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
      setRaw({ turmas: t.data || [], colabs: c.data || [], diario: d.data || [], salas: s.data || [] });
      setLoading(false);
    }
    carregarDados();
  }, []);

  const data = useMemo(() => {
    if (loading) return null;

    const [year, month] = selectedMonth.split('-').map(Number);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);
    const normalize = (s: string) => s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim();

    // 1. Aplicar Filtros de Escopo (O segredo da dinâmica)
    const filteredTurmas = raw.turmas.filter(t => 
      (selectedOp === 'Todas' || t.operacoes?.nome === selectedOp) &&
      (selectedTurma === 'Todas' || t.numero_turma === selectedTurma)
    );

    const filteredTurmaNumbers = filteredTurmas.map(t => t.numero_turma);

    // 2. Classificação de Colaboradores (Regra de Negócio)
    const operators = raw.colabs
      .filter(c => filteredTurmaNumbers.includes(c.numero_turma)) // Só colabs das turmas selecionadas
      .map(c => {
        const logs = raw.diario.filter(l => l.colaborador_id === c.id && new Date(l.data) >= startOfMonth && new Date(l.data) <= endOfMonth);
        const types = logs.map(l => normalize(l.tipo_registro));
        
        const hasPresence = types.some(t => ['presente', 'presenca', 'acompanhamento'].includes(t));
        const hasFaltaInt = types.includes('falta integracao');
        const hasFaltaInj = types.includes('falta injustificada');
        const hasDeslig = types.some(t => ['desistencia', 'desligamento', 'desligamento a pedido'].includes(t));
        
        // Regra de Ouro:
        // Treinamento = Tem presença
        // Recrutamento = Não tem presença (só faltas ou vazio)
        const category = hasPresence ? 'treinamento' : 'recrutamento';
        
        let isAbs = false;
        let isTo = false;

        if (category === 'treinamento') {
            isAbs = types.some(t => t.includes('falta'));
            isTo = hasDeslig;
        } else {
            // Regra Recrutamento (Estrita)
            isAbs = hasFaltaInt && hasFaltaInj;
            isTo = hasFaltaInt && hasFaltaInj && hasDeslig;
        }

        const turmaObj = filteredTurmas.find(t => t.numero_turma === c.numero_turma);
        return { ...c, category, isAbs, isTo, op: turmaObj?.operacoes?.nome, turma: c.numero_turma };
    });

    // 3. Filtrar pelo Tipo da Página (Treinamento ou Recrutamento)
    const finalOperators = operators.filter(o => o.category === tipo);
    const total = finalOperators.length;
    const absCount = finalOperators.filter(f => f.isAbs).length;
    const toCount = finalOperators.filter(f => f.isTo).length;

    // 4. Ranking (Baseado no filtrado)
    const ops = [...new Set(finalOperators.map(f => f.op).filter(Boolean))];
    const ranking = ops.map(op => {
      const group = finalOperators.filter(f => f.op === op);
      return { 
        nome: op, 
        abs: (group.filter(f => f.isAbs).length / Math.max(1, group.length)) * 100,
        to: (group.filter(f => f.isTo).length / Math.max(1, group.length)) * 100
      };
    });

    // 5. Cálculo Dinâmico de Dias de Sala
    const salaStats = raw.salas.map(s => {
      let diasEmUso = 0;
      for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
        const isOccupied = filteredTurmas.some(t => {
            if (t.sala !== s.nome) return false;
            const start = new Date(t.data_inicio);
            const end = t.data_fim ? new Date(t.data_fim) : new Date(2099, 11, 31);
            return d >= start && d <= end;
        });
        if (isOccupied) diasEmUso++;
      }
      return { name: s.nome, dias: diasEmUso, turmas: filteredTurmas.filter(t => t.sala === s.nome).map(t => t.numero_turma) };
    }).filter(s => s.dias > 0);

    return { 
      ativas: filteredTurmas.filter(t => t.status === 'Em Andamento').length,
      finalizadas: filteredTurmas.filter(t => t.status === 'Finalizada').length,
      abs: total > 0 ? (absCount / total) * 100 : 0,
      to: total > 0 ? (toCount / total) * 100 : 0,
      ranking,
      salaStats
    };
  }, [loading, raw, tipo, selectedMonth, selectedOp, selectedTurma]);

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
            <select onChange={(e) => setSelectedOp(e.target.value)} className="border p-1.5 text-sm rounded"><option value="Todas">Todas Operações</option>{[...new Set(raw.turmas.map(t => t.operacoes?.nome).filter(Boolean))].map(op => <option key={op} value={op}>{op}</option>)}</select>
            <select onChange={(e) => setSelectedTurma(e.target.value)} className="border p-1.5 text-sm rounded"><option value="Todas">Todas Turmas</option>{[...new Set(raw.turmas.map(t => t.numero_turma))].map(num => <option key={num} value={num}>{num}</option>)}</select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded shadow border-l-4 border-blue-500"><p className="text-[10px] font-bold text-gray-500">ATIVAS</p><p className="text-lg font-bold">{data.ativas}</p></div>
            <div className="bg-white p-3 rounded shadow border-l-4 border-green-500"><p className="text-[10px] font-bold text-gray-500">FINALIZADAS</p><p className="text-lg font-bold">{data.finalizadas}</p></div>
            <div className="bg-white p-3 rounded shadow border-l-4 border-yellow-500"><p className="text-[10px] font-bold text-gray-500">ABS</p><p className="text-lg font-bold">{data.abs.toFixed(1)}%</p></div>
            <div className="bg-white p-3 rounded shadow border-l-4 border-red-500"><p className="text-[10px] font-bold text-gray-500">TO</p><p className="text-lg font-bold">{data.to.toFixed(1)}%</p></div>
        </div>

        <div className="bg-white p-3 rounded shadow">
            <h2 className="font-bold text-sm mb-2">Ranking por Operação</h2>
            {data.ranking.map((o: any, i: number) => (
                <div key={i} className="flex justify-between py-1 border-b text-xs"><span>{o.nome}</span><span className="text-yellow-600 font-bold">{o.abs.toFixed(0)}% ABS</span><span className="text-red-600 font-bold">{o.to.toFixed(0)}% TO</span></div>
            ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-3 rounded shadow">
                <h2 className="font-bold text-sm mb-2">Ocupação de Salas (Dias em Uso)</h2>
                <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart><Pie data={data.salaStats} dataKey="dias" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>{data.salaStats.map((_:any, i:number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div className="bg-white p-3 rounded shadow overflow-hidden">
                <h2 className="font-bold text-sm mb-2">Detalhes do Ensalamento</h2>
                <table className="w-full text-xs text-left">
                    <thead><tr className="border-b"><th className="py-1">Sala</th><th className="py-1">Dias</th><th className="py-1">Turmas</th></tr></thead>
                    <tbody>{data.salaStats.map((s:any, i:number) => <tr key={i} className="border-b"><td className="py-1.5 font-medium">{s.name}</td><td className="py-1.5">{s.dias}</td><td className="py-1.5 truncate">{s.turmas.join(', ')}</td></tr>)}</tbody>
                </table>
            </div>
        </div>
    </div>
  );
}
