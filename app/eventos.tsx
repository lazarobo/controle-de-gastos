import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { Aparecer } from '../src/components/animacao';
import { CartaoEvento } from '../src/components/CartaoEvento';
import { Carregando, Titulo, Vazio } from '../src/components/ui';
import { useConsulta } from '../src/hooks/useConsulta';
import { useTema } from '../src/contexto/TemaContexto';
import * as eventosRepo from '../src/repos/eventos';
import { espaco, type Paleta } from '../src/utils/tema';

export default function ListaEventos() {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  const router = useRouter();
  const { dados, carregando } = useConsulta(() => eventosRepo.listar(true));

  const ativos = (dados ?? []).filter((ev) => ev.conta.ativo === 1);
  const encerrados = (dados ?? []).filter((ev) => ev.conta.ativo === 0);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Eventos',
          headerRight: () => (
            <Pressable onPress={() => router.push('/evento/novo')} hitSlop={12}>
              <Text style={e.novo}>Novo</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView style={e.tela} contentContainerStyle={e.conteudo}>
        {carregando && !dados ? (
          <Carregando />
        ) : (dados ?? []).length === 0 ? (
          <Vazio
            titulo="Nenhum evento"
            detalhe="Viagem, show, casamento: crie um evento, separe o dinheiro nele e lance os gastos a partir dele."
          />
        ) : (
          <>
            {ativos.map((ev, i) => (
              <Aparecer key={ev.conta.id} atraso={i * 60}>
                <CartaoEvento evento={ev} onPress={() => router.push(`/evento/${ev.conta.id}`)} />
              </Aparecer>
            ))}

            {encerrados.length > 0 ? (
              <>
                <Titulo>Encerrados</Titulo>
                {encerrados.map((ev) => (
                  <CartaoEvento
                    key={ev.conta.id}
                    evento={ev}
                    onPress={() => router.push(`/evento/${ev.conta.id}`)}
                  />
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </>
  );
}

function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
    tela: { flex: 1, backgroundColor: cores.fundo },
    conteudo: { padding: espaco.lg, gap: espaco.md, paddingBottom: espaco.xl },
    novo: { color: cores.primaria, fontSize: 15, fontWeight: '700' },
  });
}
