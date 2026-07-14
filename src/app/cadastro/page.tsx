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
  const [salas, setSalas] = useState<any[]>([]);

  // Estados do formulário da Turma
  const [numeroTurma, setNumeroTurma] = useState('');
  const [operacaoId, setOperacaoId] = useState(''); 
  const [responsavelMatricula, setResponsavelMatricula] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataAlo, setDataAlo] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [sala, setSala] = useState('');
  const [horarioInicio, setHorarioInicio] = useState(''); 

  const [colaboradores, setColaboradores] = useState<NovoColaboradorItem[]>([]);
  const [excelPasteText, setExcelPasteText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [resEquipe, resOps, resSalas] = await Promise.all([
          supabase.from('equipe').select('*'),
          supabase.from('operacoes').select('*'),
          supabase.from('salas').select('*') 
        ]);
        if (resEquipe.data) setEquipe(resEquipe.data);
        if (resOps.data) setOperacoes(resOps.data);
        if (resSalas.data) setSalas(resSalas.data);
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, []);

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

  const formatarDataParaBanco = (data: string) => {
    if (!data) return null;
    const partes = data.trim().split('/');
    if (partes.length === 3) {
      return `${partes[2]}-${partes[1]}-${partes[0]}`;
    }
    return data;
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: errorTurma } = await supabase
        .from('turmas')
        .insert({
          numero_turma: numeroTurma.trim(),
          responsavel_matricula: responsavelMatricula,
          operacao_id: Number(operacaoId),
          data_inicio: dataInicio || null,
          data_alo: dataAlo || null,
          data_fim: dataFim || null,
          sala: sala || null,
          horario: horarioInicio || null,
          status: 'Em Andamento'
        });

      if (errorTurma) throw errorTurma;

      const loteInclusao = colaboradores.map((c) => ({
        turma_numero: numeroTurma.trim(),
        matricula: c.matricula.trim(),
        nome: c.nome.trim(),
        cpf: c.cpf.replace(/\D/g, ''),
        data_admissao: formatarDataParaBanco(c.data_admissao),
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

  if (loadingData) return <div className="p-10 text-center">Carregando dados necessários...</div>;

  if (success) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center bg-white rounded-xl shadow mt-10">
        <h2 className="text-2xl font-bold text-emerald-600 mb-2">Turma Cadastrada com Sucesso!</h2>
        <p className="text-slate-500 mb-6">A turma e os colaboradores foram salvos no banco de dados.</p>
        <button onClick={() => window.location.reload()} className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors">
          Cadastrar Nova Turma
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Criação de Turmas</h1>
        <p className="text-sm text-slate-500 mt-1">Preencha os dados da turma e importe os colaboradores copiando do Excel.</p>
      </div>

      {error && <div className="p-4 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-medium">{error}</div>}
      
      <form onSubmit={handleSaveAll} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Número da Turma *</label>
              <input type="text" value={numeroTurma} onChange={(e) => setNumeroTurma(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Responsável *</label>
              <select value={responsavelMatricula} onChange={(e) => setResponsavelMatricula(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" required>
                  <option value="">Selecione...</option>
                  {equipe.map((m) => <option key={m.matricula} value={m.matricula}>{m.nome}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Operação *</label>
              <select value={operacaoId} onChange={(e) => setOperacaoId(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" required>
                  <option value="">Selecione...</option>
                  {operacoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Data Início *</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Horário de Início *</label>
              <input type="time" value={horarioInicio} onChange={(e) => setHorarioInicio(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Data 1º Alô</label>
              <input type="date" value={dataAlo} onChange={(e) => setDataAlo(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Data Fim *</label>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Sala</label>
              <select value={sala} onChange={(e) => setSala(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">Selecione a sala...</option>
                  {salas.map((s) => <option key={s.id} value={s.nome}>{s.nome}</option>)}
              </select>
            </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="font-bold text-slate-800 mb-2">Importar Operadores (Cole do Excel)</h2>
            <textarea 
              className="w-full h-32 border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              placeholder="Cole aqui os dados copiados do Excel (Matrícula, Nome, CPF, Data Admissão, Jornada, Grupo 30h)..."
              value={excelPasteText}
              onChange={(e) => {
                setExcelPasteText(e.target.value);
                handleParseExcel(e.target.value);
              }}
            />
          </div>

          {colaboradores.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <tr>
                            <th className="p-3 font-bold">Matrícula</th>
                            <th className="p-3 font-bold">Nome</th>
                            <th className="p-3 font-bold text-center w-20">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {colaboradores.map((c, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="p-3 font-medium text-slate-800">{c.matricula}</td>
                                <td className="p-3 text-slate-600">{c.nome}</td>
                                <td className="p-3 text-center w-20">
                                  <button 
                                    type="button" 
                                    onClick={() => setColaboradores(colaboradores.filter((_, i) => i !== idx))}
                                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading || colaboradores.length === 0} 
            className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {loading ? 'Salvando dados...' : 'Salvar Turma e Operadores'}
          </button>
        </div>
      </form>
    </div>
  );
}
