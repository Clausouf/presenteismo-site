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
      <div className="max-w-xl mx-auto p-8 text-center bg-white rounded
