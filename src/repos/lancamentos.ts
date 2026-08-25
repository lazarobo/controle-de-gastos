import { obterDb } from '../db';
import { intervaloDoMes, type Mes } from '../utils/date';
import type {
  Lancamento,
  LancamentoDetalhado,
  ResumoMes,
  TipoMovimento,
  TotalPorCategoria,
} from '../types';

export interface DadosLancamento {
  descricao: string;
  /** Centavos, positivo. */
  valor: number;
  tipo: TipoMovimento;
  /** 'YYYY-MM-DD'. */
  data: string;
  conta_id: number;
  categoria_id: number | null;
  observacao: string | null;
}

const SELECT_DETALHADO = `
  SELECT l.*,
         c.nome  AS conta_nome,
         cat.nome AS categoria_nome,
         cat.cor  AS categoria_cor
  FROM lancamentos l
  JOIN contas c        ON c.id = l.conta_id
  LEFT JOIN categorias cat ON cat.id = l.categoria_id
`;

/** RF04: lista do mes, mais recente primeiro; empate desfeito pela ordem de criacao. */
export async function listarPorMes(mes: Mes): Promise<LancamentoDetalhado[]> {
  const db = await obterDb();
  const { inicio, fim } = intervaloDoMes(mes);
  return db.getAllAsync<LancamentoDetalhado>(
    `${SELECT_DETALHADO}
     WHERE l.data BETWEEN ? AND ?
     ORDER BY l.data DESC, l.id DESC`,
    inicio,
    fim,
  );
}

export async function obter(id: number): Promise<Lancamento | null> {
  const db = await obterDb();
  return db.getFirstAsync<Lancamento>('SELECT * FROM lancamentos WHERE id = ?', id);
}

export async function criar(dados: DadosLancamento): Promise<number> {
  const db = await obterDb();
  const r = await db.runAsync(
    `INSERT INTO lancamentos (descricao, valor, tipo, data, conta_id, categoria_id, observacao)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    dados.descricao.trim(),
    dados.valor,
    dados.tipo,
    dados.data,
    dados.conta_id,
    dados.categoria_id,
    dados.observacao?.trim() || null,
  );
  return r.lastInsertRowId;
}

export async function atualizar(id: number, dados: DadosLancamento): Promise<void> {
  const db = await obterDb();
  await db.runAsync(
    `UPDATE lancamentos
     SET descricao = ?, valor = ?, tipo = ?, data = ?, conta_id = ?, categoria_id = ?, observacao = ?
     WHERE id = ?`,
    dados.descricao.trim(),
    dados.valor,
    dados.tipo,
    dados.data,
    dados.conta_id,
    dados.categoria_id,
    dados.observacao?.trim() || null,
    id,
  );
}

export async function excluir(id: number): Promise<void> {
  const db = await obterDb();
  await db.runAsync('DELETE FROM lancamentos WHERE id = ?', id);
}

/** RF05: receitas, despesas e resultado do mes, em centavos. */
export async function resumoMes(mes: Mes): Promise<ResumoMes> {
  const db = await obterDb();
  const { inicio, fim } = intervaloDoMes(mes);

  const r = await db.getFirstAsync<{ receitas: number; despesas: number }>(
    `SELECT COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor END), 0) AS receitas,
            COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN valor END), 0) AS despesas
     FROM lancamentos
     WHERE data BETWEEN ? AND ?`,
    inicio,
    fim,
  );

  const receitas = r?.receitas ?? 0;
  const despesas = r?.despesas ?? 0;
  return { receitas, despesas, resultado: receitas - despesas };
}

/** RF06: base do grafico de pizza. Maior total primeiro. */
export async function totaisPorCategoria(
  mes: Mes,
  tipo: TipoMovimento = 'despesa',
): Promise<TotalPorCategoria[]> {
  const db = await obterDb();
  const { inicio, fim } = intervaloDoMes(mes);

  return db.getAllAsync<TotalPorCategoria>(
    `SELECT l.categoria_id                              AS categoria_id,
            COALESCE(c.nome, 'Sem categoria')           AS categoria_nome,
            COALESCE(c.cor, '#BDBDBD')                  AS cor,
            SUM(l.valor)                                AS total
     FROM lancamentos l
     LEFT JOIN categorias c ON c.id = l.categoria_id
     WHERE l.tipo = ? AND l.data BETWEEN ? AND ?
     GROUP BY l.categoria_id
     ORDER BY total DESC`,
    tipo,
    inicio,
    fim,
  );
}

/**
 * Ultima conta usada, para pre-preencher o formulario de registro rapido (RNF02).
 * Ordena por id porque criado_em tem resolucao de segundo e empata em uso rapido.
 */
export async function ultimaContaUsada(): Promise<number | null> {
  const db = await obterDb();
  const r = await db.getFirstAsync<{ conta_id: number }>(
    `SELECT l.conta_id
     FROM lancamentos l
     JOIN contas c ON c.id = l.conta_id AND c.ativo = 1
     ORDER BY l.id DESC
     LIMIT 1`,
  );
  return r?.conta_id ?? null;
}

/** Meses que possuem lancamentos, mais recente primeiro ('YYYY-MM'). */
export async function mesesComLancamentos(): Promise<string[]> {
  const db = await obterDb();
  const linhas = await db.getAllAsync<{ mes: string }>(
    `SELECT DISTINCT substr(data, 1, 7) AS mes FROM lancamentos ORDER BY mes DESC`,
  );
  return linhas.map((l) => l.mes);
}
