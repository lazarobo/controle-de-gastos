import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Aparecer, NumeroAnimado, Tocavel } from '../../src/components/animacao';
import { Avatar } from '../../src/components/Avatar';
import { CartaoDestaque } from '../../src/components/CartaoDestaque';
import { CartaoEvento } from '../../src/components/CartaoEvento';
import { SeletorMes } from '../../src/components/SeletorMes';
import { Cartao, Carregando, Titulo, Vazio } from '../../src/components/ui';
import { useConsulta } from '../../src/hooks/useConsulta';
import { usePrivacidade } from '../../src/contexto/PrivacidadeContexto';
import { useTema } from '../../src/contexto/TemaContexto';
import * as contasRepo from '../../src/repos/contas';
import * as eventosRepo from '../../src/repos/eventos';
import * as investimentosRepo from '../../src/repos/investimentos';
import * as lancamentosRepo from '../../src/repos/lancamentos';
import { atualizarWidgetSaldo } from '../../src/widgets/atualizar';
import { mesAtual, type Mes } from '../../src/utils/date';
import { espaco, raio, type Paleta } from '../../src/utils/tema';
import type { EventoResumo, ResumoMes, SaldoConta } from '../../src/types';

interface DadosPainel {
  saldoTotal: number;
  resumo: ResumoMes;
  contas: SaldoConta[];
  eventos: EventoResumo[];
  investido: number;
  posicoes: number;
}

const ROTULO_TIPO: Record<string, string> = {
  corrente: 'Conta corrente',
  poupanca: 'Poupança',
  cartao: 'Cartão',
  dinheiro: 'Dinheiro',
};

