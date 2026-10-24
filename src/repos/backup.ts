import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

import { obterDb } from '../db';
import { VERSAO_ALVO } from '../db/migrations';
import { dataParaISO } from '../utils/date';
import type { Categoria, Conta, Lancamento, Meta } from '../types';

interface Parcelamento {
  id: number;
  descricao: string;
  valor_original: number;
  juros_bp: number;
  vezes: number;
  total: number;
  criado_em: string;
}

/**
 * Formato da tabela `investimentos` que existiu entre as migrations 3 e 8.
 * Backups dessa epoca ainda precisam restaurar: cada item vira uma conta de
 * investimento, igual a migration 9 faz no banco.
 */
interface InvestimentoLegado {
  id: number;
  nome: string;
  valor: number;
  observacao: string | null;
  cor?: string;
  criado_em?: string;
}

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
  /**
   * So em backups das migrations 3 a 8. Desde a 9 investimentos sao contas e
   * viajam dentro de `contas`.
   */
  investimentos?: InvestimentoLegado[];
  /** Ausente em backups gerados antes da migration 4; tratado como []. */
  metas?: Meta[];
  /** Ausente antes da migration 10; tratado como []. */
  parcelamentos?: Parcelamento[];
}

export interface ResultadoExportacao {
  uri: string;
  nomeArquivo: string;
  totalLancamentos: number;
}

