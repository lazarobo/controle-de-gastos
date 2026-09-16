import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Tocavel } from '../../src/components/animacao';
import { Avatar } from '../../src/components/Avatar';
import { Botao, Campo, Cartao, Chips, Rotulo, Titulo } from '../../src/components/ui';
import * as backup from '../../src/repos/backup';
import * as preferenciasRepo from '../../src/repos/preferencias';
import * as notificacoes from '../../src/servicos/notificacoes';
import { NOME_BANCO } from '../../src/db';
import { VERSAO_ALVO } from '../../src/db/migrations';
import { useTema, type ModoTema } from '../../src/contexto/TemaContexto';
import { formatarData, lerHora, mascararHora } from '../../src/utils/date';
import { espaco, type Paleta } from '../../src/utils/tema';

const OPCOES_TEMA: { valor: ModoTema; rotulo: string }[] = [
  { valor: 'claro', rotulo: 'Claro' },
  { valor: 'escuro', rotulo: 'Escuro' },
  { valor: 'sistema', rotulo: 'Automático' },
];

export default function Ajustes() {
  const { cores, modo, definirModo } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  const router = useRouter();
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);

  const [diarioAtivo, setDiarioAtivo] = useState(false);
  const [horaTexto, setHoraTexto] = useState(notificacoes.HORA_PADRAO);
  const [backupAtivo, setBackupAtivo] = useState(false);
  const [ultimoBackup, setUltimoBackup] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [diario, hora, lembreteBackup, ultimo] = await Promise.all([
        preferenciasRepo.obter(notificacoes.CHAVE_DIARIO_ATIVO),
        preferenciasRepo.obter(notificacoes.CHAVE_DIARIO_HORA),
        preferenciasRepo.obter(notificacoes.CHAVE_BACKUP_ATIVO),
        preferenciasRepo.obter(notificacoes.CHAVE_ULTIMO_BACKUP),
      ]);
      if (!vivo) return;
      setDiarioAtivo(diario === '1');
      setHoraTexto(hora ?? notificacoes.HORA_PADRAO);
      setBackupAtivo(lembreteBackup === '1');
      setUltimoBackup(ultimo);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  /** Salva a preferencia e reagenda tudo -- as duas coisas sempre juntas. */
  async function definirPreferencia(chave: string, valor: string) {
    await preferenciasRepo.definir(chave, valor);
    await notificacoes.sincronizarLembretes();
  }

  async function alternarLembrete(chave: string, ligar: boolean, aplicar: (v: boolean) => void) {
    if (ligar) {
      // Permissao so e pedida quando voce liga o lembrete, nunca ao abrir o app.
      const permitido = await notificacoes.garantirPermissao();
      if (!permitido) {
        Alert.alert(
          'Notificações bloqueadas',
          'O Android não está deixando o app avisar você. Libere em Configurações › Apps › ' +
            'Controle de Gastos › Notificações.',
        );
        return;
      }
    }
    aplicar(ligar);
    await definirPreferencia(chave, ligar ? '1' : '0');
  }

  async function mudarHora(texto: string) {
    const mascarado = mascararHora(texto);
    setHoraTexto(mascarado);
    // Só reagenda quando o horário existe de verdade; "2:" no meio da digitação não conta.
    if (lerHora(mascarado)) {
      await definirPreferencia(notificacoes.CHAVE_DIARIO_HORA, mascarado);
    }
  }

  async function exportar() {
    setExportando(true);
    try {
      const r = await backup.exportar();
      // Reinicia a contagem do lembrete de backup a partir de hoje.
      await notificacoes.registrarBackupFeito();
      await notificacoes.sincronizarLembretes();
      setUltimoBackup(await preferenciasRepo.obter(notificacoes.CHAVE_ULTIMO_BACKUP));
      Alert.alert(
        'Backup gerado',
        `${r.nomeArquivo}\n${r.totalLancamentos} lançamento(s).\n\n` +
          'Guarde o arquivo fora do celular — se o app for desinstalado, ele é a única cópia dos seus dados.',
      );
    } catch (erro) {
      Alert.alert('Erro ao exportar', mensagem(erro));
    } finally {
      setExportando(false);
    }
  }

  function confirmarImportacao() {
    Alert.alert(
      'Restaurar backup',
      'Restaurar SUBSTITUI todas as contas, categorias e lançamentos atuais pelos do arquivo. ' +
        'Esta ação não pode ser desfeita.\n\nExporte um backup antes, se quiser guardar o estado atual.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Substituir tudo', style: 'destructive', onPress: importar },
      ],
    );
  }

  async function importar() {
    setImportando(true);
    try {
      const r = await backup.importar();
      if (r.cancelado) return;
      Alert.alert(
        'Backup restaurado',
        `${r.contas} conta(s), ${r.categorias} categoria(s), ${r.lancamentos} lançamento(s), ` +
          `${r.investimentos} investimento(s) e ${r.metas} meta(s) importados.`,
      );
    } catch (erro) {
      Alert.alert('Erro ao restaurar', mensagem(erro));
    } finally {
      setImportando(false);
    }
  }

  const horaValida = lerHora(horaTexto) != null;

  return (
    <ScrollView style={e.tela} contentContainerStyle={e.conteudo}>
      <Cartao>
        <Titulo>Cadastros</Titulo>
        <Item
          rotulo="Contas"
          detalhe="Onde o dinheiro fica"
          glifo="$"
          cor="#1E88E5"
          onPress={() => router.push('/contas')}
        />
        <Item
          rotulo="Categorias"
          detalhe="Em que o dinheiro é gasto"
          glifo="#"
          cor="#FB8C00"
          onPress={() => router.push('/categorias')}
        />
        <Item
          rotulo="Metas"
          detalhe="Teto mensal de gasto por categoria"
          glifo="%"
          cor="#43A047"
          onPress={() => router.push('/metas')}
        />
        <Item
          rotulo="Eventos"
          detalhe="Viagens, shows: dinheiro separado para um fim"
          glifo="★"
          cor="#8E24AA"
          onPress={() => router.push('/eventos')}
        />
      </Cartao>

      <Cartao>
        <Titulo>Lembretes</Titulo>

        <View style={e.linhaSwitch}>
          <View style={{ flex: 1 }}>
            <Rotulo>Lembrete diário</Rotulo>
            <Text style={e.ajudaCurta}>
              Só avisa nos dias em que você não lançou nada.
            </Text>
          </View>
          <Switch
            value={diarioAtivo}
            onValueChange={(v) =>
              alternarLembrete(notificacoes.CHAVE_DIARIO_ATIVO, v, setDiarioAtivo)
            }
          />
        </View>

        {diarioAtivo ? (
          <View style={e.campoHora}>
            <Campo
              rotulo="Horário"
              value={horaTexto}
              onChangeText={mudarHora}
              keyboardType="number-pad"
              placeholder="20:00"
              maxLength={5}
              erro={horaValida ? null : 'Horário inválido — use HH:MM.'}
            />
          </View>
        ) : null}

        <View style={[e.linhaSwitch, e.comSeparador]}>
          <View style={{ flex: 1 }}>
            <Rotulo>Lembrete de backup</Rotulo>
            <Text style={e.ajudaCurta}>
              A cada 30 dias sem exportar. Último:{' '}
              {ultimoBackup ? formatarData(ultimoBackup) : 'nunca'}.
            </Text>
          </View>
          <Switch
            value={backupAtivo}
            onValueChange={(v) =>
              alternarLembrete(notificacoes.CHAVE_BACKUP_ATIVO, v, setBackupAtivo)
            }
          />
        </View>

        <Text style={e.ajuda}>
          Os lembretes são agendados no próprio aparelho — nada sai daqui. Se o Android
          estiver economizando bateria com o app, ele pode atrasar ou engolir o aviso;
          nesse caso, marque o app como "sem restrição" nas configurações de bateria.
        </Text>
      </Cartao>

      <Cartao>
        <Titulo>Aparência</Titulo>
        <Rotulo>Tema</Rotulo>
        <Chips itens={OPCOES_TEMA} valor={modo} onChange={definirModo} />
        <Text style={e.ajuda}>
          "Automático" segue o tema claro/escuro que você já configurou no Android.
          Também dá para alternar rápido pelo ☀/☾ no topo de qualquer aba.
        </Text>
      </Cartao>

      <Cartao>
        <Titulo>Backup</Titulo>
        <Text style={e.aviso}>
          Os dados ficam só neste aparelho. Desinstalar o app apaga tudo — exporte
          um backup com frequência.
        </Text>
        <View style={e.acoes}>
          <Botao titulo="Exportar backup" onPress={exportar} carregando={exportando} />
          <Botao
            titulo="Restaurar backup"
            variante="secundaria"
            onPress={confirmarImportacao}
            carregando={importando}
          />
        </View>
      </Cartao>

      <Cartao>
        <Titulo>Sobre</Titulo>
        <Text style={e.meta}>Banco: {NOME_BANCO}</Text>
        <Text style={e.meta}>Versão do schema: {VERSAO_ALVO}</Text>
        <Text style={e.meta}>Funciona 100% offline. Nenhum dado sai do aparelho.</Text>
      </Cartao>
    </ScrollView>
  );
}

