import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao, Campo, Carregando, Chips, Rotulo } from '../../src/components/ui';
import { SeletorCor } from '../../src/components/SeletorCor';
import * as contasRepo from '../../src/repos/contas';
import { formatarValor, parseMoeda } from '../../src/utils/money';
import { useTema } from '../../src/contexto/TemaContexto';
import { espaco, PALETA, type Paleta } from '../../src/utils/tema';
import { TIPOS_CONTA, type TipoConta } from '../../src/types';

export default function FormularioConta() {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const nova = id === 'nova';
  const idNumero = nova ? null : Number(id);
  const router = useRouter();

  const [carregando, setCarregando] = useState(!nova);
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoConta>('corrente');
  const [saldoInicial, setSaldoInicial] = useState('0,00');
  const [ativo, setAtivo] = useState(true);
  const [cor, setCor] = useState(PALETA[0]);
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [erroSaldo, setErroSaldo] = useState<string | null>(null);

  useEffect(() => {
    if (nova || idNumero == null) return;
    let vivo = true;

    contasRepo.obter(idNumero).then((c) => {
      if (!vivo) return;
      if (c) {
        setNome(c.nome);
        setTipo(c.tipo);
        setSaldoInicial(formatarValor(c.saldo_inicial));
        setAtivo(c.ativo === 1);
        setCor(c.cor);
      }
      setCarregando(false);
    });

    return () => {
      vivo = false;
    };
  }, [id]);

  async function salvar() {
    if (!nome.trim()) {
      setErroNome('Dê um nome à conta.');
      return;
    }
    setErroNome(null);

    // Aceita negativo: cartao de credito e cheque especial comecam devendo.
    const centavos = parseMoeda(saldoInicial);
    if (centavos == null) {
      setErroSaldo('Valor inválido.');
      return;
    }
    setErroSaldo(null);

    const negativo = saldoInicial.trim().startsWith('-');
    const dados = {
      nome,
      tipo,
      saldo_inicial: negativo ? -centavos : centavos,
      ativo,
      cor,
    };

    setSalvando(true);
    try {
      if (nova) await contasRepo.criar(dados);
      else if (idNumero != null) await contasRepo.atualizar(idNumero, dados);
      router.back();
    } catch (erro) {
      Alert.alert('Erro ao salvar', erro instanceof Error ? erro.message : String(erro));
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    if (idNumero == null) return;

    const usos = await contasRepo.contarLancamentos(idNumero);
    if (usos > 0) {
      // Decisao D03/D04: historico nao se apaga. Inativar esconde a conta das
      // telas sem alterar nenhum saldo ja lancado.
      Alert.alert(
        'Conta com histórico',
        `Esta conta tem ${usos} lançamento(s) e não pode ser excluída sem apagá-los. ` +
          'Marque-a como inativa para escondê-la das telas mantendo os números do passado.',
        [
          { text: 'Entendi', style: 'cancel' },
          {
            text: 'Inativar',
            onPress: async () => {
              setAtivo(false);
              await contasRepo.atualizar(idNumero, {
                nome,
                tipo,
                saldo_inicial: parseMoeda(saldoInicial) ?? 0,
                ativo: false,
                cor,
              });
              router.back();
            },
          },
        ],
      );
      return;
    }

    Alert.alert('Excluir conta', 'Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await contasRepo.excluir(idNumero);
            router.back();
          } catch (erro) {
            Alert.alert('Erro', erro instanceof Error ? erro.message : String(erro));
          }
        },
      },
    ]);
  }

  if (carregando) {
    return (
      <>
        <Stack.Screen options={{ title: 'Conta' }} />
        <Carregando />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: nova ? 'Nova conta' : 'Editar conta' }} />
      <ScrollView
        style={e.tela}
        contentContainerStyle={[e.conteudo, { paddingBottom: espaco.xl + insets.bottom }]}
      >
        <Campo
          rotulo="Nome"
          value={nome}
          onChangeText={setNome}
          placeholder="Nubank, Carteira, Itaú…"
          autoFocus={nova}
          erro={erroNome}
        />

        <View style={e.grupo}>
          <Rotulo>Tipo</Rotulo>
          <Chips
            itens={TIPOS_CONTA.map((t) => ({ valor: t.valor, rotulo: t.rotulo }))}
            valor={tipo}
            onChange={(v) => setTipo(v as TipoConta)}
          />
        </View>

        <Campo
          rotulo="Saldo inicial (R$)"
          value={saldoInicial}
          onChangeText={setSaldoInicial}
          keyboardType="numbers-and-punctuation"
          placeholder="0,00"
          erro={erroSaldo}
        />
        <Text style={e.ajuda}>
          O saldo de hoje. Depois disso, corrija divergências com um lançamento na
          categoria "Ajuste de saldo" — nunca mexendo neste campo, ou os meses
          passados deixam de fechar.
        </Text>

        <View style={e.grupo}>
          <Rotulo>Cor nos gráficos</Rotulo>
          <SeletorCor cor={cor} onChange={setCor} />
        </View>

        <View style={e.linhaSwitch}>
          <View style={{ flex: 1 }}>
            <Rotulo>Conta ativa</Rotulo>
            <Text style={e.ajuda}>
              Contas inativas somem das telas, mas seus lançamentos continuam contando
              no histórico.
            </Text>
          </View>
          <Switch value={ativo} onValueChange={setAtivo} />
        </View>

        <View style={e.acoes}>
          <Botao titulo="Salvar" onPress={salvar} carregando={salvando} />
          {!nova ? (
            <Botao titulo="Excluir" variante="perigo" onPress={confirmarExclusao} />
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}

function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
    tela: { flex: 1, backgroundColor: cores.fundo },
    conteudo: { padding: espaco.lg, paddingBottom: espaco.xl },
    grupo: { marginBottom: espaco.lg },
    ajuda: { fontSize: 12, color: cores.textoFraco, marginTop: -espaco.sm, marginBottom: espaco.lg },
    linhaSwitch: { flexDirection: 'row', alignItems: 'center', gap: espaco.md },
    acoes: { gap: espaco.sm, marginTop: espaco.lg },
  });
}
