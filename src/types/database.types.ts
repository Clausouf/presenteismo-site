// Enums para manter a consistência
export type StatusComum = 'Ativo' | 'Inativo';
export type StatusTurma = 'Em Andamento' | 'Finalizada';
export type CargoEquipe = 'Analista' | 'Instrutor';

export type TipoRegistroDiario = 
  | 'Presença' 
  | 'Falta Injustificada' 
  | 'Falta Integração' 
  | 'Desistência' 
  | 'Desligamento a Pedido' 
  | 'Atestado' 
  | 'Observação';

// Estruturas das Tabelas
export interface Usuario {
  id: string;
  matricula: string;
  nome: string;
  perfil: 'Gerente' | 'Treinamento' | 'Recrutamento';
  status: StatusComum;
}

export interface Equipe {
  matricula: string;
  nome: string;
  cargo: CargoEquipe;
  status: StatusComum;
}

export interface Turma {
  numero_turma: string;
  responsavel_matricula: string;
  status: StatusTurma;
  data_inicio: string;
  data_alo: string;
  data_fim: string;
  horario: string;
  operacao_id: number; // Alterado para number (conectado à tabela operacoes)
  sala: string;
}

export interface Colaborador {
  matricula: string;
  nome: string;
  cpf: string;
  data_admissao: string;
  jornada: string;
  grupo_30_horas: boolean;
  status: StatusComum;
  turma_numero: string;
}

export interface DiarioPresenca {
  turma_numero: string;
  matricula: string;
  colaborador_nome: string;
  data: string;
  tipo_registro: TipoRegistroDiario;
}