function Item({
  rotulo,
  detalhe,
  glifo,
  cor,
  onPress,
}: {
  rotulo: string;
  detalhe: string;
  /** Icone do item: um simbolo sobre circulo colorido, como os avatares. */
  glifo: string;
  cor: string;
  onPress: () => void;
}) {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  return (
    <Tocavel style={e.item} onPress={onPress}>
      <Avatar nome={rotulo} cor={cor} glifo={glifo} tamanho={36} />
      <View style={{ flex: 1 }}>
        <Text style={e.itemRotulo}>{rotulo}</Text>
        <Text style={e.itemDetalhe}>{detalhe}</Text>
      </View>
      <Text style={e.seta}>›</Text>
    </Tocavel>
  );
}

function mensagem(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

function criarEstilos(cores: Paleta) {
  return StyleSheet.create({
    tela: { flex: 1, backgroundColor: cores.fundo },
    conteudo: { padding: espaco.lg, gap: espaco.md, paddingBottom: espaco.xl },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      paddingVertical: espaco.md,
      borderTopWidth: 1,
      borderTopColor: cores.borda,
    },
    itemRotulo: { fontSize: 15, fontWeight: '600', color: cores.texto },
    itemDetalhe: { fontSize: 12, color: cores.textoFraco, marginTop: 2 },
    seta: { fontSize: 24, color: cores.textoFraco },
    linhaSwitch: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      paddingVertical: espaco.sm,
    },
    comSeparador: { borderTopWidth: 1, borderTopColor: cores.borda, marginTop: espaco.sm },
    campoHora: { maxWidth: 160, marginTop: espaco.sm },
    ajudaCurta: { fontSize: 12, color: cores.textoFraco, marginTop: 2 },
    aviso: { fontSize: 13, color: cores.textoFraco, marginBottom: espaco.md },
    ajuda: { fontSize: 12, color: cores.textoFraco, marginTop: espaco.sm, lineHeight: 17 },
    acoes: { gap: espaco.sm },
    meta: { fontSize: 12, color: cores.textoFraco, marginTop: 2 },
  });
}
