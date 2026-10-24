import { Pressable, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Icone, type NomeIcone } from '../../src/components/Icone';
import { usePrivacidade } from '../../src/contexto/PrivacidadeContexto';
import { useTema } from '../../src/contexto/TemaContexto';
import { espaco } from '../../src/utils/tema';

/**
 * Icone da aba: a aba ativa ganha uma "pilula" de fundo na cor primaria fraca,
 * no estilo Material 3 -- da para saber onde se esta sem ler o rotulo.
 */
function IconeAba({ nome, cor, ativa }: { nome: NomeIcone; cor: string; ativa: boolean }) {
  const { cores } = useTema();
  return (
    <View
      style={{
        width: 52,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ativa ? cores.primariaFraca : 'transparent',
      }}
    >
      <Icone nome={nome} cor={cor} tamanho={21} />
    </View>
  );
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
      <Icone nome={escuro ? 'lua' : 'sol'} cor={cores.texto} tamanho={21} />
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
      <Icone nome={ocultos ? 'olhoFechado' : 'olho'} cor={cores.texto} tamanho={21} />
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
        // Cabecalho da cor do fundo e sem sombra: o titulo flutua sobre a tela.
        headerStyle: { backgroundColor: cores.fundo },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800', fontSize: 20, color: cores.texto },
        headerTintColor: cores.texto,
        tabBarStyle: {
          backgroundColor: cores.superficie,
          borderTopWidth: 0,
          elevation: 12,
          // Sem `height` fixo: a biblioteca soma a area da barra de gestos do
          // Android, e uma altura fixa espremeria os icones contra ela.
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
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
          tabBarIcon: ({ color, focused }) => (
            <IconeAba nome="inicio" cor={String(color)} ativa={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="lancamentos"
        options={{
          title: 'Lançamentos',
          tabBarIcon: ({ color, focused }) => (
            <IconeAba nome="lista" cor={String(color)} ativa={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="relatorios"
        options={{
          title: 'Relatórios',
          tabBarIcon: ({ color, focused }) => (
            <IconeAba nome="relatorio" cor={String(color)} ativa={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="investimentos"
        options={{
          title: 'Investir',
          tabBarIcon: ({ color, focused }) => (
            <IconeAba nome="investir" cor={String(color)} ativa={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, focused }) => (
            <IconeAba nome="ajustes" cor={String(color)} ativa={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
