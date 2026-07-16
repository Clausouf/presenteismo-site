'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Download } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  
  // Estados para os dados brutos (cache local)
  const [turmas, setTurmas] = useState<any[]>([]);
  const [colabs, setColabs] = useState<any[]>([]);
  const [diario, setDiario] = useState<any[]>([]);
  const [salas, setSalas] = useState<any[]>([]);
  
  // Estado para o filtro
  const [selectedOp, setSelectedOp] = useState('Todas');

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

  // Lista de operações únicas para o select
  const operacoesDisponiveis = useMemo(() => {
    const ops = turmas.map(t => t.operacoes?.nome).filter(Boolean);
    return ['Todas', ...Array.from(new Set(ops))];
  }, [turmas]);

  // --- O coração da lógica: Recalcula tudo baseado no filtro selecionado ---
  const dashboardData = useMemo(() => {
    const hoje = new Date();
    const filtroData = `${hoje.getFullYear()}-${(hoje.getMonth() + 1).toString().padStart(2, '0')}`;
    const startOfMonth = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const endOfMonth = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    // 1. Filtra as turmas
    const turmasFiltradas = selectedOp === 'Todas' 
      ? turmas 
      : turmas.filter(t => t.operacoes?.nome === selectedOp);

    const numerosTurmas = turmasFiltradas.map(t => t.numero_turma);

    // 2. Filtra registros dependentes
    const colabsFiltrados = colabs.filter(c => numerosTurmas.includes(c.numero_turma));
    const diarioFiltrado = diario.filter(d => 
      numerosTurmas.includes(d.numero_turma) && 
      d.data?.startsWith(filtroData)
    );

    // 3. Cálculos
    const ativas = turmasFiltradas.filter(t => t.status === 'Em Andamento');
    const finalizadas = turmasFiltradas.filter(t => t.status === 'Finalizada');
    
    const totalDeslig = diarioFiltrado.filter(d => ['Desistência', 'Desligamento a Pedido'].includes(d.tipo_registro)).length;
    const totalReg = diarioFiltrado.filter(d => d.tipo_registro !== 'Folga').length;
    const totalFaltas = diarioFiltrado.filter(d => ['Falta Injustificada', 'Falta Integração', 'Atestado'].includes(d.tipo_registro)).length;

    // Cálculo Salas
    const stats = salas.map(sala => {
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
        turmasAtivas: ativas.length,
        turmasFinalizadas: finalizadas.length,
        opsEmTreinamento: colabsFiltrados.length,
        toMensal: colabsFiltrados.length > 0 ? (totalDeslig / colabsFiltrados.length) * 100 : 0,
        absMensal: totalReg > 0 ? (totalFaltas / totalReg) * 100 : 0
      },
      salaStats: stats,
      rankings: { /* ... (mantém a mesma lógica de ranking do seu código anterior) ... */ }
    };
  }, [selectedOp, turmas, colabs, diario, salas]);

  if (loading) return <div className="p-4 text-center">Carregando dados...</div>;

  return (
    <div className="p-4 space-y-4 text-sm">
      <div className="flex justify-between items-center bg-white p-4 rounded shadow">
        <h1 className="text-xl font-bold">Dashboard Geral</h1>
        
        {/* SELETOR DE OPERAÇÃO */}
        <select 
          value={selectedOp} 
          onChange={(e) => setSelectedOp(e.target.value)}
          className="border rounded p-2 bg-gray-50 font-bold"
        >
          {operacoesDisponiveis.map(op => <option key={op} value={op}>{op}</option>)}
        </select>
      </div>
      
      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-3 rounded shadow border-l-4 border-blue-500">
          <p className="text-[10px] font-bold text-gray-500 uppercase">Turmas Ativas</p>
          <p className="text-xl font-bold">{dashboardData.metricas.turmasAtivas}</p>
        </div>
        <div className="bg-white p-3 rounded shadow border-l-4 border-green-500">
          <p className="text-[10px] font-bold text-gray-500 uppercase">Turmas Finalizadas</p>
          <p className="text-xl font-bold">{dashboardData.metricas.turmasFinalizadas}</p>
        </div>
        <div className="bg-white p-3 rounded shadow border-l-4 border-pink-500">
          <p className="text-[10px] font-bold text-gray-500 uppercase">OP. EM TREINAMENTO</p>
          <p className="text-xl font-bold">{dashboardData.metricas.opsEmTreinamento}</p>
        </div>
        <div className="bg-white p-3 rounded shadow border-l-4 border-red-500">
          <p className="text-[10px] font-bold text-gray-500 uppercase">Turnover Mensal</p>
          <p className="text-xl font-bold">{dashboardData.metricas.toMensal.toFixed(1)}%</p>
        </div>
        <div className="bg-white p-3 rounded shadow border-l-4 border-yellow-500">
          <p className="text-[10px] font-bold text-gray-500 uppercase">ABS Mensal</p>
          <p className="text-xl font-bold">{dashboardData.metricas.absMensal.toFixed(1)}%</p>
        </div>
      </div>

      {/* Gráfico de Ocupação */}
      <div className="bg-white p-4 rounded shadow border border-slate-200">
        <h2 className="font-bold mb-2">Ocupação de Salas</h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={dashboardData.salaStats} dataKey="dias" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                {dashboardData.salaStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
