import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao, Campo, Carregando, Chips, Rotulo, Vazio } from '../../src/components/ui';
import { CampoValor } from '../../src/components/CampoValor';
import * as categoriasRepo from '../../src/repos/categorias';
import * as contasRepo from '../../src/repos/contas';
import * as lancamentosRepo from '../../src/repos/lancamentos';
import { formatarValor } from '../../src/utils/money';
import { dataParaISO, formatarData, hojeISO } from '../../src/utils/date';
import { useTema } from '../../src/contexto/TemaContexto';
import { espaco, type Paleta } from '../../src/utils/tema';
import type { Categoria, Conta, TipoLancamento } from '../../src/types';

export default function FormularioLancamento() {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const novo = id === 'novo';
  const idNumero = novo ? null : Number(id);
  const router = useRouter();

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [contas, setContas] = useState<Conta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const [tipo, setTipo] = useState<TipoLancamento>('despesa');
  const [valor, setValor] = useState(0);
  const [descricao, setDescricao] = useState('');
  const [dataTexto, setDataTexto] = useState(formatarData(hojeISO()));
  const [contaId, setContaId] = useState<number | null>(null);
  const [contaDestinoId, setContaDestinoId] = useState<number | null>(null);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [observacao, setObservacao] = useState('');
  const [erroValor, setErroValor] = useState<string | null>(null);
  const [erroData, setErroData] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    (async () => {
      const [listaContas, listaCategorias] = await Promise.all([
        contasRepo.listar(),
        categoriasRepo.listar(),
      ]);
      if (!ativo) return;

      setContas(listaContas);
      setCategorias(listaCategorias);

      if (novo) {
        // Pre-preenchimento do registro rapido (RNF02): a conta mais provavel e a
        // ultima usada; sem historico, a primeira da lista.
        const ultima = await lancamentosRepo.ultimaContaUsada();
        if (!ativo) return;
        setContaId(ultima ?? listaContas[0]?.id ?? null);
      } else if (idNumero != null) {
        const l = await lancamentosRepo.obter(idNumero);
        if (!ativo) return;
        if (!l) {
          Alert.alert('Lançamento não encontrado', undefined, [
            { text: 'Voltar', onPress: () => router.back() },
          ]);
          return;
        }
        setTipo(l.tipo);
        setValor(l.valor);
        setDescricao(l.descricao);
        setDataTexto(formatarData(l.data));
        setContaId(l.conta_id);
        setContaDestinoId(l.conta_destino_id);
        setCategoriaId(l.categoria_id);
        setObservacao(l.observacao ?? '');
      }

      if (ativo) setCarregando(false);
    })().catch((erro: unknown) => {
      if (ativo) {
        Alert.alert('Erro', erro instanceof Error ? erro.message : String(erro));
        setCarregando(false);
      }
    });

    return () => {
      ativo = false;
    };
  }, [id]);

  const transferencia = tipo === 'transferencia';

  // Transferencia nao tem categoria (CHECK no banco), entao a lista fica vazia
  // e a secao de categoria some da tela.
  const categoriasDoTipo = useMemo(
    () => (transferencia ? [] : categorias.filter((c) => c.tipo === tipo)),
    [categorias, tipo, transferencia],
  );

  // Trocar receita <-> despesa invalida a categoria escolhida, que pertence ao outro tipo.
  useEffect(() => {
    if (categoriaId != null && !categoriasDoTipo.some((c) => c.id === categoriaId)) {
      setCategoriaId(null);
    }
  }, [categoriasDoTipo, categoriaId]);

  // Sair de transferencia deixaria um destino orfao, que o CHECK do banco recusa.
  useEffect(() => {
    if (!transferencia && contaDestinoId != null) setContaDestinoId(null);
  }, [transferencia, contaDestinoId]);

  // Trocar a origem para a conta que ja era o destino deixaria os dois iguais.
  // O CHECK do banco recusaria no salvar; limpar aqui evita o usuario descobrir
  // isso so depois de preencher o resto.
  useEffect(() => {
    if (transferencia && contaDestinoId != null && contaDestinoId === contaId) {
      setContaDestinoId(null);
    }
  }, [transferencia, contaId, contaDestinoId]);

  async function salvar() {
    if (valor <= 0) {
      setErroValor('Informe um valor maior que zero.');
      return;
    }
    setErroValor(null);

    const dataISO = textoParaISO(dataTexto);
    if (!dataISO) {
      setErroData('Use o formato DD/MM/AAAA.');
      return;
    }
    setErroData(null);

    if (contaId == null) {
      Alert.alert(
        transferencia ? 'Escolha a conta de origem' : 'Escolha a conta',
        'Todo lançamento precisa estar ligado a uma conta.',
      );
      return;
    }

    if (transferencia) {
      if (contaDestinoId == null) {
        Alert.alert('Escolha a conta de destino', 'A movimentação precisa de um destino.');
        return;
      }
      if (contaDestinoId === contaId) {
        Alert.alert('Contas iguais', 'Origem e destino precisam ser contas diferentes.');
        return;
      }
    }

    // Descricao em branco cai para o nome da categoria: sem isso o registro rapido
    // exigiria digitar duas coisas, e o RNF02 nao fecharia.
    const nomeCategoria = categoriasDoTipo.find((c) => c.id === categoriaId)?.nome;
    const descricaoFinal =
      descricao.trim() ||
      (transferencia
        ? `${contas.find((c) => c.id === contaId)?.nome ?? '?'} → ${
            contas.find((c) => c.id === contaDestinoId)?.nome ?? '?'
          }`
        : nomeCategoria || (tipo === 'receita' ? 'Receita' : 'Despesa'));

    setSalvando(true);
    try {
      // categoria e destino sao mutuamente exclusivos -- o CHECK do banco recusa
      // qualquer combinacao fora disso, entao zeramos o lado que nao se aplica.
      const dados = {
        descricao: descricaoFinal,
        valor,
        tipo,
        data: dataISO,
        conta_id: contaId,
        conta_destino_id: transferencia ? contaDestinoId : null,
        categoria_id: transferencia ? null : categoriaId,
        observacao: observacao.trim() || null,
      };

      if (novo) await lancamentosRepo.criar(dados);
      else if (idNumero != null) await lancamentosRepo.atualizar(idNumero, dados);

      router.back();
    } catch (erro) {
      Alert.alert('Erro ao salvar', erro instanceof Error ? erro.message : String(erro));
    } finally {
      setSalvando(false);
    }
  }

  function confirmarExclusao() {
    Alert.alert('Excluir lançamento', 'Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          if (idNumero == null) return;
          await lancamentosRepo.excluir(idNumero);
          router.back();
        },
      },
    ]);
  }

  if (carregando) {
    return (
      <>
        <Stack.Screen options={{ title: novo ? 'Novo lançamento' : 'Editar' }} />
        <Carregando />
      </>
    );
  }

  if (contas.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Novo lançamento' }} />
        <View style={e.tela}>
          <Vazio
            titulo="Cadastre uma conta primeiro"
            detalhe="Todo lançamento precisa estar ligado a uma conta."
          />
          <View style={e.acoes}>
            <Botao titulo="Cadastrar conta" onPress={() => router.replace('/conta/nova')} />
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: novo ? 'Novo lançamento' : 'Editar lançamento' }} />
      <KeyboardAvoidingView
        style={e.tela}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[e.conteudo, { paddingBottom: espaco.xl + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={e.grupo}>
            <Chips
              itens={[
                { valor: 'despesa', rotulo: 'Despesa', cor: cores.despesa },
                { valor: 'receita', rotulo: 'Receita', cor: cores.receita },
                { valor: 'transferencia', rotulo: 'Movimentação', cor: cores.transferencia },
              ]}
              valor={tipo}
              onChange={(v) => setTipo(v as TipoLancamento)}
            />
          </View>

          {transferencia ? (
            <Text style={e.avisoTransferencia}>
              Movimentação interna: o dinheiro sai de uma conta sua e entra em outra.
              Não conta como receita nem despesa, e não altera seu saldo total.
            </Text>
          ) : null}

          <CampoValor
            rotulo="Valor"
            valor={valor}
            onChange={setValor}
            autoFocus={novo}
            erro={erroValor}
          />

          <Campo
            rotulo="Descrição (opcional)"
            value={descricao}
            onChangeText={setDescricao}
            placeholder={
              transferencia
                ? 'Usa "origem → destino" se ficar em branco'
                : 'Usa o nome da categoria se ficar em branco'
            }
          />

          <View style={e.grupo}>
            <Rotulo>Data</Rotulo>
            <Chips
              itens={[
                { valor: 'hoje', rotulo: 'Hoje' },
                { valor: 'ontem', rotulo: 'Ontem' },
              ]}
              valor={atalhoAtivo(dataTexto)}
              onChange={(v) =>
                setDataTexto(formatarData(v === 'hoje' ? hojeISO() : ontemISO()))
              }
            />
          </View>

          <Campo
            rotulo="Ou digite a data"
            value={dataTexto}
            onChangeText={(t) => setDataTexto(mascararData(t))}
            keyboardType="number-pad"
            placeholder="DD/MM/AAAA"
            maxLength={10}
            erro={erroData}
          />

          <View style={e.grupo}>
            <Rotulo>{transferencia ? 'De (origem)' : 'Conta'}</Rotulo>
            <Chips
              itens={contas.map((c) => ({ valor: c.id, rotulo: c.nome }))}
              valor={contaId}
              onChange={setContaId}
            />
          </View>

          {transferencia ? (
            <View style={e.grupo}>
              <Rotulo>Para (destino)</Rotulo>
              {contas.length < 2 ? (
                <Text style={e.semCategoria}>
                  Movimentação precisa de pelo menos duas contas. Cadastre outra em
                  Ajustes › Contas.
                </Text>
              ) : (
                <Chips
                  // A origem sai da lista: o banco recusa origem igual ao destino.
                  itens={contas
                    .filter((c) => c.id !== contaId)
                    .map((c) => ({ valor: c.id, rotulo: c.nome }))}
                  valor={contaDestinoId}
                  onChange={setContaDestinoId}
                />
              )}
            </View>
          ) : null}

          {transferencia ? null : (
          <View style={e.grupo}>
            <Rotulo>Categoria</Rotulo>
            {categoriasDoTipo.length === 0 ? (
              <Text style={e.semCategoria}>
                Nenhuma categoria de {tipo}. Cadastre em Ajustes › Categorias.
              </Text>
            ) : (
              <Chips
                itens={categoriasDoTipo.map((c) => ({
                  valor: c.id,
                  rotulo: c.nome,
                  cor: c.cor,
                }))}
                valor={categoriaId}
                onChange={setCategoriaId}
              />
            )}
          </View>
          )}

          <Campo
            rotulo="Observação (opcional)"
            value={observacao}
            onChangeText={setObservacao}
            multiline
            numberOfLines={3}
            style={e.inputMultilinha}
          />

          <View style={e.acoes}>
            <Botao titulo="Salvar" onPress={salvar} carregando={salvando} />
            {!novo ? (
              <Botao titulo="Excluir" variante="perigo" onPress={confirmarExclusao} />
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function ontemISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dataParaISO(d);
}

function atalhoAtivo(texto: string): 'hoje' | 'ontem' | null {
  const iso = textoParaISO(texto);
  if (!iso) return null;
  if (iso === hojeISO()) return 'hoje';
  if (iso === ontemISO()) return 'ontem';
  return null;
}

/** Insere as barras enquanto o usuario digita, aceitando apagar. */
function mascararData(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/**
 * 'DD/MM/AAAA' -> 'YYYY-MM-DD'. Retorna null para datas inexistentes como 31/02,
 * que o construtor Date aceitaria silenciosamente virando 03/03.
 */
function textoParaISO(texto: string): string | null {
  const m = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;

  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);

  const d = new Date(ano, mes - 1, dia);
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) {
    return null;
  }
  return dataParaISO(d);
}

function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
    tela: { flex: 1, backgroundColor: cores.fundo },
    conteudo: { padding: espaco.lg, paddingBottom: espaco.xl },
    grupo: { marginBottom: espaco.lg },
    inputMultilinha: { minHeight: 80, textAlignVertical: 'top' },
    semCategoria: { fontSize: 13, color: cores.textoFraco },
    avisoTransferencia: {
      fontSize: 12,
      color: cores.textoFraco,
      lineHeight: 17,
      marginTop: -espaco.sm,
      marginBottom: espaco.lg,
    },
    acoes: { gap: espaco.sm, marginTop: espaco.sm },
  });
}
