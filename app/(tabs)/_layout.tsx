import { Pressable, Text, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
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
        headerRight: () => <BotaoTema />,
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
