'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [metricas, setMetricas] = useState({
    turmasAtivas: 0,
    turmasFinalizadas: 0,
    opsEmTreinamento: 0,
    toMensal: 0,
    absMensal: 0,
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

        const [turmasRes, colabsRes, diarioRes] = await Promise.all([
          supabase.from('turmas').select('*, operacoes(nome)'),
          supabase.from('colaboradores').select('*'),
          supabase.from('diario_presenca').select('*'), 
        ]);

        if (!turmasRes.data || !colabsRes.data || !diarioRes.data) return;

        const turmas = turmasRes.data;
        const colabs = colabsRes.data;
        const diario = diarioRes.data.filter(d => d.data && d.data.startsWith(filtroData));

        // Cálculos Globais
        const ativas = turmas.filter(t => t.status === 'Em Andamento');
        const finalizadas = turmas.filter(t => t.status === 'Finalizada');
        const emTreinamento = colabs.filter(c => ativas.map(t => t.numero_turma).includes(c.turma_numero));
        
        const totalDesligGeral = diario.filter(d => ['Desistência', 'Desligamento a Pedido'].includes(d.tipo_registro)).length;
        const totalRegistrosGeral = diario.filter(d => d.tipo_registro !== 'Folga').length;
        const totalFaltasGeral = diario.filter(d => ['Falta Injustificada', 'Falta Integração', 'Atestado'].includes(d.tipo_registro)).length;

        setMetricas({
          turmasAtivas: ativas.length,
          turmasFinalizadas: finalizadas.length,
          opsEmTreinamento: emTreinamento.length,
          toMensal: colabs.length > 0 ? (totalDesligGeral / colabs.length) * 100 : 0,
          absMensal: totalRegistrosGeral > 0 ? (totalFaltasGeral / totalRegistrosGeral) * 100 : 0
        });

        // Lógica agrupada por NOME DA OPERAÇÃO
        const getOpRankings = (turmasSubset: any[]) => {
          // Pega apenas os nomes das operações que possuem turmas neste subset
          const opsUnicas = [...new Set(turmasSubset.map(t => t.operacoes?.nome).filter(Boolean))];

          const dados = opsUnicas.map(opNome => {
            const turmasDaOp = turmasSubset.filter(t => t.operacoes?.nome === opNome);
            const numerosTurmas = turmasDaOp.map(t => t.numero_turma);
            
            const colabsOp = colabs.filter(c => numerosTurmas.includes(c.turma_numero));
            const diarioOp = diario.filter(d => numerosTurmas.includes(d.turma_numero));
            
            const totalReg = diarioOp.filter(d => d.tipo_registro !== 'Folga').length;
            const faltas = diarioOp.filter(d => ['Falta Injustificada', 'Falta Integração', 'Atestado'].includes(d.tipo_registro)).length;
            const deslig = diarioOp.filter(d => ['Desistência', 'Desligamento a Pedido'].includes(d.tipo_registro)).length;

            return {
              nome: opNome,
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
          andamento: getOpRankings(ativas),
          finalizadas: getOpRankings(finalizadas)
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-3 rounded shadow border-l-4 border-blue-500">
          <p className="text-[10px] font-bold text-gray-500 uppercase">Turmas Ativas</p>
          <p className="text-xl font-bold">{metricas.turmasAtivas}</p>
        </div>
        <div className="bg-white p-3 rounded shadow border-l-4 border-green-500">
          <p className="text-[10px] font-bold text-gray-500 uppercase">Turmas Finalizadas</p>
          <p className="text-xl font-bold">{metricas.turmasFinalizadas}</p>
        </div>
        <div className="bg-white p-3 rounded shadow border-l-4 border-pink-500">
          <p className="text-[10px] font-bold text-gray-500 uppercase">OP. EM TREINAMENTO</p>
          <p className="text-xl font-bold">{metricas.opsEmTreinamento}</p>
        </div>
        <div className="bg-white p-3 rounded shadow border-l-4 border-red-500">
          <p className="text-[10px] font-bold text-gray-500 uppercase">Turnover Mensal</p>
          <p className="text-xl font-bold">{metricas.toMensal.toFixed(1)}%</p>
        </div>
        <div className="bg-white p-3 rounded shadow border-l-4 border-yellow-500">
          <p className="text-[10px] font-bold text-gray-500 uppercase">ABS Mensal</p>
          <p className="text-xl font-bold">{metricas.absMensal.toFixed(1)}%</p>
        </div>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded shadow border border-blue-100">
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

        <div className="bg-white p-4 rounded shadow border border-green-100">
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
