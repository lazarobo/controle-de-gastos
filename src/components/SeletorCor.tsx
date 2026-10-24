import { useEffect, useMemo, useState } from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTema } from '../contexto/TemaContexto';
import { hexParaHsv, hsvParaHex, normalizarHex, type Hsv } from '../utils/cor';
import { espaco, PALETA, raio, type Paleta } from '../utils/tema';
import { Icone } from './Icone';

/**
 * Seletor de cor compartilhado por conta, categoria, evento e investimento.
 *
 * Em cima, a grade de 24 cores prontas (o caminho rapido). O ultimo botao abre
 * o seletor livre: quadrado de saturacao x brilho, barra de matiz e campo
 * hexadecimal. A saida e sempre '#RRGGBB' -- os widgets do Android so aceitam
 * hexadecimal (ver o tipo Cor em src/utils/tema.ts).
 */
export function SeletorCor({
  cor,
  onChange,
}: {
  cor: string;
  onChange: (cor: string) => void;
}) {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  const personalizada = !PALETA.includes(cor.toUpperCase());
  const [aberto, setAberto] = useState(personalizada);

  return (
    <View style={e.raiz}>
      <View style={e.paleta}>
        {PALETA.map((c) => (
          <Pressable
            key={c}
            onPress={() => onChange(c)}
            accessibilityLabel={`Cor ${c}`}
            style={[e.amostra, { backgroundColor: c }, cor.toUpperCase() === c && e.amostraAtiva]}
          />
        ))}
        <Pressable
          onPress={() => setAberto((a) => !a)}
          accessibilityLabel="Escolher outra cor"
          style={[
            e.amostra,
            e.botaoLivre,
            personalizada && { backgroundColor: cor },
            (aberto || personalizada) && e.amostraAtiva,
          ]}
        >
          <Icone nome="pincel" cor={personalizada ? '#FFFFFF' : cores.textoFraco} tamanho={18} />
        </Pressable>
      </View>

      {aberto ? <SeletorLivre cor={cor} onChange={onChange} cores={cores} /> : null}
    </View>
  );
}

const ALTURA_QUADRADO = 168;
const ALTURA_MATIZ = 28;

