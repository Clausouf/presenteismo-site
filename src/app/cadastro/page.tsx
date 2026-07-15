'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function CalendarioPage() {
  const [turmas, setTurmas] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Carregar turmas inicial e configurar listener em tempo real
  useEffect(() => {
    async function carregarTurmas() {
      // Incluindo o join com a tabela 'equipe' para buscar o nome do responsável
      const { data, error } = await supabase
        .from('turmas')
        .select(`
          *, 
          operacoes(nome),
          equipe(nome)
        `)
        .eq('status', 'Em Andamento');
      
      if (error) {
        console.error("Erro ao carregar turmas:", error);
      } else if (data) {
        setTurmas(data);
      }
    }

    carregarTurmas();

    // Configura o Realtime para atualizar o calendário automaticamente
    const channel = supabase
      .channel('calendario-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'turmas' },
        () => {
          carregarTurmas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Navegação de mês
  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
    setSelectedDay(null);
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  };

  const getTurmasDoDia = (date: Date) => {
    return turmas.filter(t => {
      // Ajuste para garantir que a comparação de datas considere o dia corretamente
      const start = new Date(t.data_inicio + 'T00:00:00');
      const end = new Date(t.data_fim + 'T00:00:00');
      // Normalize a data de busca para comparação
      const searchDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      return searchDate >= start && searchDate <= end;
    });
  };

  const days = getDaysInMonth();

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* CALENDÁRIO PRINCIPAL */}
        <div className="lg:col-span-3 bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-xl font-bold">Cronograma de Treinamentos</h1>
            <div className="flex items-center gap-4">
              <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-100 rounded">◀</button>
              <span className="font-bold">
                {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}
              </span>
              <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-100 rounded">▶</button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(d => (
              <div key={d} className="text-center text-xs font-bold text-slate-400 p-2">{d}</div>
            ))}
            
            {days.map((date, idx) => (
              <div 
                key={idx} 
                onClick={() => date && setSelectedDay(date)}
                className={`min-h-[100px] border rounded p-2 transition-all cursor-pointer ${
                  date ? (selectedDay?.toDateString() === date.toDateString() ? 'bg-blue-50 border-blue-400' : 'bg-white hover:bg-slate-50') : 'bg-slate-100'
                }`}
              >
                {date && (
                  <>
                    <span className="text-sm font-bold text-slate-700">{date.getDate()}</span>
                    <div className="mt-2 space-y-1">
                      {getTurmasDoDia(date).map((t) => (
                        <div key={t.numero_turma} className="bg-blue-600 text-white text-[9px] p-1 rounded truncate">
                          T{t.numero_turma} - {t.operacoes?.nome || 'Sem Op'}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* SIDEBAR DETALHES */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-600 min-h-[400px]">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              📅 Detalhes
            </h2>
            
            {selectedDay ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-500 border-b pb-2">
                  {selectedDay.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                
                {getTurmasDoDia(selectedDay).length > 0 ? (
                  getTurmasDoDia(selectedDay).map((t) => (
                    <div key={t.numero_turma} className="p-3 border rounded-lg bg-slate-50">
                      <p className="font-bold text-blue-800">Turma {t.numero_turma}</p>
                      <div className="text-xs text-slate-500 mb-2 space-y-0.5">
                        <p>Operação: {t.operacoes?.nome || 'N/A'}</p>
                        <p>Responsável: {t.equipe?.nome || 'Não definido'}</p>
                      </div>
                      <div className="text-sm">
                        <span className="font-semibold text-slate-700">Sala: </span>
                        <span className="text-slate-600">{t.sala || 'Não definida'}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400 italic">Nenhum treinamento nesta data.</p>
                )}
              </div>
            ) : (
              <div className="text-center mt-20 text-slate-400">
                <p className="text-sm">Selecione um dia no calendário para visualizar os detalhes das turmas.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
