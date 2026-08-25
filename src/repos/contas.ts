import { obterDb } from '../db';
import type { Conta, SaldoConta, TipoConta } from '../types';

export interface DadosConta {
  nome: string;
  tipo: TipoConta;
  /** Centavos. */
  saldo_inicial: number;
  ativo: boolean;
}

export async function listar(incluirInativas = false): Promise<Conta[]> {
  const db = await obterDb();
  const filtro = incluirInativas ? '' : 'WHERE ativo = 1';
  return db.getAllAsync<Conta>(
    `SELECT * FROM contas ${filtro} ORDER BY ativo DESC, nome COLLATE NOCASE`,
  );
}

export async function obter(id: number): Promise<Conta | null> {
  const db = await obterDb();
  return db.getFirstAsync<Conta>('SELECT * FROM contas WHERE id = ?', id);
}

export async function criar(dados: DadosConta): Promise<number> {
  const db = await obterDb();
  const r = await db.runAsync(
    'INSERT INTO contas (nome, tipo, saldo_inicial, ativo) VALUES (?, ?, ?, ?)',
    dados.nome.trim(),
    dados.tipo,
    dados.saldo_inicial,
    dados.ativo ? 1 : 0,
  );
  return r.lastInsertRowId;
}

export async function atualizar(id: number, dados: DadosConta): Promise<void> {
  const db = await obterDb();
  await db.runAsync(
    'UPDATE contas SET nome = ?, tipo = ?, saldo_inicial = ?, ativo = ? WHERE id = ?',
    dados.nome.trim(),
    dados.tipo,
    dados.saldo_inicial,
    dados.ativo ? 1 : 0,
    id,
  );
}

export async function contarLancamentos(id: number): Promise<number> {
  const db = await obterDb();
  const r = await db.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM lancamentos WHERE conta_id = ?',
    id,
  );
  return r?.total ?? 0;
}

/**
 * Falha de proposito quando a conta tem historico. O schema ja garante isso com
 * ON DELETE RESTRICT; a contagem previa existe so para a UI dar uma mensagem util
 * ("inative a conta") em vez de um erro cru do SQLite.
 */
export async function excluir(id: number): Promise<void> {
  const usos = await contarLancamentos(id);
  if (usos > 0) {
    throw new Error(
      `Esta conta tem ${usos} lançamento(s) e não pode ser excluída. ` +
        'Marque-a como inativa para escondê-la das telas.',
    );
  }
  const db = await obterDb();
  await db.runAsync('DELETE FROM contas WHERE id = ?', id);
}

/**
 * Saldo por conta (RF07) = saldo inicial + receitas - despesas (decisao D03).
 * Somado no SQLite com inteiros; nenhum ponto flutuante envolvido.
 */
export async function saldos(incluirInativas = false): Promise<SaldoConta[]> {
  const db = await obterDb();
  const filtro = incluirInativas ? '' : 'WHERE c.ativo = 1';

  const linhas = await db.getAllAsync<Conta & { saldo: number }>(
    `SELECT c.*,
            c.saldo_inicial + COALESCE((
              SELECT SUM(CASE l.tipo WHEN 'receita' THEN l.valor ELSE -l.valor END)
              FROM lancamentos l
              WHERE l.conta_id = c.id
            ), 0) AS saldo
     FROM contas c
     ${filtro}
     ORDER BY c.ativo DESC, c.nome COLLATE NOCASE`,
  );

  return linhas.map(({ saldo, ...conta }) => ({ conta, saldo }));
}

/** Soma dos saldos das contas ativas (KPI do dashboard, RF05). */
export async function saldoTotal(): Promise<number> {
  const db = await obterDb();
  const r = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(c.saldo_inicial), 0) + COALESCE((
              SELECT SUM(CASE l.tipo WHEN 'receita' THEN l.valor ELSE -l.valor END)
              FROM lancamentos l
              JOIN contas lc ON lc.id = l.conta_id
              WHERE lc.ativo = 1
            ), 0) AS total
     FROM contas c
     WHERE c.ativo = 1`,
  );
  return r?.total ?? 0;
}
