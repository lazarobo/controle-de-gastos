import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { obterDb } from '../src/db';
import { sincronizarLembretes } from '../src/servicos/notificacoes';
import { PrivacidadeProvider } from '../src/contexto/PrivacidadeContexto';
import { TemaProvider, useTema } from '../src/contexto/TemaContexto';
import { espaco, type Paleta } from '../src/utils/tema';

/**
 * O banco abre (e migra, e semeia) uma unica vez aqui, antes de qualquer tela
 * montar. Sem essa barreira as telas correriam para consultar tabelas que ainda
 * nao existem na primeira execucao.
 *
 * TemaProvider fica FORA do gate de carregamento, envolvendo até a tela de
 * loading/erro — sem isso a primeira tela apareceria sempre clara e só
 * escureceria depois que o banco abrisse, um flash branco visível no modo
 * escuro.
 */
export default function LayoutRaiz() {
  return (
    <TemaProvider>
      <PrivacidadeProvider>
        <ConteudoRaiz />
      </PrivacidadeProvider>
    </TemaProvider>
  );
}

function ConteudoRaiz() {
  const { cores, escuro } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);

  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    obterDb()
      .then(() => {
        setPronto(true);
        // Reagenda a cada abertura: e isso que faz o lembrete diario pular o
        // dia em que voce ja lancou, sem precisar de tarefa em segundo plano.
        // Nao e aguardado -- a tela nao espera notificacao para aparecer.
        void sincronizarLembretes();
      })
      .catch((err: unknown) => setErro(err instanceof Error ? err.message : String(err)));
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
      <StatusBar style={escuro ? 'light' : 'dark'} />
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
        <Stack.Screen name="investimento/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="meta/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="evento/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="contas" options={{ title: 'Contas' }} />
        <Stack.Screen name="categorias" options={{ title: 'Categorias' }} />
        <Stack.Screen name="metas" options={{ title: 'Metas' }} />
        <Stack.Screen name="eventos" options={{ title: 'Eventos' }} />
      </Stack>
    </SafeAreaProvider>
  );
}

function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
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
}
