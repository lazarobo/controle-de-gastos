export type TipoConta = 'corrente' | 'poupanca' | 'cartao' | 'dinheiro';

/**
 * O que uma CATEGORIA classifica, e o eixo dos relatorios. Transferencia fica
 * de fora de proposito: mover dinheiro entre contas proprias nao e ganho nem
 * gasto, entao nao pode aparecer em grafico de categoria nem nos KPIs do mes.
 */
export type TipoMovimento = 'receita' | 'despesa';

/** O que um LANCAMENTO pode ser. Superconjunto de TipoMovimento (migration 5). */
export type TipoLancamento = TipoMovimento | 'transferencia';

export interface Conta {
  id: number;
  nome: string;
  tipo: TipoConta;
  /** Centavos. Ver src/utils/money.ts. */
  saldo_inicial: number;
  ativo: number;
  /** Hex, usado nos graficos comparativos por conta (migration 6). */
  cor: string;
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
  tipo: TipoLancamento;
  /** 'YYYY-MM-DD' no fuso local. Ver src/utils/date.ts. */
  data: string;
  /** Na transferencia, esta e a conta de ORIGEM. */
  conta_id: number;
  /** So preenchido em transferencia: a conta de destino. */
  conta_destino_id: number | null;
  /** Sempre null em transferencia (garantido por CHECK no banco). */
  categoria_id: number | null;
  observacao: string | null;
  criado_em: string;
}

/** Lancamento com os nomes resolvidos, usado nas listagens. */
export interface LancamentoDetalhado extends Lancamento {
  conta_nome: string;
  conta_destino_nome: string | null;
  categoria_nome: string | null;
  categoria_cor: string | null;
}

export interface SaldoConta {
  conta: Conta;
  /** Centavos: saldo inicial + receitas - despesas -+ transferencias. */
  saldo: number;
}

export interface ResumoMes {
  /** Centavos. */
  receitas: number;
  despesas: number;
  resultado: number;
}

/**
 * Uma fatia de grafico, independente da entidade de origem. Existe para os
 * componentes de grafico nao precisarem saber se estao desenhando categorias,
 * contas ou investimentos -- todos viram { nome, cor, total }.
 */
export interface FatiaGrafico {
  chave: string;
  nome: string;
  cor: string;
  /** Centavos. */
  total: number;
}

/** Receitas x despesas de uma conta no mes, para o comparativo por conta. */
export interface TotalPorConta {
  conta_id: number;
  conta_nome: string;
  cor: string;
  /** Centavos. */
  receitas: number;
  despesas: number;
}

export interface TotalPorCategoria {
  categoria_id: number | null;
  categoria_nome: string;
  cor: string;
  /** Centavos. */
  total: number;
}

/**
 * Separado de Conta de proposito: nao entra no saldo total do dashboard (RF05)
 * e o valor nao vem de lancamentos -- e digitado manualmente cada vez que o
 * usuario confere o extrato do banco/corretora.
 */
export interface Investimento {
  id: number;
  /** Nome do banco/corretora. */
  nome: string;
  /** Centavos. */
  valor: number;
  observacao: string | null;
  /** Hex, usado na rosca de distribuicao por banco (migration 7). */
  cor: string;
  criado_em: string;
  atualizado_em: string;
}

/** RF10: teto de gasto mensal por categoria. Uma por categoria, recorrente. */
export interface Meta {
  id: number;
  categoria_id: number;
  /** Centavos. */
  valor: number;
}

/** Meta com o gasto já realizado no mês, para a barra de progresso. */
export interface MetaComProgresso {
  id: number;
  categoria_id: number;
  categoria_nome: string;
  categoria_cor: string;
  /** Centavos. Teto mensal. */
  meta: number;
  /** Centavos. Já gasto na categoria no mês consultado. */
  gasto: number;
}

/** RF11: totais de um mes para o grafico de evolucao. */
export interface EvolucaoMes {
  /** 'YYYY-MM'. */
  mes: string;
  /** Centavos. */
  receitas: number;
  despesas: number;
}

/** Total de despesas de um dia do mes, para o grafico de "dia com mais gasto". */
export interface TotalPorDia {
  /** 'YYYY-MM-DD'. */
  data: string;
  /** Centavos. */
  total: number;
}

export const TIPOS_CONTA: { valor: TipoConta; rotulo: string }[] = [
  { valor: 'corrente', rotulo: 'Conta corrente' },
  { valor: 'poupanca', rotulo: 'Poupança' },
  { valor: 'cartao', rotulo: 'Cartão de crédito' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
];
