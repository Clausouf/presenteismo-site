'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AlertCircle, TrendingDown } from 'lucide-react';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [metricas, setMetricas] = useState({
    turmasAtivas: 0,
    turmasFinalizadas: 0,
    opsEmTreinamento: 0,
    toMensal: 0,
  });

  const [rankings, setRankings] = useState({
    andamento: { abs: [] as any[], to: [] as any[] },
    finalizadas: { abs: [] as any[], to: [] as any[] }
  });

  useEffect(() => {
    async function carregarDashboard() {
      setLoading(true);
      try {
        const hoje = new Date();
        const mesAtual = (hoje.getMonth() + 1).toString().padStart(2, '0');
        const anoAtual = hoje.getFullYear();
        const filtroData = `${anoAtual}-${mesAtual}`;

        const [turmasRes, colabsRes, diarioRes, opsRes] = await Promise.all([
          supabase.from('turmas').select('*, operacoes(*)'),
          supabase.from('colaboradores').select('*'),
          supabase.from('diario_presenca').select('*'), 
          supabase.from('operacoes').select('*')
        ]);

        if (!turmasRes.data || !colabsRes.data || !diarioRes.data || !opsRes.data) return;

        const turmas = turmasRes.data;
        const colabs = colabsRes.data;
        const diario = diarioRes.data.filter(d => d.data && d.data.startsWith(filtroData));
        const operacoes = opsRes.data;

        // Métricas Globais
        const ativas = turmas.filter(t => t.status === 'Em Andamento');
        const finalizadas = turmas.filter(t => t.status === 'Finalizada');
        const emTreinamento = colabs.filter(c => ativas.map(t => t.numero_turma).includes(c.turma_numero));
        const totalDesligGeral = diario.filter(d => ['Desistência', 'Desligamento a Pedido'].includes(d.tipo_registro)).length;

        setMetricas({
          turmasAtivas: ativas.length,
          turmasFinalizadas: finalizadas.length,
          opsEmTreinamento: emTreinamento.length,
          toMensal: colabs.length > 0 ? (totalDesligGeral / colabs.length) * 100 : 0
        });

        // Função para calcular rankings por subconjunto de turmas
        const getRankings = (turmasSubset: any[]) => {
          const dados = operacoes.map(op => {
            const turmasOp = turmasSubset.filter(t => t.operacoes?.id === op.id);
            const turmasOpIds = turmasOp.map(t => t.numero_turma);
            const colabsOp = colabs.filter(c => turmasOpIds.includes(c.turma_numero));
            const diarioOp = diario.filter(d => turmasOpIds.includes(d.turma_numero));
            
            const totalReg = diarioOp.filter(d => d.tipo_registro !== 'Folga').length;
            const faltas = diarioOp.filter(d => ['Falta Injustificada', 'Falta Integração', 'Atestado'].includes(d.tipo_registro)).length;
            const deslig = diarioOp.filter(d => ['Desistência', 'Desligamento a Pedido'].includes(d.tipo_registro)).length;

            return {
              nome: op.nome,
              abs: totalReg > 0 ? (faltas / totalReg) * 100 : 0,
              to: colabsOp.length > 0 ? (deslig / colabsOp.length) * 100 : 0
            };
          });
          return {
            abs: [...dados].sort((a, b) => b.abs - a.abs),
            to: [...dados].sort((a, b) => b.to - a.to)
          };
        };

        setRankings({
          andamento: getRankings(ativas),
          finalizadas: getRankings(finalizadas)
        });

      } catch (err) {
        console.error('Erro:', err);
      } finally {
        setLoading(false);
      }
    }
    carregarDashboard();
  }, []);

  if (loading) return <div className="p-4 text-center">Carregando...</div>;

  return (
    <div className="p-4 space-y-4 text-sm">
      <h1 className="text-xl font-bold">Dashboard Geral</h1>
      
      {/* Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Turmas Ativas', val: metricas.turmasAtivas, color: 'blue' },
          { label: 'Turmas Finalizadas', val: metricas.turmasFinalizadas, color: 'emerald' },
          { label: 'OPERADORES EM TREINAMENTO', val: metricas.opsEmTreinamento, color: 'indigo' },
          { label: 'Turnover Mensal', val: `${metricas.toMensal.toFixed(1)}%`, color: 'orange' },
        ].map((item, i) => (
          <div key={i} className={`bg-white p-3 rounded shadow border-l-4 border-${item.color}-500`}>
            <p className="text-[10px] font-bold text-gray-500 uppercase">{item.label}</p>
            <p className="text-xl font-bold">{item.val}</p>
          </div>
        ))}
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-2 gap-4">
        {/* Andamento */}
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-bold mb-2 text-blue-600">Turmas em Andamento</h2>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs font-bold mb-1">Ranking ABS</p>
              {rankings.andamento.abs.map((o, i) => <div key={i} className="flex justify-between py-1 border-b text-[10px]"><span>{o.nome}</span><span className="text-red-600 font-bold">{o.abs.toFixed(0)}%</span></div>)}
            </div>
            <div>
              <p className="text-xs font-bold mb-1">Ranking TO</p>
              {rankings.andamento.to.map((o, i) => <div key={i} className="flex justify-between py-1 border-b text-[10px]"><span>{o.nome}</span><span className="text-orange-600 font-bold">{o.to.toFixed(0)}%</span></div>)}
            </div>
          </div>
        </div>

        {/* Finalizadas */}
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-bold mb-2 text-emerald-600">Turmas Finalizadas</h2>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs font-bold mb-1">Ranking ABS</p>
              {rankings.finalizadas.abs.map((o, i) => <div key={i} className="flex justify-between py-1 border-b text-[10px]"><span>{o.nome}</span><span className="text-red-600 font-bold">{o.abs.toFixed(0)}%</span></div>)}
            </div>
            <div>
              <p className="text-xs font-bold mb-1">Ranking TO</p>
              {rankings.finalizadas.to.map((o, i) => <div key={i} className="flex justify-between py-1 border-b text-[10px]"><span>{o.nome}</span><span className="text-orange-600 font-bold">{o.to.toFixed(0)}%</span></div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
