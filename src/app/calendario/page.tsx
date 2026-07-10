'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function CalendarioPage() {
  const [turmas, setTurmas] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    async function carregarTurmas() {
      // Busca turmas em andamento e garante que o campo 'sala' seja carregado
      const { data } = await supabase
        .from('turmas')
        .select('*')
        .eq('status', 'Em Andamento');
      
      if (data) setTurmas(data);
    }
    carregarTurmas();
  }, []);

  // Gera os dias do mês atual para o grid
  const daysInMonth = Array.from({ 
    length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() 
  }, (_, i) => i + 1);

  // Função para filtrar turmas que ocorrem em uma data específica
  const getTurmasDoDia = (dia: number) => {
    const dataVerificacao = new Date(currentDate.getFullYear(), currentDate.getMonth(), dia);
    return turmas.filter(t => {
      const inicio = new Date(t.data_inicio + 'T00:00:00');
      const fim = new Date(t.data_fim + 'T00:00:00');
      return dataVerificacao >= inicio && dataVerificacao <= fim;
    });
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="bg-white p-6 rounded-lg shadow">
        <h1 className="text-xl font-bold mb-6">Cronograma de Treinamentos</h1>
        
        {/* Grade de dias do calendário */}
        <div className="grid grid-cols-7 gap-2">
          {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(d => (
            <div key={d} className="text-center text-xs font-bold text-slate-400 p-2">{d}</div>
          ))}
          
          {daysInMonth.map((dia) => (
            <div key={dia} className="min-h-[100px] border rounded p-2 bg-white hover:bg-slate-50 transition-colors">
              <span className="text-sm font-bold text-slate-700">{dia}</span>
              
              <div className="mt-2 space-y-1">
                {getTurmasDoDia(dia).map((turma) => (
                  <div 
                    key={turma.numero_turma} 
                    className="bg-blue-600 text-white text-[9px] p-1 rounded shadow-sm truncate cursor-help"
                    title={`Sala: ${turma.sala || 'Não definida'}`}
                  >
                    T{turma.numero_turma} - Sala {turma.sala || 'N/A'}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
