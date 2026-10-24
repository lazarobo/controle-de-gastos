import { StyleSheet, Text, View } from 'react-native';
import { luminancia } from '../utils/cor';
import { Icone, type NomeIcone } from './Icone';

/**
 * Quadrado arredondado solido na cor da entidade (conta, categoria,
 * investimento) com a inicial do nome -- ou um icone. E o que carrega a cor
 * escolhida pelo usuario para fora dos graficos e para dentro das listas.
 *
 * Solido, e nao a cor a 15%: no tema escuro o tom lavado sumia no fundo e
 * todas as contas pareciam iguais.
 */
export function Avatar({
  nome,
  cor,
  tamanho = 40,
  glifo,
  icone,
}: {
  nome: string;
  cor: string;
  tamanho?: number;
  /** Troca a inicial por um caractere (ex.: '$' no Ajustes). */
  glifo?: string;
  /** Troca a inicial por um icone desenhado (ex.: movimentacao). */
  icone?: NomeIcone;
}) {
  const letra = glifo ?? (nome.trim().charAt(0).toUpperCase() || '?');
  const corTexto = corDoTexto(cor);
  return (
    <View
      style={[
        e.forma,
        { width: tamanho, height: tamanho, borderRadius: tamanho * 0.34, backgroundColor: cor },
      ]}
    >
      {icone ? (
        <Icone nome={icone} cor={corTexto} tamanho={tamanho * 0.5} espessura={2.2} />
      ) : (
        <Text style={[e.letra, { fontSize: tamanho * 0.42, color: corTexto }]}>{letra}</Text>
      )}
    </View>
  );
}

/**
 * Letra escura sobre cor clara, branca sobre o resto. Com o seletor livre de
 * cor (1.4) da para escolher um amarelo-palha; branco em cima disso some.
 */
function corDoTexto(hex: string): string {
  return luminancia(hex) > 0.45 ? '#1A1A1A' : '#FFFFFF';
}

const e = StyleSheet.create({
  forma: { alignItems: 'center', justifyContent: 'center' },
  letra: { fontWeight: '800' },
});
