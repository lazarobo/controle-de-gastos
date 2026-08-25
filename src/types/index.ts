export type TipoConta = 'corrente' | 'poupanca' | 'cartao' | 'dinheiro';
export type TipoMovimento = 'receita' | 'despesa';

export interface Conta {
  id: number;
  nome: string;
  tipo: TipoConta;
  /** Centavos. Ver src/utils/money.ts. */
  saldo_inicial: number;
  ativo: number;
  criado_em: string;
}

export interface Categoria {
  id: number;
  nome: string;
  tipo: TipoMovimento;
  cor: string;
  /** 1 = criada pelo seed, nao pode ser renomeada nem excluida. */
  sistema: number;
}

export interface Lancamento {
  id: number;
  descricao: string;
  /** Centavos, sempre positivo. O sinal vem de `tipo`. */
  valor: number;
  tipo: TipoMovimento;
  /** 'YYYY-MM-DD' no fuso local. Ver src/utils/date.ts. */
  data: string;
  conta_id: number;
  categoria_id: number | null;
  observacao: string | null;
  criado_em: string;
}

/** Lancamento com os nomes resolvidos, usado nas listagens. */
export interface LancamentoDetalhado extends Lancamento {
  conta_nome: string;
  categoria_nome: string | null;
  categoria_cor: string | null;
}

export interface SaldoConta {
  conta: Conta;
  /** Centavos: saldo_inicial + receitas - despesas. */
  saldo: number;
}

export interface ResumoMes {
  /** Centavos. */
  receitas: number;
  despesas: number;
  resultado: number;
}

export interface TotalPorCategoria {
  categoria_id: number | null;
  categoria_nome: string;
  cor: string;
  /** Centavos. */
  total: number;
}

export const TIPOS_CONTA: { valor: TipoConta; rotulo: string }[] = [
  { valor: 'corrente', rotulo: 'Conta corrente' },
  { valor: 'poupanca', rotulo: 'Poupança' },
  { valor: 'cartao', rotulo: 'Cartão de crédito' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
];
