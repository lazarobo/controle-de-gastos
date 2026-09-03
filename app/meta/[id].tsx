import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao, Carregando, Chips, Rotulo, Vazio } from '../../src/components/ui';
import { CampoValor } from '../../src/components/CampoValor';
import * as metasRepo from '../../src/repos/metas';
import { useTema } from '../../src/contexto/TemaContexto';
import { espaco, type Paleta } from '../../src/utils/tema';

interface CategoriaOpcao {
  id: number;
  nome: string;
  cor: string;
}

export default function FormularioMeta() {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const nova = id === 'nova';
  const idNumero = nova ? null : Number(id);
  const router = useRouter();

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [opcoes, setOpcoes] = useState<CategoriaOpcao[]>([]);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [categoriaNome, setCategoriaNome] = useState('');
  const [valor, setValor] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;

    (async () => {
      if (nova) {
        const disponiveis = await metasRepo.categoriasSemMeta();
        if (!vivo) return;
        setOpcoes(disponiveis);
        setCategoriaId(disponiveis[0]?.id ?? null);
      } else if (idNumero != null) {
        const [meta, todas] = await Promise.all([
          metasRepo.obter(idNumero),
          metasRepo.listar(),
        ]);
        if (!vivo) return;
        if (!meta) {
          Alert.alert('Meta não encontrada', undefined, [
            { text: 'Voltar', onPress: () => router.back() },
          ]);
          return;
        }
        setCategoriaId(meta.categoria_id);
        setValor(meta.valor);
        setCategoriaNome(
          todas.find((m) => m.id === idNumero)?.categoria_nome ?? '',
        );
      }
      if (vivo) setCarregando(false);
    })();

    return () => {
      vivo = false;
    };
  }, [id]);

  async function salvar() {
    if (categoriaId == null) {
      setErro('Escolha uma categoria.');
      return;
    }
    if (valor <= 0) {
      setErro('Informe um teto mensal maior que zero.');
      return;
    }
    setErro(null);

    setSalvando(true);
    try {
      await metasRepo.definir(categoriaId, valor);
      router.back();
    } catch (err) {
      Alert.alert('Erro ao salvar', err instanceof Error ? err.message : String(err));
    } finally {
      setSalvando(false);
    }
  }

  function confirmarExclusao() {
    Alert.alert('Excluir meta', 'Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          if (idNumero == null) return;
          await metasRepo.excluir(idNumero);
          router.back();
        },
      },
    ]);
  }

  if (carregando) {
    return (
      <>
        <Stack.Screen options={{ title: 'Meta' }} />
        <Carregando />
      </>
    );
  }

  if (nova && opcoes.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Nova meta' }} />
        <Vazio
          titulo="Todas as categorias de despesa já têm meta"
          detalhe="Edite uma meta existente ou cadastre uma categoria nova primeiro."
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: nova ? 'Nova meta' : 'Editar meta' }} />
      <ScrollView
        style={e.tela}
        contentContainerStyle={[e.conteudo, { paddingBottom: espaco.xl + insets.bottom }]}
      >
        <View style={e.grupo}>
          <Rotulo>Categoria</Rotulo>
          {nova ? (
            <Chips
              itens={opcoes.map((o) => ({ valor: o.id, rotulo: o.nome, cor: o.cor }))}
              valor={categoriaId}
              onChange={setCategoriaId}
            />
          ) : (
            <Text style={e.categoriaFixa}>{categoriaNome}</Text>
          )}
        </View>

        <CampoValor
          rotulo="Teto mensal"
          valor={valor}
          onChange={setValor}
          autoFocus={!nova}
          erro={erro}
        />

        <Text style={e.ajuda}>
          Vale todo mês, até você mudar. Em Relatórios você vê o quanto já gastou
          da categoria comparado a este teto.
        </Text>

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
    conteudo: { padding: espaco.lg },
    grupo: { marginBottom: espaco.lg },
    categoriaFixa: { fontSize: 16, fontWeight: '600', color: cores.texto },
    ajuda: { fontSize: 12, color: cores.textoFraco, marginTop: -espaco.sm, marginBottom: espaco.lg },
    acoes: { gap: espaco.sm },
  });
}
