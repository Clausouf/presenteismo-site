export type PerfilUsuario = 'Gerente' | 'Treinamento' | 'Recrutamento';
export type StatusComum = 'Ativo' | 'Inativo';
export type StatusTurma = 'Em Andamento' | 'Finalizada';
export type StatusColaborador = 'Ativo' | 'Desligado' | 'Desistente';
export type TipoRegistroDiario = 'Presença' | 'Falta Injustificada' | 'Atestado' | 'Sem Passagem' | 'Problema Pessoal' | 'Declaração' | 'Desligamento pela Empresa' | 'Desligamento a Pedido' | 'Desistência' | 'Folga';

export interface Usuario {
  id: string;
  matricula: string;
  nome: string;
  perfil: PerfilUsuario;
  status: StatusComum;
}

export interface Turma {
  id: string;
  numero_turma: string;
  operacao_id: string;
  analista_id: string;
  instrutor_id: string;
  data_inicio: string;
  data_fim: string;
  dias_treinamento: number;
  dias_alo: number;
  status: StatusTurma;
}

export interface Colaborador {
  id: string;
  turma_id: string;
  matricula: string;
  nome: string;
  cpf: string;
  data_admissao: string;
  jornada: string;
  grupo_30_horas: boolean;
  status: StatusColaborador;
}
// Correção para o build do Cloudflare
export type Operacao = any;
export type Analista = any;
export type Instrutor = any;
