import { ReactNode, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { espaco, raio } from '../utils/tema';

/**
 * Cartao com degrade diagonal e dois circulos translucidos de enfeite.
 *
 * O degrade vem do react-native-svg, que o projeto ja usa na rosca: nada de
 * expo-linear-gradient, que seria mais um modulo nativo -- e o SDK 57 ja
 * mostrou o que modulo nativo novo custa em conflito de dependencia.
 *
 * O tamanho do SVG vem de onLayout, em numeros, e nao de width="100%": no
 * Android o SVG em posicao absoluta resolvia o percentual contra um layout
 * anterior e o degrade parava antes da borda, cortando o conteudo no meio.
 * Ate a primeira medicao, o fundo solido na cor inicial evita o flash vazio.
 */
export function CartaoDestaque({
  de,
  para,
  children,
  style,
  idGradiente = 'destaque',
}: {
  de: string;
  para: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Unico por cartao na mesma tela, se houver mais de um. */
  idGradiente?: string;
}) {
  const [tamanho, setTamanho] = useState({ largura: 0, altura: 0 });

  function medir(ev: LayoutChangeEvent) {
    const { width, height } = ev.nativeEvent.layout;
    if (width !== tamanho.largura || height !== tamanho.altura) {
      setTamanho({ largura: width, altura: height });
    }
  }

  const { largura, altura } = tamanho;

  return (
    <View style={[e.cartao, { backgroundColor: de }, style]} onLayout={medir}>
      {largura > 0 ? (
        <Svg style={StyleSheet.absoluteFill} width={largura} height={altura}>
          <Defs>
            <LinearGradient id={idGradiente} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={de} />
              <Stop offset="1" stopColor={para} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={largura} height={altura} fill={`url(#${idGradiente})`} />
          <Circle cx={largura * 0.88} cy={altura * 0.08} r={70} fill="#FFFFFF" fillOpacity={0.08} />
          <Circle cx={largura * 1.02} cy={altura * 0.85} r={95} fill="#FFFFFF" fillOpacity={0.06} />
        </Svg>
      ) : null}
      {children}
    </View>
  );
}

const e = StyleSheet.create({
  cartao: {
    borderRadius: raio.lg,
    padding: espaco.lg,
    overflow: 'hidden',
  },
});
