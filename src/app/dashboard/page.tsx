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
              to: colabsOp.length > 0 ? (des
