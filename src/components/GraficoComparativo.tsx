import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTema } from '../contexto/TemaContexto';
import { formatarMoeda } from '../utils/money';
import { espaco, type Paleta } from '../utils/tema';

export interface LinhaComparativa {
  chave: string;
  nome: string;
  /** Centavos. */
  receitas: number;
  despesas: number;
  /** Cor de identificacao da linha (conta). Opcional: sem ela, so o nome. */
  cor?: string;
}

/**
 * Duas barras horizontais por linha -- receita em cima, despesa embaixo.
 *
 * Horizontal, e nao vertical como o GraficoBarras: aqui o rotulo e um nome de
 * conta ("Banco do Brasil"), que nao cabe embaixo de uma coluna estreita. Todas
 * as linhas dividem a MESMA escala (o maior valor da tela inteira), senao cada
 * linha pareceria igualmente grande e a comparacao entre contas -- o motivo do
 * grafico existir -- se perderia.
 */
export function GraficoComparativo({ linhas }: { linhas: LinhaComparativa[] }) {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);

  const maior = Math.max(1, ...linhas.flatMap((l) => [l.receitas, l.despesas]));

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

      {linhas.map((l) => {
        const resultado = l.receitas - l.despesas;
        return (
          <View key={l.chave} style={e.linha}>
            <View style={e.cabecalho}>
              {l.cor ? <View style={[e.ponto, { backgroundColor: l.cor }]} /> : null}
              <Text style={e.nome} numberOfLines={1}>
                {l.nome}
              </Text>
              <Text
                style={[
                  e.resultado,
                  { color: resultado < 0 ? cores.despesa : cores.receita },
                ]}
              >
                {resultado > 0 ? '+' : ''}
                {formatarMoeda(resultado)}
              </Text>
            </View>

            <View style={e.barras}>
              <View style={e.trilha}>
                <View
                  style={[
                    e.preenchimento,
                    {
                      width: `${(l.receitas / maior) * 100}%`,
                      backgroundColor: cores.receita,
                    },
                  ]}
                />
              </View>
              <View style={e.trilha}>
                <View
                  style={[
                    e.preenchimento,
                    {
                      width: `${(l.despesas / maior) * 100}%`,
                      backgroundColor: cores.despesa,
                    },
                  ]}
                />
              </View>
            </View>

            <View style={e.valores}>
              <Text style={e.valorTexto}>{formatarMoeda(l.receitas)}</Text>
              <Text style={e.valorTexto}>{formatarMoeda(l.despesas)}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
    container: { gap: espaco.lg },
    legenda: { flexDirection: 'row', gap: espaco.lg, justifyContent: 'center' },
    itemLegenda: { flexDirection: 'row', alignItems: 'center', gap: espaco.xs },
    pontoLegenda: { width: 10, height: 10, borderRadius: 5 },
    textoLegenda: { fontSize: 12, color: cores.textoFraco },
    linha: { gap: espaco.xs },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
    ponto: { width: 10, height: 10, borderRadius: 5 },
    nome: { flex: 1, fontSize: 14, fontWeight: '600', color: cores.texto },
    resultado: { fontSize: 13, fontWeight: '700' },
    barras: { gap: 3 },
    trilha: {
      height: 10,
      borderRadius: 5,
      backgroundColor: cores.superficieAlt,
      overflow: 'hidden',
    },
    preenchimento: { height: '100%', borderRadius: 5 },
    valores: { flexDirection: 'row', justifyContent: 'space-between' },
    valorTexto: { fontSize: 11, color: cores.textoFraco },
  });
}
