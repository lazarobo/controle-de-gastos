import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao, Campo, Carregando, Chips, Rotulo } from '../../src/components/ui';
import { SeletorCor } from '../../src/components/SeletorCor';
import { Avatar } from '../../src/components/Avatar';
import { CampoValor } from '../../src/components/CampoValor';
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
  // Cartao de credito (migration 10).
  const [limite, setLimite] = useState(0);
  const [disponivel, setDisponivel] = useState(0);
  const [faturaAtual, setFaturaAtual] = useState(0);
  const [diaFechamento, setDiaFechamento] = useState('');
  const [diaVencimento, setDiaVencimento] = useState('');
  const [erroCartao, setErroCartao] = useState<string | null>(null);
  const cartao = tipo === 'cartao';

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
        setLimite(c.limite ?? 0);
        setDiaFechamento(c.dia_fechamento ? String(c.dia_fechamento) : '');
        setDiaVencimento(c.dia_vencimento ? String(c.dia_vencimento) : '');
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
    let saldo = negativo ? -centavos : centavos;

    let dadosCartao: contasRepo.DadosCartao | null = null;
    if (cartao) {
      const fech = Number(diaFechamento);
      const venc = Number(diaVencimento);
      const diaValido = (d: number) => Number.isInteger(d) && d >= 1 && d <= 31;
      if (limite <= 0) return setErroCartao('Informe o limite total do cartão.');
      if (!diaValido(fech) || !diaValido(venc)) {
        return setErroCartao('Fechamento e vencimento são dias do mês, de 1 a 31.');
      }
      if (nova) {
        if (disponivel > limite) return setErroCartao('O disponível não pode passar do limite.');
        const divida = limite - disponivel;
        if (faturaAtual > divida) {
          return setErroCartao(
            'A fatura atual não pode ser maior que o limite já usado (limite − disponível).',
          );
        }
        // Cartao comeca devendo o que ja esta usado do limite: e esse o saldo
        // inicial. Daqui pra frente, compras e pagamentos movem o disponivel.
        saldo = -divida;
      }
      dadosCartao = {
        limite,
        dia_fechamento: fech,
        dia_vencimento: venc,
        fatura_inicial: nova ? faturaAtual : undefined,
      };
    }
    setErroCartao(null);

    const dados = {
      nome,
      tipo,
      saldo_inicial: saldo,
      ativo,
      cor,
      cartao: dadosCartao,
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
              const centavos = parseMoeda(saldoInicial) ?? 0;
              await contasRepo.atualizar(idNumero, {
                nome,
                tipo,
                // O sinal mora no texto: parseMoeda devolve so o modulo.
                saldo_inicial: saldoInicial.trim().startsWith('-') ? -centavos : centavos,
                ativo: false,
                cor,
                cartao: cartao
                  ? {
                      limite,
                      dia_fechamento: Number(diaFechamento) || null,
                      dia_vencimento: Number(diaVencimento) || null,
                    }
                  : null,
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
          <View style={e.previa}>
            <Avatar nome={nome || '?'} cor={cor} tamanho={44} />
            <Text style={e.previaTexto}>
              A cor identifica a conta no Início, na lista de contas e nos gráficos.
            </Text>
          </View>
          <Rotulo>Cor da conta</Rotulo>
          <SeletorCor cor={cor} onChange={setCor} />
        </View>

        <View style={e.grupo}>
          <Rotulo>Tipo</Rotulo>
          <Chips
            itens={TIPOS_CONTA.map((t) => ({ valor: t.valor, rotulo: t.rotulo }))}
            valor={tipo}
            onChange={(v) => setTipo(v as TipoConta)}
          />
        </View>

        {cartao ? (
          <View style={e.grupo}>
            <CampoValor rotulo="Limite total" valor={limite} onChange={setLimite} />
            {nova ? (
              <>
                <CampoValor
                  rotulo="Limite disponível hoje"
                  valor={disponivel}
                  onChange={setDisponivel}
                />
                <CampoValor
                  rotulo="Fatura atual (aberta)"
                  valor={faturaAtual}
                  onChange={setFaturaAtual}
                />
                <Text style={e.ajuda}>
                  Copie do app do banco. O que já está usado do limite vira a dívida inicial do
                  cartão; a fatura atual é a parte dela que vence primeiro. Daqui pra frente,
                  compras baixam o disponível e pagamentos o devolvem.
                </Text>
              </>
            ) : null}
            <View style={e.linhaDias}>
              <View style={{ flex: 1 }}>
                <Campo
                  rotulo="Dia do fechamento"
                  value={diaFechamento}
                  onChangeText={(t) => setDiaFechamento(t.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  placeholder="Ex.: 28"
                  maxLength={2}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Campo
                  rotulo="Dia do vencimento"
                  value={diaVencimento}
                  onChangeText={(t) => setDiaVencimento(t.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  placeholder="Ex.: 5"
                  maxLength={2}
                />
              </View>
            </View>
            {erroCartao ? <Text style={e.erro}>{erroCartao}</Text> : null}
          </View>
        ) : (
          <>
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
          </>
        )}

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
    previa: { flexDirection: 'row', alignItems: 'center', gap: espaco.md, marginBottom: espaco.md },
    previaTexto: { flex: 1, fontSize: 12, color: cores.textoFraco, lineHeight: 17 },
    acoes: { gap: espaco.sm, marginTop: espaco.lg },
    linhaDias: { flexDirection: 'row', gap: espaco.md },
    erro: { color: cores.perigo, fontSize: 13, marginTop: -espaco.sm },
  });
}
