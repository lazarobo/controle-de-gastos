import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { Aparecer, NumeroAnimado, Tocavel } from '../src/components/animacao';
import { Avatar } from '../src/components/Avatar';
import { CartaoDestaque } from '../src/components/CartaoDestaque';
import { Carregando, Vazio } from '../src/components/ui';
import { useConsulta } from '../src/hooks/useConsulta';
import { useTema } from '../src/contexto/TemaContexto';
import * as contasRepo from '../src/repos/contas';
import { useMoeda } from '../src/contexto/PrivacidadeContexto';
import { espaco, raio, type Paleta } from '../src/utils/tema';
import { TIPOS_CONTA } from '../src/types';

const ROTULO_TIPO = Object.fromEntries(TIPOS_CONTA.map((t) => [t.valor, t.rotulo]));

/** Cor que a migration 6 deu as contas que ja existiam. */
const COR_PADRAO = '#546E7A';

export default function ListaContas() {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  const formatarMoeda = useMoeda();
  const router = useRouter();
  // Inclui inativas: esta e a unica tela onde elas podem ser reativadas.
  const { dados, carregando } = useConsulta(() => contasRepo.saldos(true));

  // Eventos tambem sao contas (migration 8), mas tem tela propria em
  // Ajustes › Eventos; aqui ficam so as contas do dia a dia.
  const contas = (dados ?? []).filter((s) => s.conta.tipo !== 'evento');
  const ativas = contas.filter((s) => s.conta.ativo === 1);
  const total = ativas.reduce((soma, s) => soma + s.saldo, 0);

  // Quem ja usava o app antes da migration 6 tem todas as contas no mesmo
  // cinza. Em vez de recolorir por conta propria (seria mexer em escolha do
  // usuario sem pedir), a tela avisa que da para escolher.
  const tudoCinza = contas.length > 1 && contas.every((s) => s.conta.cor === COR_PADRAO);

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
      <ScrollView style={e.tela} contentContainerStyle={e.conteudo}>
        {carregando && !dados ? (
          <Carregando />
        ) : contas.length === 0 ? (
          <Vazio
            titulo="Nenhuma conta cadastrada"
            detalhe="Toque em Nova para cadastrar onde seu dinheiro fica."
          />
        ) : (
          <>
            <Aparecer>
              <CartaoDestaque de={cores.gradienteA} para={cores.gradienteB} idGradiente="contas">
                <Text style={e.rotuloDestaque}>Em {ativas.length} contas ativas</Text>
                <NumeroAnimado centavos={total} style={e.total} />
                {/* Faixa proporcional: cada conta ocupa sua fatia do total, na sua cor. */}
                {total > 0 ? (
                  <View style={e.faixa}>
                    {ativas
                      .filter((s) => s.saldo > 0)
                      .map((s) => (
                        <View
                          key={s.conta.id}
                          style={{ flex: s.saldo, backgroundColor: s.conta.cor }}
                        />
                      ))}
                  </View>
                ) : null}
              </CartaoDestaque>
            </Aparecer>

            {tudoCinza ? (
              <Aparecer atraso={60}>
                <View style={[e.dica, { borderColor: cores.primaria + '66' }]}>
                  <Text style={e.dicaTexto}>
                    Suas contas estão todas na mesma cor. Toque em uma para escolher a cor
                    dela — fica mais fácil de achar no Início e nos gráficos.
                  </Text>
                </View>
              </Aparecer>
            ) : null}

            {contas.map(({ conta, saldo }, i) => (
              <Aparecer key={conta.id} atraso={100 + i * 40}>
                <Tocavel
                  style={[e.item, conta.ativo === 0 && e.inativa]}
                  onPress={() => router.push(`/conta/${conta.id}`)}
                >
                  <Avatar nome={conta.nome} cor={conta.cor} />
                  <View style={{ flex: 1 }}>
                    <Text style={e.nome} numberOfLines={1}>
                      {conta.nome}
                    </Text>
                    <Text style={e.tipo}>
                      {ROTULO_TIPO[conta.tipo] ?? conta.tipo}
                      {conta.ativo === 0 ? ' · inativa' : ''}
                    </Text>
                  </View>
                  <Text style={[e.saldo, { color: saldo < 0 ? cores.despesa : cores.texto }]}>
                    {formatarMoeda(saldo)}
                  </Text>
                </Tocavel>
              </Aparecer>
            ))}
          </>
        )}
      </ScrollView>
    </>
  );
}

function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
    tela: { flex: 1, backgroundColor: cores.fundo },
    conteudo: { padding: espaco.lg, gap: espaco.sm, paddingBottom: espaco.xl },
    novo: { color: cores.primaria, fontSize: 15, fontWeight: '700' },
    rotuloDestaque: {
      fontSize: 12,
      fontWeight: '600',
      color: cores.sobreDestaque,
      opacity: 0.8,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    total: { fontSize: 30, fontWeight: '800', color: cores.sobreDestaque, marginTop: espaco.xs },
    faixa: {
      flexDirection: 'row',
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
      marginTop: espaco.md,
      gap: 2,
    },
    dica: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderRadius: raio.md,
      padding: espaco.md,
      backgroundColor: cores.primariaFraca,
    },
    dicaTexto: { fontSize: 13, color: cores.texto, lineHeight: 18 },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      backgroundColor: cores.superficie,
      borderWidth: 1,
      borderColor: cores.borda,
      borderRadius: raio.md,
      padding: espaco.md,
    },
    inativa: { opacity: 0.55 },
    nome: { fontSize: 15, fontWeight: '600', color: cores.texto },
    tipo: { fontSize: 12, color: cores.textoFraco, marginTop: 2 },
    saldo: { fontSize: 15, fontWeight: '700' },
  });
}
