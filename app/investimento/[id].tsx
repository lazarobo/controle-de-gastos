import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao, Campo, Cartao, Carregando, Rotulo, Titulo } from '../../src/components/ui';
import { CartaoDestaque } from '../../src/components/CartaoDestaque';
import { CampoValor } from '../../src/components/CampoValor';
import { NumeroAnimado, Tocavel } from '../../src/components/animacao';
import { SeletorCor } from '../../src/components/SeletorCor';
import { useConsulta } from '../../src/hooks/useConsulta';
import { useMoeda } from '../../src/contexto/PrivacidadeContexto';
import { useTema } from '../../src/contexto/TemaContexto';
import * as contasRepo from '../../src/repos/contas';
import * as investimentosRepo from '../../src/repos/investimentos';
import * as lancamentosRepo from '../../src/repos/lancamentos';
import { formatarDataCurta, hojeISO, horaDe } from '../../src/utils/date';
import { espaco, PALETA, raio, type Paleta } from '../../src/utils/tema';
import type { InvestimentoResumo, LancamentoDetalhado } from '../../src/types';

export default function TelaInvestimento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return id === 'novo' ? <NovoInvestimento /> : <DetalheInvestimento id={Number(id)} />;
}

/** Cadastro: o "ja tenho isso la" vira o saldo inicial da conta de investimento. */
function NovoInvestimento() {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [nome, setNome] = useState('');
  const [valor, setValor] = useState(0);
  const [observacao, setObservacao] = useState('');
  const [cor, setCor] = useState<string>(PALETA[21]);
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim()) {
      setErroNome('Dê um nome (o banco ou corretora).');
      return;
    }
    setSalvando(true);
    try {
      await investimentosRepo.criar({ nome, cor, observacao: observacao.trim() || null }, valor);
      router.back();
    } catch (erro) {
      Alert.alert('Erro ao salvar', erro instanceof Error ? erro.message : String(erro));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Novo investimento' }} />
      <ScrollView
        style={e.tela}
        contentContainerStyle={[e.conteudo, { paddingBottom: espaco.xl + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <Campo
          rotulo="Banco ou corretora"
          value={nome}
          onChangeText={setNome}
          placeholder="XP, Nubank, Rico…"
          autoFocus
          erro={erroNome}
        />
        <CampoValor rotulo="Quanto já tem lá hoje" valor={valor} onChange={setValor} />
        <Text style={e.ajuda}>
          Esse valor entra como ponto de partida e não sai de conta nenhuma. Daqui pra frente,
          use “Investir” no lançamento para aportar a partir de uma conta.
        </Text>
        <Campo
          rotulo="Observação (opcional)"
          value={observacao}
          onChangeText={setObservacao}
          placeholder="Ex.: CDB, Tesouro Selic, ações…"
          multiline
          numberOfLines={3}
          style={e.inputMultilinha}
        />
        <View style={e.grupo}>
          <Rotulo>Cor</Rotulo>
          <SeletorCor cor={cor} onChange={setCor} />
        </View>
        <Botao titulo="Salvar" onPress={salvar} carregando={salvando} />
      </ScrollView>
    </>
  );
}

interface Dados {
  resumo: InvestimentoResumo | null;
  extrato: LancamentoDetalhado[];
}

function DetalheInvestimento({ id }: { id: number }) {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  const formatarMoeda = useMoeda();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { dados, carregando, recarregar } = useConsulta<Dados>(async () => {
    const [resumo, extrato] = await Promise.all([
      investimentosRepo.obter(id),
      lancamentosRepo.listarDaConta(id, 8),
    ]);
    return { resumo, extrato };
  }, [id]);

  const resumo = dados?.resumo ?? null;

  const [nome, setNome] = useState('');
  const [observacao, setObservacao] = useState('');
  const [cor, setCor] = useState<string>(PALETA[21]);
  const [ativo, setAtivo] = useState(true);
  const [valorHoje, setValorHoje] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [preenchido, setPreenchido] = useState(false);

  // Preenche o formulario uma vez; recarregar (voltar de um aporte) atualiza
  // so os numeros, sem apagar o que a pessoa estava editando.
  useEffect(() => {
    if (!resumo) return;
    setValorHoje(resumo.valor);
    if (preenchido) return;
    setNome(resumo.conta.nome);
    setObservacao(resumo.conta.observacao ?? '');
    setCor(resumo.conta.cor);
    setAtivo(resumo.conta.ativo === 1);
    setPreenchido(true);
  }, [resumo]);

  if (carregando && !dados) {
    return (
      <>
        <Stack.Screen options={{ title: 'Investimento' }} />
        <Carregando />
      </>
    );
  }

  if (!resumo) {
    return (
      <>
        <Stack.Screen options={{ title: 'Investimento' }} />
        <View style={e.tela}>
          <Text style={[e.ajuda, { padding: espaco.lg }]}>Investimento não encontrado.</Text>
        </View>
      </>
    );
  }

  const diferenca = valorHoje - resumo.valor;
  const percentual = resumo.aportado > 0 ? (resumo.rendimento / resumo.aportado) * 100 : 0;

  async function registrarValor() {
    if (diferenca === 0) return;
    setRegistrando(true);
    try {
      await investimentosRepo.registrarValorAtual(id, valorHoje, hojeISO(), horaDe());
      recarregar();
    } catch (erro) {
      Alert.alert('Erro', erro instanceof Error ? erro.message : String(erro));
    } finally {
      setRegistrando(false);
    }
  }

  async function salvar() {
    if (!nome.trim()) {
      Alert.alert('Dê um nome', 'O nome do banco ou corretora não pode ficar vazio.');
      return;
    }
    setSalvando(true);
    try {
      await investimentosRepo.atualizar(id, { nome, cor, observacao: observacao.trim() || null }, ativo);
      router.back();
    } catch (erro) {
      Alert.alert('Erro ao salvar', erro instanceof Error ? erro.message : String(erro));
    } finally {
      setSalvando(false);
    }
  }

  function confirmarExclusao() {
    Alert.alert(
      'Excluir investimento',
      'Só dá para excluir um investimento sem movimentações. Com histórico, desligue “Ativo” para escondê-lo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await contasRepo.excluir(id);
              router.back();
            } catch (erro) {
              Alert.alert('Não foi possível', erro instanceof Error ? erro.message : String(erro));
            }
          },
        },
      ],
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: resumo.conta.nome }} />
      <ScrollView
        style={e.tela}
        contentContainerStyle={[e.conteudo, e.pilha, { paddingBottom: espaco.xl + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <CartaoDestaque de={resumo.conta.cor} para={cores.gradienteB} idGradiente="investimento">
          <Text style={e.rotuloDestaque}>Valor hoje</Text>
          <NumeroAnimado centavos={resumo.valor} style={e.valorDestaque} />
          <View style={e.pilulas}>
            <View style={e.pilula}>
              <Text style={e.pilulaRotulo}>Você colocou</Text>
              <NumeroAnimado centavos={resumo.aportado} style={e.pilulaValor} />
            </View>
            <View style={e.pilula}>
              <Text style={e.pilulaRotulo}>
                Rendeu{resumo.aportado > 0 ? ` · ${percentual.toFixed(1)}%` : ''}
              </Text>
              <NumeroAnimado centavos={resumo.rendimento} comSinal style={e.pilulaValor} />
            </View>
          </View>
        </CartaoDestaque>

        <View style={e.linhaBotoes}>
          <View style={{ flex: 1 }}>
            <Botao
              titulo="Aportar"
              icone="entrada"
              onPress={() => router.push(`/lancamento/novo?tipo=investir&destino=${id}`)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Botao
              titulo="Resgatar"
              icone="saida"
              variante="secundaria"
              onPress={() => router.push(`/lancamento/novo?tipo=transferencia&conta=${id}`)}
            />
          </View>
        </View>

        <Cartao>
          <Titulo>Atualizar valor</Titulo>
          <Text style={[e.ajuda, { marginTop: 0 }]}>
            Conferiu o extrato? Digite o valor de hoje. A diferença entra como rendimento (ou
            desvalorização) — não mexe no saldo do Início nem nas receitas do mês.
          </Text>
          <CampoValor rotulo="Valor no extrato hoje" valor={valorHoje} onChange={setValorHoje} />
          {diferenca !== 0 ? (
            <Text
              style={[e.diferenca, { color: diferenca > 0 ? cores.receita : cores.despesa }]}
            >
              {diferenca > 0 ? 'Rendimento de ' : 'Desvalorização de '}
              {formatarMoeda(Math.abs(diferenca))}
            </Text>
          ) : null}
          <Botao
            titulo="Registrar"
            onPress={registrarValor}
            carregando={registrando}
            desabilitado={diferenca === 0}
          />
        </Cartao>

        {dados && dados.extrato.length > 0 ? (
          <Cartao>
            <Titulo>Movimentações</Titulo>
            {dados.extrato.map((l) => {
              const entrou =
                (l.tipo === 'transferencia' && l.conta_destino_id === id) || l.tipo === 'receita';
              return (
                <Tocavel
                  key={l.id}
                  style={e.linhaExtrato}
                  onPress={() => router.push(`/lancamento/${l.id}`)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={e.descricao} numberOfLines={1}>
                      {l.descricao}
                    </Text>
                    <Text style={e.data}>
                      {formatarDataCurta(l.data)}
                      {l.hora ? ` · ${l.hora}` : ''}
                    </Text>
                  </View>
                  <Text style={[e.valorExtrato, { color: entrou ? cores.receita : cores.despesa }]}>
                    {entrou ? '+ ' : '− '}
                    {formatarMoeda(l.valor)}
                  </Text>
                </Tocavel>
              );
            })}
          </Cartao>
        ) : null}

        <Cartao>
          <Titulo>Dados</Titulo>
          <Campo rotulo="Banco ou corretora" value={nome} onChangeText={setNome} />
          <Campo
            rotulo="Observação (opcional)"
            value={observacao}
            onChangeText={setObservacao}
            placeholder="Ex.: CDB, Tesouro Selic, ações…"
            multiline
            numberOfLines={3}
            style={e.inputMultilinha}
          />
          <View style={e.grupo}>
            <Rotulo>Cor</Rotulo>
            <SeletorCor cor={cor} onChange={setCor} />
          </View>
          <View style={e.linhaAtivo}>
            <View style={{ flex: 1 }}>
              <Text style={e.descricao}>Ativo</Text>
              <Text style={e.data}>Desligado, some da aba Investir e do total.</Text>
            </View>
            <Switch
              value={ativo}
              onValueChange={setAtivo}
              trackColor={{ true: cores.investimento, false: cores.borda }}
            />
          </View>
          <View style={e.acoes}>
            <Botao titulo="Salvar" onPress={salvar} carregando={salvando} />
            <Botao titulo="Excluir" variante="perigo" onPress={confirmarExclusao} />
          </View>
        </Cartao>
      </ScrollView>
    </>
  );
}

function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
    tela: { flex: 1, backgroundColor: cores.fundo },
    conteudo: { padding: espaco.lg },
    pilha: { gap: espaco.md },
    inputMultilinha: { minHeight: 80, textAlignVertical: 'top' },
    grupo: { marginBottom: espaco.lg },
    ajuda: {
      fontSize: 12,
      color: cores.textoFraco,
      lineHeight: 17,
      marginTop: -espaco.sm,
      marginBottom: espaco.lg,
    },
    rotuloDestaque: {
      fontSize: 12,
      fontWeight: '700',
      color: cores.sobreDestaque,
      opacity: 0.85,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    valorDestaque: {
      fontSize: 34,
      fontWeight: '800',
      color: cores.sobreDestaque,
      marginTop: espaco.xs,
    },
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
    linhaBotoes: { flexDirection: 'row', gap: espaco.md },
    diferenca: { fontSize: 14, fontWeight: '700', marginTop: -espaco.sm, marginBottom: espaco.md },
    linhaExtrato: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      paddingVertical: espaco.sm,
    },
    descricao: { fontSize: 15, fontWeight: '600', color: cores.texto },
    data: { fontSize: 12, color: cores.textoFraco, marginTop: 2 },
    valorExtrato: { fontSize: 15, fontWeight: '700' },
    linhaAtivo: { flexDirection: 'row', alignItems: 'center', marginBottom: espaco.lg },
    acoes: { gap: espaco.sm },
  });
}
