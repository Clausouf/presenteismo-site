'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Trash2, ChevronDown, BookOpen, Clock, MapPin, User,
  AlertCircle, TrendingDown, MessageSquare, Plus, Calendar, X,
  CreditCard, Briefcase, Timer, Pencil,
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

function gerarArrayDatas(dataInicio: string, dataFim: string) {
  if (!dataInicio || !dataFim) return [];
  const datas = [];
  let atual = new Date(dataInicio + 'T00:00:00');
  const fim = new Date(dataFim + 'T00:00:00');
  while (atual <= fim) {
    const ano = atual.getFullYear();
    const mes = String(atual.getMonth() + 1).padStart(2, '0');
    const dia = String(atual.getDate()).padStart(2, '0');
    datas.push(`${ano}-${mes}-${dia}`);
    atual.setDate(atual.getDate() + 1);
  }
  return datas;
}

// ── MODAL DE DADOS DO OPERADOR ───────────────────────────────────────────────
function OperadorModal({ colab, onClose }: { colab: any; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
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

        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Matrícula</p>
              <p className="text-sm font-bold text-gray-800">{colab.matricula || '—'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Jornada</p>
              <p className="text-sm font-bold text-gray-800">{colab.jornada || '—'}</p>
            </div>
          </div>

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

// ── MODAL DE EDIÇÃO DA TURMA ─────────────────────────────────────────────────
function EditarTurmaModal({ turma, colaboradoresAtuais, onClose, onSave }: { turma: any; colaboradoresAtuais: any[]; onClose: () => void; onSave: () => void }) {
  const [sala, setSala] = useState(turma.sala || '');
  const [dataInicio, setDataInicio] = useState(turma.data_inicio || '');
  const [dataFim, setDataFim] = useState(turma.data_fim || '');
  
  const [salasDisponiveis, setSalasDisponiveis] = useState<string[]>([]);
  const [colabsAtuais, setColabsAtuais] = useState<any[]>(colaboradoresAtuais);
  const [novosOperadores, setNovosOperadores] = useState<any[]>([]);
  
  const [nomeOp, setNomeOp] = useState('');
  const [matriculaOp, setMatriculaOp] = useState('');
  const [jornadaOp, setJornadaOp] = useState('');
  const [grupo30Op, setGrupo30Op] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function carregarSalas() {
      const { data, error } = await supabase.from('salas').select('*');
      if (!error && data) {
        const lista = data.map((s: any) => s.nome || s.sala || s.id).filter(Boolean);
        setSalasDisponiveis(lista);
      }
    }
    carregarSalas();
  }, []);

  const handleAddLocalOperador = () => {
    if (!nomeOp.trim() || !matriculaOp.trim()) {
      alert('Preencha pelo menos o Nome e a Matrícula do operador.');
      return;
    }
    const existeAtual = colabsAtuais.some(c => c.matricula === matriculaOp);
    const existeNovo = novosOperadores.some(o => o.matricula === matriculaOp);
    if (existeAtual || existeNovo) {
      alert('Já existe um operador com esta matrícula nesta turma ou na lista de novos.');
      return;
    }

    setNovosOperadores([
      ...novosOperadores,
      { nome: nomeOp, matricula: matriculaOp, jornada: jornadaOp, grupo_30_horas: grupo30Op }
    ]);
    setNomeOp('');
    setMatriculaOp('');
    setJornadaOp('');
    setGrupo30Op(false);
  };

  const handleRemoveLocalOperador = (matricula: string) => {
    setNovosOperadores(novosOperadores.filter(o => o.matricula !== matricula));
  };

  const handleExcluirOperadorExistente = async (matricula: string, nome: string) => {
    if (!confirm(`Deseja realmente remover o operador ${nome} (${matricula}) desta turma?`)) return;
    try {
      const { error } = await supabase
        .from('colaboradores')
        .delete()
        .eq('matricula', matricula)
        .eq('numero_turma', turma.numero_turma);

      if (error) throw error;
      setColabsAtuais(colabsAtuais.filter(c => c.matricula !== matricula));
    } catch (err: any) {
      alert('Erro ao excluir operador: ' + err.message);
    }
  };

  const handleSalvarEdicao = async () => {
    setLoading(true);
    try {
      const { error: errTurma } = await supabase
        .from('turmas')
        .update({
          sala: sala,
          data_inicio: dataInicio,
          data_fim: dataFim,
        })
        .eq('numero_turma', turma.numero_turma);

      if (errTurma) throw new Error('Erro ao atualizar turma: ' + errTurma.message);

      if (novosOperadores.length > 0) {
        const payloadColabs = novosOperadores.map(op => ({
          numero_turma: turma.numero_turma,
          matricula: op.matricula,
          nome: op.nome,
          jornada: op.jornada,
          grupo_30_horas: op.grupo_30_horas,
        }));

        const { error: errColab } = await supabase
          .from('colaboradores')
          .insert(payloadColabs);

        if (errColab) throw new Error('Erro ao adicionar novos operadores: ' + errColab.message);
      }

      alert('Turma atualizada com sucesso!');
      onSave();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <Pencil className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">Editar Turma {turma.numero_turma}</p>
              <p className="text-slate-400 text-xs mt-0.5">Altere sala, datas, gerencie operadores</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Sala</label>
              <select
                value={sala}
                onChange={(e) => setSala(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-800 font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Selecione a sala</option>
                {salasDisponiveis.map((s, idx) => (
                  <option key={idx} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Início do Treinamento</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Fim do Treinamento</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>

          <hr className="border-gray-100 my-2" />

          {/* LISTA DE OPERADORES ATUAIS COM OPÇÃO DE EXCLUSÃO */}
          <div>
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" /> Operadores na Turma ({colabsAtuais.length})
            </h3>
            {colabsAtuais.length > 0 ? (
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {colabsAtuais.map((c) => (
                  <div key={c.matricula} className="flex items-center justify-between bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-xs">
                    <div>
                      <span className="font-bold text-gray-800">{c.nome}</span>
                      <span className="text-gray-500 ml-2">({c.matricula})</span>
                      {c.jornada && <span className="text-gray-400 ml-2">— {c.jornada}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleExcluirOperadorExistente(c.matricula, c.nome)}
                      className="text-rose-500 hover:text-rose-700 p-1 rounded transition-colors hover:bg-rose-50"
                      title="Excluir operador da turma"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Nenhum operador cadastrado nesta turma.</p>
            )}
          </div>

          <hr className="border-gray-100 my-2" />

          {/* ADICIONAR NOVOS OPERADORES */}
          <div>
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-blue-600" /> Adicionar Novos Operadores
            </h3>
            
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Nome do Operador</label>
                  <input
                    type="text"
                    value={nomeOp}
                    onChange={(e) => setNomeOp(e.target.value)}
                    placeholder="Nome completo"
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Matrícula</label>
                  <input
                    type="text"
                    value={matriculaOp}
                    onChange={(e) => setMatriculaOp(e.target.value)}
                    placeholder="Ex: 12345"
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-end">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Jornada</label>
                  <input
                    type="text"
                    value={jornadaOp}
                    onChange={(e) => setJornadaOp(e.target.value)}
                    placeholder="Ex: 08:00 - 17:18"
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700 font-medium">
                    <input
                      type="checkbox"
                      checked={grupo30Op}
                      onChange={(e) => setGrupo30Op(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-300 w-4 h-4"
                    />
                    Grupo 30h
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLocalOperador}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar à Lista
                  </button>
                </div>
              </div>
            </div>

            {novosOperadores.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Novos operadores prontos para salvar ({novosOperadores.length}):</p>
                <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                  {novosOperadores.map((op) => (
                    <div key={op.matricula} className="flex items-center justify-between bg-blue-50/50 border border-blue-100 px-3 py-1.5 rounded-lg text-xs">
                      <div>
                        <span className="font-bold text-gray-800">{op.nome}</span>
                        <span className="text-gray-500 ml-2">({op.matricula})</span>
                        {op.jornada && <span className="text-gray-400 ml-2">— {op.jornada}</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveLocalOperador(op.matricula)}
                        className="text-rose-500 hover:text-rose-700 p-1 rounded transition-colors"
                        title="Remover da lista"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleSalvarEdicao}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? 'Salvando...' : 'Salvar Alterações'}
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
function TabelaTurma({ turma, responsavelNome, colaboradores, presencas, obsInicial, onUpdate, onStatusChange, onDeleteTurma, onRefresh }: any) {
  const [observacoes, setObservacoes] = useState(obsInicial || []);
  const [novaObs, setNovaObs] = useState('');
  const [obsOpen, setObsOpen] = useState(false);
  const [operadorSelecionado, setOperadorSelecionado] = useState<any | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

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
      {operadorSelecionado && (
        <OperadorModal
          colab={operadorSelecionado}
          onClose={() => setOperadorSelecionado(null)}
        />
      )}

      {editModalOpen && (
        <EditarTurmaModal
          turma={turma}
          colaboradoresAtuais={colaboradores}
          onClose={() => setEditModalOpen(false)}
          onSave={onRefresh}
        />
      )}

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden mb-6">
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
              onClick={() => setEditModalOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
              title="Editar Turma"
            >
              <Pencil className="w-4 h-4" />
            </button>

            <button
              onClick={() => onDeleteTurma(turma.numero_turma)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-rose-500/80 text-white/70 hover:text-white transition-all"
              title="Excluir Turma"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

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
