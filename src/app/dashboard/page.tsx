'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [colabs, setColabs] = useState<any[]>([]);
  const [diario, setDiario] = useState<any[]>([]);
  const [salas, setSalas] = useState<any[]>([]);
  
  // Estados para filtros
  const [selectedOp, setSelectedOp] = useState('Todas');
  const [selectedTurma, setSelectedTurma] = useState('Todas');

  // Resetar filtro de turma quando a operação mudar
  useEffect(() => {
    setSelectedTurma('Todas');
  }, [selectedOp]);

  async function carregarDashboard() {
    setLoading(true);
    try {
      const [turmasRes, colabsRes, diarioRes, salasRes] = await Promise.all([
        supabase.from('turmas').select('*, operacoes(nome)'),
        supabase.from('colaboradores').select('*'),
        supabase.from('diario_presenca').select('*'),
        supabase.from('salas').select('*')
      ]);

      if (turmasRes.data) setTurmas(turmasRes.data);
      if (colabsRes.data) setColabs(colabsRes.data);
      if (diarioRes.data) setDiario(diarioRes.data);
      if (salasRes.data) setSalas(salasRes.data);
    } catch (err) {
      console.error('Erro ao carregar:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarDashboard();
  }, []);

  const operacoesDisponiveis = useMemo(() => {
    const ops = turmas.map(t => t.operacoes?.nome).filter(Boolean);
    return ['Todas', ...Array.from(new Set(ops))];
  }, [turmas]);

  // Filtra as turmas disponíveis baseada na operação selecionada
  const turmasDisponiveis = useMemo(() => {
    if (selectedOp === 'Todas') return turmas;
    return turmas.filter(t => t.operacoes?.nome === selectedOp);
  }, [selectedOp, turmas]);

  // --- Lógica de cálculo unificada ---
  const dashboardData = useMemo(() => {
    const hoje = new Date();
    const filtroData = `${hoje.getFullYear()}-${(hoje.getMonth() + 1).toString().padStart(2, '0')}`;
    const startOfMonth = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const endOfMonth = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    // Filtra as turmas aplicando Op e Turma
    const turmasFiltradas = turmasDisponiveis.filter(t => 
      selectedTurma === 'Todas' ? true : t.numero_turma === selectedTurma
    );

    const numerosTurmas = turmasFiltradas.map(t => t.numero_turma);
    const colabsFiltrados = colabs.filter(c => numerosTurmas.includes(c.numero_turma));
    const diarioFiltrado = diario.filter(d => 
      numerosTurmas.includes(d.numero_turma) && 
      d.data?.startsWith(filtroData)
    );

    // Cálculos
    const ativas = turmasFiltradas.filter(t => t.status === 'Em Andamento');
    const finalizadas = turmasFiltradas.filter(t => t.status === 'Finalizada');
    const totalDeslig = diarioFiltrado.filter(d => ['Desistência', 'Desligamento a Pedido'].includes(d.tipo_registro)).length;
    const totalReg = diarioFiltrado.filter(d => d.tipo_registro !== 'Folga').length;
    const totalFaltas = diarioFiltrado.filter(d => ['Falta Injustificada', 'Falta Integração', 'Atestado'].includes(d.tipo_registro)).length;

    const salaStats = salas.map(sala => {
      const turmasNaSala = turmasFiltradas.filter(t => t.sala === sala.nome);
      const diasOcupadosSet = new Set<string>();
      turmasNaSala.forEach(t => {
        if (t.data_inicio && t.data_fim) {
          for (let d = new Date(t.data_inicio); d <= new Date(t.data_fim); d.setDate(d.getDate() + 1)) {
            if (d >= startOfMonth && d <= endOfMonth) diasOcupadosSet.add(d.toISOString().split('T')[0]);
          }
        }
      });
      return { name: sala.nome, dias: diasOcupadosSet.size, totalTurmas: turmasNaSala.length };
    }).filter(s => s.dias > 0);

    // Rankings
    const getOpRankings = (turmasSubset: any[]) => {
      const opsUnicas = [...new Set(turmasSubset.map(t => t.operacoes?.nome).filter(Boolean))];
      const dados = opsUnicas.map(opNome => {
        const turmasDaOp = turmasSubset.filter(t => t.operacoes?.nome === opNome);
        const nums = turmasDaOp.map(t => t.numero_turma);
        const colabsOp = colabs.filter(c => nums.includes(c.numero_turma));
        const diarioOp = diario.filter(d => nums.includes(d.numero_turma));
        const totalRegOp = diarioOp.filter(d => d.tipo_registro !== 'Folga').length;
        const faltas = diarioOp.filter(d => ['Falta Injustificada', 'Falta Integração', 'Atestado'].includes(d.tipo_registro)).length;
        const deslig = diarioOp.filter(d => ['Desistência', 'Desligamento a Pedido'].includes(d.tipo_registro)).length;
        return { nome: opNome, abs: totalRegOp > 0 ? (faltas / totalRegOp) * 100 : 0, to: colabsOp.length > 0 ? (deslig / colabsOp.length) * 100 : 0 };
      });
      return { abs: [...dados].sort((a, b) => b.abs - a.abs), to: [...dados].sort((a, b) => b.to - a.to) };
    };

    return {
      metricas: { turmasAtivas: ativas.length, turmasFinalizadas: finalizadas.length, opsEmTreinamento: colabsFiltrados.length, toMensal: colabsFiltrados.length > 0 ? (totalDeslig / colabsFiltrados.length) * 100 : 0, absMensal: totalReg > 0 ? (totalFaltas / totalReg) * 100 : 0 },
      salaStats,
      rankings: { andamento: getOpRankings(ativas), finalizadas: getOpRankings(finalizadas) }
    };
  }, [selectedOp, selectedTurma, turmasDisponiveis, colabs, diario, salas]);

  if (loading) return <div className="p-4 text-center">Carregando dados...</div>;

  return (
    <div className="p-4 space-y-4 text-sm">
      <div className="flex justify-between items-center bg-white p-4 rounded shadow gap-4">
        <h1 className="text-xl font-bold">Dashboard Geral</h1>
        
        <div className="flex gap-2">
            <select value={selectedOp} onChange={(e) => setSelectedOp(e.target.value)} className="border rounded p-2 bg-gray-50 font-bold">
            {operacoesDisponiveis.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
            
            <select value={selectedTurma} onChange={(e) => setSelectedTurma(e.target.value)} className="border rounded p-2 bg-gray-50 font-bold">
            <option value="Todas">Todas Turmas</option>
            {turmasDisponiveis.map(t => <option key={t.numero_turma} value={t.numero_turma}>{t.numero_turma}</option>)}
            </select>
        </div>
      </div>
      
      {/* Cards e restante do layout permanecem iguais */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-3 rounded shadow border-l-4 border-blue-500"><p className="text-[10px] font-bold text-gray-500 uppercase">Turmas Ativas</p><p className="text-xl font-bold">{dashboardData.metricas.turmasAtivas}</p></div>
        <div className="bg-white p-3 rounded shadow border-l-4 border-green-500"><p className="text-[10px] font-bold text-gray-500 uppercase">Turmas Finalizadas</p><p className="text-xl font-bold">{dashboardData.metricas.turmasFinalizadas}</p></div>
        <div className="bg-white p-3 rounded shadow border-l-4 border-pink-500"><p className="text-[10px] font-bold text-gray-500 uppercase">OP. EM TREINAMENTO</p><p className="text-xl font-bold">{dashboardData.metricas.opsEmTreinamento}</p></div>
        <div className="bg-white p-3 rounded shadow border-l-4 border-red-500"><p className="text-[10px] font-bold text-gray-500 uppercase">Turnover Mensal</p><p className="text-xl font-bold">{dashboardData.metricas.toMensal.toFixed(1)}%</p></div>
        <div className="bg-white p-3 rounded shadow border-l-4 border-yellow-500"><p className="text-[10px] font-bold text-gray-500 uppercase">ABS Mensal</p><p className="text-xl font-bold">{dashboardData.metricas.absMensal.toFixed(1)}%</p></div>
      </div>

      <div className="bg-white p-4 rounded shadow border border-slate-200">
        <h2 className="font-bold mb-2">Ocupação de Salas (Dias no Mês)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={dashboardData.salaStats} dataKey="dias" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                            {dashboardData.salaStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="space-y-2">
                {dashboardData.salaStats.map((s, i) => (
                    <div key={i} className="flex justify-between p-2 bg-slate-50 rounded border text-xs">
                        <span className="font-bold">{s.name}</span>
                        <span>{s.dias} dias ocupados | {s.totalTurmas} turmas</span>
                    </div>
                ))}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded shadow border border-blue-100">
          <h2 className="font-bold mb-2 text-blue-600">Turmas em Andamento</h2>
          <div className="grid grid-cols-2 gap-2">
            <div><p className="text-xs font-bold mb-1">Ranking ABS</p>{dashboardData.rankings.andamento.abs.map((o, i) => <div key={i} className="flex justify-between py-1 border-b text-[10px]"><span>{o.nome}</span><span className="text-red-600 font-bold">{o.abs.toFixed(0)}%</span></div>)}</div>
            <div><p className="text-xs font-bold mb-1">Ranking TO</p>{dashboardData.rankings.andamento.to.map((o, i) => <div key={i} className="flex justify-between py-1 border-b text-[10px]"><span>{o.nome}</span><span className="text-orange-600 font-bold">{o.to.toFixed(0)}%</span></div>)}</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded shadow border border-green-100">
          <h2 className="font-bold mb-2 text-emerald-600">Turmas Finalizadas</h2>
          <div className="grid grid-cols-2 gap-2">
            <div><p className="text-xs font-bold mb-1">Ranking ABS</p>{dashboardData.rankings.finalizadas.abs.map((o, i) => <div key={i} className="flex justify-between py-1 border-b text-[10px]"><span>{o.nome}</span><span className="text-red-600 font-bold">{o.abs.toFixed(0)}%</span></div>)}</div>
            <div><p className="text-xs font-bold mb-1">Ranking TO</p>{dashboardData.rankings.finalizadas.to.map((o, i) => <div key={i} className="flex justify-between py-1 border-b text-[10px]"><span>{o.nome}</span><span className="text-orange-600 font-bold">{o.to.toFixed(0)}%</span></div>)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
