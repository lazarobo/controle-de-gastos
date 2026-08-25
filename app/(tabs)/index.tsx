import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';

import { SeletorMes } from '../../src/components/SeletorMes';
import { Cartao, Carregando, Titulo, Vazio } from '../../src/components/ui';
import { useConsulta } from '../../src/hooks/useConsulta';
import * as contasRepo from '../../src/repos/contas';
import * as lancamentosRepo from '../../src/repos/lancamentos';
import { formatarMoeda } from '../../src/utils/money';
import { mesAtual, type Mes } from '../../src/utils/date';
import { cores, espaco, raio } from '../../src/utils/tema';
import type { ResumoMes, SaldoConta } from '../../src/types';

interface DadosPainel {
  saldoTotal: number;
  resumo: ResumoMes;
  saldos: SaldoConta[];
}

export default function Painel() {
  const [mes, setMes] = useState<Mes>(mesAtual);
  const router = useRouter();

  const { dados, carregando } = useConsulta<DadosPainel>(async () => {
    const [saldoTotal, resumo, saldos] = await Promise.all([
      contasRepo.saldoTotal(),
      lancamentosRepo.resumoMes(mes),
      contasRepo.saldos(),
    ]);
    return { saldoTotal, resumo, saldos };
  }, [mes.ano, mes.mes]);

  return (
    <View style={e.tela}>
      <ScrollView contentContainerStyle={e.conteudo}>
        <SeletorMes mes={mes} onChange={setMes} />

        {carregando && !dados ? (
          <Carregando />
        ) : dados ? (
          <>
            <Cartao>
              <Text style={e.rotuloSaldo}>Saldo total das contas ativas</Text>
              <Text
                style={[
                  e.saldoTotal,
                  { color: dados.saldoTotal < 0 ? cores.despesa : cores.texto },
                ]}
              >
                {formatarMoeda(dados.saldoTotal)}
              </Text>
            </Cartao>

            <View style={e.grade}>
              <Kpi rotulo="Receitas" valor={dados.resumo.receitas} cor={cores.receita} />
              <Kpi rotulo="Despesas" valor={dados.resumo.despesas} cor={cores.despesa} />
            </View>

            <Cartao>
              <Text style={e.rotuloSaldo}>Resultado do mês</Text>
              <Text
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
              >
                {dados.resumo.resultado > 0 ? '+' : ''}
                {formatarMoeda(dados.resumo.resultado)}
              </Text>
              <Text style={e.explicacao}>receitas do mês − despesas do mês</Text>
            </Cartao>

            <Cartao>
              <Titulo>Saldo por conta</Titulo>
              {dados.saldos.length === 0 ? (
                <Vazio
                  titulo="Nenhuma conta cadastrada"
                  detalhe="Cadastre suas contas em Ajustes › Contas."
                />
              ) : (
                dados.saldos.map(({ conta, saldo }) => (
                  <Link key={conta.id} href={`/conta/${conta.id}`} asChild>
                    <Pressable style={e.linhaConta}>
                      <Text style={e.nomeConta} numberOfLines={1}>
                        {conta.nome}
                      </Text>
                      <Text
                        style={[
                          e.valorConta,
                          { color: saldo < 0 ? cores.despesa : cores.texto },
                        ]}
                      >
                        {formatarMoeda(saldo)}
                      </Text>
                    </Pressable>
                  </Link>
                ))
              )}
            </Cartao>
          </>
        ) : null}
      </ScrollView>

      {/* RNF02: 1 toque no botao, digitar o valor, 1 toque em salvar. */}
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

function Kpi({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <Cartao style={e.kpi}>
      <Text style={e.rotuloSaldo}>{rotulo}</Text>
      <Text style={[e.valorKpi, { color: cor }]}>{formatarMoeda(valor)}</Text>
    </Cartao>
  );
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.md, paddingBottom: 96 },
  rotuloSaldo: {
    fontSize: 12,
    fontWeight: '600',
    color: cores.textoFraco,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  saldoTotal: { fontSize: 30, fontWeight: '800', color: cores.texto, marginTop: espaco.xs },
  grade: { flexDirection: 'row', gap: espaco.md },
  kpi: { flex: 1 },
  valorKpi: { fontSize: 19, fontWeight: '700', marginTop: espaco.xs },
  resultado: { fontSize: 24, fontWeight: '800', marginTop: espaco.xs },
  explicacao: { fontSize: 11, color: cores.textoFraco, marginTop: 2 },
  linhaConta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: espaco.md,
    borderTopWidth: 1,
    borderTopColor: cores.borda,
    gap: espaco.md,
  },
  nomeConta: { flex: 1, fontSize: 15, color: cores.texto },
  valorConta: { fontSize: 15, fontWeight: '700' },
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
