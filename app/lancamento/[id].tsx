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

import {
  Botao,
  Campo,
  Carregando,
  Chips,
  Rotulo,
  Segmentos,
  Vazio,
} from '../../src/components/ui';
import { CampoValor } from '../../src/components/CampoValor';
import * as categoriasRepo from '../../src/repos/categorias';
import * as contasRepo from '../../src/repos/contas';
import * as lancamentosRepo from '../../src/repos/lancamentos';
import {
  formatarData,
  hojeISO,
  horaDe,
  mascararData,
  mascararHora,
  ontemISO,
  textoParaHora,
  textoParaISO,
} from '../../src/utils/date';
import { useTema } from '../../src/contexto/TemaContexto';
import { useMoeda } from '../../src/contexto/PrivacidadeContexto';
import { calcularParcelas, lerJurosBp } from '../../src/utils/cartao';
import { espaco, raio, type Paleta } from '../../src/utils/tema';
import type { Categoria, Conta, TipoLancamento } from '../../src/types';

/**
 * O que a pessoa escolhe no topo do formulario. 'investir' nao e um tipo do
 * banco: vira uma movimentacao (transferencia) cujo destino e uma conta de
 * investimento. Fica separado na tela porque e assim que se pensa -- "investi
 * 500" -- e porque o destino so pode ser investimento.
 */
type Modo = 'despesa' | 'receita' | 'transferencia' | 'investir';

