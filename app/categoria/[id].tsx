import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao, Campo, Carregando, Chips, Rotulo } from '../../src/components/ui';
import * as categoriasRepo from '../../src/repos/categorias';
import { useTema } from '../../src/contexto/TemaContexto';
import { espaco, PALETA, raio, type Paleta } from '../../src/utils/tema';
import type { TipoMovimento } from '../../src/types';

export default function FormularioCategoria() {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  const insets = useSafeAreaInsets();
  const { id, tipo: tipoInicial } = useLocalSearchParams<{ id: string; tipo?: string }>();
  const nova = id === 'nova';
  const idNumero = nova ? null : Number(id);
  const router = useRouter();

  const [carregando, setCarregando] = useState(!nova);
  const [salvando, setSalvando] = useState(false);
  const [sistema, setSistema] = useState(false);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoMovimento>(
    tipoInicial === 'receita' ? 'receita' : 'despesa',
  );
  const [cor, setCor] = useState(PALETA[0]);
  const [erroNome, setErroNome] = useState<string | null>(null);

  useEffect(() => {
    if (nova || idNumero == null) return;
    let vivo = true;

    categoriasRepo.obter(idNumero).then((c) => {
      if (!vivo) return;
      if (c) {
        setNome(c.nome);
        setTipo(c.tipo);
        setCor(c.cor);
        setSistema(c.sistema === 1);
      }
      setCarregando(false);
    });

    return () => {
      vivo = false;
    };
  }, [id]);

  async function salvar() {
    if (!sistema && !nome.trim()) {
      setErroNome('Dê um nome à categoria.');
      return;
    }
    setErroNome(null);

    setSalvando(true);
    try {
      if (nova) await categoriasRepo.criar({ nome, tipo, cor });
      else if (idNumero != null) await categoriasRepo.atualizar(idNumero, { nome, tipo, cor });
      router.back();
    } catch (erro) {
      setErroNome(erro instanceof Error ? erro.message : String(erro));
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    if (idNumero == null) return;

    const usos = await categoriasRepo.contarLancamentos(idNumero);
    const aviso =
      usos > 0
        ? `${usos} lançamento(s) usam esta categoria. Eles NÃO serão apagados: passarão ` +
          'a aparecer como "Sem categoria" e continuarão somando nos totais.'
        : 'Esta ação não pode ser desfeita.';

    Alert.alert('Excluir categoria', aviso, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await categoriasRepo.excluir(idNumero);
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
        <Stack.Screen options={{ title: 'Categoria' }} />
        <Carregando />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: nova ? 'Nova categoria' : 'Editar categoria' }} />
      <ScrollView
        style={e.tela}
        contentContainerStyle={[e.conteudo, { paddingBottom: espaco.xl + insets.bottom }]}
      >
        {sistema ? (
          <View style={e.avisoSistema}>
            <Text style={e.avisoSistemaTexto}>
              "{nome}" é uma categoria do sistema: ela sustenta a correção de saldo por
              lançamento de ajuste. Só a cor pode ser alterada.
            </Text>
          </View>
        ) : null}

        <Campo
          rotulo="Nome"
          value={nome}
          onChangeText={setNome}
          placeholder="Mercado, Uber, Academia…"
          autoFocus={nova}
          editable={!sistema}
          erro={erroNome}
        />

        <View style={e.grupo}>
          <Rotulo>Tipo</Rotulo>
          {sistema ? (
            <Text style={e.ajuda}>{tipo === 'receita' ? 'Receita' : 'Despesa'}</Text>
          ) : (
            <Chips
              itens={[
                { valor: 'despesa', rotulo: 'Despesa', cor: cores.despesa },
                { valor: 'receita', rotulo: 'Receita', cor: cores.receita },
              ]}
              valor={tipo}
              onChange={(v) => setTipo(v as TipoMovimento)}
            />
          )}
        </View>

        <View style={e.grupo}>
          <Rotulo>Cor no gráfico</Rotulo>
          <View style={e.paleta}>
            {PALETA.map((c) => (
              <Pressable
                key={c}
                onPress={() => setCor(c)}
                style={[e.amostra, { backgroundColor: c }, cor === c && e.amostraAtiva]}
              />
            ))}
          </View>
        </View>

        <View style={e.acoes}>
          <Botao titulo="Salvar" onPress={salvar} carregando={salvando} />
          {!nova && !sistema ? (
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
    ajuda: { fontSize: 14, color: cores.textoFraco },
    avisoSistema: {
      backgroundColor: cores.primariaFraca,
      borderRadius: raio.sm,
      padding: espaco.md,
      marginBottom: espaco.lg,
    },
    avisoSistemaTexto: { fontSize: 13, color: cores.texto, lineHeight: 18 },
    paleta: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
    amostra: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: 'transparent' },
    amostraAtiva: { borderColor: cores.texto },
    acoes: { gap: espaco.sm, marginTop: espaco.lg },
  });
}
