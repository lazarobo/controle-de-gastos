import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

import { obterDb } from '../db';
import { VERSAO_ALVO } from '../db/migrations';
import { dataParaISO } from '../utils/date';
import type { Categoria, Conta, Lancamento } from '../types';

export const FORMATO_BACKUP = 'controle-de-gastos-backup';

/**
 * Sem servidor, o backup e a unica rede de protecao contra desinstalar o app
 * (risco mapeado no plano). Por isso exportar E importar ficam no v1: um backup
 * que nao restaura e so um arquivo.
 */
export interface ArquivoBackup {
  formato: typeof FORMATO_BACKUP;
  /** Versao do schema que gerou o arquivo, para recusar backups do futuro. */
  versao_schema: number;
  exportado_em: string;
  contas: Conta[];
  categorias: Categoria[];
  lancamentos: Lancamento[];
}

export interface ResultadoExportacao {
  uri: string;
  nomeArquivo: string;
  totalLancamentos: number;
}

export async function montarBackup(): Promise<ArquivoBackup> {
  const db = await obterDb();
  const [contas, categorias, lancamentos] = await Promise.all([
    db.getAllAsync<Conta>('SELECT * FROM contas ORDER BY id'),
    db.getAllAsync<Categoria>('SELECT * FROM categorias ORDER BY id'),
    db.getAllAsync<Lancamento>('SELECT * FROM lancamentos ORDER BY id'),
  ]);

  return {
    formato: FORMATO_BACKUP,
    versao_schema: VERSAO_ALVO,
    exportado_em: new Date().toISOString(),
    contas,
    categorias,
    lancamentos,
  };
}

/** RF14: grava o JSON no cache e abre a folha de compartilhamento do Android. */
export async function exportar(): Promise<ResultadoExportacao> {
  const backup = await montarBackup();
  const nomeArquivo = `controle-de-gastos-${dataParaISO(new Date())}.json`;

  const arquivo = new File(Paths.cache, nomeArquivo);
  arquivo.create({ overwrite: true, intermediates: true });
  arquivo.write(JSON.stringify(backup, null, 2));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(arquivo.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Salvar backup',
      UTI: 'public.json',
    });
  }

  return {
    uri: arquivo.uri,
    nomeArquivo,
    totalLancamentos: backup.lancamentos.length,
  };
}

export interface ResultadoImportacao {
  cancelado: boolean;
  contas: number;
  categorias: number;
  lancamentos: number;
}

/**
 * RF16: substitui TODO o conteudo atual pelo do arquivo.
 *
 * E substituicao, nao mesclagem, de proposito: os ids do arquivo sao preservados
 * para que as chaves estrangeiras dos lancamentos continuem apontando para a conta
 * e a categoria certas. Mesclar exigiria remapear ids e decidir empates — complexidade
 * que nao se paga num app de um usuario so.
 */
export async function importar(): Promise<ResultadoImportacao> {
  const escolha = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (escolha.canceled || !escolha.assets?.length) {
    return { cancelado: true, contas: 0, categorias: 0, lancamentos: 0 };
  }

  const conteudo = await new File(escolha.assets[0].uri).text();
  const backup = validar(conteudo);

  const db = await obterDb();
  await db.withTransactionAsync(async () => {
    // Ordem obrigatoria: lancamentos primeiro, senao ON DELETE RESTRICT das contas
    // aborta a limpeza.
    await db.runAsync('DELETE FROM lancamentos');
    await db.runAsync('DELETE FROM contas');
    await db.runAsync('DELETE FROM categorias');

    for (const c of backup.contas) {
      await db.runAsync(
        `INSERT INTO contas (id, nome, tipo, saldo_inicial, ativo, criado_em)
         VALUES (?, ?, ?, ?, ?, ?)`,
        c.id, c.nome, c.tipo, c.saldo_inicial, c.ativo,
        c.criado_em ?? new Date().toISOString(),
      );
    }

    for (const c of backup.categorias) {
      await db.runAsync(
        'INSERT INTO categorias (id, nome, tipo, cor, sistema) VALUES (?, ?, ?, ?, ?)',
        c.id, c.nome, c.tipo, c.cor ?? '#9E9E9E', c.sistema ?? 0,
      );
    }

    for (const l of backup.lancamentos) {
      await db.runAsync(
        `INSERT INTO lancamentos
           (id, descricao, valor, tipo, data, conta_id, categoria_id, observacao, criado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        l.id, l.descricao, l.valor, l.tipo, l.data, l.conta_id,
        l.categoria_id ?? null, l.observacao ?? null,
        l.criado_em ?? new Date().toISOString(),
      );
    }
  });

  return {
    cancelado: false,
    contas: backup.contas.length,
    categorias: backup.categorias.length,
    lancamentos: backup.lancamentos.length,
  };
}

/**
 * Rejeita antes de tocar no banco. Um arquivo malformado que passasse daqui
 * apagaria os dados atuais e falharia no meio da insercao.
 */
function validar(conteudo: string): ArquivoBackup {
  let dados: unknown;
  try {
    dados = JSON.parse(conteudo);
  } catch {
    return erro('O arquivo escolhido não é um JSON válido.');
  }

  if (typeof dados !== 'object' || dados === null) {
    return erro('O arquivo escolhido não é um backup deste aplicativo.');
  }

  const b = dados as Partial<ArquivoBackup>;

  if (b.formato !== FORMATO_BACKUP) {
    return erro('O arquivo escolhido não é um backup deste aplicativo.');
  }

  if (typeof b.versao_schema !== 'number' || b.versao_schema > VERSAO_ALVO) {
    return erro(
      `Backup gerado por uma versão mais nova do app (schema ${b.versao_schema}). ` +
        'Atualize o aplicativo antes de restaurar.',
    );
  }

  if (!Array.isArray(b.contas) || !Array.isArray(b.categorias) || !Array.isArray(b.lancamentos)) {
    return erro('O backup está incompleto: faltam contas, categorias ou lançamentos.');
  }

  const idsContas = new Set(b.contas.map((c) => c.id));
  const orfao = b.lancamentos.find((l) => !idsContas.has(l.conta_id));
  if (orfao) {
    return erro(
      `O backup está inconsistente: o lançamento "${orfao.descricao}" aponta para uma conta que não existe no arquivo.`,
    );
  }

  return b as ArquivoBackup;
}

function erro(mensagem: string): never {
  throw new Error(mensagem);
}
