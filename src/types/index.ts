/**
 * 'evento' (migration 8): viagem, show -- dinheiro separado e gasto de la.
 * 'investimento' (migration 9): recebe aportes por movimentacao e fica FORA
 * do saldo total e dos KPIs do mes.
 */
export type TipoConta = 'corrente' | 'poupanca' | 'cartao' | 'dinheiro' | 'evento' | 'investimento';

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
  /** 'YYYY-MM-DD', so em evento (CHECK no banco garante). */
  data_inicio: string | null;
  data_fim: string | null;
  /** Texto livre (migration 9); hoje so a tela de investimento mostra. */
  observacao: string | null;
  /** So cartao (migration 10). Centavos. */
  limite: number | null;
  /** So cartao: dia do mes (1-31). */
  dia_fechamento: number | null;
  dia_vencimento: number | null;
  /** So cartao: fatura que ja estava aberta no cadastro, em centavos. */
  fatura_inicial: number;
  criado_em: string;
}

/**
 * Evento com os numeros que a tela precisa. Todos em centavos, e
 * saldo = entrou - gasto - devolvido, a mesma conta que contas.saldos() faz.
 */
export interface EventoResumo {
  conta: Conta;
  /** Saldo inicial + receitas + transferencias recebidas (o "separado"). */
  entrou: number;
  /** Despesas lancadas a partir do evento. */
  gasto: number;
  /** Transferencias que sairam do evento (sobra devolvida). */
  devolvido: number;
  saldo: number;
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
  /** 'HH:MM' local, ou null nos lancamentos anteriores a migration 9. */
  hora: string | null;
  /** Na transferencia, esta e a conta de ORIGEM. */
  conta_id: number;
  /** So preenchido em transferencia: a conta de destino. */
  conta_destino_id: number | null;
  /** Sempre null em transferencia (garantido por CHECK no banco). */
  categoria_id: number | null;
  observacao: string | null;
  /** Compra parcelada a que esta parcela pertence (migration 10). */
  parcelamento_id: number | null;
  /** 1..N dentro do parcelamento. */
  parcela: number | null;
  criado_em: string;
}

/** Lancamento com os nomes resolvidos, usado nas listagens. */
export interface LancamentoDetalhado extends Lancamento {
  conta_nome: string;
  conta_tipo: TipoConta;
  conta_destino_nome: string | null;
  conta_destino_tipo: TipoConta | null;
  categoria_nome: string | null;
  categoria_cor: string | null;
  /** N do parcelamento (para mostrar "2/10"), ou null. */
  parcelas_total: number | null;
}

/** Lancamento reduzido ao que a fatura precisa. */
export interface ItemFatura {
  data: string;
  tipo: TipoLancamento;
  valor: number;
}

/** Uma fatura do cartao com o que ja caiu nela, em centavos. */
export interface FaturaResumo {
  fechamento: string;
  vencimento: string;
  /** Compras - estornos do ciclo (inclui parcelas futuras ja lancadas). */
  total: number;
  /** Quantos lancamentos caem nela. */
  itens: number;
  /** A fatura em que estamos hoje (aberta, ainda nao fechou). */
  atual: boolean;
}

export interface CartaoResumo {
  conta: Conta;
  /** Centavos: o que voce deve no cartao, somando todas as faturas (>= 0 em geral). */
  divida: number;
  /** limite - divida. Pode ficar negativo se estourou. */
  disponivel: number;
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
 * Investimento e uma conta com tipo = 'investimento' (migration 9). Os numeros
 * separam o que VOCE colocou do que o mercado fez, em centavos:
 *   aportado   = saldo inicial + movimentacoes recebidas - resgates
 *   rendimento = receitas - despesas lancadas na propria conta (ajustes de valor)
 *   valor      = aportado + rendimento (o mesmo que contas.saldos() calcula)
 */
export interface InvestimentoResumo {
  conta: Conta;
  aportado: number;
  rendimento: number;
  valor: number;
  /** 'YYYY-MM-DD' do ultimo lancamento que tocou a conta, ou da criacao. */
  ultima_movimentacao: string;
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

/**
 * Conta "do dia a dia": as que entram no saldo total e aparecem em Contas.
 * Evento e investimento tambem sao contas, mas tem telas proprias.
 */
export function ehContaComum(tipo: TipoConta): boolean {
  return tipo !== 'evento' && tipo !== 'investimento';
}