/** Sem acento e minusculo: "Cartão" e "cartao" sao a mesma categoria aqui. */
function normalizar(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** "Investimento", "Investimentos", "investir"... -- o usuario escreve de varios jeitos. */
function pareceInvestimento(nome: string): boolean {
  return normalizar(nome).includes('invest');
}

/** "Cartão de crédito", "Fatura"... -- categoria usada para pagar o cartao. */
function parecePagamentoDeCartao(nome: string): boolean {
  const n = normalizar(nome);
  return n.includes('cartao') || n.includes('fatura');
}

export default function FormularioLancamento() {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  const formatarMoeda = useMoeda();
  const insets = useSafeAreaInsets();
  // tipo/conta/destino chegam das telas de evento e investimento ("Registrar
  // gasto", "Aportar"), para o formulario ja abrir preenchido.
  const {
    id,
    tipo: tipoParam,
    conta: contaParam,
    destino: destinoParam,
    valor: valorParam,
  } = useLocalSearchParams<{
    id: string;
    tipo?: string;
    conta?: string;
    destino?: string;
    /** Centavos; "Pagar fatura" ja abre com o valor da fatura. */
    valor?: string;
  }>();
  const novo = id === 'novo';
  const idNumero = novo ? null : Number(id);
  const router = useRouter();

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [contas, setContas] = useState<Conta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const [modo, setModo] = useState<Modo>('despesa');
  const [valor, setValor] = useState(0);
  const [descricao, setDescricao] = useState('');
  const [dataTexto, setDataTexto] = useState(formatarData(hojeISO()));
  // Lancamento novo ja nasce com a hora de agora: e o caso de 9 em 10 registros.
  const [horaTexto, setHoraTexto] = useState(novo ? horaDe() : '');
  const [contaId, setContaId] = useState<number | null>(null);
  const [contaDestinoId, setContaDestinoId] = useState<number | null>(null);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [observacao, setObservacao] = useState('');
  // Conta do lancamento como estava no banco. Um rendimento (receita numa conta
  // de investimento) precisa continuar editavel sem o formulario trocar a conta.
  const [contaOriginalId, setContaOriginalId] = useState<number | null>(null);
  // Compra parcelada no cartao (migration 10). So no lancamento novo: depois de
  // gravadas, as parcelas sao lancamentos independentes.
  const [vezes, setVezes] = useState(1);
  const [jurosTexto, setJurosTexto] = useState('');
  const [erroJuros, setErroJuros] = useState<string | null>(null);
  const [parcelaInfo, setParcelaInfo] = useState<{
    id: number;
    parcela: number;
    vezes: number;
    juros_bp: number;
    valor_original: number;
    total: number;
  } | null>(null);
  const [erroValor, setErroValor] = useState<string | null>(null);
  const [erroData, setErroData] = useState<string | null>(null);
  const [erroHora, setErroHora] = useState<string | null>(null);

  const investimentos = useMemo(() => contas.filter((c) => c.tipo === 'investimento'), [contas]);
  const naoInvestimentos = useMemo(
    () => contas.filter((c) => c.tipo !== 'investimento'),
    [contas],
  );

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
      const comuns = listaContas.filter((c) => c.tipo !== 'investimento');

      if (novo) {
        // Pre-preenchimento do registro rapido (RNF02): a conta mais provavel e a
        // ultima usada; sem historico, a primeira da lista. Investimento nao
        // conta -- o ultimo lancamento pode ter sido um rendimento.
        const ultima = await lancamentosRepo.ultimaContaUsada();
        if (!ativo) return;
        // Com destino definido (pagar fatura, aportar), a origem nao pode ser o
        // proprio destino nem outro cartao: fatura se paga com conta de dinheiro.
        const destino = destinoParam ? Number(destinoParam) : null;
        const servePraOrigem = (c: Conta) =>
          destino == null || (c.id !== destino && c.tipo !== 'cartao');
        const ultimaConta = comuns.find((c) => c.id === ultima);
        setContaId(
          ultimaConta && servePraOrigem(ultimaConta)
            ? ultimaConta.id
            : comuns.find(servePraOrigem)?.id ?? null,
        );

        if (
          tipoParam === 'despesa' ||
          tipoParam === 'receita' ||
          tipoParam === 'transferencia' ||
          tipoParam === 'investir'
        ) {
          setModo(tipoParam);
        }
        if (contaParam) setContaId(Number(contaParam));
        if (destinoParam) setContaDestinoId(Number(destinoParam));
        if (valorParam && Number(valorParam) > 0) setValor(Number(valorParam));
      } else if (idNumero != null) {
        const l = await lancamentosRepo.obter(idNumero);
        if (!ativo) return;
        if (!l) {
          Alert.alert('Lançamento não encontrado', undefined, [
            { text: 'Voltar', onPress: () => router.back() },
          ]);
          return;
        }
        const tipoDe = (contaIdBusca: number | null) =>
          listaContas.find((c) => c.id === contaIdBusca)?.tipo;
        const ehAporte =
          l.tipo === 'transferencia' &&
          tipoDe(l.conta_destino_id) === 'investimento' &&
          tipoDe(l.conta_id) !== 'investimento';

        setModo(ehAporte ? 'investir' : l.tipo);
        setValor(l.valor);
        setDescricao(l.descricao);
        setDataTexto(formatarData(l.data));
        setHoraTexto(l.hora ?? '');
        setContaId(l.conta_id);
        setContaOriginalId(l.conta_id);
        setContaDestinoId(l.conta_destino_id);
        setCategoriaId(l.categoria_id);
        setObservacao(l.observacao ?? '');
        if (l.parcelamento_id != null) {
          const p = await lancamentosRepo.obterParcelamento(l.parcelamento_id);
          if (ativo && p) setParcelaInfo({ id: l.parcelamento_id, parcela: l.parcela ?? 1, ...p });
        }
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

  const movimentacao = modo === 'transferencia' || modo === 'investir';
  const tipoBanco: TipoLancamento = movimentacao ? 'transferencia' : modo;

  // Contas que aparecem como origem em cada modo. Receita/despesa nao vao para
  // investimento: la, receita/despesa significa rendimento, e isso se registra
  // em "Atualizar valor" na tela do investimento.
  const origens =
    modo === 'transferencia'
      ? contas
      : modo === 'investir'
        ? naoInvestimentos
        : contas.filter((c) => c.tipo !== 'investimento' || c.id === contaOriginalId);
  const destinos = (modo === 'investir' ? investimentos : contas).filter((c) => c.id !== contaId);

  // Movimentacao nao tem categoria (CHECK no banco), entao a lista fica vazia
  // e a secao de categoria some da tela.
  const categoriasDoTipo = useMemo(
    () => (movimentacao ? [] : categorias.filter((c) => c.tipo === modo)),
    [categorias, modo, movimentacao],
  );

  // Trocar receita <-> despesa invalida a categoria escolhida, que pertence ao outro tipo.
  useEffect(() => {
    if (categoriaId != null && !categoriasDoTipo.some((c) => c.id === categoriaId)) {
      setCategoriaId(null);
    }
  }, [categoriasDoTipo, categoriaId]);

  // Origem/destino que nao valem no modo atual: o CHECK do banco recusaria
  // depois, e o usuario so descobriria no salvar.
  useEffect(() => {
    if (contaId != null && contas.length > 0 && !origens.some((c) => c.id === contaId)) {
      setContaId(origens[0]?.id ?? null);
    }
    if (contaDestinoId != null && (!movimentacao || !destinos.some((c) => c.id === contaDestinoId))) {
      setContaDestinoId(null);
    }
  }, [modo, contaId, contaDestinoId, contas]);

  function escolherCategoria(idCategoria: number) {
    const cat = categoriasDoTipo.find((c) => c.id === idCategoria);
    // "Investimentos" como despesa era o jeito antigo de registrar aporte. Se ja
    // existe investimento cadastrado, o formulario muda para o jeito certo.
    if (modo === 'despesa' && cat && pareceInvestimento(cat.nome) && investimentos.length > 0) {
      setModo('investir');
      return;
    }
    // Mesmo raciocinio para "pagar o cartao" como despesa: contaria o gasto duas
    // vezes (na compra e no pagamento) e nao devolveria o limite.
    const cartao = contas.find((c) => c.tipo === 'cartao' && c.id !== contaId);
    if (modo === 'despesa' && cat && parecePagamentoDeCartao(cat.nome) && cartao) {
      setModo('transferencia');
      setContaDestinoId(cartao.id);
      return;
    }
    setCategoriaId(idCategoria);
  }

  const categoriaEscolhida = categoriasDoTipo.find((c) => c.id === categoriaId);

  const contaEscolhida = contas.find((c) => c.id === contaId);
  const destinoEscolhido = contas.find((c) => c.id === contaDestinoId);
  const compraNoCartao = novo && modo === 'despesa' && contaEscolhida?.tipo === 'cartao';
  const vezesEfetivas = compraNoCartao ? vezes : 1;
  const jurosBp = lerJurosBp(jurosTexto);
  const parcelas =
    vezesEfetivas > 1 && valor > 0 ? calcularParcelas(valor, vezesEfetivas, jurosBp ?? 0) : [];
  const totalParcelado = parcelas.reduce((soma, p) => soma + p, 0);
  const avisoCategoriaInvestimento =
    modo === 'despesa' && categoriaEscolhida && pareceInvestimento(categoriaEscolhida.nome);

  async function salvar() {
    if (valor <= 0) {
      setErroValor('Informe um valor maior que zero.');
      return;
    }
    setErroValor(null);

    const dataISO = textoParaISO(dataTexto);
    if (!dataISO) {
      setErroData('Use DD/MM/AAAA.');
      return;
    }
    setErroData(null);

    if (vezesEfetivas > 1 && jurosBp == null) {
      setErroJuros('Use um número, ex.: 1,99');
      return;
    }
    setErroJuros(null);

    const hora = textoParaHora(horaTexto);
    if (hora === undefined) {
      setErroHora('Use HH:MM.');
      return;
    }
    setErroHora(null);

    if (contaId == null) {
      Alert.alert(
        movimentacao ? 'Escolha a conta de origem' : 'Escolha a conta',
        'Todo lançamento precisa estar ligado a uma conta.',
      );
      return;
    }

    if (movimentacao) {
      if (contaDestinoId == null) {
        Alert.alert(
          modo === 'investir' ? 'Escolha o investimento' : 'Escolha a conta de destino',
          'A movimentação precisa de um destino.',
        );
        return;
      }
      if (contaDestinoId === contaId) {
        Alert.alert('Contas iguais', 'Origem e destino precisam ser contas diferentes.');
        return;
      }
    }

    // Descricao em branco cai para algo legivel: sem isso o registro rapido
    // exigiria digitar duas coisas, e o RNF02 nao fecharia.
    const nomeConta = (idBusca: number | null) => contas.find((c) => c.id === idBusca)?.nome ?? '?';
    const descricaoFinal =
      descricao.trim() ||
      (modo === 'investir'
        ? `Aporte em ${nomeConta(contaDestinoId)}`
        : modo === 'transferencia'
          ? `${nomeConta(contaId)} → ${nomeConta(contaDestinoId)}`
          : categoriaEscolhida?.nome || (modo === 'receita' ? 'Receita' : 'Despesa'));

    setSalvando(true);
    try {
      // categoria e destino sao mutuamente exclusivos -- o CHECK do banco recusa
      // qualquer combinacao fora disso, entao zeramos o lado que nao se aplica.
      const dados = {
        descricao: descricaoFinal,
        valor,
        tipo: tipoBanco,
        data: dataISO,
        hora,
        conta_id: contaId,
        conta_destino_id: movimentacao ? contaDestinoId : null,
        categoria_id: movimentacao ? null : categoriaId,
        observacao: observacao.trim() || null,
      };

      if (novo && vezesEfetivas > 1) {
        await lancamentosRepo.criarParcelado(dados, vezesEfetivas, jurosBp ?? 0);
      } else if (novo) await lancamentosRepo.criar(dados);
      else if (idNumero != null) await lancamentosRepo.atualizar(idNumero, dados);

      router.back();
    } catch (erro) {
      Alert.alert('Erro ao salvar', erro instanceof Error ? erro.message : String(erro));
    } finally {
      setSalvando(false);
    }
  }

  function confirmarExclusao() {
    if (parcelaInfo) {
      Alert.alert(
        'Excluir parcela',
        `Esta é a parcela ${parcelaInfo.parcela}/${parcelaInfo.vezes} de uma compra parcelada.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Só esta',
            onPress: async () => {
              if (idNumero == null) return;
              await lancamentosRepo.excluir(idNumero);
              router.back();
            },
          },
          {
            text: 'Todas as parcelas',
            style: 'destructive',
            onPress: async () => {
              await lancamentosRepo.excluirParcelamento(parcelaInfo.id);
              router.back();
            },
          },
        ],
      );
      return;
    }
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

  if (naoInvestimentos.length === 0) {
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

  const corModo = {
    despesa: cores.despesa,
    receita: cores.receita,
    transferencia: cores.transferencia,
    investir: cores.investimento,
  }[modo];

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
            <Segmentos<Modo>
              itens={[
                { valor: 'despesa', rotulo: 'Despesa', cor: cores.despesa, icone: 'saida' },
                { valor: 'receita', rotulo: 'Receita', cor: cores.receita, icone: 'entrada' },
                { valor: 'transferencia', rotulo: 'Mover', cor: cores.transferencia, icone: 'transferir' },
                { valor: 'investir', rotulo: 'Investir', cor: cores.investimento, icone: 'investir' },
              ]}
              valor={modo}
              onChange={setModo}
            />
          </View>

          {modo === 'transferencia' && destinoEscolhido?.tipo === 'cartao' ? (
            <Text style={e.aviso}>
              Pagamento de fatura: o dinheiro sai da conta e devolve limite ao cartão. Não é
              despesa — as compras já contaram quando foram feitas.
            </Text>
          ) : modo === 'transferencia' ? (
            <Text style={e.aviso}>
              Movimentação interna: o dinheiro sai de uma conta sua e entra em outra. Não conta
              como receita nem despesa. Para resgatar um investimento ou pagar o cartão, escolha
              a origem e o destino aqui.
            </Text>
          ) : modo === 'investir' ? (
            <Text style={e.aviso}>
              Aporte: o dinheiro sai da conta e vai para o investimento. Não é despesa — sai do
              saldo do Início e passa a contar em Investir.
            </Text>
          ) : null}

          <CampoValor
            rotulo="Valor"
            valor={valor}
            onChange={setValor}
            autoFocus={novo}
            erro={erroValor}
            cor={corModo}
          />

          <Campo
            rotulo="Descrição (opcional)"
            value={descricao}
            onChangeText={setDescricao}
            placeholder={
              modo === 'investir'
                ? 'Usa "Aporte em …" se ficar em branco'
                : modo === 'transferencia'
                  ? 'Usa "origem → destino" se ficar em branco'
                  : 'Usa o nome da categoria se ficar em branco'
            }
          />

          <View style={e.grupo}>
            <Rotulo>Quando</Rotulo>
            <Chips
              itens={[
                { valor: 'agora', rotulo: 'Agora' },
                { valor: 'hoje', rotulo: 'Hoje' },
                { valor: 'ontem', rotulo: 'Ontem' },
              ]}
              valor={atalhoAtivo(dataTexto, horaTexto)}
              onChange={(v) => {
                if (v === 'agora') {
                  setDataTexto(formatarData(hojeISO()));
                  setHoraTexto(horaDe());
                } else {
                  setDataTexto(formatarData(v === 'hoje' ? hojeISO() : ontemISO()));
                }
              }}
            />
          </View>

          <View style={e.linhaDataHora}>
            <View style={e.colunaData}>
              <Campo
                rotulo="Data"
                value={dataTexto}
                onChangeText={(t) => setDataTexto(mascararData(t))}
                keyboardType="number-pad"
                placeholder="DD/MM/AAAA"
                maxLength={10}
                erro={erroData}
              />
            </View>
            <View style={e.colunaHora}>
              <Campo
                rotulo="Hora"
                value={horaTexto}
                onChangeText={(t) => setHoraTexto(mascararHora(t))}
                keyboardType="number-pad"
                placeholder="HH:MM"
                maxLength={5}
                erro={erroHora}
              />
            </View>
          </View>

          <View style={e.grupo}>
            <Rotulo>{movimentacao ? 'De (origem)' : 'Conta'}</Rotulo>
            <Chips
              itens={origens.map((c) => ({ valor: c.id, rotulo: c.nome, cor: c.cor }))}
              valor={contaId}
              onChange={setContaId}
            />
          </View>

          {compraNoCartao ? (
            <View style={e.grupo}>
              <Rotulo>Parcelas</Rotulo>
              <Chips
                itens={[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => ({
                  valor: n,
                  rotulo: n === 1 ? 'À vista' : `${n}x`,
                }))}
                valor={vezes}
                onChange={setVezes}
              />
              {vezes > 1 ? (
                <View style={e.blocoParcelas}>
                  <Campo
                    rotulo="Juros (% ao mês, opcional)"
                    value={jurosTexto}
                    onChangeText={setJurosTexto}
                    keyboardType="decimal-pad"
                    placeholder="0 = sem juros"
                    erro={erroJuros}
                  />
                  {parcelas.length > 0 ? (
                    <Text style={e.resumoParcelas}>
                      {vezes}x de {formatarMoeda(parcelas[parcelas.length - 1])}
                      {parcelas[0] !== parcelas[parcelas.length - 1]
                        ? ` (1ª de ${formatarMoeda(parcelas[0])})`
                        : ''}
                      {' · total '}
                      {formatarMoeda(totalParcelado)}
                      {totalParcelado > valor
                        ? ` · juros ${formatarMoeda(totalParcelado - valor)}`
                        : ''}
                      {'\n'}Uma parcela por fatura, a partir desta. O limite é comprometido
                      inteiro agora; cada mês só conta a parcela que cai nele.
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {parcelaInfo ? (
            <Text style={[e.aviso, e.avisoCategoria]}>
              Parcela {parcelaInfo.parcela}/{parcelaInfo.vezes} de uma compra de{' '}
              {formatarMoeda(parcelaInfo.valor_original)}
              {parcelaInfo.total > parcelaInfo.valor_original
                ? ` (total com juros ${formatarMoeda(parcelaInfo.total)})`
                : ''}
              . Editar aqui muda só esta parcela.
            </Text>
          ) : null}

          {movimentacao ? (
            <View style={e.grupo}>
              <Rotulo>{modo === 'investir' ? 'Para (investimento)' : 'Para (destino)'}</Rotulo>
              {destinos.length === 0 ? (
                <View style={e.semDestino}>
                  <Text style={e.textoFraco}>
                    {modo === 'investir'
                      ? 'Nenhum investimento cadastrado ainda.'
                      : 'Movimentação precisa de pelo menos duas contas. Cadastre outra em Ajustes › Contas.'}
                  </Text>
                  {modo === 'investir' ? (
                    <Botao
                      titulo="Cadastrar investimento"
                      variante="secundaria"
                      onPress={() => router.push('/investimento/novo')}
                    />
                  ) : null}
                </View>
              ) : (
                <Chips
                  // A origem sai da lista: o banco recusa origem igual ao destino.
                  itens={destinos.map((c) => ({ valor: c.id, rotulo: c.nome, cor: c.cor }))}
                  valor={contaDestinoId}
                  onChange={setContaDestinoId}
                />
              )}
            </View>
          ) : (
            <View style={e.grupo}>
              <Rotulo>Categoria</Rotulo>
              {categoriasDoTipo.length === 0 ? (
                <Text style={e.textoFraco}>
                  Nenhuma categoria de {modo}. Cadastre em Ajustes › Categorias.
                </Text>
              ) : (
                <Chips
                  itens={categoriasDoTipo.map((c) => ({
                    valor: c.id,
                    rotulo: c.nome,
                    cor: c.cor,
                  }))}
                  valor={categoriaId}
                  onChange={escolherCategoria}
                />
              )}
              {avisoCategoriaInvestimento ? (
                <Text style={[e.aviso, e.avisoCategoria]}>
                  Investimento não é despesa. Cadastre o banco ou corretora na aba Investir e
                  use “Investir” aqui em cima: o dinheiro sai do saldo sem inflar seus gastos.
                </Text>
              ) : null}
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

function atalhoAtivo(data: string, hora: string): 'agora' | 'hoje' | 'ontem' | null {
  const iso = textoParaISO(data);
  if (!iso) return null;
  if (iso === hojeISO()) return hora === horaDe() ? 'agora' : 'hoje';
  if (iso === ontemISO()) return 'ontem';
  return null;
}

function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
    tela: { flex: 1, backgroundColor: cores.fundo },
    conteudo: { padding: espaco.lg, paddingBottom: espaco.xl },
    grupo: { marginBottom: espaco.lg },
    inputMultilinha: { minHeight: 80, textAlignVertical: 'top' },
    textoFraco: { fontSize: 13, color: cores.textoFraco, lineHeight: 18 },
    aviso: {
      fontSize: 12,
      color: cores.textoFraco,
      lineHeight: 17,
      marginTop: -espaco.sm,
      marginBottom: espaco.lg,
    },
    avisoCategoria: {
      marginTop: espaco.sm,
      marginBottom: 0,
      backgroundColor: cores.investimento + '14',
      color: cores.texto,
      borderRadius: raio.sm,
      padding: espaco.md,
    },
    linhaDataHora: { flexDirection: 'row', gap: espaco.md },
    colunaData: { flex: 3 },
    colunaHora: { flex: 2 },
    semDestino: { gap: espaco.sm },
    blocoParcelas: { marginTop: espaco.md },
    resumoParcelas: {
      fontSize: 13,
      color: cores.texto,
      lineHeight: 19,
      marginTop: -espaco.sm,
      backgroundColor: cores.superficieAlt,
      borderRadius: raio.sm,
      padding: espaco.md,
    },
    acoes: { gap: espaco.sm, marginTop: espaco.sm },
  });
}
