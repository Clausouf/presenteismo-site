'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Info, 
  Clock, 
  Users, 
  MapPin, 
  BookOpen 
} from 'lucide-react';
import { Turma } from '@/types/database.types';

interface TurmaComOperacao extends Turma {
  operacoes?: {
    nome: string;
    codigo_operacao: string;
  };
}

export default function CalendarioPage() {
  const [loading, setLoading] = useState(true);
  const [turmas, setTurmas] = useState<TurmaComOperacao[]>([]);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null); // YYYY-MM-DD

  useEffect(() => {
    async function fetchTurmasCronograma() {
      setLoading(false);
      try {
        const { data, error } = await supabase
          .from('turmas')
          .select('*, operacoes(nome, codigo_operacao)')
          .order('data_inicio', { ascending: true });

        if (data) {
          setTurmas(data as TurmaComOperacao[]);
        }
      } catch (err) {
        console.error('Erro ao buscar turmas para o calendário:', err);
      } finally {
        setLoading(true);
      }
    }
    fetchTurmasCronograma();
  }, []);

  // Helper para mudar o mês
  const alterarMes = (direcao: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const novaData = new Date(prev);
      if (direcao === 'prev') {
        novaData.setMonth(prev.getMonth() - 1);
      } else {
        novaData.setMonth(prev.getMonth() + 1);
      }
      return novaData;
    });
    setSelectedDay(null);
  };

  // Funções matemáticas e lógicas para construção do Grid do Calendário
  const ano = currentDate.getFullYear();
  const mes = currentDate.getMonth();

  const primeiroDiaSemanaMes = new Date(ano, mes, 1).getDay();
  const totalDiasMes = new Date(ano, mes + 1, 0).getDate();

  // Gera os dias do grid (incluindo o espaçamento vazio do início da semana)
  const diasGrid: (number | null)[] = [];
  for (let i = 0; i < primeiroDiaSemanaMes; i++) {
    diasGrid.push(null);
  }
  for (let i = 1; i <= totalDiasMes; i++) {
    diasGrid.push(i);
  }

  // Verifica se uma turma específica está ativa em um dia específico
  const getTurmasAtivasNoDia = (dia: number): TurmaComOperacao[] => {
    const dataAlvo = new Date(ano, mes, dia);
    // Zera horas para comparação puramente de data
    dataAlvo.setHours(0,0,0,0);

    return turmas.filter(t => {
      const inicio = new Date(t.data_inicio + 'T00:00:00');
      const fim = new Date(t.data_fim + 'T00:00:00');
      return dataAlvo >= inicio && dataAlvo <= fim;
    });
  };

  const mesesNomes = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Filtra as turmas para o dia selecionado (para exibição no painel de detalhes)
  const diaSelecionadoNumero = selectedDay ? parseInt(selectedDay.split('-')[2]) : null;
  const turmasDetalhadas = diaSelecionadoNumero ? getTurmasAtivasNoDia(diaSelecionadoNumero) : [];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4 md:p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 shrink-0">
            <CalendarIcon size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cronograma de Treinamentos</h1>
            <p className="text-xs text-slate-500 mt-0.5">Visão mensal unificada de turmas, integrações e entregas operacionais.</p>
          </div>
        </div>

        {/* Navegador de Mês */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={() => alterarMes('prev')}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-bold text-slate-800 min-w-[120px] text-center">
            {mesesNomes[mes]} de {ano}
          </span>
          <button
            onClick={() => alterarMes('next')}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Grid de Calendário (3 partes de tela) */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {/* Cabeçalho dos Dias da Semana */}
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-center py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Dom</span>
            <span>Seg</span>
            <span>Ter</span>
            <span>Qua</span>
            <span>Qui</span>
            <span>Sex</span>
            <span>Sáb</span>
          </div>

          {/* Células de Dias */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/20">
            {diasGrid.map((dia, index) => {
              if (dia === null) {
                return <div key={`empty-${index}`} className="bg-slate-50/40 min-h-[110px]" />;
              }

              const dataFormatada = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
              const turmasAtivas = getTurmasAtivasNoDia(dia);
              const isHoje = new Date().toDateString() === new Date(ano, mes, dia).toDateString();
              const isSelected = selectedDay === dataFormatada;

              return (
                <button
                  key={`day-${dia}`}
                  onClick={() => setSelectedDay(dataFormatada)}
                  className={`min-h-[110px] p-2 text-left flex flex-col justify-between items-start transition-all relative ${
                    isSelected 
                      ? 'bg-blue-50/70 border-2 border-blue-500 -m-[1px] z-10' 
                      : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  {/* Número do Dia */}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    isHoje 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-slate-600'
                  }`}>
                    {dia}
                  </span>

                  {/* Badges de Turmas Ativas */}
                  <div className="w-full space-y-1 mt-2 overflow-hidden">
                    {turmasAtivas.slice(0, 3).map((t, idx) => (
                      <div 
                        key={t.id} 
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 truncate block text-left"
                        title={`${t.operacoes?.nome || 'Operação'} - Turma ${t.numero_turma}`}
                      >
                        T-{t.numero_turma} | {t.operacoes?.nome || 'Op'}
                      </div>
                    ))}
                    {turmasAtivas.length > 3 && (
                      <span className="text-[8px] font-extrabold text-blue-600 block pl-1">
                        + {turmasAtivas.length - 3} turmas
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detalhes do Dia Selecionado (1 parte de tela) */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-5 shadow-sm h-fit space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <BookOpen size={16} className="text-blue-500" />
              Treinamentos no Dia
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {selectedDay 
                ? `Exibindo turmas para: ${selectedDay.split('-').reverse().join('/')}` 
                : 'Selecione um dia no calendário para detalhar as turmas.'
              }
            </p>
          </div>

          {!selectedDay ? (
            <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <Info size={24} className="text-slate-300" />
              Clique em qualquer data do calendário para abrir a lista detalhada de turmas em andamento.
            </div>
          ) : turmasDetalhadas.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Nenhuma turma operacional programada ou ativa nesta data.
            </div>
          ) : (
            <div className="space-y-3">
              {turmasDetalhadas.map(t => (
                <div key={t.id} className="p-3 border border-slate-100 bg-slate-50/50 rounded-xl space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs">Turma {t.numero_turma}</h4>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5">Op: {t.operacoes?.nome || 'Não definida'}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      t.status === 'Em Andamento' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {t.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px] text-slate-500 border-t border-slate-100/60">
                    <div className="flex items-center gap-1">
                      <Clock size={11} className="text-slate-400" />
                      <span>{t.horario_inicio.substring(0, 5)}h às {t.horario_fim.substring(0, 5)}h</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin size={11} className="text-slate-400" />
                      <span className="truncate">{t.sala}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
