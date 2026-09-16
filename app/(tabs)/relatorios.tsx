import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Aparecer, BarraProgresso } from '../../src/components/animacao';
import { GraficoBarras } from '../../src/components/GraficoBarras';
import { GraficoComparativo } from '../../src/components/GraficoComparativo';
import { GraficoDias } from '../../src/components/GraficoDias';
import { GraficoPizza } from '../../src/components/GraficoPizza';
import { SeletorMes } from '../../src/components/SeletorMes';
import { Cartao, Carregando, Chips, Titulo, Vazio } from '../../src/components/ui';
import { useConsulta } from '../../src/hooks/useConsulta';
import { useTema } from '../../src/contexto/TemaContexto';
import * as lancamentosRepo from '../../src/repos/lancamentos';
import * as metasRepo from '../../src/repos/metas';
import { useMoeda } from '../../src/contexto/PrivacidadeContexto';
import { mesAtual, type Mes } from '../../src/utils/date';
import { espaco, type Paleta } from '../../src/utils/tema';
import type {
  EvolucaoMes,
  FatiaGrafico,
  MetaComProgresso,
  ResumoMes,
  TotalPorCategoria,
  TotalPorConta,
  TotalPorDia,
  TipoMovimento,
} from '../../src/types';

interface Dados {
  totais: TotalPorCategoria[];
  metas: MetaComProgresso[];
  evolucao: EvolucaoMes[];
  porDia: TotalPorDia[];
  porConta: TotalPorConta[];
  resumo: ResumoMes;
}

/** Intervalo entre a entrada de um cartao e o seguinte. */
const PASSO = 60;

export default function Relatorios() {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  const router = useRouter();
  const [mes, setMes] = useState<Mes>(mesAtual);
  const [tipo, setTipo] = useState<TipoMovimento>('despesa');

  const { dados, carregando } = useConsulta<Dados>(async () => {
    const [totais, metas, evolucao, porDia, porConta, resumo] = await Promise.all([
      lancamentosRepo.totaisPorCategoria(mes, tipo),
      metasRepo.listarComProgresso(mes),
      lancamentosRepo.evolucaoMensal(mes),
      lancamentosRepo.totaisPorDia(mes),
      lancamentosRepo.totaisPorConta(mes),
      lancamentosRepo.resumoMes(mes),
    ]);
    return { totais, metas, evolucao, porDia, porConta, resumo };
  }, [mes.ano, mes.mes, tipo]);

  const despesa = tipo === 'despesa';

  return (
    <ScrollView style={e.tela} contentContainerStyle={e.conteudo}>
      <SeletorMes mes={mes} onChange={setMes} />

      <Chips
        itens={[
          { valor: 'despesa', rotulo: 'Despesas', cor: cores.despesa },
          { valor: 'receita', rotulo: 'Receitas', cor: cores.receita },
        ]}
        valor={tipo}
        onChange={(v) => setTipo(v as TipoMovimento)}
      />

      <Aparecer>
        <Cartao>
          <Titulo>{despesa ? 'Onde o dinheiro foi' : 'De onde o dinheiro veio'}</Titulo>
          {carregando && !dados ? (
            <Carregando />
          ) : !dados?.totais.length ? (
            <Vazio
              titulo={`Nenhuma ${tipo} neste mês`}
              detalhe="O gráfico aparece assim que houver lançamentos."
            />
          ) : (
            <View style={e.grafico}>
              <GraficoPizza
                dados={dados.totais.map<FatiaGrafico>((t) => ({
                  chave: String(t.categoria_id ?? 'sem'),
                  nome: t.categoria_nome,
                  cor: t.cor,
                  total: t.total,
                }))}
              />
            </View>
          )}
        </Cartao>
      </Aparecer>

      {despesa ? (
        <Aparecer atraso={PASSO}>
          <Cartao>
            <Titulo>Gasto por dia</Titulo>
            {carregando && !dados ? (
              <Carregando />
            ) : !dados?.porDia.some((d) => d.total > 0) ? (
              <Vazio
                titulo="Nenhum gasto neste mês"
                detalhe="O gráfico aparece assim que houver despesas."
              />
            ) : (
              <View style={e.grafico}>
                <GraficoDias dados={dados.porDia} />
              </View>
            )}
          </Cartao>
        </Aparecer>
      ) : null}

      {despesa ? (
        <Aparecer atraso={PASSO * 2}>
          <Cartao>
            <View style={e.cabecalhoMetas}>
              <Titulo>Metas do mês</Titulo>
              <Pressable onPress={() => router.push('/metas')} hitSlop={12}>
                <Text style={e.gerenciar}>Gerenciar</Text>
              </Pressable>
            </View>
            {carregando && !dados ? (
              <Carregando />
            ) : !dados?.metas.length ? (
              <Vazio
                titulo="Nenhuma meta cadastrada"
                detalhe='Toque em "Gerenciar" para definir um teto mensal por categoria.'
              />
            ) : (
              <View style={e.listaMetas}>
                {dados.metas.map((m) => (
                  <BarraMeta key={m.id} meta={m} />
                ))}
              </View>
            )}
          </Cartao>
        </Aparecer>
      ) : null}

      <Aparecer atraso={PASSO * 3}>
        <Cartao>
          <Titulo>Receitas × despesas do mês</Titulo>
          {carregando && !dados ? (
            <Carregando />
          ) : !dados || (dados.resumo.receitas === 0 && dados.resumo.despesas === 0) ? (
            <Vazio titulo="Nenhum lançamento neste mês" />
          ) : (
            <View style={e.grafico}>
              <GraficoComparativo
                linhas={[
                  {
                    chave: 'total',
                    nome: 'Total do mês',
                    receitas: dados.resumo.receitas,
                    despesas: dados.resumo.despesas,
                  },
                ]}
              />
            </View>
          )}
        </Cartao>
      </Aparecer>

      <Aparecer atraso={PASSO * 4}>
        <Cartao>
          <Titulo>Por conta</Titulo>
          {carregando && !dados ? (
            <Carregando />
          ) : !dados?.porConta.length ? (
            <Vazio
              titulo="Nenhuma conta movimentada neste mês"
              detalhe="Movimentações internas não entram aqui — elas não são receita nem despesa."
            />
          ) : (
            <View style={e.grafico}>
              <GraficoComparativo
                linhas={dados.porConta.map((c) => ({
                  chave: String(c.conta_id),
                  nome: c.conta_nome,
                  cor: c.cor,
                  receitas: c.receitas,
                  despesas: c.despesas,
                }))}
              />
            </View>
          )}
        </Cartao>
      </Aparecer>

      <Aparecer atraso={PASSO * 5}>
        <Cartao>
          <Titulo>Evolução (6 meses)</Titulo>
          {carregando && !dados ? (
            <Carregando />
          ) : (
            <View style={e.grafico}>
              <GraficoBarras dados={dados?.evolucao ?? []} />
            </View>
          )}
        </Cartao>
      </Aparecer>
    </ScrollView>
  );
}

