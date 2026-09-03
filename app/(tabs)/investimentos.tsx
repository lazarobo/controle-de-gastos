import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { GraficoPizza } from '../../src/components/GraficoPizza';
import { Cartao, Carregando, Titulo, Vazio } from '../../src/components/ui';
import { useConsulta } from '../../src/hooks/useConsulta';
import { useTema } from '../../src/contexto/TemaContexto';
import * as investimentosRepo from '../../src/repos/investimentos';
import { formatarMoeda } from '../../src/utils/money';
import { formatarData } from '../../src/utils/date';
import { espaco, raio, type Paleta } from '../../src/utils/tema';
import type { FatiaGrafico, Investimento } from '../../src/types';

export default function TelaInvestimentos() {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  const router = useRouter();

  const { dados, carregando } = useConsulta(() => investimentosRepo.listar());

  const itens = dados ?? [];
  const total = itens.reduce((soma, i) => soma + i.valor, 0);

  // Maior posicao: o KPI de concentracao. Um patrimonio com 80% num banco so
  // conta uma historia diferente de um dividido em cinco.
  const maior = itens.reduce<Investimento | null>(
    (m, i) => (m == null || i.valor > m.valor ? i : m),
    null,
  );
  const concentracao = total > 0 && maior ? (maior.valor / total) * 100 : 0;

  const fatias: FatiaGrafico[] = itens
    .filter((i) => i.valor > 0)
    .map((i) => ({ chave: String(i.id), nome: i.nome, cor: i.cor, total: i.valor }))
    .sort((a, b) => b.total - a.total);

  return (
    <View style={e.tela}>
      <ScrollView contentContainerStyle={e.conteudo}>
        <Cartao>
          <Text style={e.rotuloKpi}>Total investido</Text>
          <Text style={e.valorTotal}>{formatarMoeda(total)}</Text>
          <Text style={e.aviso}>Não entra no saldo total do Início.</Text>
        </Cartao>

        {carregando && !dados ? (
          <Carregando />
        ) : itens.length === 0 ? (
          <Cartao>
            <Vazio
              titulo="Nenhum investimento cadastrado"
              detalhe="Toque no + para registrar quanto você tem em cada banco."
            />
          </Cartao>
        ) : (
          <>
            <View style={e.grade}>
              <Cartao style={e.kpi}>
                <Text style={e.rotuloKpi}>Posições</Text>
                <Text style={e.valorKpi}>{itens.length}</Text>
              </Cartao>
              <Cartao style={e.kpi}>
                <Text style={e.rotuloKpi}>Maior posição</Text>
                <Text style={e.valorKpi}>{concentracao.toFixed(0)}%</Text>
                <Text style={e.detalheKpi} numberOfLines={1}>
                  {maior?.nome ?? '—'}
                </Text>
              </Cartao>
            </View>

            {fatias.length > 0 ? (
              <Cartao>
                <Titulo>Distribuição por banco</Titulo>
                <View style={e.grafico}>
                  <GraficoPizza dados={fatias} />
                </View>
              </Cartao>
            ) : null}

            <Cartao>
              <Titulo>Onde está</Titulo>
              {itens.map((i) => (
                <Pressable
                  key={i.id}
                  style={e.linha}
                  onPress={() => router.push(`/investimento/${i.id}`)}
                >
                  <View style={[e.ponto, { backgroundColor: i.cor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={e.nome} numberOfLines={1}>
                      {i.nome}
                    </Text>
                    <Text style={e.atualizado}>
                      Atualizado em {formatarData(i.atualizado_em.slice(0, 10))}
                    </Text>
                  </View>
                  <View style={e.direita}>
                    <Text style={e.valorLinha}>{formatarMoeda(i.valor)}</Text>
                    <Text style={e.percentualLinha}>
                      {total > 0 ? ((i.valor / total) * 100).toFixed(1) : '0,0'}%
                    </Text>
                  </View>
                </Pressable>
              ))}
            </Cartao>
          </>
        )}
      </ScrollView>

      <Pressable
        style={e.fab}
        onPress={() => router.push('/investimento/novo')}
        accessibilityLabel="Novo investimento"
      >
        <Text style={e.fabTexto}>+</Text>
      </Pressable>
    </View>
  );
}

function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
    tela: { flex: 1, backgroundColor: cores.fundo },
    conteudo: { padding: espaco.lg, gap: espaco.md, paddingBottom: 96 },
    rotuloKpi: {
      fontSize: 12,
      fontWeight: '600',
      color: cores.textoFraco,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    valorTotal: { fontSize: 30, fontWeight: '800', color: cores.texto, marginTop: espaco.xs },
    aviso: { fontSize: 11, color: cores.textoFraco, marginTop: 2 },
    grade: { flexDirection: 'row', gap: espaco.md },
    kpi: { flex: 1 },
    valorKpi: { fontSize: 22, fontWeight: '800', color: cores.texto, marginTop: espaco.xs },
    detalheKpi: { fontSize: 11, color: cores.textoFraco, marginTop: 2 },
    grafico: { marginTop: espaco.md },
    linha: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      paddingVertical: espaco.md,
      borderTopWidth: 1,
      borderTopColor: cores.borda,
    },
    ponto: { width: 12, height: 12, borderRadius: 6 },
    nome: { fontSize: 15, fontWeight: '600', color: cores.texto },
    atualizado: { fontSize: 11, color: cores.textoFraco, marginTop: 2 },
    direita: { alignItems: 'flex-end' },
    valorLinha: { fontSize: 15, fontWeight: '700', color: cores.texto },
    percentualLinha: { fontSize: 11, color: cores.textoFraco, marginTop: 2 },
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
