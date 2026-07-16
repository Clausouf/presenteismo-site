'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [colabs, setColabs] = useState<any[]>([]);
  const [diario, setDiario] = useState<any[]>([]);
  
  // Estado para o Filtro de Mês
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });

  useEffect(() => {
    async function carregarDados() {
      setLoading(true);
      const [t, c, d] = await Promise.all([
        supabase.from('turmas').select('*, operacoes(nome)'),
        supabase.from('colaboradores').select('*'),
        supabase.from('diario_presenca').select('*')
      ]);
      if (t.data) setTurmas(t.data);
      if (c.data) setColabs(c.data);
      if (d.data) setDiario(d.data);
      setLoading(false);
    }
    carregarDados();
  }, []);

  const dashboardData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    // 1. Filtrar Turmas no Mês (Ativas ou Finalizadas no período)
    const turmasNoMes = turmas.filter(t => {
      const tStart = new Date(t.data_inicio);
      const tEnd = t.data_fim ? new Date(t.data_fim) : new Date(2099, 0, 1);
      return tStart <= endOfMonth && tEnd >= startOfMonth;
    });

    const ativas = turmasNoMes.filter(t => t.status === 'Em Andamento');
    const finalizadas = turmasNoMes.filter(t => t.status === 'Finalizada');

    // 2. Classificar Colaboradores (Recrutamento vs Andamento até o fim do mês)
    const colabsAnalise = colabs.map(c => {
      const logsAteMes = diario.filter(d => d.colaborador_id === c.id && new Date(d.data) <= endOfMonth);
      const hasPresente = logsAteMes.some(d => d.tipo_registro === 'Presente');
      const hasDesligamento = logsAteMes.some(d => ['Desistência', 'Desligamento a Pedido'].includes(d.tipo_registro));
      return { ...c, isAndamento: hasPresente, isDesligado: hasDesligamento };
    });

    // 3. Filtrar Diario apenas do mês selecionado
    const logsMes = diario.filter(d => {
      const dDate = new Date(d.data);
      return dDate >= startOfMonth && dDate <= endOfMonth;
    });

    // Cálculos Gerais
    const getStats = (pool: any[]) => {
        const poolIds = pool.map(c => c.id);
        const logsPool = logsMes.filter(l => poolIds.includes(l.colaborador_id));
        const totalRegistros = logsPool.filter(l => l.tipo_registro !== 'Folga').length;
        const totalFaltas = logsPool.filter(l => ['Falta Injustificada', 'Falta Integração', 'Atestado'].includes(l.tipo_registro)).length;
        const totalDeslig = pool.filter(c => c.isDesligado).length; // Considera desligamento acumulado até o mês
        
        return {
            abs: totalRegistros > 0 ? (totalFaltas / totalRegistros) * 100 : 0,
            to: pool.length > 0 ? (totalDeslig / pool.length) * 100 : 0
        };
    };

    const andamentoPool = colabsAnalise.filter(c => c.isAndamento);
    const recrPool = colabsAnalise.filter(c => !c.isAndamento);

    const statsAndamento = getStats(andamentoPool);
    const statsRecrutamento = getStats(recrPool);

    // Rankings por Operação
    const operacoes = Array.from(new Set(turmas.map(t => t.operacoes?.nome).filter(Boolean)));
    const rankingAndamento = operacoes.map(op => {
        const idsNaOp = colabsAnalise.filter(c => turmas.find(t => t.numero_turma === c.numero_turma)?.operacoes?.nome === op).map(c => c.id);
        const pool = colabsAnalise.filter(c => idsNaOp.includes(c.id) && c.isAndamento);
        const stats = getStats(pool);
        return { nome: op, ...stats };
    });

    const rankingRecrutamento = operacoes.map(op => {
        const idsNaOp = colabsAnalise.filter(c => turmas.find(t => t.numero_turma === c.numero_turma)?.operacoes?.nome === op).map(c => c.id);
        const pool = colabsAnalise.filter(c => idsNaOp.includes(c.id) && !c.isAndamento);
        const stats = getStats(pool);
        return { nome: op, ...stats };
    });

    return {
        ativas: ativas.length,
        finalizadas: finalizadas.length,
        statsAndamento,
        statsRecrutamento,
        rankingAndamento,
        rankingRecrutamento
    };
  }, [selectedMonth, turmas, colabs, diario]);

  if (loading) return <div className="p-10 text-center">Carregando...</div>;

  return (
    <div className="p-6 space-y-6">
        <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow">
            <h1 className="text-xl font-bold">Dashboard Geral - {new Date(selectedMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h1>
            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="border p-2 rounded" />
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
            <Ranking title="Ranking Andamento" data={dashboardData.rankingAndamento} color="text-red-600" />
            <Ranking title="Ranking Recrutamento" data={dashboardData.rankingRecrutamento} color="text-purple-600" />
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
            <h2 className={`font-bold mb-3 ${color}`}>{title}</h2>
            <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-gray-400 border-b pb-1"><span>OPERAÇÃO</span><span>ABS</span><span>TO</span></div>
                {data.map((o, i) => (
                    <div key={i} className="flex justify-between text-sm border-b pb-1">
                        <span className="font-medium">{o.nome}</span>
                        <span className="font-bold">{o.abs.toFixed(0)}%</span>
                        <span className="font-bold">{o.to.toFixed(0)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
