import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { cores, espaco, raio } from '../utils/tema';

export function Cartao({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[e.cartao, style]}>{children}</View>;
}

export function Titulo({ children }: { children: ReactNode }) {
  return <Text style={e.titulo}>{children}</Text>;
}

export function Rotulo({ children }: { children: ReactNode }) {
  return <Text style={e.rotulo}>{children}</Text>;
}

export function TextoFraco({ children }: { children: ReactNode }) {
  return <Text style={e.textoFraco}>{children}</Text>;
}

export function Campo({
  rotulo,
  erro,
  ...props
}: TextInputProps & { rotulo: string; erro?: string | null }) {
  return (
    <View style={e.campo}>
      <Rotulo>{rotulo}</Rotulo>
      <TextInput
        {...props}
        placeholderTextColor={cores.textoFraco}
        style={[e.input, erro ? e.inputErro : null, props.style]}
      />
      {erro ? <Text style={e.mensagemErro}>{erro}</Text> : null}
    </View>
  );
}

export function Botao({
  titulo,
  onPress,
  variante = 'primaria',
  carregando = false,
  desabilitado = false,
}: {
  titulo: string;
  onPress: () => void;
  variante?: 'primaria' | 'secundaria' | 'perigo';
  carregando?: boolean;
  desabilitado?: boolean;
}) {
  const inativo = desabilitado || carregando;
  return (
    <Pressable
      onPress={onPress}
      disabled={inativo}
      style={({ pressed }) => [
        e.botao,
        variante === 'primaria' && e.botaoPrimaria,
        variante === 'secundaria' && e.botaoSecundaria,
        variante === 'perigo' && e.botaoPerigo,
        (pressed || inativo) && e.botaoInativo,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={variante === 'secundaria' ? cores.primaria : '#FFF'} />
      ) : (
        <Text
          style={[
            e.botaoTexto,
            variante === 'secundaria' && { color: cores.primaria },
          ]}
        >
          {titulo}
        </Text>
      )}
    </Pressable>
  );
}

/** Grupo de chips de selecao unica. */
export function Chips<T extends string | number>({
  itens,
  valor,
  onChange,
}: {
  itens: { valor: T; rotulo: string; cor?: string }[];
  valor: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View style={e.chips}>
      {itens.map((item) => {
        const ativo = item.valor === valor;
        return (
          <Pressable
            key={String(item.valor)}
            onPress={() => onChange(item.valor)}
            style={[
              e.chip,
              ativo && {
                backgroundColor: item.cor ?? cores.primaria,
                borderColor: item.cor ?? cores.primaria,
              },
            ]}
          >
            {item.cor && !ativo ? (
              <View style={[e.pontoCor, { backgroundColor: item.cor }]} />
            ) : null}
            <Text style={[e.chipTexto, ativo && e.chipTextoAtivo]}>{item.rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Vazio({ titulo, detalhe }: { titulo: string; detalhe?: string }) {
  return (
    <View style={e.vazio}>
      <Text style={e.vazioTitulo}>{titulo}</Text>
      {detalhe ? <Text style={e.textoFraco}>{detalhe}</Text> : null}
    </View>
  );
}

export function Carregando() {
  return (
    <View style={e.vazio}>
      <ActivityIndicator color={cores.primaria} />
    </View>
  );
}

const e = StyleSheet.create({
  cartao: {
    backgroundColor: cores.superficie,
    borderRadius: raio.md,
    padding: espaco.lg,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  titulo: { fontSize: 17, fontWeight: '700', color: cores.texto, marginBottom: espaco.sm },
  rotulo: {
    fontSize: 12,
    fontWeight: '600',
    color: cores.textoFraco,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: espaco.xs,
  },
  textoFraco: { fontSize: 13, color: cores.textoFraco },
  campo: { marginBottom: espaco.lg },
  input: {
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio.sm,
    paddingHorizontal: espaco.md,
    paddingVertical: espaco.md,
    fontSize: 16,
    color: cores.texto,
  },
  inputErro: { borderColor: cores.perigo },
  mensagemErro: { color: cores.perigo, fontSize: 12, marginTop: espaco.xs },
  botao: {
    borderRadius: raio.sm,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  botaoPrimaria: { backgroundColor: cores.primaria },
  botaoSecundaria: {
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.primaria,
  },
  botaoPerigo: { backgroundColor: cores.perigo },
  botaoInativo: { opacity: 0.6 },
  botaoTexto: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.xs,
    paddingHorizontal: espaco.md,
    paddingVertical: espaco.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
  },
  chipTexto: { fontSize: 14, color: cores.texto },
  chipTextoAtivo: { color: '#FFF', fontWeight: '700' },
  pontoCor: { width: 10, height: 10, borderRadius: 5 },
  vazio: { padding: espaco.xl, alignItems: 'center', gap: espaco.xs },
  vazioTitulo: { fontSize: 15, fontWeight: '600', color: cores.texto, textAlign: 'center' },
});
