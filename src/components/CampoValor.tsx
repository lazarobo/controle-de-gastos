import { useMemo } from 'react';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { Rotulo } from './ui';
import { useTema } from '../contexto/TemaContexto';
import { espaco, raio, type Paleta } from '../utils/tema';
import { formatarValor } from '../utils/money';

interface Props {
  rotulo: string;
  /** Centavos. 0 mostra o placeholder "0,00". */
  valor: number;
  onChange: (centavos: number) => void;
  erro?: string | null;
  autoFocus?: boolean;
}

/**
 * Campo de valor no padrão de apps de banco: os dígitos entram pela direita e
 * empurram a vírgula, sem o usuário nunca precisar digitar "," ou ".".
 *
 * Mecanismo: o TextInput é controlado e sempre mostra o valor JÁ formatado
 * (ex. "12,34"). Cada tecla do usuário produz um `onChangeText` com o texto
 * inteiro pos-edicao; extraimos so os digitos dali (`replace(/\D/g, '')`) e
 * tratamos como os centavos acumulados. Apagar uma tecla reduz naturalmente a
 * contagem de digitos, entao o backspace "funciona sozinho" sem lógica extra -
 * a pontuação é decorativa, nunca faz parte do valor real.
 */
export function CampoValor({ rotulo, valor, onChange, erro, autoFocus }: Props) {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  const exibicao = valor > 0 ? formatarValor(valor) : '';

  function aoDigitar(texto: string) {
    const digitos = texto.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 10);
    onChange(digitos === '' ? 0 : parseInt(digitos, 10));
  }

  return (
    <View style={e.campo}>
      <Rotulo>{rotulo}</Rotulo>
      <View style={[e.caixa, erro ? e.caixaErro : null]}>
        <Text style={e.prefixo}>R$</Text>
        <TextInput
          value={exibicao}
          onChangeText={aoDigitar}
          keyboardType="number-pad"
          placeholder="0,00"
          placeholderTextColor={cores.textoFraco}
          autoFocus={autoFocus}
          style={e.input}
        />
      </View>
      {erro ? <Text style={e.mensagemErro}>{erro}</Text> : null}
    </View>
  );
}

function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
    campo: { marginBottom: espaco.lg },
    caixa: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: cores.superficie,
      borderWidth: 1,
      borderColor: cores.borda,
      borderRadius: raio.sm,
      paddingHorizontal: espaco.md,
    },
    caixaErro: { borderColor: cores.perigo },
    prefixo: { fontSize: 22, fontWeight: '700', color: cores.textoFraco, marginRight: espaco.sm },
    input: {
      flex: 1,
      paddingVertical: espaco.md,
      fontSize: 28,
      fontWeight: '700',
      color: cores.texto,
    },
    mensagemErro: { color: cores.perigo, fontSize: 12, marginTop: espaco.xs },
  });
}
