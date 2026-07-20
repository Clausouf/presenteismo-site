'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Trash2, ChevronDown, BookOpen, Clock, MapPin, User,
  AlertCircle, TrendingDown, MessageSquare, Plus, Calendar, X,
  CreditCard, Briefcase, Timer,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_OPTIONS = [
  { value: 'Em Andamento', label: 'Em Andamento' },
  { value: 'Finalizada',   label: 'Finalizada'   },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'Em Andamento': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'Finalizada':   { bg: 'bg-slate-100',  text: 'text-slate-600',   dot: 'bg-slate-400'  },
};

const REGISTRO_COLORS: Record<string, string> = {
  'Presença':              'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Folga':                 'bg-sky-50 text-sky-700 border-sky-200',
  'Falta Injustificada':   'bg-rose-50 text-rose-700 border-rose-200',
  'Falta Integração':      'bg-orange-50 text-orange-700 border-orange-200',
  'Desistência':           'bg-purple-50 text-purple-700 border-purple-200',
  'Desligamento a Pedido': 'bg-slate-100 text-slate-600 border-slate-300',
  'Atestado':              'bg-amber-50 text-amber-700 border-amber-200',
  '':                      'bg-white text-slate-400 border-slate-200',
};

// ── MODAL DE DADOS DO OPERADOR ───────────────────────────────────────────────
function OperadorModal({ colab, onClose }: { colab: any; onClose: () => void }) {
  // Fecha ao pressionar Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    // Overlay
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      {/* Card do modal — clique interno não fecha */}
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">{colab.nome}</p>
              <p className="text-slate-400 text-xs mt-0.5">Dados do Operador</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo */}
        <div className="px-5 py-4 space-y-3">
          {/* Matrícula */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Matrícula</p>
              <p className="text-sm font-bold text-gray-800">{colab.matricula || '—'}</p>
            </div>
          </div>

          {/* Jornada */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Jornada</p>
              <p className="text-sm font-bold text-gray-800">{colab.jornada || '—'}</p>
            </div>
          </div>

          {/* Grupo 30h */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Timer className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Grupo 30h</p>
              <p className="text-sm font-bold text-gray-800">
                {colab.grupo_30_horas === true ? (
                  <span className="text-emerald-600">Sim</span>
                ) : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-4">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function FormattedDate({ dateString }: { dateString: string }) {
  const [date, setDate] = useState<string>('');
  useEffect(() => { setDate(new Date(dateString).toLocaleString('pt-BR')); }, [dateString]);
  return <span>{date}</span>;
}

// ── COMPONENTE DA TURMA ──────────────────────────────────────────────────────
function TabelaTurma({ turma, responsavelNome, colaboradores, presencas, obsInicial, onUpdate, onStatusChange, onDeleteTurma }: any) {
  const [observacoes, setObservacoes] = useState(obsInicial || []);
  const [novaObs, setNovaObs] = useState('');
  const [obsOpen, setObsOpen] = useState(false);
  const [operadorSelecionado, setOperadorSelecionado] = useState<any | null>(null);

  const datas = gerarArrayDatas(turma.data_inicio, turma.data_fim);
  const statusColor = STATUS_COLORS[turma.status] || STATUS_COLORS['Em Andamento'];

  const calcularIndicadores = (dataStr: string) => {
    const total = colaboradores.length;
    if (total === 0) return { absPercent: '0', desligPercent: '0' };
    const registrosDoDia = colaboradores.map((c: any) => presencas[`${c.matricula}_${dataStr}`]?.tipo_registro);
    const faltas = registrosDoDia.filter((s: string) => s === 'Falta Injustificada' || s === 'Falta Integração').length;
    const desligamentos = registrosDoDia.filter((s: string) => s === 'Desistência' || s === 'Desligamento a Pedido').length;
    return {
      absPercent: ((faltas / total) * 100).toFixed(0),
      desligPercent: ((desligamentos / total) * 100).toFixed(0),
    };
  };

  const handleSalvarObs = async () => {
    if (!novaObs.trim()) return;
    const { data, error } = await supabase
      .from('turma_observacoes')
      .insert({ numero_turma: turma.numero_turma, texto: novaObs })
      .select()
      .single();
    if (error) { alert('Erro ao salvar observação: ' + error.message); return; }
    if (data) { setObservacoes([data, ...observacoes]); setNovaObs(''); }
  };

  const handleDeleteObs = async (id: number) => {
    if (!confirm('Deseja excluir esta observação?')) return;
    const { error } = await supabase.from('turma_observacoes').delete().eq('id', id);
    if (error) { alert('Erro ao excluir observação: ' + error.message); return; }
    setObservacoes(observacoes.filter((o: any) => o.id !== id));
  };

  return (
    <>
      {/* Modal do operador — renderizado fora do card para evitar overflow:hidden */}
      {operadorSelecionado && (
        <OperadorModal
          colab={operadorSelecionado}
          onClose={() => setOperadorSelecionado(null)}
        />
      )}

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden mb-6">

        {/* ── HEADER DA TURMA ── */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-white font-bold text-base leading-tight truncate">
                Turma {turma.numero_turma}
                {responsavelNome && ` — ${responsavelNome}`}
              </h2>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                {turma.sala && (
                  <span className="flex items-center gap-1 text-slate-300 text-xs">
                    <MapPin className="w-3 h-3" /> {turma.sala}
                  </span>
                )}
                {turma.horario && (
                  <span className="flex items-center gap-1 text-slate-300 text-xs">
                    <Clock className="w-3 h-3" /> {turma.horario.substring(0, 5)}
                  </span>
                )}
                <span className="flex items-center gap-1 text-slate-300 text-xs">
                  <User className="w-3 h-3" /> {colaboradores.length} operador{colaboradores.length !== 1 ? 'es' : ''}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${statusColor.bg} ${statusColor.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusColor.dot}`} />
              <select
                value={turma.status}
                onChange={(e) => onStatusChange(turma.numero_turma, e.target.value)}
                className={`text-xs font-bold bg-transparent border-none outline-none cursor-pointer ${statusColor.text}`}
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => onDeleteTurma(turma.numero_turma)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-rose-500/80 text-white/70 hover:text-white transition-all"
              title="Excluir Turma"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── TABELA DE PRESENÇA ── */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide min-w-[200px] sticky left-0 bg-gray-50 z-10">
                  Operador
                </th>
                {datas.map((d, i) => {
                  const isIntegracao = i === 0;
                  const isAcomp = i >= datas.length - 3;
                  const label = isIntegracao ? 'Integração' : isAcomp ? 'Acomp.' : 'Treinamento';
                  const labelColor = isIntegracao ? 'text-blue-600' : isAcomp ? 'text-orange-500' : 'text-gray-400';
                  return (
                    <th key={d} className="px-1 py-3 text-center min-w-[80px]">
                      <div className={`text-[9px] font-bold uppercase tracking-wide ${labelColor}`}>{label}</div>
                      <div className="text-sm font-bold text-gray-700 mt-0.5">{d.split('-')[2]}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {colaboradores.map((c: any) => (
                <tr key={c.matricula} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-4 py-2.5 sticky left-0 bg-white hover:bg-blue-50/30 z-10">
                    {/* Botão de clique para abrir modal */}
                    <button
                      onClick={() => setOperadorSelecionado(c)}
                      className="flex items-center gap-1.5 group/btn text-left"
                      title="Ver dados do operador"
                    >
                      <span className="font-semibold text-gray-800 text-xs group-hover/btn:text-blue-600 transition-colors border-b border-dotted border-gray-300 group-hover/btn:border-blue-400">
                        {c.nome}
                      </span>
                      <span className="w-4 h-4 flex items-center justify-center rounded-full bg-gray-100 group-hover/btn:bg-blue-100 transition-colors flex-shrink-0">
                        <User className="w-2.5 h-2.5 text-gray-400 group-hover/btn:text-blue-500" />
                      </span>
                    </button>
                  </td>
                  {datas.map(d => {
                    const val = presencas[`${c.matricula}_${d}`]?.tipo_registro || '';
                    const colorClass = REGISTRO_COLORS[val] || REGISTRO_COLORS[''];
                    return (
                      <td key={d} className="px-1 py-2">
                        <select
                          value={val}
                          onChange={(e) => onUpdate(turma.numero_turma, c.matricula, c.nome, d, e.target.value)}
                          className={`w-full border rounded-lg text-[10px] px-1.5 py-1 font-medium cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${colorClass}`}
                        >
                          <option value="">--</option>
                          <option value="Presença">Presença</option>
                          <option value="Folga">Folga</option>
                          <option value="Falta Injustificada">Falta Injustificada</option>
                          <option value="Falta Integração">Falta Integração</option>
                          <option value="Desistência">Desistência</option>
                          <option value="Desligamento a Pedido">Desligamento</option>
                          <option value="Atestado">Atestado</option>
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>

            {/* ── RODAPÉ DE INDICADORES ── */}
            <tfoot>
              <tr className="bg-rose-50/60 border-t-2 border-rose-100">
                <td className="px-4 py-2.5 sticky left-0 bg-rose-50/60 z-10">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                    <span className="text-xs font-bold text-rose-700">ABS (%)</span>
                  </div>
                </td>
                {datas.map(d => {
                  const val = Number(calcularIndicadores(d).absPercent);
                  return (
                    <td key={d} className="text-center py-2.5">
                      <span className={`text-xs font-bold ${val > 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                        {val}%
                      </span>
                    </td>
                  );
                })}
              </tr>
              <tr className="bg-slate-50/60 border-t border-slate-100">
                <td className="px-4 py-2.5 sticky left-0 bg-slate-50/60 z-10">
                  <div className="flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-bold text-slate-600">Deslig./Desist. (%)</span>
                  </div>
                </td>
                {datas.map(d => {
                  const val = Number(calcularIndicadores(d).desligPercent);
                  return (
                    <td key={d} className="text-center py-2.5">
                      <span className={`text-xs font-bold ${val > 0 ? 'text-slate-700' : 'text-gray-400'}`}>
                        {val}%
                      </span>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── SEÇÃO DE OBSERVAÇÕES ── */}
        <div className="border-t border-gray-100">
          <button
            onClick={() => setObsOpen(!obsOpen)}
            className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">Observações</span>
              {observacoes.length > 0 && (
                <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {observacoes.length}
                </span>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${obsOpen ? 'rotate-180' : ''}`} />
          </button>

          {obsOpen && (
            <div className="px-5 py-4 space-y-4 bg-white">
              <div className="space-y-2">
                <textarea
                  value={novaObs}
                  onChange={(e) => setNovaObs(e.target.value)}
                  className="w-full h-20 px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent resize-none transition-all"
                  placeholder="Digite uma observação sobre esta turma..."
                />
                <button
                  onClick={handleSalvarObs}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Salvar Observação
                </button>
              </div>

              {observacoes.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  {observacoes.map((obs: any) => (
                    <div
                      key={obs.id}
                      className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 group/obs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Calendar className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          <span className="text-[10px] text-gray-400 font-medium">
                            <FormattedDate dateString={obs.created_at} />
                          </span>
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed">{obs.texto}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteObs(obs.id)}
                        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover/obs:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function DiarioPresencaPage() {
  const [equipe, setEquipe] = useState<any[]>([]);
  const [operacoes, setOperacoes] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [selectedOperacaoId, setSelectedOperacaoId] = useState<string>('todos');
  const [selectedTurmaNum, setSelectedTurmaNum] = useState<string>('');
  const [dadosDasTurmas, setDadosDasTurmas] = useState<Record<string, any>>({});
  const [loadingDados, setLoadingDados] = useState(false);

  async function carregarDados() {
    if (selectedOperacaoId === 'todos') { setDadosDasTurmas({}); return; }
    setLoadingDados(true);
    const turmasDaOp = selectedTurmaNum
      ? turmas.filter(t => t.numero_turma === selectedTurmaNum)
      : turmas.filter(t => t.operacao_id === Number(selectedOperacaoId));
    const novosDados: any = {};
    for (const t of turmasDaOp) {
      const [colabs, regs, obs] = await Promise.all([
        supabase.from('colaboradores').select('*').eq('numero_turma', t.numero_turma),
        supabase.from('diario_presenca').select('*').eq('numero_turma', t.numero_turma),
        supabase.from('turma_observacoes').select('*').eq('numero_turma', t.numero_turma).order('created_at', { ascending: false }),
      ]);
      const mapaPresencas: any = {};
      regs.data?.forEach(r => (mapaPresencas[`${r.matricula}_${r.data}`] = r));
      novosDados[t.numero_turma] = { colabs: colabs.data || [], presencas: mapaPresencas, obs: obs.data || [] };
    }
    setDadosDasTurmas(novosDados);
    setLoadingDados(false);
  }

  useEffect(() => {
    async function init() {
      const { data: o } = await supabase.from('operacoes').select('*');
      const { data: t } = await supabase.from('turmas').select('*');
      const { data: e } = await supabase.from('equipe').select('*');
      if (o) setOperacoes(o);
      if (t) setTurmas(t);
      if (e) setEquipe(e);
    }
    init();
    const channel = supabase
      .channel('turmas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turmas' }, () => init())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => { carregarDados(); }, [selectedOperacaoId, selectedTurmaNum, turmas]);

  const handleUpdatePresence = async (turmaNum: string, matricula: string, nome: string, dataStr: string, status: string) => {
    if (status === '') {
      const { error } = await supabase.from('diario_presenca').delete().eq('numero_turma', turmaNum).eq('matricula', matricula).eq('data', dataStr);
      if (error) { alert('Erro ao deletar: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('diario_presenca').upsert({ numero_turma: turmaNum, matricula, colaborador_nome: nome, data: dataStr, tipo_registro: status });
      if (error) { alert('Erro ao salvar: ' + error.message); return; }
    }
    setDadosDasTurmas(prev => {
      const newData = { ...prev };
      if (status === '') delete newData[turmaNum].presencas[`${matricula}_${dataStr}`];
      else newData[turmaNum].presencas[`${matricula}_${dataStr}`] = { ...newData[turmaNum].presencas[`${matricula}_${dataStr}`], tipo_registro: status };
      return { ...newData };
    });
  };

  const handleStatusChange = async (turmaNum: string, novoStatus: string) => {
    const { error } = await supabase.from('turmas').update({ status: novoStatus }).eq('numero_turma', turmaNum);
    if (error) { alert('Erro ao salvar no banco: ' + error.message); return; }
    setTurmas(prev => prev.map(t => t.numero_turma === turmaNum ? { ...t, status: novoStatus } : t));
  };

  const handleDeleteTurma = async (turmaNum: string) => {
    if (!confirm(`TEM CERTEZA? Isso excluirá permanentemente a Turma ${turmaNum} e todos os seus dados vinculados.`)) return;
    try {
      const { error: err1 } = await supabase.from('diario_presenca').delete().eq('numero_turma', turmaNum);
      if (err1) throw new Error(`Erro na tabela diario_presenca: ${err1.message}`);
      const { error: err2 } = await supabase.from('colaboradores').delete().eq('numero_turma', turmaNum);
      if (err2) throw new Error(`Erro na tabela colaboradores: ${err2.message}`);
      const { error: err3 } = await supabase.from('turma_observacoes').delete().eq('numero_turma', turmaNum);
      if (err3) throw new Error(`Erro na tabela turma_observacoes: ${err3.message}`);
      const { error: err4 } = await supabase.from('turmas').delete().eq('numero_turma', turmaNum);
      if (err4) throw new Error(`Erro na tabela turmas: ${err4.message}`);
      setTurmas(prev => prev.filter(t => t.numero_turma !== turmaNum));
      alert('Turma excluída com sucesso.');
    } catch (err: any) {
      console.error('Erro detalhado:', err);
      alert(err.message);
    }
  };

  const turmasFiltradas = selectedOperacaoId === 'todos'
    ? []
    : turmas.filter(t => t.operacao_id === Number(selectedOperacaoId));

  const turmasVisiveis = Object.keys(dadosDasTurmas);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-full mx-auto space-y-5">

        {/* ── BARRA DE FILTROS ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Diário de Presença</h1>
              <p className="text-xs text-gray-400">Selecione uma operação para visualizar as turmas</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Operação</label>
              <div className="relative">
                <select
                  className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent cursor-pointer pr-10 transition-all"
                  onChange={(e) => { setSelectedOperacaoId(e.target.value); setSelectedTurmaNum(''); }}
                >
                  <option value="todos">Selecione uma Operação...</option>
                  {operacoes.map(op => (
                    <option key={op.id} value={op.id}>{op.nome}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Turma</label>
              <div className="relative">
                <select
                  className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent cursor-pointer pr-10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  value={selectedTurmaNum}
                  onChange={(e) => setSelectedTurmaNum(e.target.value)}
                  disabled={selectedOperacaoId === 'todos'}
                >
                  <option value="">Todas as Turmas</option>
                  {turmasFiltradas.map(t => (
                    <option key={t.numero_turma} value={t.numero_turma}>Turma {t.numero_turma}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* ── LOADING ── */}
        {loadingDados && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-500 font-medium">Carregando turmas...</p>
            </div>
          </div>
        )}

        {/* ── ESTADO VAZIO ── */}
        {!loadingDados && selectedOperacaoId === 'todos' && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-base font-semibold text-gray-500">Nenhuma operação selecionada</p>
            <p className="text-sm text-gray-400 mt-1">Selecione uma operação no filtro acima para visualizar as turmas.</p>
          </div>
        )}

        {!loadingDados && turmasVisiveis.length === 0 && selectedOperacaoId !== 'todos' && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-base font-semibold text-gray-500">Nenhuma turma encontrada</p>
            <p className="text-sm text-gray-400 mt-1">Não há turmas com dados para esta operação.</p>
          </div>
        )}

        {/* ── TURMAS ── */}
        {!loadingDados && turmasVisiveis.map(numTurma => {
          const turmaObj = turmas.find(t => t.numero_turma === numTurma);
          const resp = equipe.find(m => m.matricula === turmaObj?.responsavel_matricula);
          if (!turmaObj || !dadosDasTurmas[numTurma]) return null;
          return (
            <TabelaTurma
              key={numTurma}
              turma={turmaObj}
              responsavelNome={resp?.nome || ''}
              colaboradores={dadosDasTurmas[numTurma].colabs}
              presencas={dadosDasTurmas[numTurma].presencas}
              obsInicial={dadosDasTurmas[numTurma].obs}
              onUpdate={handleUpdatePresence}
              onStatusChange={handleStatusChange}
              onDeleteTurma={handleDeleteTurma}
            />
          );
        })}

      </div>
    </div>
  );
}

// ── UTILITÁRIO ───────────────────────────────────────────────────────────────
function gerarArrayDatas(inicio: string, fim: string) {
  const arr = [];
  let d = new Date(inicio + 'T00:00:00');
  const f = new Date(fim + 'T00:00:00');
  while (d <= f) {
    arr.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return arr;
}
