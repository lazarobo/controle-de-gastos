import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { espaco, raio } from '../utils/tema';

/**
 * Cartao com degrade diagonal e dois circulos translucidos de enfeite.
 *
 * O degrade vem do react-native-svg, que o projeto ja usa na rosca: nada de
 * expo-linear-gradient, que seria mais um modulo nativo -- e o SDK 57 ja
 * mostrou o que modulo nativo novo custa em conflito de dependencia.
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
  return (
    <View style={[e.cartao, style]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id={idGradiente} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={de} />
            <Stop offset="1" stopColor={para} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${idGradiente})`} />
        <Circle cx="88%" cy="8%" r="70" fill="#FFFFFF" fillOpacity={0.08} />
        <Circle cx="102%" cy="85%" r="95" fill="#FFFFFF" fillOpacity={0.06} />
      </Svg>
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
