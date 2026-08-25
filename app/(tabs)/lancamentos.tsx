import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { SeletorMes } from '../../src/components/SeletorMes';
import { Carregando, Vazio } from '../../src/components/ui';
import { useConsulta } from '../../src/hooks/useConsulta';
import * as lancamentosRepo from '../../src/repos/lancamentos';
import { formatarMoeda } from '../../src/utils/money';
import { formatarDataCurta, mesAtual, type Mes } from '../../src/utils/date';
import { cores, espaco, raio } from '../../src/utils/tema';
import type { LancamentoDetalhado } from '../../src/types';

export default function ListaLancamentos() {
  const [mes, setMes] = useState<Mes>(mesAtual);
  const router = useRouter();

  const { dados, carregando } = useConsulta(
    () => lancamentosRepo.listarPorMes(mes),
    [mes.ano, mes.mes],
  );

  // A consulta ja vem ordenada por data DESC; agrupar aqui evita uma segunda ida ao banco.
  const secoes = useMemo(() => {
    const porDia = new Map<string, LancamentoDetalhado[]>();
    for (const l of dados ?? []) {
      const lista = porDia.get(l.data);
      if (lista) lista.push(l);
      else porDia.set(l.data, [l]);
    }
    return Array.from(porDia, ([data, itens]) => ({
      title: data,
      total: itens.reduce(
        (soma, i) => soma + (i.tipo === 'receita' ? i.valor : -i.valor),
        0,
      ),
      data: itens,
    }));
  }, [dados]);

  return (
    <View style={e.tela}>
      <SectionList
        sections={secoes}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={e.conteudo}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={e.cabecalho}>
            <SeletorMes mes={mes} onChange={setMes} />
          </View>
        }
        ListEmptyComponent={
          carregando ? (
            <Carregando />
          ) : (
            <Vazio
              titulo="Nenhum lançamento neste mês"
              detalhe="Toque no botão + para registrar o primeiro."
            />
          )
        }
        renderSectionHeader={({ section }) => (
          <View style={e.cabecalhoSecao}>
            <Text style={e.dia}>{formatarDataCurta(section.title)}</Text>
            <Text
              style={[
                e.totalDia,
                { color: section.total < 0 ? cores.despesa : cores.receita },
              ]}
            >
              {section.total > 0 ? '+' : ''}
              {formatarMoeda(section.total)}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable
            style={e.item}
            onPress={() => router.push(`/lancamento/${item.id}`)}
          >
            <View
              style={[
                e.marca,
                { backgroundColor: item.categoria_cor ?? cores.neutra },
              ]}
            />
            <View style={e.meio}>
              <Text style={e.descricao} numberOfLines={1}>
                {item.descricao}
              </Text>
              <Text style={e.subtitulo} numberOfLines={1}>
                {item.categoria_nome ?? 'Sem categoria'} · {item.conta_nome}
              </Text>
            </View>
            <Text
              style={[
                e.valor,
                { color: item.tipo === 'receita' ? cores.receita : cores.despesa },
              ]}
            >
              {item.tipo === 'receita' ? '+' : '−'} {formatarMoeda(item.valor)}
            </Text>
          </Pressable>
        )}
      />

      <Pressable
        style={e.fab}
        onPress={() => router.push('/lancamento/novo')}
        accessibilityLabel="Registrar gasto"
      >
        <Text style={e.fabTexto}>+</Text>
      </Pressable>
    </View>
  );
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.lg, paddingBottom: 96 },
  cabecalho: { marginBottom: espaco.md },
  cabecalhoSecao: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: espaco.lg,
    marginBottom: espaco.sm,
  },
  dia: { fontSize: 13, fontWeight: '700', color: cores.textoFraco, textTransform: 'capitalize' },
  totalDia: { fontSize: 13, fontWeight: '700' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.md,
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio.md,
    padding: espaco.md,
    marginBottom: espaco.sm,
  },
  marca: { width: 6, alignSelf: 'stretch', borderRadius: 3 },
  meio: { flex: 1 },
  descricao: { fontSize: 15, fontWeight: '600', color: cores.texto },
  subtitulo: { fontSize: 12, color: cores.textoFraco, marginTop: 2 },
  valor: { fontSize: 15, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: espaco.lg,
    bottom: espaco.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: cores.primaria,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  fabTexto: { color: '#FFF', fontSize: 34, lineHeight: 38, fontWeight: '300' },
});
