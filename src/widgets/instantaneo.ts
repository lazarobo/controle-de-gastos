import { File, Paths } from 'expo-file-system';

/**
 * O widget roda num contexto separado do app e NAO consegue abrir o SQLite.
 * Por isso o app grava aqui um instantaneo minusculo dos numeros que o widget
 * mostra, e o widget so le.
 *
 * Consequencia aceita e visivel na tela: o widget mostra os numeros de quando
 * o app foi aberto pela ultima vez, com a data ao lado. Nao e uma segunda fonte
 * de verdade -- ninguem calcula nada a partir dele, e o SQLite continua sendo
 * o unico lugar onde os dados existem de verdade.
 */
export interface InstantaneoSaldo {
  /** Centavos. */
  saldoTotal: number;
  /** Centavos, resultado do mes corrente. */
  resultado: number;
  /** ISO de quando o app gravou. */
  atualizadoEm: string;
}

const ARQUIVO = 'widget-saldo.json';

export function gravarInstantaneo(dados: InstantaneoSaldo): void {
  try {
    const arquivo = new File(Paths.document, ARQUIVO);
    arquivo.create({ overwrite: true, intermediates: true });
    arquivo.write(JSON.stringify(dados));
  } catch {
    // Widget desatualizado e um problema pequeno; nao pode derrubar a tela.
  }
}

/** Sincrono de proposito: o tratador do widget precisa responder na hora. */
export function lerInstantaneo(): InstantaneoSaldo | null {
  try {
    const arquivo = new File(Paths.document, ARQUIVO);
    if (!arquivo.exists) return null;

    const bruto: unknown = JSON.parse(arquivo.textSync());
    if (
      typeof bruto !== 'object' ||
      bruto === null ||
      typeof (bruto as InstantaneoSaldo).saldoTotal !== 'number'
    ) {
      return null;
    }
    return bruto as InstantaneoSaldo;
  } catch {
    return null;
  }
}
