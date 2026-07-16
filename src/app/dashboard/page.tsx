'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function DashboardPage() {
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

  useEffect(() => { setSelectedTurma('Todas'); }, [selectedOp]);

  const dashboardData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    // 1. Filtros de Escopo
    let turmasFiltradas = turmas.filter(t => {
      const tStart = new Date(t.data_inicio);
      const tEnd = t.data_fim ? new Date(t.data_fim) : new Date(2099, 0, 1);
      return tStart <= endOfMonth && tEnd >= startOfMonth;
    });

    if (selectedOp !== 'Todas') turmasFiltradas = turmasFiltradas.filter(t => t.operacoes?.nome === selectedOp);
    if (selectedTurma !== 'Todas') turmasFiltradas = turmasFiltradas.filter(t => t.numero_turma === selectedTurma);

    const numsTurmas = turmasFiltradas.map(t => t.numero_turma);

    // 2. Classificação de Colaboradores (Regras Atualizadas)
    const colabsAnalise = colabs
      .filter(c => numsTurmas.includes(c.numero_turma))
      .map(c => {
        const historicoGeral = diario.filter(d => d.colaborador_id === c.id);
        
        // Regra: Teve presença alguma vez? É Andamento.
        const temPresenca = historicoGeral.some(d => d.tipo_registro === 'Presença');
        
        // Desligamento ocorre em qualquer cenário
        const temDesligamento = historicoGeral.some(d => ['Desistência', 'Desligamento a Pedido'].includes(d.tipo_registro));

        return { 
          ...c, 
          isAndamento: temPresenca, 
          isRecrutamento: !temPresenca,
          temDesligamento
        };
      });

    // 3. Funções de Cálculo Isolado
    const getStats = (pool: any[], turmasAlvo: string[]) => {
        const poolIds = pool.map(c => c.id);
        const logsPool = diario.filter(l => 
            poolIds.includes(l.colaborador_id) && 
            turmasAlvo.includes(l.numero_turma) &&
            new Date(l.data) >= startOfMonth && 
            new Date(l.data) <= endOfMonth
        );
        
        const totalRegistros = logsPool.filter(l => l.tipo_registro !== 'Folga').length;
        const totalFaltas = logsPool.filter(l => ['Falta Injustificada', 'Falta Integração', 'Atestado'].includes(l.tipo_registro)).length;
        const totalDeslig = pool.filter(c => c.temDesligamento).length;
        
        return {
            abs: totalRegistros > 0 ? (totalFaltas / totalRegistros) * 100 : 0,
            to: pool.length > 0 ? (totalDeslig / pool.length) * 100 : 0
        };
    };

    // 4. Rankings (Isolando por operação)
    const opsDisponiveis = Array.from(new Set(turmasFiltradas.map(t => t.operacoes?.nome).filter(Boolean)));
    
    const rankingAndamento = opsDisponiveis.map(op => {
        const turmasOp = turmasFiltradas.filter(t => t.operacoes?.nome === op);
        const numsOp = turmasOp.map(t => t.numero_turma);
        const pool = colabsAnalise.filter(c => numsOp.includes(c.numero_turma) && c.isAndamento);
        return { nome: op, ...getStats(pool, numsOp) };
    });

    const rankingRecrutamento = opsDisponiveis.map(op => {
        const turmasOp = turmasFiltradas.filter(t => t.operacoes?.nome === op);
        const numsOp = turmasOp.map(t => t.numero_turma);
        const pool = colabsAnalise.filter(c => numsOp.includes(c.numero_turma) && c.isRecrutamento);
        return { nome: op, ...getStats(pool, numsOp) };
    });

    const andamentoPoolGlobal = colabsAnalise.filter(c => c.isAndamento);
    const recrPoolGlobal = colabsAnalise.filter(c => c.isRecrutamento);

    return {
        ativas: turmasFiltradas.filter(t => t.status === 'Em Andamento').length,
        finalizadas: turmasFiltradas.filter(t => t.status === 'Finalizada').length,
        statsAndamento: getStats(andamentoPoolGlobal, numsTurmas),
        statsRecrutamento: getStats(recrPoolGlobal, numsTurmas),
        rankingAndamento,
        rankingRecrutamento,
        salaStats: salas.map(sala => {
            const turmasNaSala = turmasFiltradas.filter(t => t.sala === sala.nome);
            const diasOcupadosSet = new Set<string>();
            turmasNaSala.forEach(t => {
                const start = new Date(Math.max(new Date(t.data_inicio).getTime(), startOfMonth.getTime()));
                const end = new Date(Math.min(t.data_fim ? new Date(t.data_fim).getTime() : 9999999999999, endOfMonth.getTime()));
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    diasOcupadosSet.add(d.toISOString().split('T')[0]);
                }
            });
            return { name: sala.nome, dias: diasOcupadosSet.size, totalTurmas: turmasNaSala.length };
        }).filter(s => s.dias > 0)
    };
  }, [selectedMonth, selectedOp, selectedTurma, turmas, colabs, diario, salas]);

  if (loading) return <div className="p-10 text-center">Carregando...</div>;

  return (
    <div className="p-6 space-y-6">
        <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow gap-4">
            <h1 className="text-xl font-bold">Dashboard Geral - {new Date(selectedMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h1>
            <div className="flex gap-2">
                <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="border p-2 rounded" />
                <select value={selectedOp} onChange={(e) => setSelectedOp(e.target.value)} className="border p-2 rounded">
                    <option value="Todas">Todas Operações</option>
                    {[...new Set(turmas.map(t => t.operacoes?.nome).filter(Boolean))].map(op => <option key={op} value={op}>{op}</option>)}
                </select>
                <select value={selectedTurma} onChange={(e) => setSelectedTurma(e.target.value)} className="border p-2 rounded">
                    <option value="Todas">Todas Turmas</option>
                    {turmas.filter(t => selectedOp === 'Todas' || t.operacoes?.nome === selectedOp).map(t => <option key={t.numero_turma} value={t.numero_turma}>{t.numero_turma}</option>)}
                </select>
            </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card title="Ativas (Mês)" value={dashboardData.ativas} color="border-blue-500" />
            <Card title="Finaliz. (Mês)" value={dashboardData.finalizadas} color="border-green-500" />
            <Card title="ABS Mensal" value={`${dashboardData.statsAndamento.abs.toFixed(1)}%`} color="border-yellow-500" />
            <Card title="TO Mensal" value={`${dashboardData.statsAndamento.to.toFixed(1)}%`} color="border-red-500" />
            <Card title="ABS Recrut." value={`${dashboardData.statsRecrutamento.abs.toFixed(1)}%`} color="border-purple-400" />
            <Card title="TO Recrut." value={`${dashboardData.statsRecrutamento.to.toFixed(1)}%`} color="border-purple-700" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded shadow border border-slate-200">
                <h2 className="font-bold mb-4">Ocupação de Salas</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={dashboardData.salaStats} dataKey="dias" nameKey="name" cx="50%" cy="50%" outerRadius={50} label>
                                    {dashboardData.salaStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="space-y-1">
                        {dashboardData.salaStats.map((s, i) => (
                            <div key={i} className="flex justify-between p-1 bg-slate-50 rounded border text-[10px]">
                                <span className="font-bold truncate w-24">{s.name}</span>
                                <span>{s.dias} dias | {s.totalTurmas} turmas</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <Ranking title="Ranking Andamento" data={dashboardData.rankingAndamento} color="text-red-600" />
                <Ranking title="Ranking Recrutamento" data={dashboardData.rankingRecrutamento} color="text-purple-600" />
            </div>
        </div>
    </div>
  );
}

function Card({ title, value, color }: { title: string, value: string | number, color: string }) {
    return (
        <div className={`bg-white p-4 rounded shadow border-l-4 ${color}`}>
            <p className="text-[10px] font-bold text-gray-500 uppercase">{title}</p>
            <p className="text-xl font-bold">{value}</p>
        </div>
    );
}

function Ranking({ title, data, color }: { title: string, data: any[], color: string }) {
    return (
        <div className="bg-white p-4 rounded shadow border border-gray-100">
            <h2 className={`font-bold mb-2 text-sm ${color}`}>{title}</h2>
            <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold text-gray-400 border-b pb-1"><span>OPERAÇÃO</span><span>ABS</span><span>TO</span></div>
                {data.map((o, i) => (
                    <div key={i} className="flex justify-between text-xs border-b py-1">
                        <span className="font-medium">{o.nome}</span>
                        <span className="font-bold">{o.abs.toFixed(0)}%</span>
                        <span className="font-bold">{o.to.toFixed(0)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
