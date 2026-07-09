'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { 
  PlusCircle, 
  Users, 
  Calendar, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  Table, 
  HelpCircle,
  Clock
} from 'lucide-react';
import { Operacao, Analista, Instrutor } from '@/types/database.types';

// Interface interna de controle dos colaboradores pré-salvamento
interface NovoColaboradorItem {
  matricula: string;
  nome: string;
  cpf: string;
  data_admissao: string;
  jornada: string;
  grupo_30_horas: boolean;
}

export default function CadastroTurmaPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Listas de Seletores carregados do Banco
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [analistas, setAnalistas] = useState<Analista[]>([]);
  const [instrutores, setInstrutores] = useState<Instrutor[]>([]);

  // Dados do Formulário da Turma
  const [numeroTurma, setNumeroTurma] = useState('');
  const [operacaoId, setOperacaoId] = useState('');
  const [analistaId, setAnalistaId] = useState('');
  const [instrutorId, setInstrutorId] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [diasTreinamento, setDiasTreinamento] = useState(12);
  const [diasAlo, setDiasAlo] = useState(3);

  // Lista Dinâmica de Operadores
  const [colaboradores, setColaboradores] = useState<NovoColaboradorItem[]>([]);
  const [excelPasteText, setExcelPasteText] = useState('');
  const [showPasteHelper, setShowPasteHelper] = useState(false);

  // Estados de Interface e Feedback
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successTurmaId, setSuccessTurmaId] = useState<string | null>(null);

  // Carrega os dados auxiliares do Supabase ao montar a tela
  useEffect(() => {
    async function loadSelectData() {
      try {
        const [resOps, resAnas, resInsts] = await Promise.all([
          supabase.from('operacoes').select('*').eq('status', 'Ativo').order('nome'),
          supabase.from('analistas').select('*').eq('status', 'Ativo').order('nome'),
          supabase.from('instrutores').select('*').eq('status', 'Ativo').order('nome')
        ]);

        if (resOps.data) setOperacoes(resOps.data as Operacao[]);
        if (resAnas.data) setAnalistas(resAnas.data as Analista[]);
        if (resInsts.data) setInstrutores(resInsts.data as Instrutor[]);

      } catch (err) {
        console.error('Erro ao carregar seletores auxiliares:', err);
      } finally {
        setLoadingData(false);
      }
    }

    loadSelectData();
  }, []);

  // Processador de texto em lote do Excel (Parsing de Tabulação)
  const handleProcessExcelPaste = () => {
    if (!excelPasteText.trim()) return;

    const linhas = excelPasteText.split('\n');
    const novosColaboradores: NovoColaboradorItem[] = [];

    linhas.forEach((linha) => {
      if (!linha.trim()) return;

      // O Excel separa colunas com tabulação ("\t") ao copiar e colar
      const colunas = linha.split('\t');

      // Mapeamento esperado: Matrícula | Nome | CPF | Data Admissão | Horário/Jornada | 30h (S/N)
      const matricula = colunas[0]?.trim() || '';
      const nome = colunas[1]?.trim() || '';
      const cpf = colunas[2]?.trim() || '';
      const data_admissao = colunas[3]?.trim() || '';
      const jornada = colunas[4]?.trim() || 'Ope Seg-Sab';
      const is30hRaw = colunas[5]?.toLowerCase().trim() || 'n';
      const grupo_30_horas = is30hRaw === 's' || is30hRaw === 'sim' || is30hRaw === 'y' || is30hRaw === 'true';

      if (matricula && nome) {
        novosColaboradores.push({
          matricula,
          nome,
          cpf: formatCPF(cpf),
          data_admissao: formatDateForInput(data_admissao),
          jornada,
          grupo_30_horas
        });
      }
    });

    if (novosColaboradores.length > 0) {
      setColaboradores([...colaboradores, ...novosColaboradores]);
      setExcelPasteText('');
      setError(null);
    } else {
      setError('Não conseguimos identificar colunas válidas. Certifique-se de que copiou a matrícula e o nome.');
    }
  };

  // Funções Utilitárias para Tratamento e Máscaras
  const formatCPF = (rawCpf: string) => {
    const clean = rawCpf.replace(/\D/g, '');
    if (clean.length !== 11) return clean;
    return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
  };

  const formatDateForInput = (rawDate: string) => {
    if (!rawDate) return '';
    // Converte datas no formato brasileiro DD/MM/AAAA para AAAA-MM-DD exigido pelo campo date do html
    const parts = rawDate.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return rawDate;
  };

  // Exclusão manual de linha do lote
  const handleRemoveColaborador = (index: number) => {
    setColaboradores(colaboradores.filter((_, idx) => idx !== index));
  };

  // Adição de linha manual em branco
  const handleAddColaboradorManual = () => {
    setColaboradores([
      ...colaboradores,
      {
        matricula: '',
        nome: '',
        cpf: '',
        data_admissao: dataInicio || '',
        jornada: 'Ope Seg-Sab 13:50 - 20:10',
        grupo_30_horas: false
      }
    ]);
  };

  // Monitor de alteração das linhas da tabela manual
  const handleUpdateColaboradorRow = (index: number, field: keyof NovoColaboradorItem, val: any) => {
    const updated = [...colaboradores];
    updated[index] = { ...updated[index], [field]: val };
    setColaboradores(updated);
  };

  // Ação Principal: Salvar Turma + Lote de Operadores no Banco de dados
  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validação da Turma
    if (!numeroTurma || !operacaoId || !analistaId || !instrutorId || !dataInicio || !dataFim) {
      setError('Por favor, preencha todas as informações cadastrais da turma.');
      setLoading(false);
      return;
    }

    // Validação da Lista de Operadores
    if (colaboradores.length === 0) {
      setError('É obrigatório incluir pelo menos 1 operador na turma para realizar a criação.');
      setLoading(false);
      return;
    }

    // Validação profunda das colunas inseridas para evitar erros de constraint no Postgres
    for (let i = 0; i < colaboradores.length; i++) {
      const c = colaboradores[i];
      if (!c.matricula.trim() || !c.nome.trim() || !c.cpf.trim() || !c.data_admissao) {
        setError(`Erro na linha ${i + 1}: Matrícula, Nome, CPF e Data de Admissão são obrigatórios.`);
        setLoading(false);
        return;
      }
    }

    try {
      // 1. Inserir a nova Turma
      const { data: turmaCriada, error: errorTurma } = await supabase
        .from('turmas')
        .insert({
          numero_turma: numeroTurma.trim(),
          operacao_id: operacaoId,
          analista_id: analistaId,
          instrutor_id: instrutorId,
          data_inicio: dataInicio,
          data_fim: dataFim,
          dias_treinamento: diasTreinamento,
          dias_alo: diasAlo,
          status: 'Em Andamento',
          user_criador: user?.id || null
        })
        .select()
        .single();

      if (errorTurma) {
        if (errorTurma.code === '23505') {
          setError('Conflito: Já existe uma turma cadastrada com este mesmo número.');
        } else {
          setError(`Erro ao salvar a turma: ${errorTurma.message}`);
        }
        setLoading(false);
        return;
      }

      // 2. Preparar os operadores com a FK (turma_id) recém criada
      const loteInclusao = colaboradores.map((c) => ({
        turma_id: turmaCriada.id,
        matricula: c.matricula.trim(),
        nome: c.nome.trim(),
        cpf: c.cpf.replace(/\D/g, ''), // remove pontos/hifens do CPF para o banco
        data_admissao: c.data_admissao,
        jornada: c.jornada,
        grupo_30_horas: c.grupo_30_horas,
        status: 'Ativo'
      }));

      // 3. Inserir todos os operadores em lote (Bulk Insert)
      const { error: errorColaboradores } = await supabase
        .from('colaboradores')
        .insert(loteInclusao);

      if (errorColaboradores) {
        // Ação de Rollback Manual se a inserção de colaboradores quebrar
        await supabase.from('turmas').delete().eq('id', turmaCriada.id);
        
        if (errorColaboradores.code === '23505') {
          setError('Um ou mais colaboradores possuem CPF ou Matrícula duplicada no sistema.');
        } else {
          setError(`Erro crítico ao processar o lote de colaboradores: ${errorColaboradores.message}`);
        }
        setLoading(false);
        return;
      }

      // Sucesso Absoluto
      setSuccessTurmaId(turmaCriada.id);

    } catch (err) {
      setError('Ocorreu uma falha inesperada durante a transação de salvamento.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Carregando parâmetros operacionais...</p>
      </div>
    );
  }

  // Tela de Sucesso Completo com Botões de Navegação Direta
  if (successTurmaId) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-slate-100 rounded-2xl p-8 text-center shadow-xl my-8 animate-fadeIn">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full mb-6">
          <CheckCircle2 size={36} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Turma e Operadores Cadastrados!</h2>
        <p className="text-slate-500 mt-3 text-sm leading-relaxed">
          A turma <strong>Nº {numeroTurma}</strong> foi ativada e o lote de <strong>{colaboradores.length} operadores</strong> foi vinculado e registrado no banco de dados com absoluto sucesso.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => {
              // Reseta o formulário
              setSuccessTurmaId(null);
              setNumeroTurma('');
              setColaboradores([]);
            }}
            className="px-5 py-3 border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium rounded-xl text-sm transition-colors"
          >
            Cadastrar Nova Turma
          </button>
          
          <button
            onClick={() => router.push(`/turmas?id=${successTurmaId}`)}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-sm shadow-md shadow-blue-500/10 flex items-center justify-center gap-2 transition-colors"
          >
            Acessar Diário de Presença
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Tela */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Criação de Turmas</h1>
          <p className="text-sm text-slate-500 mt-1">Abra turmas operacionais e inclua seus respectivos colaboradores em lote.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-sm animate-fadeIn">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSaveAll} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* COLUNA Esquerda: Cadastro Básico da Turma */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-5 md:p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-2">
            <PlusCircle size={18} className="text-blue-500" />
            <h2 className="font-semibold text-slate-900">Configurações Básicas</h2>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Número da Turma *</label>
            <input
              type="text"
              value={numeroTurma}
              onChange={(e) => setNumeroTurma(e.target.value)}
              placeholder="Ex: Turma 8"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Operação / Conta *</label>
            <select
              value={operacaoId}
              onChange={(e) => setOperacaoId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              required
            >
              <option value="">Selecione...</option>
              {operacoes.map((op) => (
                <option key={op.id} value={op.id}>{op.codigo_operacao} - {op.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Analista Responsável *</label>
            <select
              value={analistaId}
              onChange={(e) => setAnalistaId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              required
            >
              <option value="">Selecione...</option>
              {analistas.map((ana) => (
                <option key={ana.id} value={ana.id}>{ana.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Multiplicador / Instrutor *</label>
            <select
              value={instrutorId}
              onChange={(e) => setInstrutorId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              required
            >
              <option value="">Selecione...</option>
              {instrutores.map((inst) => (
                <option key={inst.id} value={inst.id}>{inst.nome}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Data Início *</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Data Fim *</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Dias Treino</label>
              <input
                type="number"
                value={diasTreinamento}
                onChange={(e) => setDiasTreinamento(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                min="1"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Dias ALÔ</label>
              <input
                type="number"
                value={diasAlo}
                onChange={(e) => setDiasAlo(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                min="0"
              />
            </div>
          </div>
        </div>

        {/* COLUNA Direita: Caixa de Importação e Tabela de Operadores */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Caixa Inteligente de Copiar e Colar (Excel) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Table size={18} className="text-blue-500" />
                <h2 className="font-semibold text-slate-900">Importação em Lote do Excel</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPasteHelper(!showPasteHelper)}
                className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1 font-medium"
              >
                <HelpCircle size={14} /> Como funciona?
              </button>
            </div>

            {showPasteHelper && (
              <div className="mb-4 text-xs bg-slate-50 border border-slate-200 text-slate-600 p-4 rounded-lg leading-relaxed space-y-1.5">
                <p className="font-semibold text-slate-800">Siga a ordem de colunas na sua planilha do Excel antes de copiar:</p>
                <p className="text-blue-600 font-mono">1. Matrícula | 2. Nome | 3. CPF | 4. Data Admissão (DD/MM/AAAA) | 5. Horário/Jornada | 6. 30 Horas? (Sim/Não)</p>
                <p className="mt-1 text-slate-500">Selecione e copie as linhas do Excel, cole na caixa abaixo e clique em <strong className="text-slate-700">"Anexar Linhas"</strong>.</p>
              </div>
            )}

            <div className="space-y-3">
              <textarea
                value={excelPasteText}
                onChange={(e) => setExcelPasteText(e.target.value)}
                placeholder="Cole as colunas de dados copiadas da planilha Excel diretamente aqui..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-mono h-24 resize-none"
              />
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-400">Total no lote pronto: <strong>{colaboradores.length}</strong></p>
                <button
                  type="button"
                  onClick={handleProcessExcelPaste}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs transition-colors"
                >
                  Anexar Linhas do Lote
                </button>
              </div>
            </div>
          </div>

          {/* Grid de Visualização e Ajustes Finos (Spreadsheet-like) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-blue-500" />
                <h2 className="font-semibold text-slate-900">Lista dos Operadores Vinculados</h2>
              </div>
              <button
                type="button"
                onClick={handleAddColaboradorManual}
                className="px-3 py-1.5 text-xs border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-lg font-semibold flex items-center gap-1 transition-colors self-start"
              >
                + Adicionar Manualmente
              </button>
            </div>

            {colaboradores.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 rounded-lg">
                <Users size={24} className="mx-auto text-slate-300" />
                <p className="text-sm font-medium text-slate-500 mt-2">Nenhum operador adicionado.</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Use a caixa acima de copiar e colar para popular o lote em segundos.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-96">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-3 w-20">Matrícula</th>
                      <th className="p-3">Nome Completo</th>
                      <th className="p-3 w-28">CPF</th>
                      <th className="p-3 w-28">Admissão</th>
                      <th className="p-3">Jornada/Horário</th>
                      <th className="p-3 text-center w-16">30h</th>
                      <th className="p-3 text-center w-10">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {colaboradores.map((col, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/40">
                        <td className="p-2">
                          <input
                            type="text"
                            value={col.matricula}
                            onChange={(e) => handleUpdateColaboradorRow(idx, 'matricula', e.target.value)}
                            className="w-full bg-transparent border-0 border-b border-transparent focus:border-blue-500 focus:ring-0 p-1"
                            placeholder="38823"
                            required
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={col.nome}
                            onChange={(e) => handleUpdateColaboradorRow(idx, 'nome', e.target.value)}
                            className="w-full bg-transparent border-0 border-b border-transparent focus:border-blue-500 focus:ring-0 p-1 font-medium"
                            placeholder="Mariana Novais Mira"
                            required
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={col.cpf}
                            onChange={(e) => handleUpdateColaboradorRow(idx, 'cpf', formatCPF(e.target.value))}
                            className="w-full bg-transparent border-0 border-b border-transparent focus:border-blue-500 focus:ring-0 p-1"
                            placeholder="000.000.000-00"
                            maxLength={14}
                            required
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="date"
                            value={col.data_admissao}
                            onChange={(e) => handleUpdateColaboradorRow(idx, 'data_admissao', e.target.value)}
                            className="w-full bg-transparent border-0 border-b border-transparent focus:border-blue-500 focus:ring-0 p-1"
                            required
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={col.jornada}
                            onChange={(e) => handleUpdateColaboradorRow(idx, 'jornada', e.target.value)}
                            className="w-full bg-transparent border-0 border-b border-transparent focus:border-blue-500 focus:ring-0 p-1"
                            placeholder="Ope Seg-Sab 13:50 - 20:10"
                            required
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={col.grupo_30_horas}
                            onChange={(e) => handleUpdateColaboradorRow(idx, 'grupo_30_horas', e.target.checked)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveColaborador(idx)}
                            className="text-rose-500 hover:text-rose-600 p-1 hover:bg-rose-50 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Botão de Cadastro Central do Formulário */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm shadow-md shadow-blue-500/10 flex items-center gap-2 disabled:opacity-50 transition-all"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Salvando Turma e Operadores...
                </>
              ) : (
                'Salvar Turma e Lote de Operadores'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
