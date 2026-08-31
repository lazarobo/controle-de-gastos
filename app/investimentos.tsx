import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { Cartao, Carregando, Vazio } from '../src/components/ui';
import { useConsulta } from '../src/hooks/useConsulta';
import { useTema } from '../src/contexto/TemaContexto';
import * as investimentosRepo from '../src/repos/investimentos';
import { formatarMoeda } from '../src/utils/money';
import { formatarData } from '../src/utils/date';
import { espaco, raio, type Paleta } from '../src/utils/tema';
import type { Investimento } from '../src/types';

interface Dados {
  itens: Investimento[];
  total: number;
}

export default function ListaInvestimentos() {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  const router = useRouter();

  const { dados, carregando } = useConsulta<Dados>(async () => {
    const [itens, total] = await Promise.all([
      investimentosRepo.listar(),
      investimentosRepo.total(),
    ]);
    return { itens, total };
  });

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Investimentos',
          headerRight: () => (
            <Pressable onPress={() => router.push('/investimento/novo')} hitSlop={12}>
              <Text style={e.novo}>Novo</Text>
            </Pressable>
          ),
        }}
      />
      <FlatList
        style={e.tela}
        contentContainerStyle={e.conteudo}
        data={dados?.itens ?? []}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          dados && dados.itens.length > 0 ? (
            <Cartao style={e.cartaoTotal}>
              <Text style={e.rotuloTotal}>Total investido</Text>
              <Text style={e.valorTotal}>{formatarMoeda(dados.total)}</Text>
              <Text style={e.aviso}>Não entra no saldo total do início.</Text>
            </Cartao>
          ) : null
        }
        ListEmptyComponent={
          carregando ? (
            <Carregando />
          ) : (
            <Vazio
              titulo="Nenhum investimento cadastrado"
              detalhe="Toque em Novo para registrar quanto você tem em cada banco."
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable style={e.item} onPress={() => router.push(`/investimento/${item.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={e.nome} numberOfLines={1}>
                {item.nome}
              </Text>
              <Text style={e.atualizado}>
                Atualizado em {formatarData(item.atualizado_em.slice(0, 10))}
              </Text>
            </View>
            <Text style={e.valor}>{formatarMoeda(item.valor)}</Text>
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
    cartaoTotal: { marginBottom: espaco.lg },
    rotuloTotal: {
      fontSize: 12,
      fontWeight: '600',
      color: cores.textoFraco,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    valorTotal: { fontSize: 26, fontWeight: '800', color: cores.texto, marginTop: espaco.xs },
    aviso: { fontSize: 11, color: cores.textoFraco, marginTop: 2 },
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
    nome: { fontSize: 15, fontWeight: '600', color: cores.texto },
    atualizado: { fontSize: 12, color: cores.textoFraco, marginTop: 2 },
    valor: { fontSize: 15, fontWeight: '700', color: cores.texto },
  });
}
