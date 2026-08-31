import { obterDb } from '../db';

/** Chave-valor genérico (migration 2). Hoje só guarda o modo de tema. */
export async function obter(chave: string): Promise<string | null> {
  const db = await obterDb();
  const r = await db.getFirstAsync<{ valor: string }>(
    `SELECT valor FROM preferencias WHERE chave = ?`,
    chave,
  );
  return r?.valor ?? null;
}

export async function definir(chave: string, valor: string): Promise<void> {
  const db = await obterDb();
  await db.runAsync(
    `INSERT INTO preferencias (chave, valor) VALUES (?, ?)
     ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`,
    chave,
    valor,
  );
}
