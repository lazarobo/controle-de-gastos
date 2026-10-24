/**
 * Cor em hexadecimal. O tipo nao e `string` solto de proposito: os widgets do
 * Android so aceitam hexadecimal, e sem isso um inocente `'red'` compilaria
 * aqui e sumiria la, sem erro nenhum.
 */
export type Cor = `#${string}`;

/**
 * Duas paletas com as MESMAS chaves — todo componente le `cores.texto`,
 * `cores.superficie` etc. sem saber qual das duas esta ativa. Quem decide isso
 * e o TemaContexto (src/contexto/TemaContexto.tsx); nada aqui e reativo.
 *
 * A interface e escrita a mao (em vez de `typeof paletaClara`) para as duas
 * paletas serem obrigadas a ter as mesmas chaves E cores hexadecimais.
 */
export interface Paleta {
  fundo: Cor;
  superficie: Cor;
  superficieAlt: Cor;
  borda: Cor;
  texto: Cor;
  textoFraco: Cor;
  primaria: Cor;
  primariaFraca: Cor;
  receita: Cor;
  despesa: Cor;
  /** Movimentacao interna: nem ganho nem gasto, entao nem verde nem vermelho. */
  transferencia: Cor;
  perigo: Cor;
  neutra: Cor;
  /** Degrade do cartao de saldo no Inicio (topo-esquerda -> base-direita). */
  gradienteA: Cor;
  gradienteB: Cor;
  /** Texto sobre o degrade: branco nos dois temas, o fundo e sempre escuro. */
  sobreDestaque: Cor;
  /** Acento de investimentos: roxo, distinto de receita/despesa/primaria. */
  investimento: Cor;
  /** Cor da sombra dos cartoes (elevation no Android). */
  sombra: Cor;
}

export const paletaClara: Paleta = {
  fundo: '#F3F5FA',
  superficie: '#FFFFFF',
  superficieAlt: '#EEF1F6',
  borda: '#E3E7EF',
  texto: '#101828',
  textoFraco: '#667085',
  primaria: '#2563EB',
  primariaFraca: '#E6EEFD',
  receita: '#16A34A',
  despesa: '#DC2626',
  /** Movimentacao interna: nem ganho nem gasto, entao nem verde nem vermelho. */
  transferencia: '#64748B',
  perigo: '#DC2626',
  neutra: '#98A2B3',
  /** Degrade do cartao de saldo no Inicio (topo-esquerda -> base-direita). */
  gradienteA: '#2563EB',
  gradienteB: '#6D3FE0',
  /** Texto sobre o degrade: branco nos dois temas, o fundo e sempre escuro. */
  sobreDestaque: '#FFFFFF',
  /** Acento de investimentos: roxo, distinto de receita/despesa/primaria. */
  investimento: '#7C4DFF',
  sombra: '#1D2939',
};

export const paletaEscura: Paleta = {
  fundo: '#0B111A',
  superficie: '#151D29',
  superficieAlt: '#1D2735',
  borda: '#263243',
  texto: '#F2F4F7',
  textoFraco: '#94A3B8',
  primaria: '#5B8DEF',
  primariaFraca: '#1A2B4A',
  receita: '#4ADE80',
  despesa: '#F87171',
  transferencia: '#94A3B8',
  perigo: '#F87171',
  neutra: '#7A8794',
  gradienteA: '#2F5FD0',
  gradienteB: '#5A32B8',
  sobreDestaque: '#FFFFFF',
  investimento: '#A78BFA',
  sombra: '#000000',
};

export const espaco = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

/** Cantos mais redondos desde a 1.4: cartao 20, campo/botao 14, chip pilula. */
export const raio = {
  sm: 10,
  md: 14,
  lg: 20,
};

/**
 * Sombra suave de cartao. No Android quem desenha e `elevation` (as props
 * shadow* sao do iOS); no tema escuro a sombra quase nao aparece, e por isso
 * os cartoes mantem a borda fina tambem.
 */
export function sombra(cores: Paleta, nivel: 1 | 2 | 3 = 1) {
  return {
    shadowColor: cores.sombra,
    shadowOpacity: 0.06 * nivel,
    shadowRadius: 4 * nivel,
    shadowOffset: { width: 0, height: nivel },
    elevation: nivel * 2,
  };
}

/**
 * Paleta oferecida ao criar categoria e conta. Nao muda com o tema: a cor e
 * escolhida pelo usuario e precisa continuar reconhecivel no claro E no escuro
 * -- por isso nada de tom pastel nem de quase-preto/quase-branco aqui.
 *
 * Organizada em quatro linhas de seis, percorrendo o circulo cromatico
 * (vermelhos -> laranjas/amarelos -> verdes -> azuis/roxos), para o seletor
 * virar uma grade legivel em vez de uma sopa de cores.
 */
export const PALETA = [
  // vermelhos e rosas
  '#E53935', '#D81B60', '#C2185B', '#AD1457', '#F4511E', '#BF360C',
  // laranjas e amarelos
  '#FB8C00', '#F57C00', '#FFA000', '#FDD835', '#F9A825', '#8D6E63',
  // verdes e ciano
  '#43A047', '#2E7D32', '#7CB342', '#00897B', '#00ACC1', '#0097A7',
  // azuis, roxos e neutros
  '#1E88E5', '#1565C0', '#3949AB', '#5E35B1', '#8E24AA', '#546E7A',
];
