import { useMemo, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Aparecer, NumeroAnimado, Tocavel } from '../../src/components/animacao';
import { Avatar } from '../../src/components/Avatar';
import { CartaoDestaque } from '../../src/components/CartaoDestaque';
import { Fab } from '../../src/components/Fab';
import { SeletorMes } from '../../src/components/SeletorMes';
import { Carregando, Vazio } from '../../src/components/ui';
import { useConsulta } from '../../src/hooks/useConsulta';
import * as lancamentosRepo from '../../src/repos/lancamentos';
import { useMoeda } from '../../src/contexto/PrivacidadeContexto';
import { formatarDataCurta, mesAtual, type Mes } from '../../src/utils/date';
import { useTema } from '../../src/contexto/TemaContexto';
import { espaco, raio, sombra, type Paleta } from '../../src/utils/tema';
import type { LancamentoDetalhado, ResumoMes } from '../../src/types';

interface Dados {
  lancamentos: LancamentoDetalhado[];
  resumo: ResumoMes;
}

export default function ListaLancamentos() {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  const formatarMoeda = useMoeda();
  const [mes, setMes] = useState<Mes>(mesAtual);
  const router = useRouter();

  const { dados, carregando } = useConsulta<Dados>(async () => {
    const [lancamentos, resumo] = await Promise.all([
      lancamentosRepo.listarPorMes(mes),
      lancamentosRepo.resumoMes(mes),
    ]);
    return { lancamentos, resumo };
  }, [mes.ano, mes.mes]);

  // A consulta ja vem ordenada por data DESC; agrupar aqui evita uma segunda ida ao banco.
  const secoes = useMemo(() => {
    const porDia = new Map<string, LancamentoDetalhado[]>();
    for (const l of dados?.lancamentos ?? []) {
      const lista = porDia.get(l.data);
      if (lista) lista.push(l);
      else porDia.set(l.data, [l]);
    }
    return Array.from(porDia, ([data, itens]) => ({
      title: data,
      // Transferencia fica fora: ela move dinheiro entre contas proprias, entao
      // somar como saida (ou entrada) inventaria um gasto que nao existiu no dia.
      total: itens.reduce((soma, i) => {
        if (i.conta_tipo === 'investimento') return soma;
        if (i.tipo === 'receita') return soma + i.valor;
        if (i.tipo === 'despesa') return soma - i.valor;
        return soma;
      }, 0),
      data: itens,
    }));
  }, [dados]);

  const quantidade = dados?.lancamentos.length ?? 0;

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
            {dados && quantidade > 0 ? (
              <Aparecer>
                <CartaoDestaque
                  de={cores.gradienteA}
                  para={cores.gradienteB}
                  idGradiente="lancamentos"
                >
                  <Text style={e.rotuloDestaque}>
                    Resultado · {quantidade} {quantidade === 1 ? 'lançamento' : 'lançamentos'}
                  </Text>
                  <NumeroAnimado centavos={dados.resumo.resultado} comSinal style={e.resultado} />
                  <View style={e.pilulas}>
                    <View style={e.pilula}>
                      <Text style={e.pilulaRotulo}>↑ Receitas</Text>
                      <NumeroAnimado centavos={dados.resumo.receitas} style={e.pilulaValor} />
                    </View>
                    <View style={e.pilula}>
                      <Text style={e.pilulaRotulo}>↓ Despesas</Text>
                      <NumeroAnimado centavos={dados.resumo.despesas} style={e.pilulaValor} />
                    </View>
                  </View>
                </CartaoDestaque>
              </Aparecer>
            ) : null}
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
        renderItem={({ item }) => {
          const transferencia = item.tipo === 'transferencia';
          const aporte = transferencia && item.conta_destino_tipo === 'investimento';
          // Receita/despesa dentro de um investimento e ajuste de valor, nao
          // ganho nem gasto -- por isso tambem nao entra no total do dia.
          const rendimento = !transferencia && item.conta_tipo === 'investimento';
          const corItem = transferencia
            ? aporte
              ? cores.investimento
              : cores.transferencia
            : rendimento
              ? cores.investimento
              : item.categoria_cor ?? cores.neutra;
          return (
            <Tocavel style={e.item} onPress={() => router.push(`/lancamento/${item.id}`)}>
              {/* Cor da categoria no avatar: da para achar "o mercado" de relance. */}
              <Avatar
                nome={item.categoria_nome ?? item.descricao}
                cor={corItem}
                icone={aporte || rendimento ? 'investir' : transferencia ? 'transferir' : undefined}
                tamanho={40}
              />
              <View style={e.meio}>
                <Text style={e.descricao} numberOfLines={1}>
                  {item.descricao}
                </Text>
                <Text style={e.subtitulo} numberOfLines={1}>
                  {item.hora ? `${item.hora} · ` : ''}
                  {transferencia
                    ? `${item.conta_nome} → ${item.conta_destino_nome ?? '?'}`
                    : rendimento
                      ? `Investimento · ${item.conta_nome}`
                      : `${item.categoria_nome ?? 'Sem categoria'} · ${item.conta_nome}`}
                </Text>
              </View>
              <Text
                style={[
                  e.valor,
                  {
                    color:
                      transferencia
                        ? corItem
                        : item.tipo === 'receita'
                          ? cores.receita
                          : cores.despesa,
                  },
                ]}
              >
                {/* Transferencia nao ganha sinal: nao entra nem sai do seu patrimonio. */}
                {item.tipo === 'receita' ? '+ ' : item.tipo === 'despesa' ? '− ' : ''}
                {formatarMoeda(item.valor)}
              </Text>
            </Tocavel>
          );
        }}
      />

      <Fab onPress={() => router.push('/lancamento/novo')} rotulo="Registrar gasto" />
    </View>
  );
}

function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
    tela: { flex: 1, backgroundColor: cores.fundo },
    conteudo: { padding: espaco.lg, paddingBottom: 96 },
    cabecalho: { gap: espaco.md, marginBottom: espaco.xs },
    rotuloDestaque: {
      fontSize: 12,
      fontWeight: '600',
      color: cores.sobreDestaque,
      opacity: 0.8,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    resultado: { fontSize: 30, fontWeight: '800', color: cores.sobreDestaque, marginTop: espaco.xs },
    pilulas: { flexDirection: 'row', gap: espaco.sm, marginTop: espaco.md },
    pilula: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderRadius: raio.md,
      paddingVertical: espaco.sm,
      paddingHorizontal: espaco.md,
    },
    pilulaRotulo: { fontSize: 11, color: cores.sobreDestaque, opacity: 0.85 },
    pilulaValor: { fontSize: 15, fontWeight: '700', color: cores.sobreDestaque, marginTop: 2 },
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
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: cores.borda,
      borderRadius: raio.lg,
      padding: espaco.md,
      marginBottom: espaco.sm,
      ...sombra(cores, 1),
    },
    meio: { flex: 1 },
    descricao: { fontSize: 15, fontWeight: '600', color: cores.texto },
    subtitulo: { fontSize: 12, color: cores.textoFraco, marginTop: 2 },
    valor: { fontSize: 15, fontWeight: '700' },
  });
}
