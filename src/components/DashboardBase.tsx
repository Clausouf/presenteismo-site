'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

function obterClassificacao(colaboradores: any[], diario: any[]) {
  const normalizar = (str: string) => str?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim();
  const termosPresenca = ['presente', 'presenca', 'acompanhamento'];

  const idsComPresenca = new Set(
    diario
      .filter(l => termosPresenca.includes(normalizar(l.tipo_registro || '')))
      .map(l => l.colaborador_id)
  );

  return {
    treinamento: colaboradores.filter(c => idsComPresenca.has(c.id)),
    recrutamento: colaboradores.filter(c => !idsComPresenca.has(c.id))
  };
}

export default function DashboardBase({ tipo }: { tipo: 'treinamento' | 'recrutamento' }) {
  const [loading, setLoading] = useState(true);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [colabs, setColabs] = useState<any[]>([]);
  const [diario, setDiario] = useState<any[]>([]);
  const [salas, setSalas] = useState<any[]>([]);
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  const [selectedOp, setSelectedOp] = useState('Todas');

  useEffect(() => {
    async function carregarDados() {
      setLoading(true);
      const [t, c, d, s] = await Promise.all([
        supabase.from('turmas').select('*, operacoes(nome)'),
        supabase.from('colaboradores').select('*'),
        supabase.from('diario_presenca').select('*'),
        supabase.from('salas').select('*')
      ]);
      if (t.data) setTurmas(t.data);
      if (c.data) setColabs(c.data);
      if (d.data) setDiario(d.data);
      if (s.data) setSalas(s.data);
      setLoading(false);
    }
    carregarDados();
  }, []);

  const data = useMemo(() => {
    if (loading) return null;

    const [year, month] = selectedMonth.split('-').map(Number);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    const { treinamento, recrutamento } = obterClassificacao(colabs, diario);
    const poolAtivo = tipo === 'treinamento' ? treinamento : recrutamento;

    const filteredPool = poolAtivo.filter(c => {
        const turma = turmas.find(t => t.numero_turma === c.numero_turma);
        if (!turma) return false;
        return selectedOp === 'Todas' || turma.operacoes?.nome === selectedOp;
    });

    const activeIds = filteredPool.map(c => c.id);
    const logsDoMes = diario.filter(l => 
        activeIds.includes(l.colaborador_id) &&
        new Date(l.data) >= startOfMonth && 
        new Date(l.data) <= endOfMonth
    );

    const normalizar = (s: string) => s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim();
    const isFalta = (t: string) => ['falta injustificada', 'falta integracao', 'atestado'].includes(normalizar(t || ''));
    const isDeslig = (t: string) => ['desistencia', 'desligamento', 'desligamento a pedido'].some(p => normalizar(t || '').includes(p));

    const regCount = logsDoMes.filter(l => l.tipo_registro !== 'Folga').length;
    const faltasCount = logsDoMes.filter(l => isFalta(l.tipo_registro)).length;
    const desligadosCount = new Set(logsDoMes.filter(l => isDeslig(l.tipo_registro)).map(l => l.colaborador_id)).size;

    const opsAtivas = [...new Set(turmas.map(t => t.operacoes?.nome).filter(Boolean))];
    const ranking = opsAtivas.map(op => {
        const poolDaOp = filteredPool.filter(c => turmas.find(t => t.numero_turma === c.numero_turma)?.operacoes?.nome === op);
        const idsOp = poolDaOp.map(c => c.id);
        const logsOp = logsDoMes.filter(l => idsOp.includes(l.colaborador_id));
        const regOp = logsOp.filter(l => l.tipo_registro !== 'Folga').length;
        const falOp = logsOp.filter(l => isFalta(l.tipo_registro)).length;
        const desOp = new Set(logsOp.filter(l => isDeslig(l.tipo_registro)).map(l => l.colaborador_id)).size;
        return { nome: op, abs: regOp > 0 ? (falOp / regOp) * 100 : 0, to: poolDaOp.length > 0 ? (desOp / poolDaOp.length) * 100 : 0 };
    });

    const salaStats = salas.map(sala => {
        const turmasNaSala = turmas.filter(t => t.sala === sala.nome && (selectedOp === 'Todas' || t.operacoes?.nome === selectedOp));
        const diasSet = new Set<string>();
        turmasNaSala.forEach(t => {
            const start = new Date(Math.max(new Date(t.data_inicio).getTime(), startOfMonth.getTime()));
            const end = new Date(Math.min(t.data_fim ? new Date(t.data_fim).getTime() : 9999999999999, endOfMonth.getTime()));
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) diasSet.add(d.toISOString().split('T')[0]);
        });
        const ops = [...new Set(turmasNaSala.map(t => t.operacoes?.nome).filter(Boolean))];
        return { name: sala.nome, dias: diasSet.size, ops };
    }).filter(s => s.dias > 0);

    return {
        ativas: turmas.filter(t => t.status === 'Em Andamento').length,
        finalizadas: turmas.filter(t => t.status === 'Finalizada').length,
        abs: regCount > 0 ? (faltasCount / regCount) * 100 : 0,
        to: filteredPool.length > 0 ? (desligadosCount / filteredPool.length) * 100 : 0,
        ranking,
        salaStats
    };
  }, [loading, selectedMonth, selectedOp, tipo, turmas, colabs, diario, salas]);

  if (loading) return <div className="p-10 text-center">Carregando...</div>;

  return (
    <div className="p-6 space-y-6">
        <div className="flex gap-2 mb-6">
            <Link href="/dashboard/treinamento" className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tipo === 'treinamento' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-emerald-600 border border-emerald-200'}`}>Treinamento</Link>
            <Link href="/dashboard/recrutamento" className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tipo === 'recrutamento' ? 'bg-purple-600 text-white shadow-lg' : 'bg-white text-purple-600 border border-purple-200'}`}>Recrutamento</Link>
        </div>

        <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow gap-4">
            <h1 className="text-xl font-bold capitalize">Dashboard {tipo}</h1>
            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="border p-2 rounded" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card title="Ativas" value={data?.ativas || 0} color="border-blue-500" />
            <Card title="Finalizadas" value={data?.finalizadas || 0} color="border-green-500" />
            <Card title="ABS Geral" value={`${(data?.abs || 0).toFixed(1)}%`} color="border-yellow-500" />
            <Card title="TO Geral" value={`${(data?.to || 0).toFixed(1)}%`} color="border-red-500" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tabela de Salas Melhorada */}
            <div className="bg-white p-4 rounded shadow border border-slate-200">
                <h2 className="font-bold mb-4">Ocupação de Salas</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase border-b">
                            <tr><th className="py-2">Sala</th><th className="py-2">Dias</th><th className="py-2">Operações</th></tr>
                        </thead>
                        <tbody>
                            {data?.salaStats.map((s, i) => (
                                <tr key={i} className="border-b last:border-0">
                                    <td className="py-3 font-medium">{s.name}</td>
                                    <td className="py-3">{s.dias}</td>
                                    <td className="py-3 text-gray-600">{s.ops.join(', ') || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white p-4 rounded shadow border border-slate-200">
                <h2 className="font-bold mb-4">Ranking por Operação</h2>
                <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-gray-400 border-b pb-2"><span>OPERAÇÃO</span><span>ABS</span><span>TO</span></div>
                    {data?.ranking.map((o, i) => (
                        <div key={i} className="flex justify-between py-2 border-b text-sm">
                            <span className="font-medium">{o.nome}</span>
                            <span>{o.abs.toFixed(0)}%</span>
                            <span className="font-bold text-red-600">{o.to.toFixed(0)}%</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );
}

function Card({ title, value, color }: { title: string, value: string | number, color: string }) {
    return <div className={`bg-white p-4 rounded shadow border-l-4 ${color}`}><p className="text-[10px] font-bold text-gray-500 uppercase">{title}</p><p className="text-xl font-bold">{value}</p></div>;
}
