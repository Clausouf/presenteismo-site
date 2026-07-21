'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Trash2, BookOpen, Users, ClipboardList, CheckCircle2,
  Hash, UserCheck, Building2, MapPin, CalendarDays, Clock,
  Upload, ChevronDown, AlertCircle, Loader2, Plus,
} from 'lucide-react';

interface NovoColaboradorItem {
  matricula: string;
  nome: string;
  cpf: string;
  data_admissao: string;
  jornada: string;
  grupo_30_horas: boolean;
}

// ── CAMPO REUTILIZÁVEL ───────────────────────────────────────────────────────
function Field({
  label,
  required,
  icon: Icon,
  children,
}: {
  label: string;
  required?: boolean;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide">
        <Icon className="w-3.5 h-3.5 text-gray-400" />
        {label}
        {required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent transition-all';

const selectCls =
  'w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent transition-all cursor-pointer pr-9';

// ── SELECT COM CHEVRON ───────────────────────────────────────────────────────
function SelectField({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={selectCls} {...props}>
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

// ── TELA DE SUCESSO ──────────────────────────────────────────────────────────
function SuccessScreen({ onReset }: { onReset: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center max-w-md w-full">
        <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-9 h-9 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Turma Cadastrada!</h2>
        <p className="text-sm text-gray-500 mb-7">
          A turma e os operadores foram salvos com sucesso no sistema.
        </p>
        <button
          onClick={onReset}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors shadow-sm"
        >
          Cadastrar Nova Turma
        </button>
      </div>
    </div>
  );
}

// ── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function CadastroTurmaPage() {
  const [equipe, setEquipe] = useState<any[]>([]);
  const [operacoes, setOperacoes] = useState<any[]>([]);
  const [salas, setSalas] = useState<any[]>([]);

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
          supabase.from('salas').select('*'),
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
    const lines = text.split('\n').filter((line) => line.trim() !== '');
    const novos: NovoColaboradorItem[] = lines.map((line) => {
      const [matricula, nome, cpf, data_admissao, jornada, grupo_30] = line.split('\t');
      return {
        matricula: matricula || '',
        nome: nome || '',
        cpf: cpf || '',
        data_admissao: data_admissao || '',
        jornada: jornada || 'Integral',
        grupo_30_horas: grupo_30?.trim().toLowerCase() === 'sim' || false,
      };
    });
    setColaboradores(novos);
  };

  const formatarDataParaBanco = (data: string) => {
    if (!data) return null;
    const partes = data.trim().split('/');
    if (partes.length === 3) return `${partes[2]}-${partes[1]}-${partes[0]}`;
    return data;
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: errorTurma } = await supabase.from('turmas').insert({
        numero_turma: numeroTurma.trim(),
        responsavel_matricula: responsavelMatricula,
        operacao_id: Number(operacaoId),
        data_inicio: dataInicio || null,
        data_alo: dataAlo || null,
        data_fim: dataFim || null,
        sala: sala || null,
        horario: horarioInicio || null,
        status: 'Em Andamento',
      });
      if (errorTurma) throw errorTurma;

      const lote = colaboradores.map((c) => ({
        numero_turma: numeroTurma.trim(),
        matricula: c.matricula.trim(),
        nome: c.nome.trim(),
        cpf: c.cpf.replace(/\D/g, ''),
        data_admissao: formatarDataParaBanco(c.data_admissao),
        jornada: c.jornada,
        grupo_30_horas: c.grupo_30_horas,
        status: 'Ativo',
      }));

      const { error: errorColabs } = await supabase.from('colaboradores').insert(lote);
      if (errorColabs) throw errorColabs;

      setSuccess(true);
    } catch (err: any) {
      setError(`Erro ao salvar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── LOADING INICIAL ──
  if (loadingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Carregando formulário...</p>
        </div>
      </div>
    );
  }

  if (success) return <SuccessScreen onReset={() => window.location.reload()} />;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* ── CABEÇALHO ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">Criação de Turma</h1>
            <p className="text-xs text-gray-400">Preencha os dados e importe os operadores para cadastrar uma nova turma</p>
          </div>
        </div>

        {/* ── ALERTA DE ERRO ── */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl">
            <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-rose-700 font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSaveAll} className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── COLUNA ESQUERDA: DADOS DA TURMA ── */}
          <div className="lg:col-span-1 space-y-5">

            {/* Identificação */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-bold text-gray-700">Identificação</span>
              </div>
              <div className="px-5 py-4 space-y-4">
                <Field label="Número da Turma" required icon={Hash}>
                  <input
                    type="text"
                    value={numeroTurma}
                    onChange={(e) => setNumeroTurma(e.target.value)}
                    className={inputCls}
                    placeholder="Ex: T-2026-001"
                    required
                  />
                </Field>

                <Field label="Responsável" required icon={UserCheck}>
                  <SelectField
                    value={responsavelMatricula}
                    onChange={(e) => setResponsavelMatricula(e.target.value)}
                    required
                  >
                    <option value="">Selecione o responsável...</option>
                    {equipe.map((m) => (
                      <option key={m.matricula} value={m.matricula}>{m.nome}</option>
                    ))}
                  </SelectField>
                </Field>

                <Field label="Operação" required icon={Building2}>
                  <SelectField
                    value={operacaoId}
                    onChange={(e) => setOperacaoId(e.target.value)}
                    required
                  >
                    <option value="">Selecione a operação...</option>
                    {operacoes.map((o) => (
                      <option key={o.id} value={o.id}>{o.nome}</option>
                    ))}
                  </SelectField>
                </Field>

                <Field label="Sala" required icon={MapPin}>
                  <SelectField
                    value={sala}
                    onChange={(e) => setSala(e.target.value)}
                    required
                  >
                    <option value="">Selecione a sala...</option>
                    {salas.map((s) => (
                      <option key={s.id} value={s.nome}>{s.nome}</option>
                    ))}
                  </SelectField>
                </Field>
              </div>
            </div>

            {/* Período */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-bold text-gray-700">Período</span>
              </div>
              <div className="px-5 py-4 space-y-4">
                <Field label="Data Início" required icon={CalendarDays}>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className={inputCls}
                    required
                  />
                </Field>

                <Field label="Data 1º Alô" icon={CalendarDays}>
                  <input
                    type="date"
                    value={dataAlo}
                    onChange={(e) => setDataAlo(e.target.value)}
                    className={inputCls}
                  />
                </Field>

                <Field label="Data Fim" required icon={CalendarDays}>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className={inputCls}
                    required
                  />
                </Field>

                <Field label="Horário de Início" required icon={Clock}>
                  <input
                    type="time"
                    value={horarioInicio}
                    onChange={(e) => setHorarioInicio(e.target.value)}
                    className={inputCls}
                    required
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* ── COLUNA DIREITA: OPERADORES ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Import Excel */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-bold text-gray-700">Importar Operadores</span>
                </div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide bg-gray-100 px-2 py-1 rounded-lg">
                  Cole do Excel
                </span>
              </div>
              <div className="px-5 py-4 space-y-3">
                <p className="text-xs text-gray-500 leading-relaxed">
                  Copie as colunas do Excel na ordem: <span className="font-semibold text-gray-700">Matrícula → Nome → CPF → Data Admissão → Jornada → Grupo 30h</span>
                </p>
                <textarea
                  className="w-full h-28 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-xs font-mono text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent resize-none transition-all"
                  placeholder="Cole aqui os dados copiados do Excel..."
                  value={excelPasteText}
                  onChange={(e) => {
                    setExcelPasteText(e.target.value);
                    handleParseExcel(e.target.value);
                  }}
                />
              </div>
            </div>

            {/* Tabela de operadores */}
            {colaboradores.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-bold text-gray-700">Operadores Importados</span>
                  </div>
                  <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2.5 py-1 rounded-full">
                    {colaboradores.length} operador{colaboradores.length !== 1 ? 'es' : ''}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wide w-8">#</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Matrícula</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Nome</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Jornada</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wide">30h</th>
                        <th className="px-4 py-3 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {colaboradores.map((c, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/30 transition-colors group/row">
                          <td className="px-4 py-2.5 text-gray-400 font-medium">{idx + 1}</td>
                          <td className="px-4 py-2.5">
                            <span className="font-mono text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">
                              {c.matricula}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-semibold text-gray-800">{c.nome}</td>
                          <td className="px-4 py-2.5 text-gray-500">{c.jornada || '—'}</td>
                          <td className="px-4 py-2.5">
                            {c.grupo_30_horas ? (
                              <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Sim</span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => setColaboradores(colaboradores.filter((_, i) => i !== idx))}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover/row:opacity-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Estado vazio — sem operadores */}
            {colaboradores.length === 0 && excelPasteText === '' && (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-12 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
                  <Users className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-sm font-semibold text-gray-400">Nenhum operador importado</p>
                <p className="text-xs text-gray-400 mt-1">Cole os dados do Excel no campo acima para importar.</p>
              </div>
            )}

            {/* Botão de salvar */}
            <button
              type="submit"
              disabled={loading || colaboradores.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl transition-colors shadow-sm text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Salvar Turma e Operadores
                  {colaboradores.length > 0 && (
                    <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ml-1">
                      {colaboradores.length}
                    </span>
                  )}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
