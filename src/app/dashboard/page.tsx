'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Briefcase, 
  AlertCircle
} from 'lucide-react';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [metricas, setMetricas] = useState({
    turmasAtivas: 0,
    turmasFinalizadas: 0,
    opsEmTreinamento: 0,
    toMensal: 0,
    absMensal: 0
  });

  const [rankingAbs, setRankingAbs] = useState<any[]>([]);
  const [rankingTo, setRankingTo] = useState<any[]>([]);

  useEffect(() => {
    async function carregarDashboard() {
      setLoading(true);
      try {
        const hoje = new Date();
        const mesAtual = (hoje.getMonth() + 1).toString().padStart(2, '0');
        const anoAtual = hoje.getFullYear();
        const filtroData = `${anoAtual}-${mesAtual}`; // Ex: "2026-07"

        // Buscamos todos os dados sem filtros de URL para evitar o erro 404
        const [turmasRes, colabsRes, diarioRes, opsRes] = await Promise.all([
          supabase.from('turmas').select('*, operacoes(*)'),
          supabase.from('colaboradores').select('*'),
          supabase.from('diario_presenca').select('*'), 
          supabase.from('operacoes').select('*')
        ]);

        if (!turmasRes.data || !colabsRes.data || !diarioRes.data || !opsRes.data) {
          console.error("Erro ao carregar dados do Supabase");
          return;
        }

        const turmas = turmasRes.data;
        const colabs = colabsRes.data;
        // Filtro aplicado localmente após carregar todos os dados
        const diario = diarioRes.data.filter(d => d.data && d.data.startsWith(filtroData));
        const operacoes = opsRes.data;

        // 1. Métricas de Turmas
        const ativas = turmas.filter(t => t.status === 'Em Andamento');
        const finalizadas = turmas.filter(t => t.status === 'Finalizada');
        
        const turmasAtivasIds = ativas.map(t => t.numero_turma);
        const emTreinamento = colabs.filter(c => turmasAtivasIds.includes(c.turma_numero));

        // 2. Processamento por Operação
        const mapaOps = operacoes.map(op => {
          const turmasOp = turmas.filter(t => t.operacoes?.id === op.id);
          const turmasOpIds = turmasOp.map(t => t.numero_turma);
          const colabsOp = colabs.filter(c => turmasOpIds.includes(c.turma_numero));
          const diarioOp = diario.filter(d => turmasOpIds.includes(d.turma_numero));
          
          const totalRegistros = diarioOp.filter(d => d.tipo_registro !== 'Folga').length;
          const totalFaltas = diarioOp.filter(d => ['Falta Injustificada', 'Falta Integração', 'Atestado'].includes(d.tipo_registro)).length;
          const totalDesligamentos = diarioOp.filter(d => ['Desistência', 'Desligamento a Pedido'].includes(d.tipo_registro)).length;

          return {
            nome: op.nome,
            abs: totalRegistros > 0 ? (totalFaltas / totalRegistros) * 100 : 0,
            to: colabsOp.length > 0 ? (totalDesligamentos / colabsOp.length) * 100 : 0
          };
        });

        // 3. Totais Globais Mensais
        const totalRegistrosGeral = diario.filter(d => d.tipo_registro !== 'Folga').length;
        const totalFaltasGeral = diario.filter(d => ['Falta Injustificada', 'Falta Integração', 'Atestado'].includes(d.tipo_registro)).length;
        const totalDesligGeral = diario.filter(d => ['Desistência', 'Desligamento a Pedido'].includes(d.tipo_registro)).length;
        const totalColabsGeral = colabs.length;

        setMetricas({
          turmasAtivas: ativas.length,
          turmasFinalizadas: finalizadas.length,
          opsEmTreinamento: emTreinamento.length,
          absMensal: totalRegistrosGeral > 0 ? (totalFaltasGeral / totalRegistrosGeral) * 100 : 0,
          toMensal: totalColabsGeral > 0 ? (totalDesligGeral / totalColabsGeral) * 100 : 0
        });

        setRankingAbs([...mapaOps].sort((a, b) => b.abs - a.abs));
        setRankingTo([...mapaOps].sort((a, b) => b.to - a.to));

      } catch (err) {
        console.error('Erro ao processar dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    carregarDashboard();
  }, []);

  if (loading) return <div className="p-10 text-center">Carregando métricas...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard Geral</h1>
      
      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-xs font-bold text-gray-500 uppercase">Turmas Ativas</p>
          <p className="text-2xl font-bold">{metricas.turmasAtivas}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-emerald-500">
          <p className="text-xs font-bold text-gray-500 uppercase">Turmas Finalizadas</p>
          <p className="text-2xl font-bold">{metricas.turmasFinalizadas}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-indigo-500">
          <p className="text-xs font-bold text-gray-500 uppercase">Em Treinamento</p>
          <p className="text-2xl font-bold">{metricas.opsEmTreinamento}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-orange-500">
          <p className="text-xs font-bold text-gray-500 uppercase">Turnover Mensal</p>
          <p className="text-2xl font-bold">{metricas.toMensal.toFixed(1)}%</p>
        </div>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border">
          <h2 className="font-bold mb-4 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-600"/> Ranking ABS (Mensal)</h2>
          <div className="space-y-2">
            {rankingAbs.map((op, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="text-sm font-medium">{op.nome}</span>
                <span className="font-bold text-red-600">{op.abs.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <h2 className="font-bold mb-4 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-orange-600"/> Ranking TO (Mensal)</h2>
          <div className="space-y-2">
            {rankingTo.map((op, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="text-sm font-medium">{op.nome}</span>
                <span className="font-bold text-orange-600">{op.to.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
