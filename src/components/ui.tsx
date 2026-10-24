import { ReactNode, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { useTema } from '../contexto/TemaContexto';
import { luminancia } from '../utils/cor';
import { espaco, raio, sombra, type Paleta } from '../utils/tema';
import { Icone, type NomeIcone } from './Icone';

export function Cartao({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const e = useEstilos();
  return <View style={[e.cartao, style]}>{children}</View>;
}

export function Titulo({ children }: { children: ReactNode }) {
  const e = useEstilos();
  return <Text style={e.titulo}>{children}</Text>;
}

export function Rotulo({ children }: { children: ReactNode }) {
  const e = useEstilos();
  return <Text style={e.rotulo}>{children}</Text>;
}

export function TextoFraco({ children }: { children: ReactNode }) {
  const e = useEstilos();
  return <Text style={e.textoFraco}>{children}</Text>;
}

/**
 * Campo preenchido (fundo levemente mais escuro, sem borda) que ganha borda na
 * cor primaria enquanto tem foco -- e assim que se ve qual campo o teclado
 * esta editando sem procurar o cursor.
 */
export function Campo({
  rotulo,
  erro,
  ...props
}: TextInputProps & { rotulo: string; erro?: string | null }) {
  const { cores } = useTema();
  const e = useEstilos();
  const [foco, setFoco] = useState(false);
  return (
    <View style={e.campo}>
      <Rotulo>{rotulo}</Rotulo>
      <TextInput
        {...props}
        onFocus={(ev) => {
          setFoco(true);
          props.onFocus?.(ev);
        }}
        onBlur={(ev) => {
          setFoco(false);
          props.onBlur?.(ev);
        }}
        placeholderTextColor={cores.textoFraco}
        style={[e.input, foco && e.inputFoco, erro ? e.inputErro : null, props.style]}
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
  icone,
}: {
  titulo: string;
  onPress: () => void;
  variante?: 'primaria' | 'secundaria' | 'perigo';
  carregando?: boolean;
  desabilitado?: boolean;
  icone?: NomeIcone;
}) {
  const { cores } = useTema();
  const e = useEstilos();
  const inativo = desabilitado || carregando;
  const corTexto =
    variante === 'secundaria' ? cores.primaria : variante === 'perigo' ? cores.perigo : '#FFFFFF';
  return (
    <Pressable
      onPress={onPress}
      disabled={inativo}
      style={({ pressed }) => [
        e.botao,
        variante === 'primaria' && e.botaoPrimaria,
        variante === 'secundaria' && e.botaoSecundaria,
        variante === 'perigo' && e.botaoPerigo,
        pressed && e.botaoPressionado,
        inativo && e.botaoInativo,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={corTexto} />
      ) : (
        <View style={e.botaoConteudo}>
          {icone ? <Icone nome={icone} cor={corTexto} tamanho={18} /> : null}
          <Text style={[e.botaoTexto, { color: corTexto }]}>{titulo}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Texto legivel sobre qualquer cor -- o seletor livre deixa escolher amarelo-claro. */
export function textoSobre(cor: string): string {
  return luminancia(cor) > 0.45 ? '#101828' : '#FFFFFF';
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
  const { cores } = useTema();
  const e = useEstilos();
  return (
    <View style={e.chips}>
      {itens.map((item) => {
        const ativo = item.valor === valor;
        const corAtiva = item.cor ?? cores.primaria;
        return (
          <Pressable
            key={String(item.valor)}
            onPress={() => onChange(item.valor)}
            style={({ pressed }) => [
              e.chip,
              ativo && { backgroundColor: corAtiva, borderColor: corAtiva },
              pressed && !ativo && { borderColor: corAtiva },
            ]}
          >
            {item.cor && !ativo ? (
              <View style={[e.pontoCor, { backgroundColor: item.cor }]} />
            ) : null}
            <Text style={[e.chipTexto, ativo && { color: textoSobre(corAtiva), fontWeight: '700' }]}>
              {item.rotulo}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Controle segmentado: escolha unica entre poucas opcoes que dividem a largura
 * (tipo do lancamento). Diferente dos Chips, nao quebra linha -- a pessoa ve
 * todas as opcoes lado a lado e a escolhida "acende" na sua cor.
 */
export function Segmentos<T extends string>({
  itens,
  valor,
  onChange,
}: {
  itens: { valor: T; rotulo: string; cor: string; icone?: NomeIcone }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  const { cores } = useTema();
  const e = useEstilos();
  return (
    <View style={e.segmentos}>
      {itens.map((item) => {
        const ativo = item.valor === valor;
        const corTexto = ativo ? textoSobre(item.cor) : cores.textoFraco;
        return (
          <Pressable
            key={item.valor}
            onPress={() => onChange(item.valor)}
            style={[e.segmento, ativo && [{ backgroundColor: item.cor }, sombra(cores, 1)]]}
            accessibilityState={{ selected: ativo }}
          >
            {item.icone ? <Icone nome={item.icone} cor={corTexto} tamanho={16} /> : null}
            <Text style={[e.segmentoTexto, { color: corTexto }]} numberOfLines={1}>
              {item.rotulo}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Vazio({ titulo, detalhe }: { titulo: string; detalhe?: string }) {
  const e = useEstilos();
  return (
    <View style={e.vazio}>
      <Text style={e.vazioTitulo}>{titulo}</Text>
      {detalhe ? <Text style={[e.textoFraco, { textAlign: 'center' }]}>{detalhe}</Text> : null}
    </View>
  );
}

export function Carregando() {
  const { cores } = useTema();
  const e = useEstilos();
  return (
    <View style={e.vazio}>
      <ActivityIndicator color={cores.primaria} />
    </View>
  );
}

/** Estilos derivados da paleta ativa. Recalculado só quando o tema muda. */
function useEstilos() {
  const { cores } = useTema();
  return useMemo(() => criarEstilos(cores), [cores]);
}

function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
    cartao: {
      backgroundColor: cores.superficie,
      borderRadius: raio.lg,
      padding: espaco.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: cores.borda,
      ...sombra(cores, 1),
    },
    titulo: {
      fontSize: 16,
      fontWeight: '800',
      color: cores.texto,
      marginBottom: espaco.sm,
      letterSpacing: -0.2,
    },
    rotulo: {
      fontSize: 11,
      fontWeight: '700',
      color: cores.textoFraco,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    textoFraco: { fontSize: 13, color: cores.textoFraco, lineHeight: 18 },
    campo: { marginBottom: espaco.lg },
    input: {
      backgroundColor: cores.superficieAlt,
      borderWidth: 1.5,
      borderColor: 'transparent',
      borderRadius: raio.md,
      paddingHorizontal: espaco.md + 2,
      paddingVertical: espaco.md,
      fontSize: 16,
      color: cores.texto,
    },
    inputFoco: { borderColor: cores.primaria, backgroundColor: cores.superficie },
    inputErro: { borderColor: cores.perigo },
    mensagemErro: { color: cores.perigo, fontSize: 12, marginTop: espaco.xs },
    botao: {
      borderRadius: raio.md,
      paddingVertical: 14,
      paddingHorizontal: espaco.lg,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
    },
    botaoConteudo: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
    botaoPrimaria: { backgroundColor: cores.primaria, ...sombra(cores, 2) },
    botaoSecundaria: { backgroundColor: cores.primariaFraca },
    botaoPerigo: { backgroundColor: cores.perigo + '18' },
    botaoPressionado: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    botaoInativo: { opacity: 0.55 },
    botaoTexto: { fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: 'transparent',
      backgroundColor: cores.superficieAlt,
    },
    chipTexto: { fontSize: 14, color: cores.texto, fontWeight: '500' },
    pontoCor: { width: 10, height: 10, borderRadius: 5 },
    segmentos: {
      flexDirection: 'row',
      backgroundColor: cores.superficieAlt,
      borderRadius: raio.md,
      padding: 4,
      gap: 4,
    },
    segmento: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 10,
      borderRadius: raio.sm,
    },
    segmentoTexto: { fontSize: 13, fontWeight: '700' },
    vazio: { padding: espaco.xl, alignItems: 'center', gap: espaco.xs },
    vazioTitulo: { fontSize: 15, fontWeight: '700', color: cores.texto, textAlign: 'center' },
  });
}
