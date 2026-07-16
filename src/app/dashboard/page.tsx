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
  
  const [selectedOp, setSelectedOp] = useState('Todas');
  const [selectedTurma, setSelectedTurma] = useState('Todas');

  useEffect(() => { setSelectedTurma('Todas'); }, [selectedOp]);

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
    } catch (err) { console.error('Erro:', err); } finally { setLoading(false); }
  }

  useEffect(() => { carregarDashboard(); }, []);

  const operacoesDisponiveis = useMemo(() => {
    const ops = turmas.map(t => t.operacoes?.nome).filter(Boolean);
    return ['Todas', ...Array.from(new Set(ops))];
  }, [turmas]);

  const turmasDisponiveis = useMemo(() => {
    if (selectedOp === 'Todas') return turmas;
    return turmas.filter(t => t.operacoes?.nome === selectedOp);
  }, [selectedOp, turmas]);

  const dashboardData = useMemo(() => {
    const hoje = new Date();
    const filtroData = `${hoje.getFullYear()}-${(hoje.getMonth() + 1).toString().padStart(2, '0')}`;
    const startOfMonth = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const endOfMonth = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    const turmasFiltradas = turmasDisponiveis.filter(t => selectedTurma === 'Todas' ? true : t.numero_turma === selectedTurma);
    const numerosTurmas = turmasFiltradas.map(t => t.numero_turma);
    
    const colabsAnalise = colabs
      .filter(c => numerosTurmas.includes(c.numero_turma))
      .map(c => {
        const registros = diario.filter(d => d.colaborador_id === c.id);
        const hasPresente = registros.some(r => r.tipo_registro === 'Presente');
        const isDesligado = registros.some(r => ['Desistência', 'Desligamento a Pedido'].includes(r.tipo_registro));
        return { ...c, isRecrutamento: !hasPresente, isDesligado };
      });

    const andamentoPool = colabsAnalise.filter(c => !c.isRecrutamento);
    const recrutamentoPool = colabsAnalise.filter(c => c.isRecrutamento);

    const diarioFiltrado = diario.filter(d => numerosTurmas.includes(d.numero_turma) && d.data?.startsWith(filtroData));
    const totalReg = diarioFiltrado.filter(d => d.tipo_registro !== 'Folga').length;
    const totalFaltas = diarioFiltrado.filter(d => ['Falta Injustificada', 'Falta Integração', 'Atestado'].includes(d.tipo_registro)).length;
    
    // Rank Andamento: calcula ABS e TO
    const opsUnicas = [...new Set(turmasFiltradas.map(t => t.operacoes?.nome).filter(Boolean))];
    
    const rankAndamento = opsUnicas.map(op => {
        const nums = turmasFiltradas.filter(t => t.operacoes?.nome === op).map(t => t.numero_turma);
        const dOp = diario.filter(d => nums.includes(d.numero_turma));
        const cOp = andamentoPool.filter(c => nums.includes(c.numero_turma));
        const regs = dOp.filter(d => d.tipo_registro !== 'Folga').length;
        const faltas = dOp.filter(d => ['Falta Injustificada', 'Falta Integração', 'Atestado'].includes(d.tipo_registro)).length;
        const deslig = cOp.filter(c => c.isDesligado).length;
        return { nome: op, abs: regs > 0 ? (faltas / regs) * 100 : 0, to: cOp.length > 0 ? (deslig / cOp.length) * 100 : 0 };
    });

    const rankRecrutamento = opsUnicas.map(op => {
        const nums = turmasFiltradas.filter(t => t.operacoes?.nome === op).map(t => t.numero_turma);
        const rOp = recrutamentoPool.filter(c => nums.includes(c.numero_turma));
        return { nome: op, valor: rOp.length > 0 ? (rOp.filter(c => c.isDesligado).length / rOp.length) * 100 : 0 };
    });

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

    return {
      metricas: {
        turmasAtivas: turmasFiltradas.filter(t => t.status === 'Em Andamento').length,
        turmasFinalizadas: turmasFiltradas.filter(t => t.status === 'Finalizada').length,
        toMensal: andamentoPool.length > 0 ? (andamentoPool.filter(c => c.isDesligado).length / andamentoPool.length) * 100 : 0,
        absMensal: totalReg > 0 ? (totalFaltas / totalReg) * 100 : 0,
        recrTotal: recrutamentoPool.length,
        recrPerda: recrutamentoPool.length > 0 ? (recrutamentoPool.filter(c => c.isDesligado).length / recrutamentoPool.length) * 100 : 0
      },
      salaStats,
      rankAndamento,
      rankRecrutamento
    };
  }, [selectedOp, selectedTurma, turmasDisponiveis, colabs, diario, salas]);

  if (loading) return <div className="p-4 text-center">Carregando dados...</div>;

  return (
    <div className="p-4 space-y-4 text-sm">
      <div className="flex justify-between items-center bg-white p-4 rounded shadow">
        <h1 className="text-xl font-bold">Dashboard Geral</h1>
        <div className="flex gap-2">
            <select value={selectedOp} onChange={(e) => setSelectedOp(e.target.value)} className="border rounded p-2 bg-gray-50 font-bold"><option value="Todas">Todas Operações</option>{operacoesDisponiveis.filter(o => o !== 'Todas').map(op => <option key={op} value={op}>{op}</option>)}</select>
            <select value={selectedTurma} onChange={(e) => setSelectedTurma(e.target.value)} className="border rounded p-2 bg-gray-50 font-bold"><option value="Todas">Todas Turmas</option>{turmasDisponiveis.map(t => <option key={t.numero_turma} value={t.numero_turma}>{t.numero_turma}</option>)}</select>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white p-3 rounded shadow border-l-4 border-blue-500"><p className="text-[10px] font-bold text-gray-500 uppercase">Ativas</p><p className="text-xl font-bold">{dashboardData.metricas.turmasAtivas}</p></div>
        <div className="bg-white p-3 rounded shadow border-l-4 border-green-500"><p className="text-[10px] font-bold text-gray-500 uppercase">Finaliz.</p><p className="text-xl font-bold">{dashboardData.metricas.turmasFinalizadas}</p></div>
        <div className="bg-white p-3 rounded shadow border-l-4 border-red-500"><p className="text-[10px] font-bold text-gray-500 uppercase">TO Mensal</p><p className="text-xl font-bold">{dashboardData.metricas.toMensal.toFixed(1)}%</p></div>
        <div className="bg-white p-3 rounded shadow border-l-4 border-yellow-500"><p className="text-[10px] font-bold text-gray-500 uppercase">ABS Mensal</p><p className="text-xl font-bold">{dashboardData.metricas.absMensal.toFixed(1)}%</p></div>
        <div className="bg-purple-50 p-3 rounded shadow border-l-4 border-purple-500"><p className="text-[10px] font-bold text-purple-600 uppercase">Base Recr.</p><p className="text-xl font-bold">{dashboardData.metricas.recrTotal}</p></div>
        <div className="bg-purple-50 p-3 rounded shadow border-l-4 border-purple-700"><p className="text-[10px] font-bold text-purple-600 uppercase">Perda Recr.</p><p className="text-xl font-bold">{dashboardData.metricas.recrPerda.toFixed(1)}%</p></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Gráfico Salas + Lista */}
        <div className="bg-white p-4 rounded shadow border border-slate-200">
            <h2 className="font-bold mb-2">Ocupação de Salas</h2>
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

        {/* Rankings */}
        <div className="space-y-4">
            <div className="bg-white p-4 rounded shadow border border-red-100">
                <h2 className="font-bold text-red-600 mb-2 text-xs">Ranking Andamento (ABS / TO)</h2>
                <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold border-b pb-1 text-gray-400"><span>OPERAÇÃO</span><span>ABS</span><span>TO</span></div>
                    {dashboardData.rankAndamento.map((o, i) => (
                        <div key={i} className="flex justify-between text-xs border-b py-1">
                            <span className="font-medium">{o.nome}</span>
                            <span className="text-red-600 font-bold">{o.abs.toFixed(0)}%</span>
                            <span className="text-orange-600 font-bold">{o.to.toFixed(0)}%</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="bg-white p-4 rounded shadow border border-purple-100">
                <h2 className="font-bold text-purple-600 mb-2 text-xs">Ranking Recrutamento</h2>
                <div className="space-y-1">
                    {dashboardData.rankRecrutamento.map((o, i) => (
                        <div key={i} className="flex justify-between text-xs border-b pb-1">
                            <span className="font-medium">{o.nome}</span>
                            <span className="text-purple-600 font-bold">{o.valor.toFixed(0)}%</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
