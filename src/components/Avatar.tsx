import { StyleSheet, Text, View } from 'react-native';

/**
 * Circulo solido na cor da entidade (conta, categoria, investimento) com a
 * inicial do nome. E o que carrega a cor escolhida pelo usuario para fora dos
 * graficos e para dentro das listas.
 *
 * Solido, e nao a cor a 15% como era no Inicio: no tema escuro o tom lavado
 * sumia no fundo e todas as contas pareciam iguais.
 */
export function Avatar({
  nome,
  cor,
  tamanho = 38,
  glifo,
}: {
  nome: string;
  cor: string;
  tamanho?: number;
  /** Troca a inicial por um simbolo (ex.: icones do Ajustes). */
  glifo?: string;
}) {
  const letra = glifo ?? (nome.trim().charAt(0).toUpperCase() || '?');
  return (
    <View
      style={[
        e.circulo,
        { width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: cor },
      ]}
    >
      <Text style={[e.letra, { fontSize: tamanho * 0.42, color: corDoTexto(cor) }]}>{letra}</Text>
    </View>
  );
}

/**
 * Letra escura sobre cor clara, branca sobre o resto. Sem isso o amarelo da
 * paleta (#FDD835) ficaria com a inicial branca praticamente ilegivel.
 */
function corDoTexto(hex: string): string {
  const limpo = hex.replace('#', '').slice(0, 6);
  if (limpo.length !== 6) return '#FFFFFF';
  const r = parseInt(limpo.slice(0, 2), 16);
  const g = parseInt(limpo.slice(2, 4), 16);
  const b = parseInt(limpo.slice(4, 6), 16);
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia > 0.62 ? '#1A1A1A' : '#FFFFFF';
}

const e = StyleSheet.create({
  circulo: { alignItems: 'center', justifyContent: 'center' },
  letra: { fontWeight: '800' },
});
