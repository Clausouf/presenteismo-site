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
  
  const [activeTab, setActiveTab] = useState<'treinamento' | 'recrutamento'>('treinamento');
  
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

  const dashboardData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    // 1. Definições de apoio
    const normalizar = (str: string) => str?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim();
    const isPresenca = (tipo: string) => ['presente', 'presenca'].includes(normalizar(tipo || ''));
    const isFalta = (tipo: string) => ['falta injustificada', 'falta integracao', 'atestado'].includes(normalizar(tipo || ''));
    const isDesligamento = (tipo: string) => ['desistencia', 'desligamento a pedido'].includes(normalizar(tipo || ''));

    // 2. Filtro de Turmas base
    let turmasFiltradas = turmas.filter(t => {
      const tStart = new Date(t.data_inicio);
      const tEnd = t.data_fim ? new Date(t.data_fim) : new Date(2099, 0, 1);
      return tStart <= endOfMonth && tEnd >= startOfMonth;
    });

    if (selectedOp !== 'Todas') turmasFiltradas = turmasFiltradas.filter(t => t.operacoes?.nome === selectedOp);
    if (selectedTurma !== 'Todas') turmasFiltradas = turmasFiltradas.filter(t => t.numero_turma === selectedTurma);

    const numsTurmasAtivas = turmasFiltradas.map(t => t.numero_turma);

    // 3. Estruturação Consolidada por Operador
    const structuredData = colabs
      .filter(c => numsTurmasAtivas.includes(c.numero_turma))
      .map(c => {
        const allLogs = diario.filter(l => l.colaborador_id === c.id && l.numero_turma === c.numero_turma);
        
        // Classificação permanente
        const classificacao = allLogs.some(l => isPresenca(l.tipo_registro)) ? 'treinamento' : 'recrutamento';

        // Filtro mensal para indicadores
        const logsDoMes = allLogs.filter(l => {
            const dataLog = new Date(l.data);
            return dataLog >= startOfMonth && dataLog <= endOfMonth;
        });

        return {
            ...c,
            classificacao,
            op: c.operacao_nome || turmas.find(t => t.numero_turma === c.numero_turma)?.operacoes?.nome,
            registrosDoMes: logsDoMes.filter(l => l.tipo_registro !== 'Folga'),
            faltasDoMes: logsDoMes.filter(l => isFalta(l.tipo_registro)),
            desligamentosDoMes: logsDoMes.filter(l => isDesligamento(l.tipo_registro))
        };
      });

    // 4. Seleção do Pool (Aba Ativa)
    const activePool = structuredData.filter(c => c.classificacao === activeTab);

    // 5. Cálculos Gerais (Respeitando Pool Ativo)
    const totalRegistros = activePool.reduce((acc, c) => acc + c.registrosDoMes.length, 0);
    const totalFaltas = activePool.reduce((acc, c) => acc + c.faltasDoMes.length, 0);
    const totalDesligados = activePool.filter(c => c.desligamentosDoMes.length > 0).length;

    // 6. Ranking (Isolado por Aba usando structuredData)
    const opsDisponiveis = Array.from(new Set(activePool.map(c => c.op).filter(Boolean)));
    const ranking = opsDisponiveis.map(op => {
        const poolOp = activePool.filter(c => c.op === op);
        const regOp = poolOp.reduce((acc, c) => acc + c.registrosDoMes.length, 0);
        const falOp = poolOp.reduce((acc, c) => acc + c.faltasDoMes.length, 0);
        const desOp = poolOp.filter(c => c.desligamentosDoMes.length > 0).length;

        return { 
            nome: op, 
            abs: regOp > 0 ? (falOp / regOp) * 100 : 0,
            to: poolOp.length > 0 ? (desOp / poolOp.length) * 100 : 0
        };
    });

    return {
        ativas: turmasFiltradas.filter(t => t.status === 'Em Andamento').length,
        finalizadas: turmasFiltradas.filter(t => t.status === 'Finalizada').length,
        abs: totalRegistros > 0 ? (totalFaltas / totalRegistros) * 100 : 0,
        to: activePool.length > 0 ? (totalDesligados / activePool.length) * 100 : 0,
        ranking,
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
  }, [selectedMonth, selectedOp, selectedTurma, activeTab, turmas, colabs, diario, salas]);

  if (loading) return <div className="p-10 text-center">Carregando...</div>;

  return (
    <div className="p-6 space-y-6">
        <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow gap-4">
            <h1 className="text-xl font-bold">Dashboard {activeTab === 'treinamento' ? 'Treinamento' : 'Recrutamento'} - {new Date(selectedMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h1>
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

        <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit">
            <button onClick={() => setActiveTab('treinamento')} className={`px-4 py-2 rounded shadow ${activeTab === 'treinamento' ? 'bg-white font-bold text-blue-600' : 'text-gray-500'}`}>Treinamento</button>
            <button onClick={() => setActiveTab('recrutamento')} className={`px-4 py-2 rounded shadow ${activeTab === 'recrutamento' ? 'bg-white font-bold text-purple-600' : 'text-gray-500'}`}>Recrutamento</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card title="Ativas (Mês)" value={dashboardData.ativas} color="border-blue-500" />
            <Card title="Finaliz. (Mês)" value={dashboardData.finalizadas} color="border-green-500" />
            <Card title="ABS Geral" value={`${dashboardData.abs.toFixed(1)}%`} color="border-yellow-500" />
            <Card title="TO Geral" value={`${dashboardData.to.toFixed(1)}%`} color="border-red-500" />
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

            <div className="bg-white p-4 rounded shadow border border-gray-100">
                <h2 className={`font-bold mb-2 text-sm`}>Ranking por Operação</h2>
                <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-gray-400 border-b pb-1"><span>OPERAÇÃO</span><span>ABS</span><span>TO</span></div>
                    {dashboardData.ranking.map((o, i) => (
                        <div key={i} className="flex justify-between text-xs border-b py-1">
                            <span className="font-medium">{o.nome}</span>
                            <span className="font-bold">{o.abs.toFixed(0)}%</span>
                            <span className="font-bold">{o.to.toFixed(0)}%</span>
                        </div>
                    ))}
                </div>
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
