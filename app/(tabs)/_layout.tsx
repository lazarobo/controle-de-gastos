import { Pressable, Text, View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { usePrivacidade } from '../../src/contexto/PrivacidadeContexto';
import { useTema } from '../../src/contexto/TemaContexto';
import { espaco } from '../../src/utils/tema';

function Icone({ glifo, cor }: { glifo: string; cor: ColorValue }) {
  return <Text style={{ fontSize: 20, color: cor }}>{glifo}</Text>;
}

/**
 * Alterna claro <-> escuro com um toque, pulando o modo 'sistema'. Fica no
 * cabeçalho de toda aba (screenOptions.headerRight) em vez de só em Ajustes,
 * porque é a ação mais frequente do trio de opções — a escolha completa
 * (incluindo "seguir o sistema") mora em Ajustes.
 */
function BotaoTema() {
  const { cores, escuro, definirModo } = useTema();
  return (
    <Pressable
      onPress={() => definirModo(escuro ? 'claro' : 'escuro')}
      hitSlop={12}
      style={{ paddingHorizontal: espaco.md }}
      accessibilityLabel={escuro ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
    >
      <Text style={{ fontSize: 20, color: cores.texto }}>{escuro ? '☾' : '☀'}</Text>
    </Pressable>
  );
}

/**
 * O "olhinho" dos apps de banco: esconde todo valor da tela de uma vez.
 * Fica ao lado do sol/lua porque as duas sao decisoes sobre ONDE voce esta
 * usando o app agora -- no escuro, ou perto de gente.
 */
function BotaoOlho() {
  const { cores } = useTema();
  const { ocultos, alternar } = usePrivacidade();
  return (
    <Pressable
      onPress={alternar}
      hitSlop={12}
      style={{ paddingHorizontal: espaco.sm }}
      accessibilityLabel={ocultos ? 'Mostrar valores' : 'Esconder valores'}
    >
      <Text style={{ fontSize: 19, color: cores.texto }}>{ocultos ? '⊘' : '◉'}</Text>
    </Pressable>
  );
}

export default function LayoutAbas() {
  const { cores } = useTema();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: cores.primaria,
        tabBarInactiveTintColor: cores.textoFraco,
        headerStyle: { backgroundColor: cores.superficie },
        headerTitleStyle: { fontWeight: '700', color: cores.texto },
        headerTintColor: cores.texto,
        tabBarStyle: { backgroundColor: cores.superficie, borderTopColor: cores.borda },
        sceneStyle: { backgroundColor: cores.fundo },
        // Troca de aba desliza em vez de piscar: o jeito mais barato de o app
        // inteiro parecer menos estatico, sem tocar em nenhuma tela.
        animation: 'shift',
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <BotaoOlho />
            <BotaoTema />
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color }) => <Icone glifo="◉" cor={color} />,
        }}
      />
      <Tabs.Screen
        name="lancamentos"
        options={{
          title: 'Lançamentos',
          tabBarIcon: ({ color }) => <Icone glifo="≡" cor={color} />,
        }}
      />
      <Tabs.Screen
        name="relatorios"
        options={{
          title: 'Relatórios',
          tabBarIcon: ({ color }) => <Icone glifo="◑" cor={color} />,
        }}
      />
      <Tabs.Screen
        name="investimentos"
        options={{
          title: 'Investir',
          tabBarIcon: ({ color }) => <Icone glifo="▲" cor={color} />,
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color }) => <Icone glifo="⚙" cor={color} />,
        }}
      />
    </Tabs>
  );
}
