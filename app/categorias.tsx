import { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { Carregando, Vazio } from '../src/components/ui';
import { useConsulta } from '../src/hooks/useConsulta';
import { useTema } from '../src/contexto/TemaContexto';
import * as categoriasRepo from '../src/repos/categorias';
import { espaco, raio, type Paleta } from '../src/utils/tema';
import type { Categoria } from '../src/types';

export default function ListaCategorias() {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  const router = useRouter();
  const { dados, carregando } = useConsulta(() => categoriasRepo.listar());

  const secoes = useMemo(() => {
    const despesas = (dados ?? []).filter((c) => c.tipo === 'despesa');
    const receitas = (dados ?? []).filter((c) => c.tipo === 'receita');
    return [
      { title: 'Despesas', data: despesas },
      { title: 'Receitas', data: receitas },
    ].filter((s) => s.data.length > 0);
  }, [dados]);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Categorias',
          headerRight: () => (
            <Pressable onPress={() => router.push('/categoria/nova')} hitSlop={12}>
              <Text style={e.novo}>Nova</Text>
            </Pressable>
          ),
        }}
      />
      <SectionList<Categoria>
        style={e.tela}
        contentContainerStyle={e.conteudo}
        sections={secoes}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={carregando ? <Carregando /> : <Vazio titulo="Nenhuma categoria" />}
        renderSectionHeader={({ section }) => (
          <Text style={e.secao}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <Pressable style={e.item} onPress={() => router.push(`/categoria/${item.id}`)}>
            <View style={[e.ponto, { backgroundColor: item.cor }]} />
            <Text style={e.nome} numberOfLines={1}>
              {item.nome}
            </Text>
            {item.sistema === 1 ? <Text style={e.tag}>sistema</Text> : null}
          </Pressable>
        )}
      />
    </>
  );
}

function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
    tela: { flex: 1, backgroundColor: cores.fundo },
    conteudo: { padding: espaco.lg },
    novo: { color: cores.primaria, fontSize: 15, fontWeight: '700' },
    secao: {
      fontSize: 13,
      fontWeight: '700',
      color: cores.textoFraco,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: espaco.lg,
      marginBottom: espaco.sm,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      backgroundColor: cores.superficie,
      borderWidth: 1,
      borderColor: cores.borda,
      borderRadius: raio.md,
      padding: espaco.md,
      marginBottom: espaco.sm,
    },
    ponto: { width: 14, height: 14, borderRadius: 7 },
    nome: { flex: 1, fontSize: 15, color: cores.texto },
    tag: {
      fontSize: 10,
      color: cores.textoFraco,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
  });
}
