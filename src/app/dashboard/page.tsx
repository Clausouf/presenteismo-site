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

// ... (Interfaces de apoio mantidas)

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

  useEffect(() => {
    async function carregarMétricasDashboard() {
      setLoading(true);
      try {
        // 1. Busca com JOIN na tabela de operacoes
        // Nota: Garanta que sua tabela 'turmas' tenha uma relação configurada com 'operacoes'
        const { data: turmas } = await supabase
          .from('turmas')
          .select('*, operacoes(*)'); // Faz o JOIN pela FK operacao_id
        
        const { data: colaboradores } = await supabase
          .from('colaboradores')
          .select('*');

        const { data: diario } = await supabase
          .from('diario_presenca')
          .select('*');

        if (!turmas || !colaboradores || !diario) return;

        // --- CÁLCULO DOS CARDS GLOBAIS ---
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

        // --- PROCESSAMENTO DO RANKING POR OPERAÇÃO ---
        const mapaOps: Record<number, any> = {};

        // Inicializa mapa usando operacao_id
        turmas.forEach(t => {
          const op = t.operacoes; // Objeto retornado pelo JOIN
          if (op && !mapaOps[op.id]) {
            mapaOps[op.id] = {
              nome: op.nome,
              codigo: op.codigo_operacao, // Verifique se sua tabela operacoes tem essa coluna
              turmasAtivas: t.status === 'Em Andamento' ? 1 : 0,
              totalFaltas: 0,
              registrosValores: 0
            };
          } else if (op && t.status === 'Em Andamento') {
            mapaOps[op.id].turmasAtivas += 1;
          }
        });

        // Vincula as faltas usando MATRICULA e TURMA_NUMERO (Corrigido)
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

  // ... (Mantenha sua função processarTimelineFaltas original, ela já funcionava bem)
  
  // (O resto do seu JSX permanece o mesmo, pois as variáveis de estado foram mantidas)
