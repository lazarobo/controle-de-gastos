import { useMemo, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Aparecer, NumeroAnimado, Tocavel } from '../../src/components/animacao';
import { Avatar } from '../../src/components/Avatar';
import { CartaoDestaque } from '../../src/components/CartaoDestaque';
import { SeletorMes } from '../../src/components/SeletorMes';
import { Carregando, Vazio } from '../../src/components/ui';
import { useConsulta } from '../../src/hooks/useConsulta';
import * as lancamentosRepo from '../../src/repos/lancamentos';
import { formatarMoeda } from '../../src/utils/money';
import { formatarDataCurta, mesAtual, type Mes } from '../../src/utils/date';
import { useTema } from '../../src/contexto/TemaContexto';
import { espaco, raio, type Paleta } from '../../src/utils/tema';
import type { LancamentoDetalhado, ResumoMes } from '../../src/types';

interface Dados {
  lancamentos: LancamentoDetalhado[];
  resumo: ResumoMes;
}

export default function ListaLancamentos() {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
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
          return (
            <Tocavel style={e.item} onPress={() => router.push(`/lancamento/${item.id}`)}>
              {/* Cor da categoria no avatar: da para achar "o mercado" de relance. */}
              <Avatar
                nome={transferencia ? '' : item.categoria_nome ?? item.descricao}
                cor={transferencia ? cores.transferencia : item.categoria_cor ?? cores.neutra}
                glifo={transferencia ? '⇄' : undefined}
                tamanho={36}
              />
              <View style={e.meio}>
                <Text style={e.descricao} numberOfLines={1}>
                  {item.descricao}
                </Text>
                <Text style={e.subtitulo} numberOfLines={1}>
                  {transferencia
                    ? `${item.conta_nome} → ${item.conta_destino_nome ?? '?'}`
                    : `${item.categoria_nome ?? 'Sem categoria'} · ${item.conta_nome}`}
                </Text>
              </View>
              <Text
                style={[
                  e.valor,
                  {
                    color:
                      item.tipo === 'receita'
                        ? cores.receita
                        : item.tipo === 'despesa'
                          ? cores.despesa
                          : cores.transferencia,
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

      <Tocavel
        style={e.fab}
        onPress={() => router.push('/lancamento/novo')}
        accessibilityLabel="Registrar gasto"
      >
        <Text style={e.fabTexto}>+</Text>
      </Tocavel>
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
      borderWidth: 1,
      borderColor: cores.borda,
      borderRadius: raio.md,
      padding: espaco.md,
      marginBottom: espaco.sm,
    },
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
}
