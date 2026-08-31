import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { formatarMoeda } from '../utils/money';
import { useTema } from '../contexto/TemaContexto';
import { espaco, type Paleta } from '../utils/tema';
import type { TotalPorCategoria } from '../types';

const TAMANHO = 200;
const ESPESSURA = 34;
const RAIO = (TAMANHO - ESPESSURA) / 2;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

/**
 * Rosca desenhada com react-native-svg em vez de uma biblioteca de graficos.
 *
 * Cada fatia e um circulo completo com `strokeDasharray` cortando o traco no
 * comprimento do arco e `strokeDashoffset` empurrando-o ate o angulo inicial.
 * A rotacao de -90 graus faz a primeira fatia comecar no topo em vez das 3h.
 */
export function GraficoPizza({ dados }: { dados: TotalPorCategoria[] }) {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);

  const total = dados.reduce((soma, d) => soma + d.total, 0);
  if (total <= 0) return null;

  let acumulado = 0;
  const fatias = dados.map((d) => {
    const fracao = d.total / total;
    const fatia = {
      chave: `${d.categoria_id ?? 'sem'}`,
      cor: d.cor,
      comprimento: fracao * CIRCUNFERENCIA,
      deslocamento: -acumulado * CIRCUNFERENCIA,
      percentual: fracao * 100,
      nome: d.categoria_nome,
      valor: d.total,
    };
    acumulado += fracao;
    return fatia;
  });

  return (
    <View style={e.container}>
      <View style={e.rosca}>
        <Svg width={TAMANHO} height={TAMANHO}>
          <G rotation={-90} originX={TAMANHO / 2} originY={TAMANHO / 2}>
            {fatias.map((f) => (
              <Circle
                key={f.chave}
                cx={TAMANHO / 2}
                cy={TAMANHO / 2}
                r={RAIO}
                stroke={f.cor}
                strokeWidth={ESPESSURA}
                fill="none"
                strokeDasharray={`${f.comprimento} ${CIRCUNFERENCIA - f.comprimento}`}
                strokeDashoffset={f.deslocamento}
              />
            ))}
          </G>
        </Svg>

        <View style={e.centro} pointerEvents="none">
          <Text style={e.centroRotulo}>total</Text>
          <Text style={e.centroValor}>{formatarMoeda(total)}</Text>
        </View>
      </View>

      <View style={e.legenda}>
        {fatias.map((f) => (
          <View key={f.chave} style={e.linha}>
            <View style={[e.ponto, { backgroundColor: f.cor }]} />
            <Text style={e.nome} numberOfLines={1}>
              {f.nome}
            </Text>
            <Text style={e.percentual}>{f.percentual.toFixed(1)}%</Text>
            <Text style={e.valor}>{formatarMoeda(f.valor)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
    container: { gap: espaco.lg },
    rosca: { alignSelf: 'center', width: TAMANHO, height: TAMANHO, justifyContent: 'center' },
    centro: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centroRotulo: { fontSize: 11, color: cores.textoFraco, textTransform: 'uppercase' },
    centroValor: { fontSize: 18, fontWeight: '700', color: cores.texto },
    legenda: { gap: espaco.sm },
    linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
    ponto: { width: 12, height: 12, borderRadius: 6 },
    nome: { flex: 1, fontSize: 14, color: cores.texto },
    percentual: { fontSize: 12, color: cores.textoFraco, width: 48, textAlign: 'right' },
    valor: { fontSize: 14, fontWeight: '600', color: cores.texto, width: 96, textAlign: 'right' },
  });
}
