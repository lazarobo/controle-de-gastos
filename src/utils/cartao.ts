/**
 * Regras de cartao de credito que nao dependem do banco: em que fatura cai uma
 * compra e quanto vale cada parcela. Sem import nenhum de proposito -- o
 * `npm run verify` carrega este arquivo direto no Node.
 *
 * Datas no mesmo formato do resto do app ('YYYY-MM-DD', fuso local).
 */

const pad = (n: number) => String(n).padStart(2, '0');

function ultimoDia(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

/** Mes seguinte/anterior sem passar do ultimo dia (31/01 + 1 mes = 28 ou 29/02). */
export function somarMesesISO(iso: string, meses: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const total = ano * 12 + (mes - 1) + meses;
  const a = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return `${a}-${pad(m)}-${pad(Math.min(dia, ultimoDia(a, m)))}`;
}

function diaNoMes(ano: number, mes: number, dia: number): string {
  return `${ano}-${pad(mes)}-${pad(Math.min(dia, ultimoDia(ano, mes)))}`;
}

export interface Fatura {
  /** Ultimo dia de compras que entram nela. */
  fechamento: string;
  /** Quando ela precisa estar paga. Identifica a fatura. */
  vencimento: string;
}

/**
 * Fatura em que uma compra feita em `data` cai.
 *
 * Compra ate o dia do fechamento (inclusive) entra na fatura que fecha naquele
 * mes; depois dele, na do mes seguinte. O vencimento vem depois do fechamento:
 * no mesmo mes se o dia de vencimento for maior, senao no mes seguinte
 * (fecha dia 28, vence dia 5).
 */
export function faturaDe(data: string, diaFechamento: number, diaVencimento: number): Fatura {
  const [ano, mes, dia] = data.split('-').map(Number);
  let fa = ano;
  let fm = mes;
  if (dia > Math.min(diaFechamento, ultimoDia(ano, mes))) {
    fm += 1;
    if (fm > 12) {
      fm = 1;
      fa += 1;
    }
  }
  const fechamento = diaNoMes(fa, fm, diaFechamento);

  let va = fa;
  let vm = fm;
  if (diaVencimento <= diaFechamento) {
    vm += 1;
    if (vm > 12) {
      vm = 1;
      va += 1;
    }
  }
  return { fechamento, vencimento: diaNoMes(va, vm, diaVencimento) };
}

/**
 * Valor de cada parcela, em centavos inteiros, somando exatamente o total.
 *
 * Sem juros: divide e joga a sobra de centavos na PRIMEIRA parcela (100,00 em
 * 3x = 33,34 + 33,33 + 33,33), como os bancos fazem.
 *
 * Com juros (pontos-base ao mes, 199 = 1,99%): tabela Price, parcela fixa
 * P = V * i / (1 - (1 + i)^-n). O calculo usa float uma unica vez e arredonda
 * para centavo inteiro -- dali pra frente tudo e soma de inteiros (D07).
 */
export function calcularParcelas(valor: number, vezes: number, jurosBp = 0): number[] {
  if (vezes <= 1) return [valor];

  if (jurosBp <= 0) {
    const base = Math.floor(valor / vezes);
    const parcelas = Array.from({ length: vezes }, () => base);
    parcelas[0] += valor - base * vezes;
    return parcelas;
  }

  const i = jurosBp / 10000;
  const parcela = Math.round((valor * i) / (1 - Math.pow(1 + i, -vezes)));
  return Array.from({ length: vezes }, () => parcela);
}

/** '1,99' / '1.99' / '2' -> 199 pontos-base. null se nao for numero >= 0. */
export function lerJurosBp(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.');
  if (!limpo) return 0;
  if (!/^\d+(\.\d{0,2})?$/.test(limpo)) return null;
  return Math.round(Number(limpo) * 100);
}

export interface ItemFatura {
  data: string;
  tipo: string;
  /** Centavos, positivo. */
  valor: number;
}

export interface FaturaAgrupada extends Fatura {
  total: number;
  itens: number;
  /** A fatura aberta hoje (ainda nao fechou). */
  atual: boolean;
}

/**
 * Agrupa as compras (despesa) e estornos (receita) do cartao por fatura e
 * devolve as que ainda importam: a fechada que nao venceu, a atual e as
 * futuras (parcelas). A fatura atual sempre aparece, mesmo zerada.
 *
 * `inicial` e a fatura que ja existia no cadastro do cartao.
 */
export function agruparFaturas(
  itens: ItemFatura[],
  diaFechamento: number,
  diaVencimento: number,
  hoje: string,
  inicial?: { data: string; valor: number },
): FaturaAgrupada[] {
  const porVencimento = new Map<string, FaturaAgrupada>();
  const atual = faturaDe(hoje, diaFechamento, diaVencimento);

  const somar = (data: string, valor: number) => {
    const f = faturaDe(data, diaFechamento, diaVencimento);
    const existente = porVencimento.get(f.vencimento);
    if (existente) {
      existente.total += valor;
      existente.itens += 1;
    } else {
      porVencimento.set(f.vencimento, { ...f, total: valor, itens: 1, atual: false });
    }
  };

  if (inicial && inicial.valor > 0) somar(inicial.data, inicial.valor);
  for (const i of itens) {
    if (i.tipo === 'despesa') somar(i.data, i.valor);
    else if (i.tipo === 'receita') somar(i.data, -i.valor);
  }

  if (!porVencimento.has(atual.vencimento)) {
    porVencimento.set(atual.vencimento, { ...atual, total: 0, itens: 0, atual: false });
  }
  porVencimento.get(atual.vencimento)!.atual = true;

  return Array.from(porVencimento.values())
    .filter((f) => f.vencimento >= hoje || f.atual)
    .sort((a, b) => (a.vencimento < b.vencimento ? -1 : 1));
}
