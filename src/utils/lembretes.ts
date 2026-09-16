/**
 * Quando os lembretes devem tocar. Puro de proposito: nao importa
 * expo-notifications, entao o `npm run verify` consegue testar a regra sem
 * nenhum modulo nativo -- e a regra e justamente a parte que da errado.
 *
 * Nao importa NADA, nem os utilitarios de data: quem chama entrega Date pronto.
 * Sem isso o Node, que exige extensao explicita no import, nao consegue carregar
 * este arquivo no verify.
 */

export interface Hora {
  hora: number;
  minuto: number;
}

/** Monta a data no fuso LOCAL (D08): nada de UTC no meio do caminho. */
function em(dia: Date, { hora, minuto }: Hora): Date {
  return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), hora, minuto, 0, 0);
}

function somarDias(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/**
 * As proximas `quantidade` datas do lembrete diario.
 *
 * Duas decisoes aqui:
 *
 * 1. Se voce JA lancou hoje, hoje e pulado. O lembrete existe para o dia em
 *    que voce esqueceu, nao para elogiar quem ja fez.
 * 2. Devolve varias datas avulsas em vez de um alarme "repete todo dia".
 *    Sem tarefa em segundo plano, um alarme repetido tocaria mesmo nos dias
 *    em que voce lancou. Com uma lista, o app reagenda a cada abertura e
 *    empurra a janela para frente; quem some por uma semana continua sendo
 *    lembrado todos os dias, porque a lista ja estava agendada.
 */
export function proximosLembretesDiarios(
  agora: Date,
  hora: Hora,
  jaLancouHoje: boolean,
  quantidade = 7,
): Date[] {
  let primeiro = em(agora, hora);
  // Horario de hoje ja passou (ou ja lancou): comeca amanha.
  if (jaLancouHoje || primeiro.getTime() <= agora.getTime()) {
    primeiro = em(somarDias(agora, 1), hora);
  }
  return Array.from({ length: quantidade }, (_, i) => em(somarDias(primeiro, i), hora));
}

/**
 * Lembretes de backup, contados a partir do ultimo backup feito -- nao da
 * instalacao. Quem exportou ontem nao precisa ser cutucado hoje.
 */
export function proximosLembretesBackup(
  agora: Date,
  ultimoBackup: Date | null,
  hora: Hora,
  quantidade = 3,
  intervaloDias = 30,
): Date[] {
  const base = ultimoBackup ?? agora;
  let primeiro = em(somarDias(base, intervaloDias), hora);
  // Backup vencido ha muito tempo: cobra amanha, nao numa data no passado.
  if (primeiro.getTime() <= agora.getTime()) {
    primeiro = em(somarDias(agora, 1), hora);
  }
  return Array.from({ length: quantidade }, (_, i) =>
    em(somarDias(primeiro, i * intervaloDias), hora),
  );
}
