import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTema } from '../contexto/TemaContexto';
import { formatarMoeda } from '../utils/money';
import { espaco, type Paleta } from '../utils/tema';
import type { TotalPorDia } from '../types';

const ALTURA_MAX = 100;

/**
 * Uma coluna por dia do mes (ate 31), barra proporcional ao gasto do dia. Sem
 * rotulo em cada coluna -- 31 numeros nao cabem sem virar poluicao visual; em
 * vez disso, so o dia de MAIOR gasto ganha cor diferente e uma legenda acima
 * do grafico ("Maior gasto: dia X"), que e a pergunta que este grafico existe
 * para responder.
 */
export function GraficoDias({ dados }: { dados: TotalPorDia[] }) {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);

  const maior = dados.reduce((m, d) => (d.total > m.total ? d : m), dados[0]);

  if (!maior || maior.total <= 0) return null;

  const diaDoPico = Number(maior.data.slice(8, 10));
  const ultimoDia = Number(dados[dados.length - 1].data.slice(8, 10));

  return (
    <View style={e.container}>
      <Text style={e.destaque}>
        Maior gasto: dia {diaDoPico} — {formatarMoeda(maior.total)}
      </Text>

      <View style={e.eixo}>
        {dados.map((d) => {
          const pico = d.data === maior.data;
          return (
            <View
              key={d.data}
              style={[
                e.barra,
                {
                  height: Math.max(2, (d.total / maior.total) * ALTURA_MAX),
                  backgroundColor: pico ? cores.primaria : cores.despesa,
                  opacity: d.total === 0 ? 0.15 : pico ? 1 : 0.55,
                },
              ]}
            />
          );
        })}
      </View>

      <View style={e.rotulos}>
        <Text style={e.rotuloExtremo}>1</Text>
        <Text style={e.rotuloExtremo}>{ultimoDia}</Text>
      </View>
    </View>
  );
}

function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
    container: { gap: espaco.sm },
    destaque: { fontSize: 13, fontWeight: '700', color: cores.texto, textAlign: 'center' },
    eixo: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      height: ALTURA_MAX,
      borderBottomWidth: 1,
      borderBottomColor: cores.borda,
    },
    barra: { flex: 1, marginHorizontal: 1, borderRadius: 2 },
    rotulos: { flexDirection: 'row', justifyContent: 'space-between' },
    rotuloExtremo: { fontSize: 11, color: cores.textoFraco },
  });
}
