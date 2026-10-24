import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Aparecer, NumeroAnimado, Tocavel } from '../../src/components/animacao';
import { Avatar } from '../../src/components/Avatar';
import { CartaoDestaque } from '../../src/components/CartaoDestaque';
import { Fab } from '../../src/components/Fab';
import { GraficoPizza } from '../../src/components/GraficoPizza';
import { Botao, Cartao, Carregando, Titulo, Vazio } from '../../src/components/ui';
import { useConsulta } from '../../src/hooks/useConsulta';
import { useTema } from '../../src/contexto/TemaContexto';
import * as investimentosRepo from '../../src/repos/investimentos';
import { useMoeda, usePrivacidade } from '../../src/contexto/PrivacidadeContexto';
import { formatarDataCurta } from '../../src/utils/date';
import { espaco, raio, type Paleta } from '../../src/utils/tema';
import type { FatiaGrafico, InvestimentoResumo } from '../../src/types';

export default function TelaInvestimentos() {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  const formatarMoeda = useMoeda();
  const { ocultos } = usePrivacidade();
  const router = useRouter();

  const { dados, carregando } = useConsulta(() => investimentosRepo.listar());

  const itens = dados ?? [];
  const total = itens.reduce((soma, i) => soma + i.valor, 0);
  const aportado = itens.reduce((soma, i) => soma + i.aportado, 0);
  const rendimento = itens.reduce((soma, i) => soma + i.rendimento, 0);
  const percentual = aportado > 0 ? (rendimento / aportado) * 100 : 0;

  // Maior posicao: o KPI de concentracao. Um patrimonio com 80% num banco so
  // conta uma historia diferente de um dividido em cinco.
  const maior = itens.reduce<InvestimentoResumo | null>(
    (m, i) => (m == null || i.valor > m.valor ? i : m),
    null,
  );
  const concentracao = total > 0 && maior ? (maior.valor / total) * 100 : 0;

  const fatias: FatiaGrafico[] = itens
    .filter((i) => i.valor > 0)
    .map((i) => ({ chave: String(i.conta.id), nome: i.conta.nome, cor: i.conta.cor, total: i.valor }))
    .sort((a, b) => b.total - a.total);

  return (
    <View style={e.tela}>
      <ScrollView contentContainerStyle={e.conteudo}>
        <Aparecer>
          {/* Degrade roxo: o mesmo acento do cartao de investimentos no Inicio. */}
          <CartaoDestaque de={cores.investimento} para={cores.gradienteB} idGradiente="investido">
            <Text style={e.rotuloDestaque}>Total investido</Text>
            <NumeroAnimado centavos={total} style={e.valorTotal} />
            <View style={e.pilulas}>
              <View style={e.pilula}>
                <Text style={e.pilulaRotulo}>Você colocou</Text>
                <NumeroAnimado centavos={aportado} style={e.pilulaValor} />
              </View>
              <View style={e.pilula}>
                <Text style={e.pilulaRotulo}>
                  Rendeu{aportado > 0 ? ` · ${percentual.toFixed(1)}%` : ''}
                </Text>
                <NumeroAnimado centavos={rendimento} comSinal style={e.pilulaValor} />
              </View>
            </View>
          </CartaoDestaque>
        </Aparecer>

        {carregando && !dados ? (
          <Carregando />
        ) : itens.length === 0 ? (
          <Cartao>
            <Vazio
              titulo="Nenhum investimento cadastrado"
              detalhe="Cadastre o banco ou corretora. Depois, “Investir” no lançamento tira o dinheiro da conta e coloca aqui — sem virar despesa."
            />
          </Cartao>
        ) : (
          <>
            <Aparecer atraso={60} style={e.grade}>
              <Cartao style={e.kpi}>
                <Text style={e.rotuloKpi}>Posições</Text>
                <Text style={e.valorKpi}>{itens.length}</Text>
              </Cartao>
              <Cartao style={e.kpi}>
                <Text style={e.rotuloKpi}>Maior posição</Text>
                <Text style={e.valorKpi}>{concentracao.toFixed(0)}%</Text>
                <Text style={e.detalheKpi} numberOfLines={1}>
                  {maior?.conta.nome ?? '—'}
                </Text>
              </Cartao>
            </Aparecer>

            <Aparecer atraso={90}>
              <Botao
                titulo="Investir agora"
                icone="investir"
                onPress={() => router.push('/lancamento/novo?tipo=investir')}
              />
            </Aparecer>

            {fatias.length > 0 ? (
              <Aparecer atraso={120}>
                <Cartao>
                  <Titulo>Distribuição por banco</Titulo>
                  <View style={e.grafico}>
                    <GraficoPizza dados={fatias} />
                  </View>
                </Cartao>
              </Aparecer>
            ) : null}

            <Aparecer atraso={180}>
              <Cartao>
                <Titulo>Onde está</Titulo>
                {itens.map((i) => (
                  <Tocavel
                    key={i.conta.id}
                    style={e.linha}
                    onPress={() => router.push(`/investimento/${i.conta.id}`)}
                  >
                    <Avatar nome={i.conta.nome} cor={i.conta.cor} />
                    <View style={{ flex: 1 }}>
                      <Text style={e.nome} numberOfLines={1}>
                        {i.conta.nome}
                      </Text>
                      <Text style={e.atualizado} numberOfLines={1}>
                        {i.conta.observacao ? `${i.conta.observacao} · ` : ''}
                        {formatarDataCurta(i.ultima_movimentacao)}
                      </Text>
                    </View>
                    <View style={e.direita}>
                      <Text style={e.valorLinha}>{formatarMoeda(i.valor)}</Text>
                      {/* D20: escondido, some tambem o sinal e a cor do rendimento. */}
                      {i.rendimento !== 0 && !ocultos ? (
                        <Text
                          style={[
                            e.rendimentoLinha,
                            { color: i.rendimento > 0 ? cores.receita : cores.despesa },
                          ]}
                        >
                          {i.rendimento > 0 ? '+' : '−'}
                          {formatarMoeda(Math.abs(i.rendimento))}
                        </Text>
                      ) : (
                        <Text style={e.percentualLinha}>
                          {total > 0 ? ((i.valor / total) * 100).toFixed(1) : '0.0'}%
                        </Text>
                      )}
                    </View>
                  </Tocavel>
                ))}
              </Cartao>
            </Aparecer>
          </>
        )}
      </ScrollView>

      <Fab
        onPress={() => router.push('/investimento/novo')}
        rotulo="Novo investimento"
        cor={cores.investimento}
      />
    </View>
  );
}

