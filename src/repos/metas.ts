import { obterDb } from '../db';
import { intervaloDoMes, type Mes } from '../utils/date';
import type { Meta, MetaComProgresso } from '../types';

export async function listar(): Promise<(Meta & { categoria_nome: string; categoria_cor: string })[]> {
  const db = await obterDb();
  return db.getAllAsync(
    `SELECT m.id, m.categoria_id, m.valor,
            c.nome AS categoria_nome, c.cor AS categoria_cor
     FROM metas m
     JOIN categorias c ON c.id = m.categoria_id
     ORDER BY c.nome COLLATE NOCASE`,
  );
}

export async function obter(id: number): Promise<Meta | null> {
  const db = await obterDb();
  return db.getFirstAsync<Meta>('SELECT id, categoria_id, valor FROM metas WHERE id = ?', id);
}

export async function obterPorCategoria(categoriaId: number): Promise<Meta | null> {
  const db = await obterDb();
  return db.getFirstAsync<Meta>(
    'SELECT id, categoria_id, valor FROM metas WHERE categoria_id = ?',
    categoriaId,
  );
}

/** Categorias de despesa que ainda nao tem meta cadastrada (para o formulario de nova meta). */
export async function categoriasSemMeta(): Promise<{ id: number; nome: string; cor: string }[]> {
  const db = await obterDb();
  return db.getAllAsync(
    `SELECT c.id, c.nome, c.cor
     FROM categorias c
     WHERE c.tipo = 'despesa' AND c.sistema = 0
       AND c.id NOT IN (SELECT categoria_id FROM metas)
     ORDER BY c.nome COLLATE NOCASE`,
  );
}

/**
 * UNIQUE(categoria_id) garante uma meta por categoria; upsert em vez de criar/
 * atualizar separados porque a UI so oferece "definir a meta desta categoria",
 * nunca escolhe entre criar ou editar.
 */
export async function definir(categoriaId: number, valor: number): Promise<void> {
  const db = await obterDb();
  await db.runAsync(
    `INSERT INTO metas (categoria_id, valor) VALUES (?, ?)
     ON CONFLICT(categoria_id) DO UPDATE SET valor = excluded.valor`,
    categoriaId,
    valor,
  );
}

export async function excluir(id: number): Promise<void> {
  const db = await obterDb();
  await db.runAsync('DELETE FROM metas WHERE id = ?', id);
}

/** RF10: metas com o gasto ja realizado no mes, para a barra de progresso em Relatorios. */
export async function listarComProgresso(mes: Mes): Promise<MetaComProgresso[]> {
  const db = await obterDb();
  const { inicio, fim } = intervaloDoMes(mes);

  return db.getAllAsync<MetaComProgresso>(
    `SELECT m.id, m.categoria_id, m.valor AS meta,
            c.nome AS categoria_nome, c.cor AS categoria_cor,
            COALESCE((
              SELECT SUM(l.valor) FROM lancamentos l
              WHERE l.categoria_id = m.categoria_id
                AND l.tipo = 'despesa'
                AND l.data BETWEEN ? AND ?
            ), 0) AS gasto
     FROM metas m
     JOIN categorias c ON c.id = m.categoria_id
     ORDER BY c.nome COLLATE NOCASE`,
    inicio,
    fim,
  );
}
