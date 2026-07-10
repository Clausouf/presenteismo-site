'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
// ... (mantenha seus imports de tipos aqui)

function DiarioPresencaContent() {
  const [turmas, setTurmas] = useState<any[]>([]);
  const [operacoes, setOperacoes] = useState<any[]>([]);
  const [selectedOperacaoId, setSelectedOperacaoId] = useState<string>('todos');
  const [selectedTurma, setSelectedTurma] = useState<any>(null);
  
  // Estados para observações
  const [novaObs, setNovaObs] = useState('');
  const [historicoObs, setHistoricoObs] = useState<any[]>([]);

  // ... (seus outros estados de colaboradores, presenças, etc)

  // 1. CARREGAMENTO INICIAL
  useEffect(() => {
    async function init() {
      const { data: t } = await supabase.from('turmas').select('*');
      const { data: o } = await supabase.from('operacoes').select('*');
      if (t) setTurmas(t);
      if (o) setOperacoes(o);
    }
    init();
  }, []);

  // 2. FUNÇÃO DE CARREGAR DADOS DA TURMA
  const carregarDadosTurma = async (turmaNumero: string) => {
    // Busca detalhes da turma
    const { data: turma } = await supabase.from('turmas').select('*').eq('numero_turma', turmaNumero).single();
    if (turma) {
      setSelectedTurma(turma);
      // Busca observações dessa turma
      const { data: obs } = await supabase.from('turma_observacoes').select('*').eq('turma_numero', turmaNumero).order('created_at', { ascending: false });
      setHistoricoObs(obs || []);
      // ... (carregar presenças e colaboradores)
    }
  };

  // 3. SALVAR OBSERVAÇÃO
  const handleSalvarObs = async () => {
    if (!novaObs.trim() || !selectedTurma) return;
    
    const { data, error } = await supabase.from('turma_observacoes').insert({
      turma_numero: selectedTurma.numero_turma,
      texto: novaObs
    }).select();

    if (data) {
      setHistoricoObs([data[0], ...historicoObs]); // Adiciona no topo da lista
      setNovaObs(''); // Limpa o campo
    }
  };

  // 4. LÓGICA DE FILTRAGEM
  const turmasFiltradas = selectedOperacaoId === 'todos' 
    ? turmas 
    : turmas.filter(t => String(t.operacao_id) === String(selectedOperacaoId));

  return (
    <div className="space-y-6 p-4">
      {/* SELETORES */}
      <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-lg shadow">
        <div>
          <label className="block text-xs font-bold text-gray-500">OPERAÇÃO</label>
          <select onChange={(e) => { setSelectedOperacaoId(e.target.value); setSelectedTurma(null); }} className="w-full border p-2 rounded">
            <option value="todos">Todas as Operações</option>
            {operacoes.map(op => <option key={op.id} value={op.id}>{op.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500">TURMA</label>
          <select onChange={(e) => carregarDadosTurma(e.target.value)} className="w-full border p-2 rounded">
            <option value="">Selecione uma turma...</option>
            {turmasFiltradas.map(t => <option key={t.numero_turma} value={t.numero_turma}>Turma {t.numero_turma}</option>)}
          </select>
        </div>
      </div>

      {/* ÁREA DE OBSERVAÇÕES */}
      {selectedTurma && (
        <div className="bg-white p-4 rounded-lg shadow mt-4">
          <label className="block font-bold text-sm mb-2">Adicionar Observação</label>
          <textarea 
            className="w-full border p-2 rounded h-20"
            value={novaObs}
            onChange={(e) => setNovaObs(e.target.value)}
          />
          <button 
            onClick={handleSalvarObs}
            className="bg-blue-600 text-white px-4 py-2 rounded mt-2 hover:bg-blue-700"
          >
            Salvar Observação
          </button>

          <div className="mt-6 space-y-2">
            <h3 className="font-bold text-sm text-gray-600">Histórico de Observações:</h3>
            {historicoObs.map((item) => (
              <div key={item.id} className="p-3 bg-gray-50 border rounded text-sm">
                <span className="text-gray-400 text-xs">{new Date(item.created_at).toLocaleString()}</span>
                <p>{item.texto}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
