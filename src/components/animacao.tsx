import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  PressableProps,
  StyleProp,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useMovimentoReduzido } from '../hooks/useMovimentoReduzido';
import { formatarMoeda } from '../utils/money';

/**
 * Animacoes do app, todas com a API Animated nativa do React Native.
 *
 * O Reanimated esta no node_modules (pinado por overrides), mas nunca foi
 * configurado: ele exige plugin de Babel e ja custou dois builds quebrados no
 * SDK 57. Para "leves animacoes" -- fade, deslize, escala, contagem -- a API
 * embutida basta, e opacidade/transform rodam na thread nativa.
 *
 * Todo componente aqui respeita useMovimentoReduzido.
 */

const SUAVE = Easing.out(Easing.cubic);

/** Entrada com fade + leve subida. `atraso` escalona uma lista de cartoes. */
export function Aparecer({
  children,
  atraso = 0,
  style,
}: {
  children: ReactNode;
  atraso?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduzido = useMovimentoReduzido();
  const progresso = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduzido) {
      progresso.setValue(1);
      return;
    }
    Animated.timing(progresso, {
      toValue: 1,
      duration: 380,
      delay: atraso,
      easing: SUAVE,
      useNativeDriver: true,
    }).start();
    // So na montagem: a tela nao pode "reaparecer" toda vez que os dados
    // recarregam ao voltar de um formulario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduzido]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progresso,
          transform: [
            { translateY: progresso.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Valor em reais que conta ate o numero novo. Na montagem conta a partir de
 * zero; depois, a partir do valor anterior -- entao lancar uma despesa faz o
 * saldo "descer" ate o novo total, que e o feedback de que deu certo.
 *
 * Interpola em CENTAVOS e arredonda cada quadro: o texto nunca mostra um valor
 * fracionario, e o ultimo quadro e exatamente `centavos`.
 */
export function NumeroAnimado({
  centavos,
  style,
  comSinal = false,
}: {
  centavos: number;
  style?: StyleProp<TextStyle>;
  /** Mostra "+" antes de valores positivos (resultado do mes). */
  comSinal?: boolean;
}) {
  const reduzido = useMovimentoReduzido();
  const [exibido, setExibido] = useState(0);
  const anterior = useRef(0);

  useEffect(() => {
    if (reduzido) {
      anterior.current = centavos;
      setExibido(centavos);
      return;
    }

    const de = anterior.current;
    const para = centavos;
    const t = new Animated.Value(0);
    const ouvinte = t.addListener(({ value }) => setExibido(Math.round(de + (para - de) * value)));

    Animated.timing(t, {
      toValue: 1,
      duration: 650,
      easing: SUAVE,
      // Texto nao anima na thread nativa: o valor precisa passar pelo JS.
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        anterior.current = para;
        setExibido(para);
      }
    });

    return () => {
      // Interrompida no meio (valor mudou de novo): a proxima comeca de onde
      // esta parou, sem pular.
      t.stopAnimation((v) => {
        anterior.current = Math.round(de + (para - de) * v);
      });
      t.removeListener(ouvinte);
    };
  }, [centavos, reduzido]);

  return (
    <Text style={style}>
      {comSinal && centavos > 0 ? '+' : ''}
      {formatarMoeda(exibido)}
    </Text>
  );
}

/** Pressable que encolhe levemente no toque -- o "clique" que falta em RN. */
export function Tocavel({
  children,
  style,
  ...resto
}: Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduzido = useMovimentoReduzido();
  const escala = useRef(new Animated.Value(1)).current;

  function ir(valor: number) {
    if (reduzido) return;
    Animated.spring(escala, {
      toValue: valor,
      speed: 40,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }

  // O estilo vai no PROPRIO Pressable, nunca num filho. Numa versao anterior o
  // estilo ficava numa Animated.View interna: com position absolute (o botao +),
  // o Pressable em volta ficava 0x0 -- o circulo aparecia, mas o toque caia no
  // vazio. Assim, a area tocavel e sempre exatamente a area desenhada.
  return (
    <PressableAnimado
      onPressIn={() => ir(0.97)}
      onPressOut={() => ir(1)}
      {...resto}
      style={[style, { transform: [{ scale: escala }] }]}
    >
      {children}
    </PressableAnimado>
  );
}

const PressableAnimado = Animated.createAnimatedComponent(Pressable);

/** Barra de progresso que preenche ao aparecer e ao mudar de valor. */
export function BarraProgresso({
  fracao,
  cor,
  trilha,
  altura = 8,
}: {
  /** 0..1; valores fora disso sao cortados (estouro de meta mostra cheio). */
  fracao: number;
  cor: string;
  trilha: string;
  altura?: number;
}) {
  const reduzido = useMovimentoReduzido();
  const alvo = Math.max(0, Math.min(1, fracao));
  const largura = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduzido) {
      largura.setValue(alvo);
      return;
    }
    Animated.timing(largura, {
      toValue: alvo,
      duration: 700,
      easing: SUAVE,
      // Largura e propriedade de layout: nao roda na thread nativa.
      useNativeDriver: false,
    }).start();
  }, [alvo, reduzido, largura]);

  return (
    <View
      style={{
        height: altura,
        borderRadius: altura / 2,
        backgroundColor: trilha,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          height: '100%',
          borderRadius: altura / 2,
          backgroundColor: cor,
          width: largura.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  );
}
