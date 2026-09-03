import { obterDb } from '../db';
import type { Investimento } from '../types';

export interface DadosInvestimento {
  nome: string;
  /** Centavos. */
  valor: number;
  observacao: string | null;
  cor: string;
}

export async function listar(): Promise<Investimento[]> {
  const db = await obterDb();
  return db.getAllAsync<Investimento>(
    `SELECT * FROM investimentos ORDER BY nome COLLATE NOCASE`,
  );
}

export async function obter(id: number): Promise<Investimento | null> {
  const db = await obterDb();
  return db.getFirstAsync<Investimento>(`SELECT * FROM investimentos WHERE id = ?`, id);
}

export async function criar(dados: DadosInvestimento): Promise<number> {
  const db = await obterDb();
  const r = await db.runAsync(
    `INSERT INTO investimentos (nome, valor, observacao, cor) VALUES (?, ?, ?, ?)`,
    dados.nome.trim(),
    dados.valor,
    dados.observacao?.trim() || null,
    dados.cor,
  );
  return r.lastInsertRowId;
}

/**
 * `atualizado_em` e regravado aqui na mao porque o DEFAULT do schema so roda
 * no INSERT -- sem isso a tela nunca saberia ha quanto tempo o valor foi
 * conferido pela ultima vez.
 */
export async function atualizar(id: number, dados: DadosInvestimento): Promise<void> {
  const db = await obterDb();
  await db.runAsync(
    `UPDATE investimentos
     SET nome = ?, valor = ?, observacao = ?, cor = ?, atualizado_em = datetime('now')
     WHERE id = ?`,
    dados.nome.trim(),
    dados.valor,
    dados.observacao?.trim() || null,
    dados.cor,
    id,
  );
}

export async function excluir(id: number): Promise<void> {
  const db = await obterDb();
  await db.runAsync(`DELETE FROM investimentos WHERE id = ?`, id);
}

/** Soma de tudo que esta investido, em centavos. Base do "levantamento". */
export async function total(): Promise<number> {
  const db = await obterDb();
  const r = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(valor), 0) AS total FROM investimentos`,
  );
  return r?.total ?? 0;
}
