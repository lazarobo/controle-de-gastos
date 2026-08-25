import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { migrar } from './migrations';
import { semear } from './seed';

export const NOME_BANCO = 'controle-de-gastos.db';

let promessaDb: Promise<SQLiteDatabase> | null = null;

/**
 * Conexao unica do app. A promessa e memoizada para que chamadas simultaneas
 * (varias telas montando ao mesmo tempo) compartilhem a MESMA abertura e nao
 * disparem o migrar() em paralelo.
 */
export function obterDb(): Promise<SQLiteDatabase> {
  if (!promessaDb) {
    promessaDb = abrir().catch((erro) => {
      // Sem isso, uma falha transitoria deixaria a promessa rejeitada em cache
      // para sempre e o app so voltaria a funcionar depois de reinstalado.
      promessaDb = null;
      throw erro;
    });
  }
  return promessaDb;
}

async function abrir(): Promise<SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(NOME_BANCO);

  // foreign_keys e OFF por padrao no SQLite e vale por conexao. Sem isto os
  // ON DELETE RESTRICT / SET NULL declarados no schema seriam apenas decorativos.
  // WAL melhora leitura concorrente; ambos precisam rodar fora de transacao.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  await migrar(db);
  await semear(db);

  return db;
}

/** Usado apos restaurar um backup, para forcar reabertura na proxima consulta. */
export async function fecharDb(): Promise<void> {
  const anterior = promessaDb;
  promessaDb = null;
  if (anterior) {
    try {
      (await anterior).closeAsync();
    } catch {
      // Banco ja fechado ou nunca aberto: nada a fazer.
    }
  }
}