function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
    tela: { flex: 1, backgroundColor: cores.fundo },
    conteudo: { padding: espaco.lg, gap: espaco.md, paddingBottom: 96 },
    rotuloDestaque: {
      fontSize: 12,
      fontWeight: '700',
      color: cores.sobreDestaque,
      opacity: 0.85,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    valorTotal: { fontSize: 34, fontWeight: '800', color: cores.sobreDestaque, marginTop: espaco.xs },
    pilulas: { flexDirection: 'row', gap: espaco.sm, marginTop: espaco.lg },
    pilula: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderRadius: raio.md,
      paddingVertical: espaco.sm,
      paddingHorizontal: espaco.md,
    },
    pilulaRotulo: { fontSize: 11, color: cores.sobreDestaque, opacity: 0.9 },
    pilulaValor: { fontSize: 16, fontWeight: '800', color: cores.sobreDestaque, marginTop: 2 },
    rotuloKpi: {
      fontSize: 11,
      fontWeight: '700',
      color: cores.textoFraco,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    grade: { flexDirection: 'row', gap: espaco.md },
    kpi: { flex: 1 },
    valorKpi: { fontSize: 24, fontWeight: '800', color: cores.texto, marginTop: espaco.xs },
    detalheKpi: { fontSize: 11, color: cores.textoFraco, marginTop: 2 },
    grafico: { marginTop: espaco.md },
    linha: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      paddingVertical: espaco.sm,
    },
    nome: { fontSize: 15, fontWeight: '700', color: cores.texto },
    atualizado: { fontSize: 12, color: cores.textoFraco, marginTop: 2 },
    direita: { alignItems: 'flex-end' },
    valorLinha: { fontSize: 15, fontWeight: '800', color: cores.texto },
    rendimentoLinha: { fontSize: 12, fontWeight: '700', marginTop: 2 },
    percentualLinha: { fontSize: 12, color: cores.textoFraco, marginTop: 2 },
  });
}
