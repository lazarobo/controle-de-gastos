import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarraProgresso, NumeroAnimado } from '../../src/components/animacao';
import { CampoValor } from '../../src/components/CampoValor';
import { SeletorCor } from '../../src/components/SeletorCor';
import { Botao, Campo, Cartao, Carregando, Chips, Rotulo } from '../../src/components/ui';
import { useConsulta } from '../../src/hooks/useConsulta';
import { useTema } from '../../src/contexto/TemaContexto';
import * as contasRepo from '../../src/repos/contas';
import * as eventosRepo from '../../src/repos/eventos';
import { formatarMoeda } from '../../src/utils/money';
import { formatarData, hojeISO, mascararData, textoParaISO } from '../../src/utils/date';
import { espaco, PALETA, type Paleta } from '../../src/utils/tema';
import type { Conta } from '../../src/types';

export default function FormularioEvento() {
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

  const [nome, setNome] = useState('');
  const [cor, setCor] = useState(PALETA[18]);
  const [inicioTexto, setInicioTexto] = useState('');
  const [fimTexto, setFimTexto] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [reserva, setReserva] = useState(0);
  const [contaOrigem, setContaOrigem] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Numeros do evento: recarregam ao voltar de "Registrar gasto"/"Separar mais".
  const { dados: resumo } = useConsulta(
    async () => (idNumero == null ? null : eventosRepo.obter(idNumero)),
    [idNumero],
  );

  useEffect(() => {
    let vivo = true;
    (async () => {
      const lista = await contasRepo.listar();
      if (!vivo) return;
      // Dinheiro para um evento sai de conta do dia a dia, nao de outro evento.
      const origens = lista.filter((c) => c.tipo !== 'evento');
      setContas(origens);
      setContaOrigem(origens[0]?.id ?? null);

      if (!novo && idNumero != null) {
        const ev = await eventosRepo.obter(idNumero);
        if (!vivo) return;
        if (ev) {
          setNome(ev.conta.nome);
          setCor(ev.conta.cor);
          setInicioTexto(ev.conta.data_inicio ? formatarData(ev.conta.data_inicio) : '');
          setFimTexto(ev.conta.data_fim ? formatarData(ev.conta.data_fim) : '');
          setAtivo(ev.conta.ativo === 1);
        }
      }
      if (vivo) setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [id]);

  /** '' vira null; texto invalido vira erro (undefined). */
  function lerData(texto: string): string | null | undefined {
    if (!texto.trim()) return null;
    return textoParaISO(texto) ?? undefined;
  }

  async function salvar() {
    if (!nome.trim()) {
      setErro('Dê um nome ao evento.');
      return;
    }
    const inicio = lerData(inicioTexto);
    const fim = lerData(fimTexto);
    if (inicio === undefined || fim === undefined) {
      setErro('Datas no formato DD/MM/AAAA, ou deixe em branco.');
      return;
    }
    // O CHECK do banco tambem recusa; checar aqui da uma mensagem legivel.
    if (inicio && fim && fim < inicio) {
      setErro('O fim não pode ser antes do início.');
      return;
    }
    if (novo && reserva > 0 && contaOrigem == null) {
      setErro('Escolha de qual conta sai o dinheiro separado.');
      return;
    }
    setErro(null);

    const dados = { nome, cor, data_inicio: inicio, data_fim: fim };
    setSalvando(true);
    try {
      if (novo) {
        await eventosRepo.criar(
          dados,
          reserva > 0 && contaOrigem != null
            ? { conta_id: contaOrigem, valor: reserva, data: hojeISO() }
            : null,
        );
      } else if (idNumero != null) {
        await eventosRepo.atualizar(idNumero, dados, ativo);
      }
      router.back();
    } catch (err) {
      Alert.alert('Erro ao salvar', err instanceof Error ? err.message : String(err));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (idNumero == null) return;
    const usos = await contasRepo.contarLancamentos(idNumero);
    if (usos > 0) {
      Alert.alert(
        'Evento com lançamentos',
        `Este evento tem ${usos} lançamento(s). Para escondê-lo, marque como encerrado — ` +
          'os gastos continuam no histórico e nos relatórios.',
      );
      return;
    }
    Alert.alert('Excluir evento', 'Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await contasRepo.excluir(idNumero);
          router.back();
        },
      },
    ]);
  }

  if (carregando) {
    return (
      <>
        <Stack.Screen options={{ title: 'Evento' }} />
        <Carregando />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: novo ? 'Novo evento' : nome || 'Evento' }} />
      <ScrollView
        style={e.tela}
        contentContainerStyle={[e.conteudo, { paddingBottom: espaco.xl + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        {!novo && resumo ? (
          <Cartao style={e.resumo}>
            <Text style={e.rotulo}>Disponível no evento</Text>
            <NumeroAnimado
              centavos={resumo.saldo}
              style={[e.saldo, { color: resumo.saldo < 0 ? cores.despesa : cores.texto }]}
            />
            <Text style={e.detalhe}>
              gasto {formatarMoeda(resumo.gasto)} de {formatarMoeda(resumo.entrou)} separados
              {resumo.devolvido > 0 ? ` · devolvido ${formatarMoeda(resumo.devolvido)}` : ''}
            </Text>
            <View style={e.barra}>
              <BarraProgresso
                fracao={resumo.entrou > 0 ? resumo.gasto / resumo.entrou : 0}
                cor={resumo.saldo < 0 ? cores.despesa : cor}
                trilha={cores.superficieAlt}
                altura={10}
              />
            </View>
            <View style={e.acoesResumo}>
              <Botao
                titulo="Registrar gasto"
                onPress={() => router.push(`/lancamento/novo?tipo=despesa&conta=${idNumero}`)}
              />
              <Botao
                titulo="Separar mais"
                variante="secundaria"
                onPress={() =>
                  router.push(`/lancamento/novo?tipo=transferencia&destino=${idNumero}`)
                }
              />
              {resumo.saldo > 0 && !ativo ? (
                <Botao
                  titulo="Devolver a sobra"
                  variante="secundaria"
                  onPress={() =>
                    router.push(`/lancamento/novo?tipo=transferencia&conta=${idNumero}`)
                  }
                />
              ) : null}
            </View>
          </Cartao>
        ) : null}

        <Campo
          rotulo="Nome"
          value={nome}
          onChangeText={setNome}
          placeholder="Viagem Floripa, Show, Casamento…"
          autoFocus={novo}
        />

        <View style={e.datas}>
          <View style={{ flex: 1 }}>
            <Campo
              rotulo="Início (opcional)"
              value={inicioTexto}
              onChangeText={(t) => setInicioTexto(mascararData(t))}
              keyboardType="number-pad"
              placeholder="DD/MM/AAAA"
              maxLength={10}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Campo
              rotulo="Fim (opcional)"
              value={fimTexto}
              onChangeText={(t) => setFimTexto(mascararData(t))}
              keyboardType="number-pad"
              placeholder="DD/MM/AAAA"
              maxLength={10}
            />
          </View>
        </View>

        {novo ? (
          <>
            <CampoValor rotulo="Separar agora (opcional)" valor={reserva} onChange={setReserva} />
            {reserva > 0 ? (
              <View style={e.grupo}>
                <Rotulo>Tirar de</Rotulo>
                <Chips
                  itens={contas.map((c) => ({ valor: c.id, rotulo: c.nome, cor: c.cor }))}
                  valor={contaOrigem}
                  onChange={setContaOrigem}
                />
              </View>
            ) : null}
            <Text style={e.ajuda}>
              Separar vira uma movimentação interna da conta escolhida para o evento: o
              saldo total não muda, só o dinheiro troca de lugar. Depois é só lançar os
              gastos com o evento como conta.
            </Text>
          </>
        ) : (
          <View style={e.linhaSwitch}>
            <View style={{ flex: 1 }}>
              <Rotulo>Evento encerrado</Rotulo>
              <Text style={e.ajuda}>
                Some do Início e da escolha de conta. Os gastos continuam nos relatórios.
              </Text>
            </View>
            <Switch value={!ativo} onValueChange={(v) => setAtivo(!v)} />
          </View>
        )}

        <View style={e.grupo}>
          <Rotulo>Cor</Rotulo>
          <SeletorCor cor={cor} onChange={setCor} />
        </View>

        {erro ? <Text style={e.erro}>{erro}</Text> : null}

        <View style={e.acoes}>
          <Botao titulo="Salvar" onPress={salvar} carregando={salvando} />
          {!novo ? <Botao titulo="Excluir" variante="perigo" onPress={excluir} /> : null}
        </View>
      </ScrollView>
    </>
  );
}

function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
    tela: { flex: 1, backgroundColor: cores.fundo },
    conteudo: { padding: espaco.lg },
    resumo: { marginBottom: espaco.lg, gap: espaco.xs },
    rotulo: {
      fontSize: 12,
      fontWeight: '600',
      color: cores.textoFraco,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    saldo: { fontSize: 30, fontWeight: '800' },
    detalhe: { fontSize: 12, color: cores.textoFraco },
    barra: { marginTop: espaco.sm },
    acoesResumo: { gap: espaco.sm, marginTop: espaco.md },
    datas: { flexDirection: 'row', gap: espaco.md },
    grupo: { marginBottom: espaco.lg },
    ajuda: { fontSize: 12, color: cores.textoFraco, lineHeight: 17, marginBottom: espaco.lg },
    linhaSwitch: { flexDirection: 'row', alignItems: 'center', gap: espaco.md },
    erro: { color: cores.perigo, fontSize: 13, marginBottom: espaco.md },
    acoes: { gap: espaco.sm },
  });
}