function BarraMeta({ meta }: { meta: MetaComProgresso }) {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);

  const formatarMoeda = useMoeda();
  const fracao = meta.meta > 0 ? meta.gasto / meta.meta : 0;
  const estourou = meta.gasto > meta.meta;

  return (
    <View style={e.linhaMeta}>
      <View style={e.cabecalhoLinhaMeta}>
        <Text style={e.nomeMeta} numberOfLines={1}>
          {meta.categoria_nome}
        </Text>
        <Text style={[e.valoresMeta, estourou && { color: cores.despesa }]}>
          {formatarMoeda(meta.gasto)} / {formatarMoeda(meta.meta)}
        </Text>
      </View>
      {/* Preenche ao aparecer: a barra "enchendo" e o que torna a meta legivel de relance. */}
      <BarraProgresso
        fracao={fracao}
        cor={estourou ? cores.despesa : meta.categoria_cor}
        trilha={cores.superficieAlt}
      />
      {estourou ? <Text style={e.avisoEstouro}>Estourou a meta</Text> : null}
    </View>
  );
}

function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
    tela: { flex: 1, backgroundColor: cores.fundo },
    conteudo: { padding: espaco.lg, gap: espaco.md, paddingBottom: espaco.xl },
    grafico: { marginTop: espaco.md },
    cabecalhoMetas: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    gerenciar: { color: cores.primaria, fontSize: 13, fontWeight: '700' },
    listaMetas: { gap: espaco.md, marginTop: espaco.sm },
    linhaMeta: { gap: espaco.xs },
    cabecalhoLinhaMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: espaco.sm },
    nomeMeta: { flex: 1, fontSize: 14, color: cores.texto, fontWeight: '600' },
    valoresMeta: { fontSize: 12, color: cores.textoFraco },
    avisoEstouro: { fontSize: 11, color: cores.despesa, fontWeight: '600' },
  });
}
