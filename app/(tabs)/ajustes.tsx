import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Botao, Cartao, Chips, Rotulo, Titulo } from '../../src/components/ui';
import * as backup from '../../src/repos/backup';
import { NOME_BANCO } from '../../src/db';
import { VERSAO_ALVO } from '../../src/db/migrations';
import { useTema, type ModoTema } from '../../src/contexto/TemaContexto';
import { espaco, raio, type Paleta } from '../../src/utils/tema';

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

  async function exportar() {
    setExportando(true);
    try {
      const r = await backup.exportar();
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
        `${r.contas} conta(s), ${r.categorias} categoria(s), ${r.lancamentos} lançamento(s) e ` +
          `${r.investimentos} investimento(s) importados.`,
      );
    } catch (erro) {
      Alert.alert('Erro ao restaurar', mensagem(erro));
    } finally {
      setImportando(false);
    }
  }

  return (
    <ScrollView style={e.tela} contentContainerStyle={e.conteudo}>
      <Cartao>
        <Titulo>Cadastros</Titulo>
        <Item rotulo="Contas" detalhe="Onde o dinheiro fica" onPress={() => router.push('/contas')} />
        <Item
          rotulo="Categorias"
          detalhe="Em que o dinheiro é gasto"
          onPress={() => router.push('/categorias')}
        />
        <Item
          rotulo="Investimentos"
          detalhe="Quanto está investido em cada banco"
          onPress={() => router.push('/investimentos')}
        />
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
  onPress,
}: {
  rotulo: string;
  detalhe: string;
  onPress: () => void;
}) {
  const { cores } = useTema();
  const e = useMemo(() => criarEstilos(cores), [cores]);
  return (
    <Pressable style={e.item} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={e.itemRotulo}>{rotulo}</Text>
        <Text style={e.itemDetalhe}>{detalhe}</Text>
      </View>
      <Text style={e.seta}>›</Text>
    </Pressable>
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
      paddingVertical: espaco.md,
      borderTopWidth: 1,
      borderTopColor: cores.borda,
    },
    itemRotulo: { fontSize: 15, fontWeight: '600', color: cores.texto },
    itemDetalhe: { fontSize: 12, color: cores.textoFraco, marginTop: 2 },
    seta: { fontSize: 24, color: cores.textoFraco },
    aviso: { fontSize: 13, color: cores.textoFraco, marginBottom: espaco.md },
    ajuda: { fontSize: 12, color: cores.textoFraco, marginTop: espaco.sm },
    acoes: { gap: espaco.sm },
    meta: { fontSize: 12, color: cores.textoFraco, marginTop: 2 },
  });
}
