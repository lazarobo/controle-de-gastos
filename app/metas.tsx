import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { Carregando, Vazio } from '../src/components/ui';
import { useConsulta } from '../src/hooks/useConsulta';
import { useTema } from '../src/contexto/TemaContexto';
import * as metasRepo from '../src/repos/metas';
import { formatarMoeda } from '../src/utils/money';
import { espaco, raio, type Paleta } from '../src/utils/tema';

export default function ListaMetas() {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  const router = useRouter();
  const { dados, carregando } = useConsulta(() => metasRepo.listar());

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Metas',
          headerRight: () => (
            <Pressable onPress={() => router.push('/meta/nova')} hitSlop={12}>
              <Text style={e.novo}>Nova</Text>
            </Pressable>
          ),
        }}
      />
      <FlatList
        style={e.tela}
        contentContainerStyle={e.conteudo}
        data={dados ?? []}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={
          carregando ? (
            <Carregando />
          ) : (
            <Vazio
              titulo="Nenhuma meta cadastrada"
              detalhe="Toque em Nova para definir um teto mensal de gasto por categoria."
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable style={e.item} onPress={() => router.push(`/meta/${item.id}`)}>
            <View style={[e.ponto, { backgroundColor: item.categoria_cor }]} />
            <Text style={e.nome} numberOfLines={1}>
              {item.categoria_nome}
            </Text>
            <Text style={e.valor}>{formatarMoeda(item.valor)}/mês</Text>
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
    valor: { fontSize: 14, fontWeight: '700', color: cores.texto },
  });
}