function SeletorLivre({
  cor,
  onChange,
  cores,
}: {
  cor: string;
  onChange: (cor: string) => void;
  cores: Paleta;
}) {
  const e = useMemo(() => criarEstilos(cores), [cores]);
  // O HSV vive aqui, e nao so derivado do hex: no cinza (saturacao 0) a matiz
  // se perde na conversao, e a barra pularia para o vermelho a cada toque.
  const [hsv, setHsv] = useState<Hsv>(() => hexParaHsv(cor));
  const [largura, setLargura] = useState(0);
  const [texto, setTexto] = useState(cor.toUpperCase());

  useEffect(() => {
    if (hsvParaHex(hsv) !== cor.toUpperCase()) setHsv(hexParaHsv(cor));
    setTexto(cor.toUpperCase());
  }, [cor]);

  function aplicar(novo: Hsv) {
    setHsv(novo);
    onChange(hsvParaHex(novo));
  }

  const limitar = (n: number) => Math.min(1, Math.max(0, n));

  function tocarQuadrado(ev: GestureResponderEvent) {
    if (largura === 0) return;
    const { locationX, locationY } = ev.nativeEvent;
    aplicar({ h: hsv.h, s: limitar(locationX / largura), v: 1 - limitar(locationY / ALTURA_QUADRADO) });
  }

  function tocarMatiz(ev: GestureResponderEvent) {
    if (largura === 0) return;
    aplicar({ ...hsv, h: limitar(ev.nativeEvent.locationX / largura) * 359.9 });
  }

  // Arrastar dentro do ScrollView do formulario: sem isto o Android entrega o
  // gesto para a rolagem no primeiro movimento vertical.
  const arrastavel = (tratar: (ev: GestureResponderEvent) => void) => ({
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    // Devolver true aqui bloqueia o responder nativo (Android).
    onResponderGrant: (ev: GestureResponderEvent) => {
      tratar(ev);
      return true;
    },
    onResponderMove: tratar,
  });

  const corPura = hsvParaHex({ h: hsv.h, s: 1, v: 1 });

  return (
    <View
      style={e.livre}
      onLayout={(ev: LayoutChangeEvent) => setLargura(ev.nativeEvent.layout.width)}
    >
      <View style={[e.quadrado, { height: ALTURA_QUADRADO }]} {...arrastavel(tocarQuadrado)}>
        {largura > 0 ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Svg width={largura} height={ALTURA_QUADRADO}>
              <Defs>
                <LinearGradient id="sv-branco" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
                  <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                </LinearGradient>
                <LinearGradient id="sv-preto" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#000000" stopOpacity={0} />
                  <Stop offset="1" stopColor="#000000" stopOpacity={1} />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width={largura} height={ALTURA_QUADRADO} fill={corPura} />
              <Rect x={0} y={0} width={largura} height={ALTURA_QUADRADO} fill="url(#sv-branco)" />
              <Rect x={0} y={0} width={largura} height={ALTURA_QUADRADO} fill="url(#sv-preto)" />
              <Circle
                cx={hsv.s * largura}
                cy={(1 - hsv.v) * ALTURA_QUADRADO}
                r={11}
                fill={hsvParaHex(hsv)}
                stroke="#FFFFFF"
                strokeWidth={3}
              />
            </Svg>
          </View>
        ) : null}
      </View>

      <View style={[e.matiz, { height: ALTURA_MATIZ }]} {...arrastavel(tocarMatiz)}>
        {largura > 0 ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Svg width={largura} height={ALTURA_MATIZ}>
              <Defs>
                <LinearGradient id="matiz" x1="0" y1="0" x2="1" y2="0">
                  {[0, 60, 120, 180, 240, 300, 360].map((h) => (
                    <Stop
                      key={h}
                      offset={String(h / 360)}
                      stopColor={hsvParaHex({ h: h % 360, s: 1, v: 1 })}
                    />
                  ))}
                </LinearGradient>
              </Defs>
              <Rect
                x={0}
                y={0}
                width={largura}
                height={ALTURA_MATIZ}
                rx={ALTURA_MATIZ / 2}
                fill="url(#matiz)"
              />
              <Circle
                cx={Math.min(largura - 12, Math.max(12, (hsv.h / 360) * largura))}
                cy={ALTURA_MATIZ / 2}
                r={11}
                fill={corPura}
                stroke="#FFFFFF"
                strokeWidth={3}
              />
            </Svg>
          </View>
        ) : null}
      </View>

      <View style={e.linhaHex}>
        <View style={[e.previa, { backgroundColor: cor }]} />
        <Text style={e.cerquilha}>HEX</Text>
        <TextInput
          value={texto}
          onChangeText={(t) => {
            setTexto(t.toUpperCase());
            const hex = normalizarHex(t);
            // So aceita com 6 digitos enquanto digita: com 3, '#ABC' viraria
            // '#AABBCC' no meio da digitacao de '#ABCDEF'.
            if (hex && t.replace('#', '').length === 6) onChange(hex);
          }}
          onEndEditing={() => {
            const hex = normalizarHex(texto);
            if (hex) onChange(hex);
            else setTexto(cor.toUpperCase());
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
          style={e.inputHex}
          placeholderTextColor={cores.textoFraco}
        />
      </View>
    </View>
  );
}

function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
    raiz: { gap: espaco.md },
    paleta: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
    amostra: {
      width: 38,
      height: 38,
      borderRadius: 13,
      borderWidth: 3,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Anel na cor do texto: funciona sobre qualquer cor da paleta, nos dois temas.
    amostraAtiva: { borderColor: cores.texto },
    botaoLivre: { backgroundColor: cores.superficieAlt },
    livre: { gap: espaco.md },
    quadrado: { borderRadius: raio.md, overflow: 'hidden' },
    matiz: { borderRadius: ALTURA_MATIZ / 2, overflow: 'hidden' },
    linhaHex: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
    previa: { width: 40, height: 40, borderRadius: 12 },
    cerquilha: { fontSize: 12, fontWeight: '800', color: cores.textoFraco, letterSpacing: 0.8 },
    inputHex: {
      flex: 1,
      backgroundColor: cores.superficieAlt,
      borderRadius: raio.sm,
      paddingHorizontal: espaco.md,
      paddingVertical: 10,
      fontSize: 16,
      fontWeight: '700',
      color: cores.texto,
      fontFamily: 'monospace',
    },
  });
}
