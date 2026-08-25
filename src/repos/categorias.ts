import { obterDb } from '../db';
import type { Categoria, TipoMovimento } from '../types';

export interface DadosCategoria {
  nome: string;
  tipo: TipoMovimento;
  cor: string;
}

export async function listar(tipo?: TipoMovimento): Promise<Categoria[]> {
  const db = await obterDb();
  if (tipo) {
    return db.getAllAsync<Categoria>(
      'SELECT * FROM categorias WHERE tipo = ? ORDER BY sistema, nome COLLATE NOCASE',
      tipo,
    );
  }
  return db.getAllAsync<Categoria>(
    'SELECT * FROM categorias ORDER BY tipo, sistema, nome COLLATE NOCASE',
  );
}

export async function obter(id: number): Promise<Categoria | null> {
  const db = await obterDb();
  return db.getFirstAsync<Categoria>('SELECT * FROM categorias WHERE id = ?', id);
}

export async function criar(dados: DadosCategoria): Promise<number> {
  const db = await obterDb();
  try {
    const r = await db.runAsync(
      'INSERT INTO categorias (nome, tipo, cor, sistema) VALUES (?, ?, ?, 0)',
      dados.nome.trim(),
      dados.tipo,
      dados.cor,
    );
    return r.lastInsertRowId;
  } catch (erro) {
    throw traduzirDuplicata(erro, dados);
  }
}

export async function atualizar(id: number, dados: DadosCategoria): Promise<void> {
  const atualCategoria = await obter(id);
  if (!atualCategoria) throw new Error('Categoria não encontrada.');

  // Categorias de sistema sustentam a decisao D04 (ajuste de saldo). Deixar
  // renomear ou trocar o tipo quebraria o unico caminho previsto para corrigir
  // divergencia de saldo, entao so a cor e editavel.
  if (atualCategoria.sistema === 1) {
    const db = await obterDb();
    await db.runAsync('UPDATE categorias SET cor = ? WHERE id = ?', dados.cor, id);
    return;
  }

  const db = await obterDb();
  try {
    await db.runAsync(
      'UPDATE categorias SET nome = ?, tipo = ?, cor = ? WHERE id = ?',
      dados.nome.trim(),
      dados.tipo,
      dados.cor,
      id,
    );
  } catch (erro) {
    throw traduzirDuplicata(erro, dados);
  }
}

export async function contarLancamentos(id: number): Promise<number> {
  const db = await obterDb();
  const r = await db.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM lancamentos WHERE categoria_id = ?',
    id,
  );
  return r?.total ?? 0;
}

/**
 * Excluir uma categoria NAO apaga lancamentos: o schema usa ON DELETE SET NULL,
 * entao os gastos passam a aparecer como "Sem categoria" e os totais continuam
 * batendo. A UI avisa quantos serao afetados antes de confirmar.
 */
export async function excluir(id: number): Promise<void> {
  const categoria = await obter(id);
  if (!categoria) return;
  if (categoria.sistema === 1) {
    throw new Error(
      `"${categoria.nome}" é uma categoria do sistema e não pode ser excluída.`,
    );
  }
  const db = await obterDb();
  await db.runAsync('DELETE FROM categorias WHERE id = ?', id);
}

function traduzirDuplicata(erro: unknown, dados: DadosCategoria): Error {
  const msg = erro instanceof Error ? erro.message : String(erro);
  if (msg.includes('UNIQUE') || msg.includes('idx_cat_nome_tipo')) {
    const rotulo = dados.tipo === 'receita' ? 'receita' : 'despesa';
    return new Error(`Já existe uma categoria de ${rotulo} chamada "${dados.nome.trim()}".`);
  }
  return erro instanceof Error ? erro : new Error(msg);
}
