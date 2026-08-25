/**
 * Todo valor monetario circula como INTEGER de centavos.
 *
 * Motivo: REAL/float nao representa decimais exatos (0.1 + 0.2 === 0.30000000000000004).
 * Somando centenas de lancamentos o erro se acumula e o total do app deixa de bater
 * com o extrato do banco. Inteiro de centavos e exato ate 2^53 centavos (~90 trilhoes).
 * A divisao por 100 acontece somente na formatacao para exibicao.
 */

const formatador = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/** 123456 -> "R$ 1.234,56" */
export function formatarMoeda(centavos: number): string {
  return formatador.format(centavos / 100);
}

/** 123456 -> "1.234,56" (sem simbolo, para inputs) */
export function formatarValor(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',');
}

/**
 * Converte o texto digitado pelo usuario em centavos.
 * Aceita "1.234,56", "1234,56", "1234.56" e "1234".
 * Retorna null quando o texto nao e um numero valido.
 */
export function parseMoeda(texto: string): number | null {
  const limpo = texto.trim().replace(/[^\d.,-]/g, '');
  if (!limpo) return null;

  // Separador decimal = o ultimo ',' ou '.' que aparecer.
  const posVirgula = limpo.lastIndexOf(',');
  const posPonto = limpo.lastIndexOf('.');
  const posDecimal = Math.max(posVirgula, posPonto);

  let inteiros: string;
  let decimais: string;

  if (posDecimal === -1) {
    inteiros = limpo;
    decimais = '';
  } else {
    inteiros = limpo.slice(0, posDecimal);
    decimais = limpo.slice(posDecimal + 1);
    // Se o que vem depois nao tem cara de decimal, era separador de milhar.
    if (decimais.length > 2 || !/^\d*$/.test(decimais)) {
      inteiros = limpo;
      decimais = '';
    }
  }

  const digitosInteiros = inteiros.replace(/\D/g, '');
  if (!digitosInteiros && !decimais) return null;

  const centavos =
    Number(digitosInteiros || '0') * 100 + Number(decimais.padEnd(2, '0') || '0');

  return Number.isFinite(centavos) ? centavos : null;
}

/** Aplica o sinal do tipo. Usado apenas para exibicao. */
export function comSinal(centavos: number, tipo: 'receita' | 'despesa'): number {
  return tipo === 'despesa' ? -centavos : centavos;
}
