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

// Interfaces para tipagem dos aggregators de cálculo
interface MetricasCards {
  totalTurmasAtivas: number;
  totalOperadoresMatriculados: number;
  taxaAbsenteismoGlobal: number;
  taxaTurnoverGlobal: number;
}

interface FaltaAgrupada {
  periodo: string; // Nome do dia, semana ou mês
  quantidade: number;
}

interface RankingOperacao {
  operacaoNome: string;
  codigo: string;
  turmasAtivas: number;
  totalFaltas: number;
  taxaAbsenteismo: number;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'dia' | 'semana' | 'mes'>('dia');
  
  // Estados de dados consolidados
  const [metricas, setMetricas] = useState<MetricasCards>({
    totalTurmasAtivas: 0,
    totalOperadoresMatriculados: 0,
    taxaAbsenteismoGlobal: 0,
    taxaTurnoverGlobal: 0
  });

  const [graficoFaltas, setGraficoFaltas] = useState<FaltaAgrupada[]>([]);
  const [rankingOperacoes, setRankingOperacoes] = useState<RankingOperacao[]>([]);

  useEffect(() => {
    async function carregarMétricasDashboard() {
      setLoading(true);
      try {
        // 1. Puxar dados de Turmas Em Andamento, Operações e Colaboradores
        const { data: turmas, error: e1 } = await supabase
          .from('turmas')
          .select('*, operacoes(*)');
        
        const { data: colaboradores, error: e2 } = await supabase
          .from('colaboradores')
          .select('*');

        const { data: diario, error: e3 } = await supabase
          .from('diario_presenca')
          .select('*');

        if (!turmas || !colaboradores || !diario) return;

        // --- CÁLCULO DOS CARDS GLOBAIS ---
        const turmasAtivas = turmas.filter(t => t.status === 'Em Andamento');
        const totalMatriculados = colaboradores.length;

        // Categorização de diários para Absenteísmo vs Turnover
        const registrosAusencia: TipoRegistroDiario[] = ['Falta Injustificada', 'Atestado', 'Sem Passagem', 'Problema Pessoal', 'Declaração'];
        const registrosEvasao: TipoRegistroDiario[] = ['Desligamento pela Empresa', 'Desligamento a Pedido', 'Desistência'];

        const totalAusencias = diario.filter(d => registrosAusencia.includes(d.tipo_registro)).length;
        const totalRegistrosValidos = diario.filter(d => d.tipo_registro !== 'Folga').length;
        
        const totalEvasoes = diario.filter(d => registrosEvasao.includes(d.tipo_registro)).length;

        const absenteismoGlobal = totalRegistrosValidos > 0 ? (totalAusencias / totalRegistrosValidos) * 100 : 0;
        const turnoverGlobal = totalMatriculados > 0 ? (totalEvasoes / totalMatriculados) * 100 : 0;

        setMetricas({
          totalTurmasAtivas: turmasAtivas.length,
          totalOperadoresMatriculados: totalMatriculados,
          taxaAbsenteismoGlobal: absenteismoGlobal,
          taxaTurnoverGlobal: turnoverGlobal
        });

        // --- PROCESSAMENTO DO GRÁFICO / TIMELINE DE FALTAS ---
        processarTimelineFaltas(diario, registrosAusencia, timeframe);

        // --- PROCESSAMENTO DO RANKING POR OPERAÇÃO ---
        const mapaOps: Record<string, { nome: string; codigo: string; turmasAtivas: number; totalFaltas: number; registrosValores: number }> = {};

        // Inicializa mapa com base nas turmas
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

        // Vincula as faltas mapeando colaborador -> turma -> operação
        diario.forEach(d => {
          const colab = colaboradores.find(c => c.id === d.colaborador_id);
          if (!colab) return;
          const turma = turmas.find(t => t.id === colab.turma_id);
          if (!turma || !turma.operacoes) return;

          const opId = turma.operacoes.id;
          if (mapaOps[opId]) {
            if (d.tipo_registro !== 'Folga') mapaOps[opId].registrosValores += 1;
            if (registrosAusencia.includes(d.tipo_registro)) {
              mapaOps[opId].totalFaltas += 1;
            }
          }
        });

        const rankingCalculado: RankingOperacao[] = Object.values(mapaOps)
          .filter(o => o.turmasAtivas > 0) // Foco em turmas em andamento solicitado
          .map(o => ({
            operacaoNome: o.nome,
            codigo: o.codigo,
            turmasAtivas: o.turmasAtivas,
            totalFaltas: o.totalFaltas,
            taxaAbsenteismo: o.registrosValores > 0 ? (o.totalFaltas / o.registrosValores) * 100 : 0
          }))
          .sort((a, b) => b.taxaAbsenteismo - a.taxaAbsenteismo); // Pior absenteísmo no topo para ação imediata

        setRankingOperacoes(rankingCalculado);

      } catch (err) {
        console.error('Erro ao estruturar os dados do dashboard:', err);
      } finally {
        setLoading(false);
      }
    }

    carregarMétricasDashboard();
  }, [timeframe]);

