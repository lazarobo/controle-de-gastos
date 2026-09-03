import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTema } from '../contexto/TemaContexto';
import { formatarMesAbreviado } from '../utils/date';
import { formatarMoeda } from '../utils/money';
import { espaco, type Paleta } from '../utils/tema';
import type { EvolucaoMes } from '../types';

const ALTURA_MAX = 120;
const LARGURA_BARRA = 10;

/**
 * Barras simples com View + flexbox, sem SVG: sao retangulos com altura
 * proporcional ao valor, nao precisam de arco nem rotacao (diferente da
 * rosca em GraficoPizza.tsx). Duas barras por mes (receita/despesa), altura
 * escalada pelo MAIOR valor entre todos os meses exibidos, para as colunas
 * serem comparaveis entre si.
 */
export function GraficoBarras({ dados }: { dados: EvolucaoMes[] }) {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);

  const maior = Math.max(1, ...dados.flatMap((d) => [d.receitas, d.despesas]));

  return (
    <View style={e.container}>
      <View style={e.legenda}>
        <View style={e.itemLegenda}>
          <View style={[e.pontoLegenda, { backgroundColor: cores.receita }]} />
          <Text style={e.textoLegenda}>Receitas</Text>
        </View>
        <View style={e.itemLegenda}>
          <View style={[e.pontoLegenda, { backgroundColor: cores.despesa }]} />
          <Text style={e.textoLegenda}>Despesas</Text>
        </View>
      </View>

      <View style={e.eixo}>
        {dados.map((d) => (
          <View key={d.mes} style={e.coluna}>
            <View style={e.barrasWrap}>
              <View
                style={[
                  e.barra,
                  {
                    height: Math.max(2, (d.receitas / maior) * ALTURA_MAX),
                    backgroundColor: cores.receita,
                  },
                ]}
              />
              <View
                style={[
                  e.barra,
                  {
                    height: Math.max(2, (d.despesas / maior) * ALTURA_MAX),
                    backgroundColor: cores.despesa,
                  },
                ]}
              />
            </View>
            <Text style={e.rotuloMes}>{formatarMesAbreviado(d.mes)}</Text>
          </View>
        ))}
      </View>

      <View style={e.resumo}>
        <Text style={e.resumoTexto}>
          Maior valor no período: {formatarMoeda(maior)}
        </Text>
      </View>
    </View>
  );
}

function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
    container: { gap: espaco.md },
    legenda: { flexDirection: 'row', gap: espaco.lg, justifyContent: 'center' },
    itemLegenda: { flexDirection: 'row', alignItems: 'center', gap: espaco.xs },
    pontoLegenda: { width: 10, height: 10, borderRadius: 5 },
    textoLegenda: { fontSize: 12, color: cores.textoFraco },
    eixo: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'flex-end',
      height: ALTURA_MAX + 28,
      borderBottomWidth: 1,
      borderBottomColor: cores.borda,
    },
    coluna: { alignItems: 'center', gap: espaco.xs },
    barrasWrap: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 3,
      height: ALTURA_MAX,
    },
    barra: { width: LARGURA_BARRA, borderRadius: 3 },
    rotuloMes: { fontSize: 11, color: cores.textoFraco, textTransform: 'capitalize' },
    resumo: { alignItems: 'center' },
    resumoTexto: { fontSize: 11, color: cores.textoFraco },
  });
}
