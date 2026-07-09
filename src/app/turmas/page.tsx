'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { 
  BookOpen, 
  Calendar, 
  User, 
  CheckCircle, 
  CloudLightning, 
  AlertCircle, 
  Search, 
  ArrowLeftRight, 
  Info,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Turma, Colaborador, DiarioPresenca, TipoRegistroDiario } from '@/types/database.types';

// Opções oficiais de status definidas no banco de dados
const STATUS_OPTIONS: TipoRegistroDiario[] = [
  'Presença',
  'Falta Injustificada',
  'Atestado',
  'Sem Passagem',
  'Problema Pessoal',
  'Declaração',
  'Desligamento pela Empresa',
  'Desligamento a Pedido',
  'Desistência',
  'Folga'
];

// Mapeamento de cores estéticas para cada tipo de registro
const STATUS_COLORS: Record<TipoRegistroDiario, { bg: string; text: string; border: string }> = {
  'Presença': { bg: 'bg-emerald-500/10', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Falta Injustificada': { bg: 'bg-rose-500/10', text: 'text-rose-700', border: 'border-rose-200' },
  'Atestado': { bg: 'bg-amber-500/10', text: 'text-amber-700', border: 'border-amber-200' },
  'Sem Passagem': { bg: 'bg-violet-500/10', text: 'text-violet-700', border: 'border-violet-200' },
  'Problema Pessoal': { bg: 'bg-sky-500/10', text: 'text-sky-700', border: 'border-sky-200' },
  'Declaração': { bg: 'bg-indigo-500/10', text: 'text-indigo-700', border: 'border-indigo-200' },
  'Desligamento pela Empresa': { bg: 'bg-slate-500/10', text: 'text-slate-700', border: 'border-slate-300' },
  'Desligamento a Pedido': { bg: 'bg-slate-500/10', text: 'text-slate-700', border: 'border-slate-300' },
  'Desistência': { bg: 'bg-orange-500/10', text: 'text-orange-700', border: 'border-orange-200' },
  'Folga': { bg: 'bg-gray-500/10', text: 'text-gray-600', border: 'border-gray-200' }
};

function DiarioPresencaContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  // Estados principais de dados
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>('');
  const [currentTurma, setCurrentTurma] = useState<Turma | null>(null);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [presencas, setPresencas] = useState<Record<string, DiarioPresenca>>({}); // Chave composta: "colaboradorId_data"

  // Controle de datas da turma selecionada
  const [datasLista, setDatasLista] = useState<string[]>([]);
  const [mobileActiveDate, setMobileActiveDate] = useState<string>('');

  // Estados de controle operacional
  const [loadingTurmas, setLoadingTurmas] = useState(true);
  const [loadingDiario, setLoadingDiario] = useState(false);
  const [savingCell, setSavingCell] = useState<string | null>(null); // "colaboradorId_data"
  const [error, setError] = useState<string | null>(null);

  // 1. Carrega a listagem inicial de turmas ativas
  useEffect(() => {
    async function fetchTurmas() {
      try {
        const { data, error: err } = await supabase
          .from('turmas')
          .select('*')
          .order('numero_turma', { ascending: true });

        if (data) {
          setTurmas(data as Turma[]);
          // Captura ID vindo da URL (ex: redirecionamento do cadastro)
          const queryId = searchParams.get('id');
          if (queryId) {
            setSelectedTurmaId(queryId);
          } else if (data.length > 0) {
            setSelectedTurmaId(data[0].id);
          }
        }
      } catch (e) {
        setError('Falha ao conectar e buscar turmas disponíveis.');
      } finally {
        setLoadingTurmas(false);
      }
    }
    fetchTurmas();
  }, [searchParams]);

  // 2. Sempre que a turma mudar, reconstrói o Diário de Presenças
  useEffect(() => {
    if (!selectedTurmaId) return;

    async function loadTurmaDiarioData() {
      setLoadingDiario(true);
      setError(null);
      try {
        // Busca os metadados da turma específica
        const { data: dataTurma } = await supabase
          .from('turmas')
          .select('*')
          .eq('id', selectedTurmaId)
          .single();

        if (!dataTurma) return;
        const turmaObj = dataTurma as Turma;
        setCurrentTurma(turmaObj);

        // Gera o array de datas completo entre data_inicio e data_fim
        const datas = gerarArrayDatas(turmaObj.data_inicio, turmaObj.data_fim);
        setDatasLista(datas);
        if (datas.length > 0) {
          setMobileActiveDate(datas[0]); // Inicializa o dia ativo do mobile
        }

        // Busca todos os colaboradores vinculados a esta turma
        const { data: dataColabs } = await supabase
          .from('colaboradores')
          .select('*')
          .eq('turma_id', selectedTurmaId)
          .order('nome', { ascending: true });

        const listaColabs = (dataColabs as Colaborador[]) || [];
        setColaboradores(listaColabs);

        // Busca todos os registros de presença já realizados para esta turma
        if (listaColabs.length > 0) {
          const idsColabs = listaColabs.map(c => c.id);
          const { data: dataPresencas } = await supabase
            .from('diario_presenca')
            .select('*')
            .in('colaborador_id', idsColabs);

          const mapaPresencas: Record<string, DiarioPresenca> = {};
          if (dataPresencas) {
            dataPresencas.forEach((p: any) => {
              mapaPresencas[`${p.colaborador_id}_${p.data_registro}`] = p as DiarioPresenca;
            });
          }
          setPresencas(mapaPresencas);
        } else {
          setPresencas({});
        }

      } catch (err) {
        setError('Ocorreu um erro ao estruturar a matriz de chamadas.');
      } finally {
        setLoadingDiario(false);
      }
    }

    loadTurmaDiarioData();
  }, [selectedTurmaId]);

  // Função interna auxiliar para construir a linha do tempo (Loop de Datas)
  const gerarArrayDatas = (inicioStr: string, fimStr: string): string[] => {
    const datas: string[] = [];
    const dataAtual = new Date(inicioStr + 'T00:00:00');
    const dataFim = new Date(fimStr + 'T00:00:00');

    // Salvaguarda para evitar loops infinitos caso a data esteja corrompida
    let limitador = 0;
    while (dataAtual <= dataFim && limitador < 90) {
      datas.push(dataAtual.toISOString().split('T')[0]);
      dataAtual.setDate(dataAtual.getDate() + 1);
      limitador++;
    }
    return datas;
  };

  // 3. Atualizador Reativo de Presença (Garante gravação imediata via clique)
  const handleUpdatePresence = async (colaboradorId: string, dataStr: string, novoStatus: TipoRegistroDiario) => {
    const chaveCelula = `${colaboradorId}_${dataStr}`;
    setSavingCell(chaveCelula);

    // Identifica se é período de ALÔ (Linha de negócio: últimos dias ou configurável)
    // Para simplificar, calculamos se o dia atual está dentro dos últimos N dias estipulados na turma
    const indexData = datasLista.indexOf(dataStr);
    const isAlo = indexData >= (datasLista.length - (currentTurma?.dias_alo || 0));

    try {
      const registroExistente = presencas[chaveCelula];

      if (registroExistente) {
        // Se já existe registro, faz o update
        const { data, error: err } = await supabase
          .from('diario_presenca')
          .update({
            tipo_registro: novoStatus,
            is_alo: isAlo,
            updated_by: user?.id || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', registroExistente.id)
          .select()
          .single();

        if (!err && data) {
          setPresencas(prev => ({ ...prev, [chaveCelula]: data as DiarioPresenca }));
        }
      } else {
        // Se é a primeira vez gravando este dia da pessoa, faz o insert
        const { data, error: err } = await supabase
          .from('diario_presenca')
          .insert({
            colaborador_id: colaboradorId,
            data_registro: dataStr,
            tipo_registro: novoStatus,
            is_alo: isAlo,
            updated_by: user?.id || null
          })
          .select()
          .single();

        if (!err && data) {
          setPresencas(prev => ({ ...prev, [chaveCelula]: data as DiarioPresenca }));
        }
      }
    } catch (e) {
      console.error('Erro na gravação reativa:', e);
    } finally {
      // Pequeno timeout de 300ms apenas para dar o feedback visual suave do check verde
      setTimeout(() => setSavingCell(null), 300);
    }
  };

  // Formatador estético de data para exibição de cabeçalhos (Ex: "04/ Mai")
  const formatarDataCabecalho = (dataStr: string) => {
    const [ano, mes, dia] = dataStr.split('-');
    const mesesAbrev = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return {
      dia,
      mes: mesesAbrev[parseInt(mes) - 1]
    };
  };

  // Navegador rápido de datas para a visualização Mobile
  const navegarDataMobile = (direcao: 'prev' | 'next') => {
    const indexAtual = datasLista.indexOf(mobileActiveDate);
    if (direcao === 'prev' && indexAtual > 0) {
      setMobileActiveDate(datasLista[indexAtual - 1]);
    } else if (direcao === 'next' && indexAtual < datasLista.length - 1) {
      setMobileActiveDate(datasLista[indexAtual + 1]);
    }
  };

  if (loadingTurmas) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-2">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Buscando diários ativos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Barra de Filtro Superior */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center text-blue-600 shrink-0">
            <BookOpen size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Diário de Presença</h1>
            <p className="text-xs text-slate-500 mt-0.5">Selecione uma turma operacional para efetuar as chamadas diárias.</p>
          </div>
        </div>

        {/* Seletor de Turma Integrado */}
        <div className="w-full md:w-72">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Turma em Foco</label>
          <select
            value={selectedTurmaId}
            onChange={(e) => {
              setSelectedTurmaId(e.target.value);
              // Atualiza o parametro ID da URL de forma elegante sem recarregar a tela inteira
              router.replace(`/turmas?id=${e.target.value}`);
            }}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
          >
            {turmas.map(t => (
              <option key={t.id} value={t.id}>Nº {t.numero_turma} ({t.status === 'Em Andamento' ? 'Ativa' : 'Finalizada'})</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-sm">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loadingDiario ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2 bg-white border border-slate-100 rounded-xl">
          <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400">Montando matriz de frequência dos operadores...</p>
        </div>
      ) : colaboradores.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <User size={32} className="mx-auto text-slate-300 mb-3" />
          <h3 className="text-base font-semibold text-slate-800">Esta turma não possui operadores vinculados</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Vá até a aba de criação ou gerenciamento para incluir operadores no lote desta turma.</p>
        </div>
      ) : (
        <>
          {/* ==========================================
              VISÃO DESKTOP: Grade de Matriz Completa
             ========================================== */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    {/* Cabeçalho Fixo do Operador */}
                    <th className="p-3 w-64 bg-slate-50 border-r border-slate-200 text-xs font-bold uppercase tracking-wider">
                      Nome do Operador / Matrícula
                    </th>
                    {/* Cabeçalhos Dinâmicos de Datas */}
                    {datasLista.map(dataStr => {
                      const { dia, mes } = formatarDataCabecalho(dataStr);
                      // Verifica se o dia atual da iteração é de período ALÔ
                      const indexData = datasLista.indexOf(dataStr);
                      const isAlo = indexData >= (datasLista.length - (currentTurma?.dias_alo || 0));
                      
                      return (
                        <th key={dataStr} className={`p-2 text-center w-28 text-[11px] font-semibold border-r border-slate-200 transition-colors ${isAlo ? 'bg-amber-50/60 text-amber-800' : ''}`}>
                          <div className="font-bold text-slate-800 text-sm">{dia}</div>
                          <div>{mes}</div>
                          {isAlo && <span className="inline-block text-[9px] font-bold text-amber-600 bg-amber-100 rounded px-1 mt-0.5 tracking-wide scale-90">ALÔ</span>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-xs">
                  {colaboradores.map(colab => (
                    <tr key={colab.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Célula de identificação do colaborador */}
                      <td className="p-3 border-r border-slate-200 font-medium text-slate-900 bg-white sticky left-0 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                        <div className="truncate font-semibold">{colab.nome}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Matrícula: {colab.matricula}</div>
                      </td>

                      {/* Células de Matriz de Presença */}
                      {datasLista.map(dataStr => {
                        const chave = `${colab.id}_${dataStr}`;
                        const registro = presencas[chave];
                        const statusAtual = registro?.tipo_registro || 'Presença'; // Default para otimizar preenchimento
                        const cores = STATUS_COLORS[statusAtual];
                        const isSaving = savingCell === chave;

                        return (
                          <td key={dataStr} className="p-1 border-r border-slate-100 text-center relative group">
                            <div className="relative w-full h-full">
                              <select
                                value={statusAtual}
                                onChange={(e) => handleUpdatePresence(colab.id, dataStr, e.target.value as TipoRegistroDiario)}
                                className={`w-full px-2 py-1.5 rounded-md font-medium border text-center transition-all appearance-none cursor-pointer text-[11px] ${cores.bg} ${cores.text} ${cores.border} focus:outline-none focus:ring-1 focus:ring-blue-500`}
                              >
                                {STATUS_OPTIONS.map(opt => (
                                  <option key={opt} value={opt} className="bg-white text-slate-900 text-left">{opt}</option>
                                ))}
                              </select>

                              {/* Indicador de Salvamento Assíncrono Completo */}
                              {isSaving && (
                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-md animate-fadeIn">
                                  <CheckCircle size={14} className="text-emerald-500 animate-scaleUp" />
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Informações de legenda para Desktop */}
            <div className="bg-slate-50 border-t border-slate-200 p-3 px-4 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <Info size={14} className="text-blue-500" />
                <span>Os dados são sincronizados em tempo real no Supabase a cada alteração efetuada.</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-amber-100 border border-amber-300 rounded block" /> Período ALÔ</div>
              </div>
            </div>
          </div>


          {/* ==========================================
              VISÃO MOBILE: Fila Dinâmica por Dia Ativo
             ========================================== */}
          <div className="block md:hidden space-y-4">
            {/* Navegador de Data Ativa Mobile */}
            <div className="bg-slate-900 text-white rounded-xl p-3 flex items-center justify-between shadow-md">
              <button
                type="button"
                onClick={() => navegarDataMobile('prev')}
                disabled={datasLista.indexOf(mobileActiveDate) === 0}
                className="p-2 hover:bg-slate-800 disabled:opacity-30 rounded-lg transition-colors"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="text-center">
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Data Operacional Focada</p>
                <div className="flex items-center justify-center gap-2 mt-0.5">
                  <Calendar size={14} className="text-blue-400" />
                  <span className="font-bold text-sm">
                    {mobileActiveDate.split('-').reverse().join('/')}
                  </span>
                </div>
                {datasLista.indexOf(mobileActiveDate) >= (datasLista.length - (currentTurma?.dias_alo || 0)) && (
                  <span className="inline-block text-[9px] font-bold text-amber-400 bg-amber-500/20 border border-amber-500/30 rounded px-1.5 mt-1 tracking-wide">Fase de ALÔ Ativa</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => navegarDataMobile('next')}
                disabled={datasLista.indexOf(mobileActiveDate) === datasLista.length - 1}
                className="p-2 hover:bg-slate-800 disabled:opacity-30 rounded-lg transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Listagem de Operadores para a Data Selecionada no Mobile */}
            <div className="space-y-3">
              {colaboradores.map(colab => {
                const chave = `${colab.id}_${mobileActiveDate}`;
                const registro = presencas[chave];
                const statusAtual = registro?.tipo_registro || 'Presença';
                const cores = STATUS_COLORS[statusAtual];
                const isSaving = savingCell === chave;

                return (
                  <div key={colab.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3 relative overflow-hidden">
                    
                    {/* Cabeçalho do Card */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm leading-tight">{colab.nome}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">Matrícula: {colab.matricula}</p>
                      </div>
                    </div>

                    {/* Selector de Status Mobile Otimizado */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Frequência do Dia</label>
                      <div className="relative">
                        <select
                          value={statusAtual}
                          onChange={(e) => handleUpdatePresence(colab.id, mobileActiveDate, e.target.value as TipoRegistroDiario)}
                          className={`w-full px-3 py-2.5 rounded-lg text-xs font-bold border ${cores.bg} ${cores.text} ${cores.border} focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                        >
                          {STATUS_OPTIONS.map(opt => (
                            <option key={opt} value={opt} className="bg-white text-slate-900">{opt}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Feedback de salvamento Mobile Overlay */}
                    {isSaving && (
                      <div className="absolute inset-0 bg-white/90 z-10 flex items-center justify-center animate-fadeIn">
                        <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
                          <CheckCircle size={16} className="animate-scaleUp" />
                          Sincronizado!
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Wrapper principal estruturado com Suspense nativo exigido pelo Next.js App Router para ganchos de leitura de URL
export default function DiarioPresencaPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Iniciando barramento de frequência...</p>
      </div>
    }>
      <DiarioPresencaContent />
    </Suspense>
  );
}
