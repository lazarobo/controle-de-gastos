import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { obterDb } from '../src/db';
import { cores, espaco } from '../src/utils/tema';

/**
 * O banco abre (e migra, e semeia) uma unica vez aqui, antes de qualquer tela
 * montar. Sem essa barreira as telas correriam para consultar tabelas que ainda
 * nao existem na primeira execucao.
 */
export default function LayoutRaiz() {
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    obterDb()
      .then(() => setPronto(true))
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : String(e)));
  }, []);

  if (erro) {
    return (
      <View style={e.centro}>
        <Text style={e.tituloErro}>Não foi possível abrir o banco de dados</Text>
        <Text style={e.detalheErro}>{erro}</Text>
      </View>
    );
  }

  if (!pronto) {
    return (
      <View style={e.centro}>
        <ActivityIndicator color={cores.primaria} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: cores.superficie },
          headerTintColor: cores.texto,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: cores.fundo },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="lancamento/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="conta/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="categoria/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="contas" options={{ title: 'Contas' }} />
        <Stack.Screen name="categorias" options={{ title: 'Categorias' }} />
      </Stack>
    </SafeAreaProvider>
  );
}

const e = StyleSheet.create({
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: espaco.xl,
    gap: espaco.sm,
    backgroundColor: cores.fundo,
  },
  tituloErro: { fontSize: 16, fontWeight: '700', color: cores.texto, textAlign: 'center' },
  detalheErro: { fontSize: 13, color: cores.textoFraco, textAlign: 'center' },
});
