'use client';

export const runtime = 'edge';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Trash2 } from 'lucide-react';

interface NovoColaboradorItem {
  matricula: string;
  nome: string;
  cpf: string;
  data_admissao: string;
  jornada: string;
  grupo_30_horas: boolean;
}

export default function CadastroTurmaPage() {
  const [equipe, setEquipe] = useState<any[]>([]);
  const [operacoes, setOperacoes] = useState<any[]>([]);

  const [numeroTurma, setNumeroTurma] = useState('');
  const [operacaoId, setOperacaoId] = useState(''); 
  const [responsavelMatricula, setResponsavelMatricula] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataAlo, setDataAlo] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [sala, setSala] = useState('');

  const [colaboradores, setColaboradores] = useState<NovoColaboradorItem[]>([]);
  const [excelPasteText, setExcelPasteText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [resEquipe, resOps] = await Promise.all([
          supabase.from('equipe').select('*'),
          supabase.from('operacoes').select('*')
        ]);
        if (resEquipe.data) setEquipe(resEquipe.data);
        if (resOps.data) setOperacoes(resOps.data);
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, []);

  // Lógica para processar o texto colado do Excel
  const handleParseExcel = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const novosColaboradores: NovoColaboradorItem[] = lines.map(line => {
      const [matricula, nome, cpf, data_admissao, jornada, grupo_30] = line.split('\t');
      return {
        matricula: matricula || '',
        nome: nome || '',
        cpf: cpf || '',
        data_admissao: data_admissao || '',
        jornada: jornada || 'Integral',
        grupo_30_horas: grupo_30?.trim().toLowerCase() === 'sim' || false
      };
    });
    setColaboradores(novosColaboradores);
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Inserir a Turma
      const { error: errorTurma } = await supabase
        .from('turmas')
        .insert({
          numero_turma: numeroTurma.trim(),
          responsavel_matricula: responsavelMatricula,
          operacao_id: Number(operacaoId),
          data_inicio: dataInicio,
          data_alo: dataAlo,
          data_fim: dataFim,
          sala: sala,
          status: 'Em Andamento'
        });

      if (errorTurma) throw errorTurma;

      // 2. Inserir os Colaboradores
      const loteInclusao = colaboradores.map((c) => ({
        turma_numero: numeroTurma.trim(),
        matricula: c.matricula.trim(),
        nome: c.nome.trim(),
        cpf: c.cpf.replace(/\D/g, ''),
        data_admissao: c.data_admissao,
        jornada: c.jornada,
        grupo_30_horas: c.grupo_30_horas,
        status: 'Ativo'
      }));

      const { error: errorColaboradores } = await supabase.from('colaboradores').insert(loteInclusao);
      if (errorColaboradores) throw errorColaboradores;

      setSuccess(true);
    } catch (err: any) {
      setError(`Erro ao salvar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) return <div className="p-10 text-center">Carregando...</div>;

  if (success) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center">
        <h2 className="text-2xl font-bold">Turma Cadastrada com Sucesso!</h2>
        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">Nova Turma</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Criação de Turmas</h1>
      {error && <div className="p-4 bg-rose-50 text-rose-700 rounded-lg">{error}</div>}
      <form onSubmit={handleSaveAll} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda: Dados da Turma */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl border space-y-4">
            {/* ... seus inputs de turma ... */}
            <label className="block text-sm font-bold">Número da Turma *</label>
            <input type="text" value={numeroTurma} onChange={(e) => setNumeroTurma(e.target.value)} className="w-full border rounded p-2" required />
            <label className="block text-sm font-bold">Responsável *</label>
            <select value={responsavelMatricula} onChange={(e) => setResponsavelMatricula(e.target.value)} className="w-full border rounded p-2" required>
                <option value="">Selecione...</option>
                {equipe.map((m) => <option key={m.matricula} value={m.matricula}>{m.nome}</option>)}
            </select>
            <label className="block text-sm font-bold">Operação *</label>
            <select value={operacaoId} onChange={(e) => setOperacaoId(e.target.value)} className="w-full border rounded p-2" required>
                <option value="">Selecione...</option>
                {operacoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
        </div>

        {/* Coluna Direita: Importação em Lote */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-6 rounded-xl border">
            <h2 className="font-bold mb-2">Importar Operadores (Cole do Excel)</h2>
            <textarea 
              className="w-full h-32 border rounded p-2 text-sm"
              placeholder="Cole aqui os dados copiados do Excel (Matrícula, Nome, CPF, Data, Jornada, Grupo 30h)..."
              value={excelPasteText}
              onChange={(e) => {
                setExcelPasteText(e.target.value);
                handleParseExcel(e.target.value);
              }}
            />
          </div>

          {colaboradores.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-xs">
                    <thead className="bg-slate-100">
                        <tr>
                            <th className="p-2">Matrícula</th>
                            <th className="p-2">Nome</th>
                            <th className="p-2">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {colaboradores.map((c, idx) => (
                            <tr key={idx} className="border-b">
                                <td className="p-2">{c.matricula}</td>
                                <td className="p-2">{c.nome}</td>
                                <td className="p-2"><button type="button" onClick={() => setColaboradores(colaboradores.filter((_, i) => i !== idx))}><Trash2 size={14} className="text-red-500"/></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          )}

          <button type="submit" disabled={loading || colaboradores.length === 0} className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold disabled:bg-gray-300">
            {loading ? 'Salvando...' : 'Salvar Turma e Operadores'}
          </button>
        </div>
      </form>
    </div>
  );
}
