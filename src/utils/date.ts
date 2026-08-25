/**
 * Datas circulam como 'YYYY-MM-DD' no fuso LOCAL.
 *
 * Armadilha evitada aqui: `new Date().toISOString().slice(0, 10)` converte para UTC.
 * No Brasil (UTC-3), um lancamento feito as 21h de 31/01 viraria '2026-02-01' — o gasto
 * cai no mes errado e o dashboard nunca fecha. Por isso montamos a string a partir dos
 * getters locais (getFullYear/getMonth/getDate), nunca via ISO.
 */

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** Data local do dispositivo como 'YYYY-MM-DD'. */
export function hojeISO(): string {
  return dataParaISO(new Date());
}

export function dataParaISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Interpreta 'YYYY-MM-DD' como meia-noite LOCAL (o construtor de string faria UTC). */
export function isoParaData(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

/** '2026-08-25' -> '25/08/2026' */
export function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** '2026-08-25' -> '25 de agosto' */
export function formatarDataCurta(iso: string): string {
  const [, mes, dia] = iso.split('-').map(Number);
  return `${dia} de ${MESES[mes - 1]}`;
}

export interface Mes {
  ano: number;
  /** 1-12. */
  mes: number;
}

export function mesAtual(): Mes {
  const d = new Date();
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

/** Chave 'YYYY-MM', usada em comparacoes e agrupamentos. */
export function chaveMes({ ano, mes }: Mes): string {
  return `${ano}-${pad(mes)}`;
}

export function mesDoISO(iso: string): Mes {
  const [ano, mes] = iso.split('-').map(Number);
  return { ano, mes };
}

/** Primeiro e ultimo dia do mes, ambos inclusivos, para `data BETWEEN ? AND ?`. */
export function intervaloDoMes({ ano, mes }: Mes): { inicio: string; fim: string } {
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return {
    inicio: `${ano}-${pad(mes)}-01`,
    fim: `${ano}-${pad(mes)}-${pad(ultimoDia)}`,
  };
}

export function somarMeses({ ano, mes }: Mes, delta: number): Mes {
  const total = ano * 12 + (mes - 1) + delta;
  return { ano: Math.floor(total / 12), mes: (total % 12) + 1 };
}

/** 'agosto de 2026' */
export function formatarMes({ ano, mes }: Mes): string {
  return `${MESES[mes - 1]} de ${ano}`;
}

export function mesesIguais(a: Mes, b: Mes): boolean {
  return a.ano === b.ano && a.mes === b.mes;
}
