export type Paleta = typeof paletaClara;

/**
 * Duas paletas com as MESMAS chaves — todo componente le `cores.texto`,
 * `cores.superficie` etc. sem saber qual das duas esta ativa. Quem decide isso
 * e o TemaContexto (src/contexto/TemaContexto.tsx); nada aqui e reativo.
 */
export const paletaClara = {
  fundo: '#F4F6F8',
  superficie: '#FFFFFF',
  superficieAlt: '#F0F2F5',
  borda: '#E2E6EA',
  texto: '#12232E',
  textoFraco: '#6B7A88',
  primaria: '#1E6FD9',
  primariaFraca: '#E8F1FD',
  receita: '#1B8A3F',
  despesa: '#C62828',
  /** Movimentacao interna: nem ganho nem gasto, entao nem verde nem vermelho. */
  transferencia: '#5E6C7A',
  perigo: '#C62828',
  neutra: '#9E9E9E',
};

export const paletaEscura: Paleta = {
  fundo: '#0F1620',
  superficie: '#1A2430',
  superficieAlt: '#212D3B',
  borda: '#2C3A48',
  texto: '#EDF1F5',
  textoFraco: '#8A99A8',
  primaria: '#5B9BF0',
  primariaFraca: '#1D3352',
  receita: '#4CAF6E',
  despesa: '#E5695F',
  transferencia: '#8A99A8',
  perigo: '#E5695F',
  neutra: '#7A8794',
};

export const espaco = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const raio = {
  sm: 8,
  md: 12,
  lg: 16,
};

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
