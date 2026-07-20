'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Paleta de cores por operação (rotativa)
const OP_COLORS = [
  { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd', dot: '#3b82f6' },
  { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7', dot: '#10b981' },
  { bg: '#ede9fe', text: '#4c1d95', border: '#c4b5fd', dot: '#8b5cf6' },
  { bg: '#fef3c7', text: '#92400e', border: '#fcd34d', dot: '#f59e0b' },
  { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5', dot: '#ef4444' },
  { bg: '#e0f2fe', text: '#0c4a6e', border: '#7dd3fc', dot: '#0ea5e9' },
];

function getOpColor(opNome: string, allOps: string[]) {
  const idx = allOps.indexOf(opNome);
  return OP_COLORS[idx >= 0 ? idx % OP_COLORS.length : 0];
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function CalendarioPage() {
  const [turmas, setTurmas] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregarTurmas() {
      setLoading(true);
      const { data } = await supabase
        .from('turmas')
        .select('*, operacoes(nome)')
        .eq('status', 'Em Andamento');
      if (data) setTurmas(data);
      setLoading(false);
    }

    carregarTurmas();

    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turmas' }, () => {
        carregarTurmas();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
    setSelectedDay(null);
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  };

  const getTurmasDoDia = (date: Date) => {
    return turmas.filter(t => {
      const start = new Date(t.data_inicio + 'T00:00:00');
      const end = new Date(t.data_fim + 'T00:00:00');
      return date >= start && date <= end;
    });
  };

  // Lista única de operações para mapeamento de cores
  const allOps = [...new Set(turmas.map(t => t.operacoes?.nome || 'Sem Operação'))];

  const days = getDaysInMonth();
  const today = new Date();
  const isToday = (date: Date) =>
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const mesAno = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();

  const selectedTurmas = selectedDay ? getTurmasDoDia(selectedDay) : [];

  // Formata horário: se vier como "08:00:00" → "08:00", se vier como "08:00" mantém
  const formatHorario = (h: string | null | undefined) => {
    if (!h) return null;
    return h.length > 5 ? h.slice(0, 5) : h;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-5">

        {/* ── CALENDÁRIO PRINCIPAL ── */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

          {/* Header do calendário */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h1 className="text-lg font-bold text-gray-900">Cronograma de Treinamentos</h1>
              <p className="text-xs text-gray-400 mt-0.5">Turmas em andamento</p>
            </div>
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl px-1 py-1">
              <button
                onClick={() => changeMonth(-1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm transition-all text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
              <span className="px-3 text-sm font-bold text-gray-800 min-w-[160px] text-center">{mesAno}</span>
              <button
                onClick={() => changeMonth(1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm transition-all text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Legenda de operações */}
          {allOps.length > 0 && (
            <div className="flex flex-wrap gap-2 px-6 py-3 border-b border-gray-50 bg-gray-50/50">
              {allOps.map((op, i) => {
                const c = getOpColor(op, allOps);
                return (
                  <span
                    key={op}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                    style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
                    {op}
                  </span>
                );
              })}
            </div>
          )}

          {/* Grid de dias */}
          <div className="p-4">
            {/* Cabeçalho dos dias da semana */}
            <div className="grid grid-cols-7 mb-2">
              {WEEKDAYS.map(d => (
                <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2 uppercase tracking-wide">
                  {d}
                </div>
              ))}
            </div>

            {/* Células */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((date, idx) => {
                if (!date) {
                  return <div key={idx} className="min-h-[90px] rounded-xl bg-gray-50/50" />;
                }

                const turmasDia = getTurmasDoDia(date);
                const isSelected = selectedDay?.toDateString() === date.toDateString();
                const isTodayDate = isToday(date);
                const MAX_VISIBLE = 3;
                const extra = turmasDia.length - MAX_VISIBLE;

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDay(date)}
                    className={`min-h-[90px] rounded-xl p-2 cursor-pointer transition-all duration-150 border ${
                      isSelected
                        ? 'bg-blue-50 border-blue-300 shadow-sm'
                        : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    {/* Número do dia */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                          isTodayDate
                            ? 'bg-blue-600 text-white'
                            : isSelected
                            ? 'text-blue-700'
                            : 'text-gray-700'
                        }`}
                      >
                        {date.getDate()}
                      </span>
                      {turmasDia.length > 0 && (
                        <span className="text-[9px] font-semibold text-gray-400">
                          {turmasDia.length}
                        </span>
                      )}
                    </div>

                    {/* Tags de turmas */}
                    <div className="space-y-0.5">
                      {turmasDia.slice(0, MAX_VISIBLE).map(t => {
                        const opNome = t.operacoes?.nome || 'Sem Operação';
                        const c = getOpColor(opNome, allOps);
                        return (
                          <div
                            key={t.numero_turma}
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md truncate border"
                            style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
                          >
                            T{t.numero_turma} · {opNome.split(' ')[0]}
                          </div>
                        );
                      })}
                      {extra > 0 && (
                        <div className="text-[9px] text-gray-400 font-medium pl-1">
                          +{extra} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── SIDEBAR DETALHES ── */}
        <div className="lg:w-80 flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden sticky top-6">

            {/* Header sidebar */}
            <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-blue-700">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Treinamentos no Dia</h2>
                  {selectedDay ? (
                    <p className="text-xs text-blue-200 mt-0.5 capitalize">
                      {selectedDay.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                  ) : (
                    <p className="text-xs text-blue-200 mt-0.5">Selecione uma data</p>
                  )}
                </div>
              </div>
            </div>

            {/* Conteúdo sidebar */}
            <div className="p-4">
              {!selectedDay ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
                    <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-500">Nenhum dia selecionado</p>
                  <p className="text-xs text-gray-400 mt-1">Clique em um dia no calendário para ver os detalhes das turmas.</p>
                </div>
              ) : selectedTurmas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
                    <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-500">Sem treinamentos</p>
                  <p className="text-xs text-gray-400 mt-1">Nenhuma turma ativa nesta data.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Contador */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {selectedTurmas.length} turma{selectedTurmas.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {selectedTurmas.map(t => {
                    const opNome = t.operacoes?.nome || 'Sem Operação';
                    const c = getOpColor(opNome, allOps);
                    const horarioInicio = formatHorario(t.horario_inicio);
                    const horarioFim = formatHorario(t.horario_fim);
                    const horario = horarioInicio
                      ? horarioFim
                        ? `${horarioInicio} – ${horarioFim}`
                        : horarioInicio
                      : null;

                    return (
                      <div
                        key={t.numero_turma}
                        className="rounded-xl border overflow-hidden"
                        style={{ borderColor: c.border }}
                      >
                        {/* Cabeçalho do card */}
                        <div className="px-3 py-2.5 flex items-center justify-between" style={{ backgroundColor: c.bg }}>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.dot }} />
                            <span className="text-sm font-bold" style={{ color: c.text }}>
                              Turma {t.numero_turma}
                            </span>
                          </div>
                          {horario && (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: c.dot + '22', color: c.text }}
                            >
                              {horario}
                            </span>
                          )}
                        </div>

                        {/* Detalhes do card */}
                        <div className="px-3 py-2.5 bg-white space-y-2">
                          {/* Operação */}
                          <div className="flex items-start gap-2">
                            <svg className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                            </svg>
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Operação</p>
                              <p className="text-xs font-semibold text-gray-800">{opNome}</p>
                            </div>
                          </div>

                          {/* Sala */}
                          <div className="flex items-start gap-2">
                            <svg className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                            </svg>
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Sala</p>
                              <p className="text-xs font-semibold text-gray-800">{t.sala || 'Não definida'}</p>
                            </div>
                          </div>

                          {/* Horário — linha separada se não couber no header */}
                          {!horario && (
                            <div className="flex items-start gap-2">
                              <svg className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                              </svg>
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Horário</p>
                                <p className="text-xs font-semibold text-gray-400 italic">Não informado</p>
                              </div>
                            </div>
                          )}

                          {/* Período */}
                          <div className="flex items-start gap-2">
                            <svg className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Período</p>
                              <p className="text-xs font-semibold text-gray-800">
                                {new Date(t.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')}
                                {' → '}
                                {new Date(t.data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
