import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Aparecer, BarraProgresso, NumeroAnimado, Tocavel } from '../../src/components/animacao';
import { CartaoDestaque } from '../../src/components/CartaoDestaque';
import { Botao, Cartao, Carregando, Titulo, Vazio } from '../../src/components/ui';
import { useConsulta } from '../../src/hooks/useConsulta';
import { useMoeda } from '../../src/contexto/PrivacidadeContexto';
import { useTema } from '../../src/contexto/TemaContexto';
import * as cartoesRepo from '../../src/repos/cartoes';
import * as lancamentosRepo from '../../src/repos/lancamentos';
import { formatarDataCurta, hojeISO } from '../../src/utils/date';
import { espaco, raio, type Paleta } from '../../src/utils/tema';
import type { CartaoResumo, FaturaResumo, LancamentoDetalhado } from '../../src/types';

interface Dados {
  cartao: CartaoResumo | null;
  faturas: FaturaResumo[];
  compras: LancamentoDetalhado[];
}

/**
 * Painel do cartao: limite, fatura atual, proximas faturas (parcelas) e as
 * ultimas compras. Editar nome, limite e dias continua no formulario de conta.
 */
export default function TelaCartao() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const idNumero = Number(id);
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  const formatarMoeda = useMoeda();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { dados, carregando } = useConsulta<Dados>(async () => {
    const [cartao, faturas, compras] = await Promise.all([
      cartoesRepo.obter(idNumero),
      cartoesRepo.faturas(idNumero),
      lancamentosRepo.listarDaConta(idNumero, 10),
    ]);
    return { cartao, faturas, compras };
  }, [idNumero]);

  if (carregando && !dados) {
    return (
      <>
        <Stack.Screen options={{ title: 'Cartão' }} />
        <Carregando />
      </>
    );
  }

  const cartao = dados?.cartao;
  if (!cartao) {
    return (
      <>
        <Stack.Screen options={{ title: 'Cartão' }} />
        <Vazio titulo="Cartão não encontrado" />
      </>
    );
  }

  const { conta, divida, disponivel } = cartao;
  const limite = conta.limite ?? 0;
  const configurado = limite > 0 && conta.dia_fechamento != null && conta.dia_vencimento != null;
  const hoje = hojeISO();
  const faturas = dados?.faturas ?? [];
  // Fechada e ainda nao vencida: a que precisa ser paga agora.
  const aPagar = faturas.find((f) => !f.atual && f.fechamento < hoje && f.total > 0);
  const atual = faturas.find((f) => f.atual);
  const futuras = faturas.filter((f) => f.fechamento > (atual?.fechamento ?? hoje));

  function pagar(valor: number) {
    const sufixo = valor > 0 ? `&valor=${valor}` : '';
    router.push(`/lancamento/novo?tipo=transferencia&destino=${conta.id}${sufixo}`);
  }

  return (
    <>
      <Stack.Screen options={{ title: conta.nome }} />
      <ScrollView
        style={e.tela}
        contentContainerStyle={[e.conteudo, { paddingBottom: espaco.xl + insets.bottom }]}
      >
        <Aparecer>
          <CartaoDestaque de={conta.cor} para={cores.gradienteB} idGradiente="cartao">
            <Text style={e.rotuloDestaque}>Limite disponível</Text>
            <NumeroAnimado centavos={disponivel} style={e.valorDestaque} />
            {limite > 0 ? (
              <View style={e.barra}>
                <BarraProgresso
                  fracao={divida / limite}
                  cor="#FFFFFF"
                  trilha="rgba(255,255,255,0.25)"
                  altura={8}
                />
              </View>
            ) : null}
            <View style={e.pilulas}>
              <View style={e.pilula}>
                <Text style={e.pilulaRotulo}>Usado</Text>
                <NumeroAnimado centavos={divida} style={e.pilulaValor} />
              </View>
              <View style={e.pilula}>
                <Text style={e.pilulaRotulo}>Limite total</Text>
                <NumeroAnimado centavos={limite} style={e.pilulaValor} />
              </View>
            </View>
          </CartaoDestaque>
        </Aparecer>

        {!configurado ? (
          <Cartao>
            <Titulo>Complete o cartão</Titulo>
            <Text style={e.ajuda}>
              Informe o limite e os dias de fechamento e vencimento para o app separar as
              faturas.
            </Text>
            <Botao titulo="Configurar" onPress={() => router.push(`/conta/${conta.id}`)} />
          </Cartao>
        ) : null}

        {aPagar ? (
          <Aparecer atraso={40}>
            <Cartao style={[e.destaqueFatura, { borderColor: cores.despesa }]}>
              <Text style={[e.rotulo, { color: cores.despesa }]}>Fatura fechada</Text>
              <Text style={e.valorFatura}>{formatarMoeda(aPagar.total)}</Text>
              <Text style={e.ajuda}>Vence em {formatarDataCurta(aPagar.vencimento)}</Text>
              <Botao titulo="Pagar esta fatura" onPress={() => pagar(aPagar.total)} />
            </Cartao>
          </Aparecer>
        ) : null}

        {atual && configurado ? (
          <Aparecer atraso={80}>
            <Cartao>
              <Text style={e.rotulo}>Fatura atual · aberta</Text>
              <Text style={e.valorFatura}>{formatarMoeda(atual.total)}</Text>
              <Text style={e.ajuda}>
                Fecha em {formatarDataCurta(atual.fechamento)} · vence em{' '}
                {formatarDataCurta(atual.vencimento)}
              </Text>
              <Botao
                titulo="Pagar fatura"
                variante={aPagar ? 'secundaria' : 'primaria'}
                onPress={() => pagar(aPagar ? 0 : atual.total)}
              />
            </Cartao>
          </Aparecer>
        ) : null}

        {futuras.length > 0 ? (
          <Aparecer atraso={120}>
            <Cartao>
              <Titulo>Próximas faturas</Titulo>
              {futuras.map((f) => (
                <View key={f.vencimento} style={e.linha}>
                  <View style={{ flex: 1 }}>
                    <Text style={e.nome}>Vence {formatarDataCurta(f.vencimento)}</Text>
                    <Text style={e.detalhe}>
                      {f.itens} {f.itens === 1 ? 'lançamento' : 'lançamentos'}
                    </Text>
                  </View>
                  <Text style={e.valorLinha}>{formatarMoeda(f.total)}</Text>
                </View>
              ))}
            </Cartao>
          </Aparecer>
        ) : null}

        <Aparecer atraso={160}>
          <Botao
            titulo="Nova compra no cartão"
            icone="mais"
            variante="secundaria"
            onPress={() => router.push(`/lancamento/novo?tipo=despesa&conta=${conta.id}`)}
          />
        </Aparecer>

        {dados && dados.compras.length > 0 ? (
          <Aparecer atraso={200}>
            <Cartao>
              <Titulo>Últimos lançamentos</Titulo>
              {dados.compras.map((l) => {
                const pagamento = l.tipo === 'transferencia' && l.conta_destino_id === conta.id;
                const entrou = pagamento || l.tipo === 'receita';
                return (
                  <Tocavel
                    key={l.id}
                    style={e.linha}
                    onPress={() => router.push(`/lancamento/${l.id}`)}
                  >
                    <View style={[e.ponto, { backgroundColor: l.categoria_cor ?? cores.neutra }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={e.nome} numberOfLines={1}>
                        {pagamento ? 'Pagamento recebido' : l.descricao}
                      </Text>
                      <Text style={e.detalhe}>
                        {formatarDataCurta(l.data)}
                        {l.hora ? ` · ${l.hora}` : ''}
                        {l.categoria_nome ? ` · ${l.categoria_nome}` : ''}
                      </Text>
                    </View>
                    <Text
                      style={[e.valorLinha, { color: entrou ? cores.receita : cores.texto }]}
                    >
                      {entrou ? '+ ' : ''}
                      {formatarMoeda(l.valor)}
                    </Text>
                  </Tocavel>
                );
              })}
            </Cartao>
          </Aparecer>
        ) : null}

        <Botao
          titulo="Editar cartão"
          variante="secundaria"
          onPress={() => router.push(`/conta/${conta.id}`)}
        />
      </ScrollView>
    </>
  );
}

function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
    tela: { flex: 1, backgroundColor: cores.fundo },
    conteudo: { padding: espaco.lg, gap: espaco.md },
    rotuloDestaque: {
      fontSize: 12,
      fontWeight: '700',
      color: cores.sobreDestaque,
      opacity: 0.85,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    valorDestaque: { fontSize: 34, fontWeight: '800', color: cores.sobreDestaque, marginTop: espaco.xs },
    barra: { marginTop: espaco.md },
    pilulas: { flexDirection: 'row', gap: espaco.sm, marginTop: espaco.md },
    pilula: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderRadius: raio.md,
      paddingVertical: espaco.sm,
      paddingHorizontal: espaco.md,
    },
    pilulaRotulo: { fontSize: 11, color: cores.sobreDestaque, opacity: 0.9 },
    pilulaValor: { fontSize: 16, fontWeight: '800', color: cores.sobreDestaque, marginTop: 2 },
    rotulo: {
      fontSize: 11,
      fontWeight: '700',
      color: cores.textoFraco,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    valorFatura: { fontSize: 28, fontWeight: '800', color: cores.texto, marginTop: espaco.xs },
    destaqueFatura: { borderWidth: 1.5 },
    ajuda: { fontSize: 12, color: cores.textoFraco, lineHeight: 17, marginVertical: espaco.sm },
    linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.md, paddingVertical: espaco.sm },
    ponto: { width: 10, height: 10, borderRadius: 5 },
    nome: { fontSize: 15, fontWeight: '600', color: cores.texto },
    detalhe: { fontSize: 12, color: cores.textoFraco, marginTop: 2 },
    valorLinha: { fontSize: 15, fontWeight: '700', color: cores.texto },
  });
}
