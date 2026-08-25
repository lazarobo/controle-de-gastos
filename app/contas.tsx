import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { Carregando, Vazio } from '../src/components/ui';
import { useConsulta } from '../src/hooks/useConsulta';
import * as contasRepo from '../src/repos/contas';
import { formatarMoeda } from '../src/utils/money';
import { cores, espaco, raio } from '../src/utils/tema';
import { TIPOS_CONTA } from '../src/types';

const ROTULO_TIPO = Object.fromEntries(TIPOS_CONTA.map((t) => [t.valor, t.rotulo]));

export default function ListaContas() {
  const router = useRouter();
  // Inclui inativas: esta e a unica tela onde elas podem ser reativadas.
  const { dados, carregando } = useConsulta(() => contasRepo.saldos(true));

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Contas',
          headerRight: () => (
            <Pressable onPress={() => router.push('/conta/nova')} hitSlop={12}>
              <Text style={e.novo}>Nova</Text>
            </Pressable>
          ),
        }}
      />
      <FlatList
        style={e.tela}
        contentContainerStyle={e.conteudo}
        data={dados ?? []}
        keyExtractor={(item) => String(item.conta.id)}
        ListEmptyComponent={
          carregando ? (
            <Carregando />
          ) : (
            <Vazio
              titulo="Nenhuma conta cadastrada"
              detalhe="Toque em Nova para cadastrar onde seu dinheiro fica."
            />
          )
        }
        renderItem={({ item: { conta, saldo } }) => (
          <Pressable style={e.item} onPress={() => router.push(`/conta/${conta.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={[e.nome, conta.ativo === 0 && e.inativa]} numberOfLines={1}>
                {conta.nome}
                {conta.ativo === 0 ? '  (inativa)' : ''}
              </Text>
              <Text style={e.tipo}>{ROTULO_TIPO[conta.tipo] ?? conta.tipo}</Text>
            </View>
            <Text style={[e.saldo, { color: saldo < 0 ? cores.despesa : cores.texto }]}>
              {formatarMoeda(saldo)}
            </Text>
          </Pressable>
        )}
      />
    </>
  );
}

const e = StyleSheet.create({
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
  nome: { fontSize: 15, fontWeight: '600', color: cores.texto },
  inativa: { color: cores.textoFraco },
  tipo: { fontSize: 12, color: cores.textoFraco, marginTop: 2 },
  saldo: { fontSize: 15, fontWeight: '700' },
});
