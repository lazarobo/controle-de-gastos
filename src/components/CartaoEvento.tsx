import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BarraProgresso, Tocavel } from './animacao';
import { useTema } from '../contexto/TemaContexto';
import { formatarMoeda } from '../utils/money';
import { formatarData } from '../utils/date';
import { espaco, raio, type Paleta } from '../utils/tema';
import type { EventoResumo } from '../types';

/** Cartao de evento com saldo e barra de gasto. Usado no Inicio e em Eventos. */
export function CartaoEvento({
  evento,
  onPress,
}: {
  evento: EventoResumo;
  onPress: () => void;
}) {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  const { conta, entrou, gasto, saldo } = evento;
  const estourou = saldo < 0;
  const periodo = formatarPeriodo(conta.data_inicio, conta.data_fim);

  return (
    <Tocavel onPress={onPress} style={[e.cartao, conta.ativo === 0 && e.encerrado]}>
      <View style={[e.faixa, { backgroundColor: conta.cor }]} />
      <View style={e.corpo}>
        <View style={e.linhaTopo}>
          <Text style={e.nome} numberOfLines={1}>
            {conta.nome}
          </Text>
          <Text style={[e.saldo, { color: estourou ? cores.despesa : cores.texto }]}>
            {formatarMoeda(saldo)}
          </Text>
        </View>
        <Text style={e.detalhe}>
          {periodo ? `${periodo} · ` : ''}gasto {formatarMoeda(gasto)} de {formatarMoeda(entrou)}
        </Text>
        <View style={e.barra}>
          <BarraProgresso
            fracao={entrou > 0 ? gasto / entrou : 0}
            cor={estourou ? cores.despesa : conta.cor}
            trilha={cores.superficieAlt}
          />
        </View>
      </View>
    </Tocavel>
  );
}

function formatarPeriodo(inicio: string | null, fim: string | null): string | null {
  const curta = (iso: string) => formatarData(iso).slice(0, 5);
  if (inicio && fim) return `${curta(inicio)} – ${curta(fim)}`;
  if (inicio) return `a partir de ${curta(inicio)}`;
  if (fim) return `até ${curta(fim)}`;
  return null;
}

function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
    cartao: {
      flexDirection: 'row',
      backgroundColor: cores.superficie,
      borderWidth: 1,
      borderColor: cores.borda,
      borderRadius: raio.md,
      overflow: 'hidden',
    },
    encerrado: { opacity: 0.6 },
    faixa: { width: 6 },
    corpo: { flex: 1, padding: espaco.md, gap: espaco.xs },
    linhaTopo: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
    nome: { flex: 1, fontSize: 16, fontWeight: '700', color: cores.texto },
    saldo: { fontSize: 16, fontWeight: '800' },
    detalhe: { fontSize: 12, color: cores.textoFraco },
    barra: { marginTop: espaco.xs },
  });
}