export default function Painel() {
  const { cores } = useTema();
  const { ocultos } = usePrivacidade();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  const [mes, setMes] = useState<Mes>(mesAtual);
  const router = useRouter();

  const { dados, carregando } = useConsulta<DadosPainel>(async () => {
    const [saldoTotal, resumo, saldos, eventos, investido, investimentos] = await Promise.all([
      contasRepo.saldoTotal(),
      lancamentosRepo.resumoMes(mes),
      contasRepo.saldos(),
      eventosRepo.listar(),
      investimentosRepo.total(),
      investimentosRepo.listar(),
    ]);
    return {
      saldoTotal,
      resumo,
      // Eventos tambem sao contas, mas ganham secao propria logo abaixo.
      contas: saldos.filter((s) => s.conta.tipo !== 'evento'),
      eventos,
      investido,
      posicoes: investimentos.length,
    };
  }, [mes.ano, mes.mes]);

  // O widget nao consegue abrir o banco: quem o alimenta e esta tela, toda
  // vez que os numeros chegam. Por isso o widget mostra 'atualizado <quando>'.
  useEffect(() => {
    if (dados) void atualizarWidgetSaldo(dados.saldoTotal, dados.resumo.resultado, ocultos);
  }, [dados, ocultos]);

  return (
    <View style={e.tela}>
      <ScrollView contentContainerStyle={e.conteudo}>
        <SeletorMes mes={mes} onChange={setMes} />

        {carregando && !dados ? (
          <Carregando />
        ) : dados ? (
          <>
            <Aparecer>
              <CartaoDestaque de={cores.gradienteA} para={cores.gradienteB}>
                <Text style={e.rotuloDestaque}>Saldo total</Text>
                <NumeroAnimado centavos={dados.saldoTotal} style={e.saldoTotal} />
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

            <Aparecer atraso={60}>
              <Cartao style={e.linhaResultado}>
                <View style={{ flex: 1 }}>
                  <Text style={e.rotulo}>Resultado do mês</Text>
                  <Text style={e.explicacao}>receitas − despesas</Text>
                </View>
                <NumeroAnimado
                  centavos={dados.resumo.resultado}
                  comSinal
                  style={[
                    e.resultado,
                    {
                      color:
                        dados.resumo.resultado < 0
                          ? cores.despesa
                          : dados.resumo.resultado > 0
                            ? cores.receita
                            : cores.texto,
                    },
                  ]}
                />
              </Cartao>
            </Aparecer>

            <Aparecer atraso={120}>
              <Cartao>
                <Titulo>Contas</Titulo>
                {dados.contas.length === 0 ? (
                  <Vazio
                    titulo="Nenhuma conta cadastrada"
                    detalhe="Cadastre suas contas em Ajustes › Contas."
                  />
                ) : (
                  dados.contas.map(({ conta, saldo }) => (
                    <Tocavel
                      key={conta.id}
                      style={e.linhaConta}
                      onPress={() => router.push(`/conta/${conta.id}`)}
                    >
                      <Avatar nome={conta.nome} cor={conta.cor} />
                      <View style={{ flex: 1 }}>
                        <Text style={e.nomeConta} numberOfLines={1}>
                          {conta.nome}
                        </Text>
                        <Text style={e.tipoConta}>{ROTULO_TIPO[conta.tipo] ?? conta.tipo}</Text>
                      </View>
                      <NumeroAnimado
                        centavos={saldo}
                        style={[e.valorConta, { color: saldo < 0 ? cores.despesa : cores.texto }]}
                      />
                    </Tocavel>
                  ))
                )}
              </Cartao>
            </Aparecer>

            <Aparecer atraso={180}>
              <Tocavel
                onPress={() => router.push('/investimentos')}
                style={[
                  e.cartaoInvestimento,
                  {
                    backgroundColor: cores.investimento + '1F',
                    borderColor: cores.investimento + '55',
                  },
                ]}
              >
                <View style={[e.iconeInvestimento, { backgroundColor: cores.investimento }]}>
                  <Text style={e.iconeTexto}>▲</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={e.rotulo}>Investido</Text>
                  <Text style={e.explicacao}>
                    {dados.posicoes === 0
                      ? 'toque para cadastrar'
                      : `${dados.posicoes} ${dados.posicoes === 1 ? 'posição' : 'posições'} · fora do saldo`}
                  </Text>
                </View>
                <NumeroAnimado
                  centavos={dados.investido}
                  style={[e.valorInvestido, { color: cores.investimento }]}
                />
              </Tocavel>
            </Aparecer>

            {dados.eventos.length > 0 ? (
              <Aparecer atraso={240} style={e.secaoEventos}>
                <View style={e.cabecalhoSecao}>
                  <Titulo>Eventos</Titulo>
                  <Pressable onPress={() => router.push('/eventos')} hitSlop={12}>
                    <Text style={e.verTodos}>Ver todos</Text>
                  </Pressable>
                </View>
                {dados.eventos.map((ev) => (
                  <CartaoEvento
                    key={ev.conta.id}
                    evento={ev}
                    onPress={() => router.push(`/evento/${ev.conta.id}`)}
                  />
                ))}
              </Aparecer>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {/* RNF02: 1 toque no botao, digitar o valor, 1 toque em salvar. */}
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
    conteudo: { padding: espaco.lg, gap: espaco.md, paddingBottom: 96 },
    rotuloDestaque: {
      fontSize: 12,
      fontWeight: '600',
      color: cores.sobreDestaque,
      opacity: 0.8,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    saldoTotal: {
      fontSize: 34,
      fontWeight: '800',
      color: cores.sobreDestaque,
      marginTop: espaco.xs,
    },
    pilulas: { flexDirection: 'row', gap: espaco.sm, marginTop: espaco.lg },
    pilula: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderRadius: raio.md,
      paddingVertical: espaco.sm,
      paddingHorizontal: espaco.md,
    },
    pilulaRotulo: { fontSize: 11, color: cores.sobreDestaque, opacity: 0.85 },
    pilulaValor: { fontSize: 16, fontWeight: '700', color: cores.sobreDestaque, marginTop: 2 },
    rotulo: {
      fontSize: 12,
      fontWeight: '600',
      color: cores.textoFraco,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    explicacao: { fontSize: 11, color: cores.textoFraco, marginTop: 2 },
    linhaResultado: { flexDirection: 'row', alignItems: 'center', gap: espaco.md },
    resultado: { fontSize: 22, fontWeight: '800' },
    linhaConta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      paddingVertical: espaco.sm,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarLetra: { fontSize: 16, fontWeight: '800' },
    nomeConta: { fontSize: 15, fontWeight: '600', color: cores.texto },
    tipoConta: { fontSize: 11, color: cores.textoFraco, marginTop: 1 },
    valorConta: { fontSize: 15, fontWeight: '700' },
    cartaoInvestimento: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      borderRadius: raio.md,
      borderWidth: 1,
      padding: espaco.lg,
    },
    iconeInvestimento: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconeTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
    valorInvestido: { fontSize: 18, fontWeight: '800' },
    secaoEventos: { gap: espaco.sm },
    cabecalhoSecao: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    verTodos: { color: cores.primaria, fontSize: 13, fontWeight: '700' },
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
