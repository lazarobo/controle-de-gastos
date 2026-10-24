import { StyleSheet } from 'react-native';
import { useTema } from '../contexto/TemaContexto';
import { espaco, sombra } from '../utils/tema';
import { Tocavel } from './animacao';
import { Icone } from './Icone';

/**
 * Botao flutuante "+" das abas. Era copiado em tres telas, cada uma com o seu
 * estilo; aqui o tamanho, a sombra e o icone ficam iguais em todas.
 */
export function Fab({
  onPress,
  rotulo,
  cor,
}: {
  onPress: () => void;
  /** Lido pelo leitor de tela. */
  rotulo: string;
  /** Padrao: a cor primaria do tema. */
  cor?: string;
}) {
  const { cores } = useTema();
  return (
    <Tocavel
      style={[e.fab, sombra(cores, 3), { backgroundColor: cor ?? cores.primaria }]}
      onPress={onPress}
      accessibilityLabel={rotulo}
    >
      <Icone nome="mais" cor="#FFFFFF" tamanho={28} espessura={2.5} />
    </Tocavel>
  );
}

const e = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: espaco.lg,
    bottom: espaco.lg,
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
