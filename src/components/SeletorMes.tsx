import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatarMes, mesAtual, mesesIguais, somarMeses, type Mes } from '../utils/date';
import { useTema } from '../contexto/TemaContexto';
import { espaco, raio, type Paleta } from '../utils/tema';

export function SeletorMes({
  mes,
  onChange,
}: {
  mes: Mes;
  onChange: (m: Mes) => void;
}) {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  const hoje = mesAtual();
  const noMesAtual = mesesIguais(mes, hoje);

  return (
    <View style={e.barra}>
      <Pressable
        onPress={() => onChange(somarMeses(mes, -1))}
        hitSlop={12}
        style={e.seta}
      >
        <Text style={e.setaTexto}>‹</Text>
      </Pressable>

      <Pressable onPress={() => onChange(hoje)} disabled={noMesAtual} style={e.centro}>
        <Text style={e.mes}>{formatarMes(mes)}</Text>
        {!noMesAtual ? <Text style={e.voltar}>tocar para voltar ao mês atual</Text> : null}
      </Pressable>

      <Pressable
        onPress={() => onChange(somarMeses(mes, 1))}
        hitSlop={12}
        style={e.seta}
      >
        <Text style={e.setaTexto}>›</Text>
      </Pressable>
    </View>
  );
}

function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
    barra: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: cores.superficie,
      borderRadius: raio.md,
      borderWidth: 1,
      borderColor: cores.borda,
      paddingHorizontal: espaco.sm,
      paddingVertical: espaco.sm,
    },
    seta: { paddingHorizontal: espaco.md, paddingVertical: espaco.xs },
    setaTexto: { fontSize: 26, lineHeight: 30, color: cores.primaria, fontWeight: '700' },
    centro: { flex: 1, alignItems: 'center' },
    mes: { fontSize: 16, fontWeight: '700', color: cores.texto, textTransform: 'capitalize' },
    voltar: { fontSize: 11, color: cores.primaria, marginTop: 2 },
  });
}
