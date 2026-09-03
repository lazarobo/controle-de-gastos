import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTema } from '../contexto/TemaContexto';
import { espaco, PALETA, type Paleta } from '../utils/tema';

/**
 * Grade de cores compartilhada por conta e categoria. Antes cada formulario
 * desenhava a sua; com a paleta crescendo para 24 cores, duplicar o layout
 * significaria arrumar o espacamento em dois lugares toda vez.
 */
export function SeletorCor({
  cor,
  onChange,
}: {
  cor: string;
  onChange: (cor: string) => void;
}) {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);

  return (
    <View style={e.paleta}>
      {PALETA.map((c) => (
        <Pressable
          key={c}
          onPress={() => onChange(c)}
          accessibilityLabel={`Cor ${c}`}
          style={[e.amostra, { backgroundColor: c }, cor === c && e.amostraAtiva]}
        />
      ))}
    </View>
  );
}

function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
    paleta: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
    amostra: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 3,
      borderColor: 'transparent',
    },
    // Anel na cor do texto: funciona sobre qualquer cor da paleta, nos dois temas.
    amostraAtiva: { borderColor: cores.texto },
  });
}