export async function montarBackup(): Promise<ArquivoBackup> {
  const db = await obterDb();
  const [contas, categorias, lancamentos, metas, parcelamentos] = await Promise.all([
    db.getAllAsync<Conta>('SELECT * FROM contas ORDER BY id'),
    db.getAllAsync<Categoria>('SELECT * FROM categorias ORDER BY id'),
    db.getAllAsync<Lancamento>('SELECT * FROM lancamentos ORDER BY id'),
    db.getAllAsync<Meta>('SELECT * FROM metas ORDER BY id'),
    db.getAllAsync<Parcelamento>('SELECT * FROM parcelamentos ORDER BY id'),
  ]);

  return {
    formato: FORMATO_BACKUP,
    versao_schema: VERSAO_ALVO,
    exportado_em: new Date().toISOString(),
    contas,
    categorias,
    lancamentos,
    metas,
    parcelamentos,
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
  investimentos: number;
  metas: number;
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
    return {
      cancelado: true,
      contas: 0,
      categorias: 0,
      lancamentos: 0,
      investimentos: 0,
      metas: 0,
    };
  }

  const conteudo = await new File(escolha.assets[0].uri).text();
  const backup = validar(conteudo);

  const db = await obterDb();
  await db.withTransactionAsync(async () => {
    // Ordem obrigatoria: lancamentos primeiro, senao ON DELETE RESTRICT das contas
    // aborta a limpeza. metas antes de categorias pela FK (CASCADE cuidaria
    // disso sozinho, mas apagar explicito deixa a ordem clara).
    await db.runAsync('DELETE FROM lancamentos');
    await db.runAsync('DELETE FROM parcelamentos');
    await db.runAsync('DELETE FROM metas');
    await db.runAsync('DELETE FROM contas');
    await db.runAsync('DELETE FROM categorias');

    for (const c of backup.contas) {
      await db.runAsync(
        `INSERT INTO contas
           (id, nome, tipo, saldo_inicial, ativo, cor, data_inicio, data_fim, observacao,
            limite, dia_fechamento, dia_vencimento, fatura_inicial, criado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        c.id, c.nome, c.tipo, c.saldo_inicial, c.ativo,
        // Backup anterior a migration 6 nao tem cor: cai no mesmo cinza que a
        // migration deu as contas que ja existiam, para o app ficar coerente.
        c.cor ?? '#546E7A',
        // Anterior a migration 8: nao ha eventos, entao datas sao sempre null.
        c.data_inicio ?? null,
        c.data_fim ?? null,
        // Anterior a migration 9.
        c.observacao ?? null,
        // Anterior a migration 10: cartao sem limite nem dias.
        c.limite ?? null,
        c.dia_fechamento ?? null,
        c.dia_vencimento ?? null,
        c.fatura_inicial ?? 0,
        c.criado_em ?? new Date().toISOString(),
      );
    }

    // Backup antigo: investimento vira conta com id novo, depois dos das contas
    // (nenhum lancamento apontava para ele, entao nao ha o que remapear).
    for (const i of backup.investimentos ?? []) {
      await db.runAsync(
        `INSERT INTO contas (nome, tipo, saldo_inicial, ativo, cor, observacao, criado_em)
         VALUES (?, 'investimento', ?, 1, ?, ?, ?)`,
        i.nome, i.valor, i.cor ?? '#1E88E5', i.observacao ?? null,
        i.criado_em ?? new Date().toISOString(),
      );
    }

    for (const c of backup.categorias) {
      await db.runAsync(
        'INSERT INTO categorias (id, nome, tipo, cor, sistema) VALUES (?, ?, ?, ?, ?)',
        c.id, c.nome, c.tipo, c.cor ?? '#9E9E9E', c.sistema ?? 0,
      );
    }

    // Antes dos lancamentos: as parcelas apontam para o parcelamento.
    for (const p of backup.parcelamentos ?? []) {
      await db.runAsync(
        `INSERT INTO parcelamentos (id, descricao, valor_original, juros_bp, vezes, total, criado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        p.id, p.descricao, p.valor_original, p.juros_bp, p.vezes, p.total, p.criado_em,
      );
    }

    for (const l of backup.lancamentos) {
      await db.runAsync(
        `INSERT INTO lancamentos
           (id, descricao, valor, tipo, data, hora, conta_id, conta_destino_id,
            categoria_id, observacao, parcelamento_id, parcela, criado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        l.id, l.descricao, l.valor, l.tipo, l.data,
        // Anterior a migration 9: sem hora, como os lancamentos migrados.
        l.hora ?? null,
        l.conta_id,
        // Ausente em backup anterior a migration 5 -- e obrigatoriamente null
        // fora de transferencia, que o CHECK do banco confere.
        l.conta_destino_id ?? null,
        l.categoria_id ?? null, l.observacao ?? null,
        l.parcelamento_id ?? null, l.parcela ?? null,
        l.criado_em ?? new Date().toISOString(),
      );
    }

    // Depois de categorias (FK) e independente de lancamentos.
    for (const m of backup.metas ?? []) {
      await db.runAsync(
        'INSERT INTO metas (id, categoria_id, valor) VALUES (?, ?, ?)',
        m.id, m.categoria_id, m.valor,
      );
    }
  });

  return {
    cancelado: false,
    contas: backup.contas.filter((c) => c.tipo !== 'investimento').length,
    categorias: backup.categorias.length,
    lancamentos: backup.lancamentos.length,
    investimentos:
      (backup.investimentos?.length ?? 0) +
      backup.contas.filter((c) => c.tipo === 'investimento').length,
    metas: backup.metas?.length ?? 0,
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

  // Ausente = backup de antes da migration 3/4 (investimentos/metas nao existiam
  // ainda). Nao e erro, so nao havia o que exportar; os campos ficam undefined e
  // o resto do fluxo trata como lista vazia.
  if (b.investimentos !== undefined && !Array.isArray(b.investimentos)) {
    return erro('O backup está corrompido: o campo de investimentos não é uma lista.');
  }
  if (b.parcelamentos !== undefined && !Array.isArray(b.parcelamentos)) {
    return erro('O backup está corrompido: o campo de parcelamentos não é uma lista.');
  }
  if (b.metas !== undefined && !Array.isArray(b.metas)) {
    return erro('O backup está corrompido: o campo de metas não é uma lista.');
  }

  const idsContas = new Set(b.contas.map((c) => c.id));
  const orfaoLancamento = b.lancamentos.find((l) => !idsContas.has(l.conta_id));
  if (orfaoLancamento) {
    return erro(
      `O backup está inconsistente: o lançamento "${orfaoLancamento.descricao}" aponta para uma conta que não existe no arquivo.`,
    );
  }

  const orfaoDestino = b.lancamentos.find(
    (l) => l.conta_destino_id != null && !idsContas.has(l.conta_destino_id),
  );
  if (orfaoDestino) {
    return erro(
      `O backup está inconsistente: a movimentação "${orfaoDestino.descricao}" aponta para uma conta de destino que não existe no arquivo.`,
    );
  }

  const idsCategorias = new Set(b.categorias.map((c) => c.id));
  const orfaoMeta = b.metas?.find((m) => !idsCategorias.has(m.categoria_id));
  if (orfaoMeta) {
    return erro(
      'O backup está inconsistente: uma meta aponta para uma categoria que não existe no arquivo.',
    );
  }

  return b as ArquivoBackup;
}

function erro(mensagem: string): never {
  throw new Error(mensagem);
}
