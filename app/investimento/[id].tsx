import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao, Campo, Carregando, Rotulo } from '../../src/components/ui';
import { SeletorCor } from '../../src/components/SeletorCor';
import { CampoValor } from '../../src/components/CampoValor';
import * as investimentosRepo from '../../src/repos/investimentos';
import { useTema } from '../../src/contexto/TemaContexto';
import { espaco, PALETA, type Paleta } from '../../src/utils/tema';

export default function FormularioInvestimento() {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const novo = id === 'novo';
  const idNumero = novo ? null : Number(id);
  const router = useRouter();

  const [carregando, setCarregando] = useState(!novo);
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState(0);
  const [observacao, setObservacao] = useState('');
  const [cor, setCor] = useState(PALETA[18]);
  const [erroNome, setErroNome] = useState<string | null>(null);

  useEffect(() => {
    if (novo || idNumero == null) return;
    let vivo = true;

    investimentosRepo.obter(idNumero).then((i) => {
      if (!vivo) return;
      if (i) {
        setNome(i.nome);
        setValor(i.valor);
        setObservacao(i.observacao ?? '');
        setCor(i.cor);
      }
      setCarregando(false);
    });

    return () => {
      vivo = false;
    };
  }, [id]);

  async function salvar() {
    if (!nome.trim()) {
      setErroNome('Dê um nome (o banco ou corretora).');
      return;
    }
    setErroNome(null);

    const dados = {
      nome,
      valor,
      observacao: observacao.trim() || null,
      cor,
    };

    setSalvando(true);
    try {
      if (novo) await investimentosRepo.criar(dados);
      else if (idNumero != null) await investimentosRepo.atualizar(idNumero, dados);
      router.back();
    } catch (erro) {
      Alert.alert('Erro ao salvar', erro instanceof Error ? erro.message : String(erro));
    } finally {
      setSalvando(false);
    }
  }

  function confirmarExclusao() {
    Alert.alert('Excluir investimento', 'Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          if (idNumero == null) return;
          await investimentosRepo.excluir(idNumero);
          router.back();
        },
      },
    ]);
  }

  if (carregando) {
    return (
      <>
        <Stack.Screen options={{ title: 'Investimento' }} />
        <Carregando />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: novo ? 'Novo investimento' : 'Editar investimento' }} />
      <ScrollView
        style={e.tela}
        contentContainerStyle={[e.conteudo, { paddingBottom: espaco.xl + insets.bottom }]}
      >
        <Campo
          rotulo="Banco ou corretora"
          value={nome}
          onChangeText={setNome}
          placeholder="XP, Nubank, Rico…"
          autoFocus={novo}
          erro={erroNome}
        />

        <CampoValor rotulo="Valor investido" valor={valor} onChange={setValor} />

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
          <Rotulo>Cor no gráfico</Rotulo>
          <SeletorCor cor={cor} onChange={setCor} />
        </View>

        <Text style={e.ajuda}>
          Este valor não vem de lançamento nenhum — atualize aqui sempre que conferir
          o extrato. Investimentos não entram no saldo total do início.
        </Text>

        <View style={e.acoes}>
          <Botao titulo="Salvar" onPress={salvar} carregando={salvando} />
          {!novo ? (
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
    conteudo: { padding: espaco.lg },
    inputMultilinha: { minHeight: 80, textAlignVertical: 'top' },
    grupo: { marginBottom: espaco.lg },
    ajuda: { fontSize: 12, color: cores.textoFraco, marginTop: -espaco.sm, marginBottom: espaco.lg },
    acoes: { gap: espaco.sm },
  });
}