  // Função auxiliar para agrupar faltas dinamicamente por dia, semana ou mês
  const processarTimelineFaltas = (diario: any[], filtrosAusencia: string[], modo: 'dia' | 'semana' | 'mes') => {
    const mapaFaltas: Record<string, number> = {};

    diario.forEach(d => {
      if (!filtrosAusencia.includes(d.tipo_registro)) return;
      
      const dataStr = d.data_registro; // Formato YYYY-MM-DD
      let chavePeriodo = dataStr;

      if (modo === 'mes') {
        chavePeriodo = dataStr.substring(0, 7); // Agrupa por YYYY-MM
      } else if (modo === 'semana') {
        // Cálculo simples de semana aproximada do ano
        const dataObj = new Date(dataStr + 'T00:00:00');
        const primeiroDiaAno = new Date(dataObj.getFullYear(), 0, 1);
        const dias = Math.floor((dataObj.getTime() - primeiroDiaAno.getTime()) / (24 * 60 * 60 * 1000));
        const semanaNum = Math.ceil((dias + primeiroDiaAno.getDay() + 1) / 7);
        chavePeriodo = `Semana ${semanaNum} (${dataObj.getFullYear()})`;
      } else {
        // Formato brasileiro para o dia
        const parts = dataStr.split('-');
        chavePeriodo = `${parts[2]}/${parts[1]}`;
      }

      mapaFaltas[chavePeriodo] = (mapaFaltas[chavePeriodo] || 0) + 1;
    });

    // Converte para array ordenado
    const resultado = Object.entries(mapaFaltas).map(([periodo, quantidade]) => ({
      periodo,
      quantidade
    })).slice(-7); // Limita aos últimos 7 pontos para manter o gráfico limpo

    setGraficoFaltas(resultado);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Processando volumetria e consolidação de KPIs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Título da tela */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Indicadores de Presenteísmo</h1>
        <p className="text-sm text-slate-500 mt-1">Análise de evasão e frequência de colaboradores da Integração à Entrega de Turmas.</p>
      </div>

      {/* Grade de Cards de KPIs Superiores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Turmas em Integração</p>
            <h3 className="text-2xl font-bold text-slate-800">{metricas.totalTurmasAtivas}</h3>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Briefcase size={20} />
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Operadores Formando</p>
            <h3 className="text-2xl font-bold text-slate-800">{metricas.totalOperadoresMatriculados}</h3>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <Users size={20} />
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Absenteísmo Médio</p>
            <h3 className="text-2xl font-bold text-slate-800">{metricas.taxaAbsenteismoGlobal.toFixed(1)}%</h3>
          </div>
          <div className={`p-3 rounded-lg ${metricas.taxaAbsenteismoGlobal > 8 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {metricas.taxaAbsenteismoGlobal > 8 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Turnover de T&D</p>
            <h3 className="text-2xl font-bold text-slate-800">{metricas.taxaTurnoverGlobal.toFixed(1)}%</h3>
          </div>
          <div className={`p-3 rounded-lg ${metricas.taxaTurnoverGlobal > 5 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
            <UserX size={20} />
          </div>
        </div>
      </div>

      {/* Sessão Gráficos e Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Painel Esquerdo/Central: Gráfico/Volumetria de Faltas */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 md:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-blue-500" />
                <h2 className="font-semibold text-slate-900">Volumetria de Ausências Cadastradas</h2>
              </div>
              
              {/* Filtro de Visão (Dia, Semana, Mês) */}
              <div className="flex bg-slate-100 p-1 rounded-lg self-start">
                <button
                  onClick={() => setTimeframe('dia')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${timeframe === 'dia' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Dia
                </button>
                <button
                  onClick={() => setTimeframe('semana')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${timeframe === 'semana' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Semana
                </button>
                <button
                  onClick={() => setTimeframe('mes')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${timeframe === 'mes' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Mês
                </button>
              </div>
            </div>

            {/* Simulação Visual de Barras com Tailwind CSS pura (Ultra responsivo e leve) */}
            {graficoFaltas.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                Nenhum registro de ausência computado no período selecionado.
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                {graficoFaltas.map((item, idx) => {
                  const maxVolume = Math.max(...graficoFaltas.map(g => g.quantidade), 1);
                  const percentualBarra = (item.quantidade / maxVolume) * 100;

                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-600">{item.periodo}</span>
                        <span className="text-slate-900 font-bold">{item.quantidade} faltas</span>
                      </div>
                      <div className="w-full bg-slate-100 h-6 rounded-md overflow-hidden relative">
                        <div 
                          className="bg-blue-500 h-full rounded-md transition-all duration-500"
                          style={{ width: `${percentualBarra}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center gap-2 bg-blue-50 text-blue-800 text-xs p-3 rounded-xl border border-blue-100">
            <Clock size={16} className="shrink-0" />
            <span>Gráfico dinâmico alimentado diretamente pelas chamadas dos multiplicadores nas salas.</span>
          </div>
        </div>

        {/* Painel Direito: Ranking de Absenteísmo por Operação */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-5 md:p-6 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
            <Award size={18} className="text-amber-500" />
            <h2 className="font-semibold text-slate-900">Ranking por Operação</h2>
          </div>

          <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
            Visão crítica ordenada pelas operações com maior índice de perda sobre as **Turmas em Andamento**.
          </p>

          {rankingOperacoes.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Nenhuma operação ativa com turmas em andamento.
            </div>
          ) : (
            <div className="space-y-4">
              {rankingOperacoes.map((item, index) => {
                const badgeColor = item.taxaAbsenteismo > 10 
                  ? 'bg-rose-50 text-rose-700 border-rose-100' 
                  : item.taxaAbsenteismo > 5 
                    ? 'bg-amber-50 text-amber-700 border-amber-100' 
                    : 'bg-emerald-50 text-emerald-700 border-emerald-100';

                return (
                  <div key={index} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50/50 transition-colors">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-mono">#{index + 1}</span>
                        {item.operacaoNome}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        Cód: {item.codigo} • {item.turmasAtivas} {item.turmasAtivas === 1 ? 'turma ativa' : 'turmas numéricas'}
                      </div>
                    </div>

                    <div className={`text-right px-2.5 py-1 rounded-md border font-bold text-xs ${badgeColor}`}>
                      {item.taxaAbsenteismo.toFixed(1)}% Abs.
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
