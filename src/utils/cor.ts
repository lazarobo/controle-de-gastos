/**
 * Conversoes de cor do seletor personalizado. Sem import nenhum de proposito:
 * o `npm run verify` carrega este arquivo direto no Node.
 *
 * O seletor trabalha em HSV (matiz, saturacao, brilho) porque e o modelo do
 * quadrado + barra de matiz que todo mundo conhece; o banco e os widgets
 * continuam recebendo hexadecimal '#RRGGBB'.
 */

export interface Hsv {
  /** 0..360 */
  h: number;
  /** 0..1 */
  s: number;
  /** 0..1 */
  v: number;
}

/** '#abc', 'abc', '#AABBCC' -> '#AABBCC'. null se nao for hexadecimal valido. */
export function normalizarHex(texto: string): `#${string}` | null {
  let t = texto.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(t)) {
    t = t
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(t)) return null;
  return `#${t.toUpperCase()}`;
}

export function hexParaHsv(hex: string): Hsv {
  const n = normalizarHex(hex) ?? '#000000';
  const r = parseInt(n.slice(1, 3), 16) / 255;
  const g = parseInt(n.slice(3, 5), 16) / 255;
  const b = parseInt(n.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvParaHex({ h, s, v }: Hsv): `#${string}` {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.min(1, Math.max(0, s));
  const vv = Math.min(1, Math.max(0, v));

  const c = vv * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = vv - c;

  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const canal = (valor: number) =>
    Math.round((valor + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${canal(r)}${canal(g)}${canal(b)}`.toUpperCase() as `#${string}`;
}

/**
 * Luminancia relativa (WCAG) de 0 a 1. Decide se o texto sobre a cor vai
 * branco ou escuro -- o seletor livre deixa escolher amarelo-claro, e branco
 * em cima disso some.
 */
export function luminancia(hex: string): number {
  const n = normalizarHex(hex) ?? '#000000';
  const lin = (i: number) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
}
