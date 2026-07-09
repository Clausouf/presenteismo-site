'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  BarChart3, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  CalendarDays, 
  Briefcase, 
  Award, 
  AlertCircle,
  Clock,
  UserX
} from 'lucide-react';
import { TipoRegistroDiario } from '@/types/database.types';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'dia' | 'semana' | 'mes'>('dia');
  
  const [metricas, setMetricas] = useState({
    totalTurmasAtivas: 0,
    totalOperadoresMatriculados: 0,
    taxaAbsenteismoGlobal: 0,
    taxaTurnoverGlobal: 0
  });

  const [graficoFaltas, setGraficoFaltas] = useState<any[]>([]);
  const [rankingOperacoes, setRankingOperacoes] = useState<any[]>([]);

  // Função helper necessária para o build funcionar
  const processarTimelineFaltas = (diario: any[], registrosAusencia: string[], tf: string) => {
    // Implementação básica para evitar erro
    const dados = diario
      .filter(d => registrosAusencia.includes(d.tipo_registro))
      .slice(0, 5); // Exemplo de processamento simples
    setGraficoFaltas(dados);
  };

  useEffect(() => {
    async function carregarMétricasDashboard() {
      setLoading(true);
      try {
        const { data: turmas } = await supabase
          .from('turmas')
          .select('*, operacoes(*)');
        
        const { data: colaboradores } = await supabase
          .from('colaboradores')
          .select('*');

        const { data: diario } = await supabase
          .from('diario_presenca')
          .select('*');

        if (!turmas || !colaboradores || !diario) return;

        const turmasAtivas = turmas.filter(t => t.status === 'Em Andamento');
        const totalMatriculados = colaboradores.length;

        const registrosAusencia: TipoRegistroDiario[] = ['Falta Injustificada', 'Atestado', 'Falta Integração', 'Desistência'];
        const registrosEvasao: TipoRegistroDiario[] = ['Desligamento a Pedido', 'Desistência'];

        const totalAusencias = diario.filter(d => registrosAusencia.includes(d.tipo_registro)).length;
        const totalRegistrosValidos = diario.filter(d => d.tipo_registro !== 'Folga').length;
        const totalEvasoes = diario.filter(d => registrosEvasao.includes(d.tipo_registro)).length;

        setMetricas({
          totalTurmasAtivas: turmasAtivas.length,
          totalOperadoresMatriculados: totalMatriculados,
          taxaAbsenteismoGlobal: totalRegistrosValidos > 0 ? (totalAusencias / totalRegistrosValidos) * 100 : 0,
          taxaTurnoverGlobal: totalMatriculados > 0 ? (totalEvasoes / totalMatriculados) * 100 : 0
        });

        const mapaOps: Record<number, any> = {};

        turmas.forEach(t => {
          const op = t.operacoes;
          if (op && !mapaOps[op.id]) {
            mapaOps[op.id] = {
              nome: op.nome,
              codigo: op.codigo_operacao,
              turmasAtivas: t.status === 'Em Andamento' ? 1 : 0,
              totalFaltas: 0,
              registrosValores: 0
            };
          } else if (op && t.status === 'Em Andamento') {
            mapaOps[op.id].turmasAtivas += 1;
          }
        });

        diario.forEach(d => {
          const colab = colaboradores.find(c => c.matricula === d.matricula);
          if (!colab) return;
          
          const turma = turmas.find(t => t.numero_turma === colab.turma_numero);
          if (!turma || !turma.operacoes) return;

          const opId = turma.operacoes.id;
          if (mapaOps[opId]) {
            if (d.tipo_registro !== 'Folga') mapaOps[opId].registrosValores += 1;
            if (registrosAusencia.includes(d.tipo_registro)) {
              mapaOps[opId].totalFaltas += 1;
            }
          }
        });

        const rankingCalculado = Object.values(mapaOps)
          .filter(o => o.turmasAtivas > 0)
          .map(o => ({
            operacaoNome: o.nome,
            codigo: o.codigo,
            turmasAtivas: o.turmasAtivas,
            taxaAbsenteismo: o.registrosValores > 0 ? (o.totalFaltas / o.registrosValores) * 100 : 0
          }))
          .sort((a, b) => b.taxaAbsenteismo - a.taxaAbsenteismo);

        setRankingOperacoes(rankingCalculado);
        processarTimelineFaltas(diario, registrosAusencia, timeframe);

      } catch (err) {
        console.error('Erro no dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    carregarMétricasDashboard();
  }, [timeframe]);

  if (loading) return <div className="p-10 text-center">Carregando métricas...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      
      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border">
          <p className="text-sm text-gray-500">Turmas Ativas</p>
          <p className="text-2xl font-bold">{metricas.totalTurmasAtivas}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <p className="text-sm text-gray-500">Operadores Ativos</p>
          <p className="text-2xl font-bold">{metricas.totalOperadoresMatriculados}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <p className="text-sm text-gray-500">Absenteísmo</p>
          <p className="text-2xl font-bold text-red-600">{metricas.taxaAbsenteismoGlobal.toFixed(1)}%</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <p className="text-sm text-gray-500">Turnover</p>
          <p className="text-2xl font-bold text-orange-600">{metricas.taxaTurnoverGlobal.toFixed(1)}%</p>
        </div>
      </div>

      {/* Ranking */}
      <div className="bg-white p-6 rounded-lg shadow border">
        <h2 className="font-bold mb-4">Ranking de Absenteísmo por Operação</h2>
        <div className="space-y-2">
          {rankingOperacoes.map((op, idx) => (
            <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="font-medium">{op.operacaoNome}</span>
              <span className="font-bold text-red-600">{op.taxaAbsenteismo.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
