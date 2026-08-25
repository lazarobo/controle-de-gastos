import { Text, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { cores } from '../../src/utils/tema';

function Icone({ glifo, cor }: { glifo: string; cor: ColorValue }) {
  return <Text style={{ fontSize: 20, color: cor }}>{glifo}</Text>;
}

export default function LayoutAbas() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: cores.primaria,
        tabBarInactiveTintColor: cores.textoFraco,
        headerStyle: { backgroundColor: cores.superficie },
        headerTitleStyle: { fontWeight: '700', color: cores.texto },
        tabBarStyle: { backgroundColor: cores.superficie, borderTopColor: cores.borda },
        sceneStyle: { backgroundColor: cores.fundo },
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
        name="ajustes"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color }) => <Icone glifo="⚙" cor={color} />,
        }}
      />
    </Tabs>
  );
}
