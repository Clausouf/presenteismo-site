'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Trash2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_OPTIONS = [
  { value: 'Em Andamento', label: 'Em Andamento' },
  { value: 'Finalizada', label: 'Finalizada' }
];

function FormattedDate({ dateString }: { dateString: string }) {
  const [date, setDate] = useState<string>('');
  useEffect(() => {
    setDate(new Date(dateString).toLocaleString());
  }, [dateString]);
  return <span>{date}</span>;
}

// --- COMPONENTE DA TURMA ---
function TabelaTurma({ turma, responsavelNome, colaboradores, presencas, obsInicial, onUpdate, onStatusChange, onDeleteTurma }: any) {
  const [observacoes, setObservacoes] = useState(obsInicial || []);
  const [novaObs, setNovaObs] = useState('');
  
  const datas = gerarArrayDatas(turma.data_inicio, turma.data_fim);

  const calcularIndicadores = (dataStr: string) => {
    const total = colaboradores.length;
    if (total === 0) return { absPercent: "0", desligPercent: "0" };
    const registrosDoDia = colaboradores.map((c: any) => presencas[`${c.matricula}_${dataStr}`]?.tipo_registro);
    const faltas = registrosDoDia.filter((s: string) => s === 'Falta Injustificada' || s === 'Falta Integração').length;
    const desligamentos = registrosDoDia.filter((s: string) => s === 'Desistência' || s === 'Desligamento a Pedido').length;
    return { absPercent: ((faltas / total) * 100).toFixed(0), desligPercent: ((desligamentos / total) * 100).toFixed(0) };
  };

  const handleSalvarObs = async () => {
    if (!novaObs.trim()) return;
    const { data, error } = await supabase.from('turma_observacoes').insert({ numero_turma: turma.numero_turma, texto: novaObs }).select().single();
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
    <div className="mb-10 border rounded-lg bg-white shadow-sm overflow-hidden">
      <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
        {/* CABEÇALHO ATUALIZADO CONFORME SOLICITADO */}
        <div className="font-bold text-slate-800 text-lg">
          Turma {turma.numero_turma}
          {` - ${responsavelNome || 'Sem responsável'}`}
          {turma.sala && ` - ${turma.sala}`}
          {turma.horario && ` - ${turma.horario.substring(0, 5)}`}
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Status:</span>
            <select
              value={turma.status}
              onChange={(e) => onStatusChange(turma.numero_turma, e.target.value)}
              className="text-xs font-bold p-1 px-2 border rounded bg-white text-slate-700 cursor-pointer shadow-sm hover:bg-slate-100"
            >
              {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <button 
            onClick={() => onDeleteTurma(turma.numero_turma)}
            className="p-1.5 text-rose-500 hover:bg-rose-100 rounded transition-colors"
            title="Excluir Turma"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr>
              <th className="p-3 bg-white">OPERADOR</th>
              {datas.map((d, i) => (
                <th key={d} className="p-1 text-center min-w-[60px]">
                  <div className={`text-[9px] font-bold uppercase ${i === 0 ? 'text-blue-600' : (i >= datas.length - 3 ? 'text-orange-600' : 'text-slate-500')}`}>
                    {i === 0 ? 'Integração' : (i >= datas.length - 3 ? 'Acomp.' : 'Treinamento')}
                  </div>
                  <div className="text-xs">{d.split('-')[2]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {colaboradores.map((c: any) => (
              <tr key={c.matricula} className="border-t hover:bg-slate-50/50">
                <td className="p-3 font-medium text-slate-700 relative group min-w-[180px]">
                  <span className="cursor-help border-b border-dotted border-slate-400 pb-0.5 hover:text-blue-600 transition-colors">
                    {c.nome}
                  </span>
                  
                  <div className="absolute left-0 top-full mt-2 w-64 bg-slate-800 text-white p-3 rounded-lg shadow-xl hidden group-hover:block z-50 text-[11px] pointer-events-none border border-slate-700">
                    <div className="space-y-1.5">
                      <p className="font-bold border-b border-slate-700 pb-1 mb-1 text-blue-400">{c.nome}</p>
                      <p><span className="text-slate-400">Matrícula:</span> {c.matricula}</p>
                      <p><span className="text-slate-400">Jornada:</span> {c.jornada || '-'}</p>
                      <p><span className="text-slate-400">Grupo 30h:</span> {c.grupo_30_horas === true ? 'Sim' : '-'}</p>
                    </div>
                  </div>
                </td>
                {datas.map(d => (
                  <td key={d} className="p-1">
                    <select 
                      value={presencas[`${c.matricula}_${d}`]?.tipo_registro || ''} 
                      onChange={(e) => onUpdate(turma.numero_turma, c.matricula, c.nome, d, e.target.value)}
                      className="w-full border rounded text-[10px] p-1"
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
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 border-t-2 border-slate-200">
            <tr>
              <td className="p-3 font-bold text-slate-700">ABS (%)</td>
              {datas.map(d => <td key={d} className="text-center font-bold text-rose-600 text-xs">{calcularIndicadores(d).absPercent}%</td>)}
            </tr>
            <tr>
              <td className="p-3 font-bold text-slate-500">Deslig./Desist. (%)</td>
              {datas.map(d => <td key={d} className="text-center font-bold text-slate-600 text-xs">{calcularIndicadores(d).desligPercent}%</td>)}
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="p-4 bg-slate-50 border-t">
        <label className="block text-sm font-bold text-slate-700 mb-2">Adicionar Observação</label>
        <textarea value={novaObs} onChange={(e) => setNovaObs(e.target.value)} className="w-full h-20 p-2 border rounded-lg text-sm" placeholder="Digite aqui..." />
        <button onClick={handleSalvarObs} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold mt-2 hover:bg-blue-700">Salvar Observação</button>
        <div className="mt-4 space-y-2">
          {observacoes.map((obs: any) => (
            <div key={obs.id} className="p-2 bg-white border rounded text-xs text-slate-600 shadow-sm flex justify-between items-start">
              <div>
                <span className="text-[10px] text-slate-400 block"><FormattedDate dateString={obs.created_at} /></span>
                {obs.texto}
              </div>
              <button onClick={() => handleDeleteObs(obs.id)} className="text-rose-400 hover:text-rose-600 ml-2">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- PÁGINA PRINCIPAL ---
export default function DiarioPresencaPage() {
  const [equipe, setEquipe] = useState<any[]>([]);
  const [operacoes, setOperacoes] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [selectedOperacaoId, setSelectedOperacaoId] = useState<string>('todos');
  const [selectedTurmaNum, setSelectedTurmaNum] = useState<string>('');
  const [dadosDasTurmas, setDadosDasTurmas] = useState<Record<string, any>>({});

  async function carregarDados() {
    if (selectedOperacaoId === 'todos') { setDadosDasTurmas({}); return; }
    const turmasDaOp = selectedTurmaNum ? turmas.filter(t => t.numero_turma === selectedTurmaNum) : turmas.filter(t => t.operacao_id === Number(selectedOperacaoId));
    const novosDados: any = {};
    for (const t of turmasDaOp) {
      const [colabs, regs, obs] = await Promise.all([
        supabase.from('colaboradores').select('*').eq('numero_turma', t.numero_turma),
        supabase.from('diario_presenca').select('*').eq('turma_numero', t.numero_turma), // Fix: usando turma_numero
        supabase.from('turma_observacoes').select('*').eq('numero_turma', t.numero_turma).order('created_at', { ascending: false })
      ]);
      const mapaPresencas: any = {};
      regs.data?.forEach(r => mapaPresencas[`${r.matricula}_${r.data}`] = r);
      novosDados[t.numero_turma] = { colabs: colabs.data || [], presencas: mapaPresencas, obs: obs.data || [] };
    }
    setDadosDasTurmas(novosDados);
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

    const channel = supabase.channel('turmas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turmas' }, () => init())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    carregarDados();
  }, [selectedOperacaoId, selectedTurmaNum, turmas]);

  const handleUpdatePresence = async (turmaNum: string, matricula: string, nome: string, dataStr: string, status: string) => {
    if (status === '') {
        // Fix: usamos 'turma_numero' na tabela diario_presenca para evitar erro
        const { error } = await supabase.from('diario_presenca').delete().eq('turma_numero', turmaNum).eq('matricula', matricula).eq('data', dataStr);
        if (error) { alert('Erro ao deletar: ' + error.message); return; }
    } else {
        // Fix: usamos 'turma_numero' na tabela diario_presenca
        const { error } = await supabase.from('diario_presenca').upsert({ turma_numero: turmaNum, matricula, colaborador_nome: nome, data: dataStr, tipo_registro: status });
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
    const { error } = await supabase
      .from('turmas')
      .update({ status: novoStatus })
      .eq('numero_turma', turmaNum);

    if (error) { 
      alert("Erro ao salvar no banco: " + error.message); 
      return; 
    }
    setTurmas(prev => prev.map(t => t.numero_turma === turmaNum ? { ...t, status: novoStatus } : t));
  };

  const handleDeleteTurma = async (turmaNum: string) => {
    if (!confirm(`TEM CERTEZA? Isso excluirá permanentemente a Turma ${turmaNum} e todos os seus dados vinculados.`)) return;
    
    // Fix: A tabela 'diario_presenca' usa a coluna 'turma_numero', as outras parecem usar 'numero_turma'
    try {
        const { error: err1 } = await supabase.from('diario_presenca').delete().eq('turma_numero', turmaNum);
        const { error: err2 } = await supabase.from('colaboradores').delete().eq('numero_turma', turmaNum);
        const { error: err3 } = await supabase.from('turma_observacoes').delete().eq('numero_turma', turmaNum);
        const { error: err4 } = await supabase.from('turmas').delete().eq('numero_turma', turmaNum);
        
        if (err1 || err2 || err3 || err4) throw new Error("Erro ao deletar registros vinculados.");
        
        setTurmas(prev => prev.filter(t => t.numero_turma !== turmaNum));
        alert('Turma excluída com sucesso.');
    } catch (err: any) {
        alert(err.message);
    }
  };

  const turmasFiltradas = selectedOperacaoId === 'todos' ? [] : turmas.filter(t => t.operacao_id === Number(selectedOperacaoId));

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-lg shadow">
        <div>
          <label className="block text-xs font-bold text-slate-500">OPERAÇÃO</label>
          <select className="w-full border p-2 rounded" onChange={(e) => { setSelectedOperacaoId(e.target.value); setSelectedTurmaNum(''); }}>
            <option value="todos">Selecione uma Operação...</option>
            {operacoes.map(op => <option key={op.id} value={op.id}>{op.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500">TURMA</label>
          <select className="w-full border p-2 rounded" value={selectedTurmaNum} onChange={(e) => setSelectedTurmaNum(e.target.value)}>
            <option value="">Todas as Turmas</option>
            {turmasFiltradas.map(t => <option key={t.numero_turma} value={t.numero_turma}>Turma {t.numero_turma}</option>)}
          </select>
        </div>
      </div>
      {selectedOperacaoId !== 'todos' && Object.keys(dadosDasTurmas).map(numTurma => {
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
  );
}

function gerarArrayDatas(inicio: string, fim: string) {
  const arr = [];
  let d = new Date(inicio + 'T00:00:00');
  const f = new Date(fim + 'T00:00:00');
  while (d <= f) { arr.push(d.toISOString().split('T')[0]); d.setDate(d.getDate() + 1); }
  return arr;
}
