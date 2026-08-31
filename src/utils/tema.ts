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
 * Paleta oferecida ao criar categoria. Nao muda com o tema: a cor da
 * categoria e escolhida pelo usuario e precisa continuar reconhecivel tanto
 * no claro quanto no escuro.
 */
export const PALETA = [
  '#E53935', '#FB8C00', '#FDD835', '#43A047', '#00ACC1',
  '#1E88E5', '#3949AB', '#8E24AA', '#D81B60', '#6D4C41',
  '#546E7A', '#757575',
];
