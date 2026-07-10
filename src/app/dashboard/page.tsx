'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Download } from 'lucide-react';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  
  // Estados para exportação
  const [diarioData, setDiarioData] = useState<any[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  
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

  const handleExport = () => {
    let csvContent = "\ufeff"; // BOM para acentos
    csvContent += "Relatório Dashboard Geral\n\n";
    
    // 1. Resumo
    csvContent += "Métrica,Valor\n";
    csvContent += `Turmas Ativas,${metricas.turmasAtivas}\n`;
    csvContent += `Turmas Finalizadas,${metricas.turmasFinalizadas}\n`;
    csvContent += `Operadores em Treinamento,${metricas.opsEmTreinamento}\n`;
    csvContent += `Turnover Mensal,${metricas.toMensal.toFixed(1)}%\n`;
    csvContent += `ABS Mensal,${metricas.absMensal.toFixed(1)}%\n\n`;

    // 2. Rankings
    csvContent += "Ranking Turmas em Andamento (Operação),ABS%,TO%\n";
    rankings.andamento.abs.forEach(o => {
        const toVal = rankings.andamento.to.find(t => t.nome === o.nome)?.to || 0;
        csvContent += `${o.nome},${o.abs.toFixed(0)}%,${toVal.toFixed(0)}%\n`;
    });

    // 3. Tabela Pivô (O pedido principal)
    csvContent += "\nDetalhado Presença (Operador x Dia)\n";
    
    // Obter datas únicas do mês para criar as colunas
    const uniqueDates = [...new Set(diarioData.map(d => d.data))].sort();
    
    // Cabeçalho: Turma, Operador, Data1, Data2, ...
    csvContent += `Turma,Operador,${uniqueDates.join(',')}\n`;

    // Agrupar dados por operador (assumindo que existe nome_colaborador ou similar no diario ou linkando com colaboradores)
    // Aqui estamos agrupando pelo ID do colaborador ou Nome que estiver no diário
    const operadores = [...new Set(diarioData.map(d => d.nome_colaborador || 'Não informado'))];

    operadores.forEach(opNome => {
        const registrosDoOp = diarioData.filter(d => d.nome_colaborador === opNome);
        const turma = registrosDoOp[0]?.turma_numero || '-';
        
        // Criar linha de registros por data
        let row = `${turma},${opNome}`;
        uniqueDates.forEach(date => {
            const registroDoDia = registrosDoOp.find(d => d.data === date);
            row += `,${registroDoDia ? registroDoDia.tipo_registro : '-'}`;
        });
        csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_completo_pivot_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

        setColaboradores(colabsRes.data);
        
        // Unir diário com nome do colaborador para o relatório ficar completo
        const diarioComNome = diarioRes.data.map(d => ({
            ...d,
            nome_colaborador: colabsRes.data.find(c => c.id === d.colaborador_id)?.nome || "Desconhecido"
        })).filter(d => d.data && d.data.startsWith(filtroData));

        setDiarioData(diarioComNome);

        const turmas = turmasRes.data;
        const colabs = colabsRes.data;

        const ativas = turmas.filter(t => t.status === 'Em Andamento');
        const finalizadas = turmas.filter(t => t.status === 'Finalizada');
        const emTreinamento = colabs.filter(c => ativas.map(t => t.numero_turma).includes(c.turma_numero));
        
        const totalDesligGeral = diarioComNome.filter(d => ['Desistência', 'Desligamento a Pedido'].includes(d.tipo_registro)).length;
        const totalRegistrosGeral = diarioComNome.filter(d => d.tipo_registro !== 'Folga').length;
        const totalFaltasGeral = diarioComNome.filter(d => ['Falta Injustificada', 'Falta Integração', 'Atestado'].includes(d.tipo_registro)).length;

        setMetricas({
          turmasAtivas: ativas.length,
          turmasFinalizadas: finalizadas.length,
          opsEmTreinamento: emTreinamento.length,
          toMensal: colabs.length > 0 ? (totalDesligGeral / colabs.length) * 100 : 0,
          absMensal: totalRegistrosGeral > 0 ? (totalFaltasGeral / totalRegistrosGeral) * 100 : 0
        });

        const getOpRankings = (turmasSubset: any[]) => {
          const opsUnicas = [...new Set(turmasSubset.map(t => t.operacoes?.nome).filter(Boolean))];
          const dados = opsUnicas.map(opNome => {
            const turmasDaOp = turmasSubset.filter(t => t.operacoes?.nome === opNome);
            const numerosTurmas = turmasDaOp.map(t => t.numero_turma);
            const colabsOp = colabs.filter(c => numerosTurmas.includes(c.turma_numero));
            const diarioOp = diarioComNome.filter(d => numerosTurmas.includes(d.turma_numero));
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
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Dashboard Geral</h1>
        <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition"
        >
            <Download size={16} /> Exportar Relatório Detalhado
        </button>
      </div>
      
      {/* ... [Restante do JSX do Dashboard mantém igual] ... */}
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
