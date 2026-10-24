import { obterDb } from '../db';
import { calcularParcelas, somarMesesISO } from '../utils/cartao';
import { chaveMes, dataParaISO, intervaloDoMes, somarMeses, type Mes } from '../utils/date';
import type {
  EvolucaoMes,
  Lancamento,
  LancamentoDetalhado,
  ResumoMes,
  TipoLancamento,
  TipoMovimento,
  TotalPorCategoria,
  TotalPorConta,
  TotalPorDia,
} from '../types';

export interface DadosLancamento {
  descricao: string;
  /** Centavos, positivo. */
  valor: number;
  tipo: TipoLancamento;
  /** 'YYYY-MM-DD'. */
  data: string;
  /** 'HH:MM' local, ou null quando o usuario apagou a hora. */
  hora: string | null;
  /** Na transferencia, a conta de ORIGEM. */
  conta_id: number;
  /** Obrigatorio em transferencia, null nos demais (CHECK no banco garante). */
  conta_destino_id: number | null;
  /** Sempre null em transferencia. */
  categoria_id: number | null;
  observacao: string | null;
}

/**
 * Lancamentos em conta de investimento sao ajustes de valor (rendimento ou
 * queda), nao ganho nem gasto do mes -- toda consulta de KPI os descarta com
 * este filtro. Sem ele, um mes bom na bolsa apareceria como "receita".
 */
const FORA_INVESTIMENTO = `conta_id NOT IN (SELECT id FROM contas WHERE tipo = 'investimento')`;

const SELECT_DETALHADO = `
  SELECT l.*,
         c.nome   AS conta_nome,
         c.tipo   AS conta_tipo,
         cd.nome  AS conta_destino_nome,
         cd.tipo  AS conta_destino_tipo,
         cat.nome AS categoria_nome,
         cat.cor  AS categoria_cor,
         p.vezes  AS parcelas_total
  FROM lancamentos l
  JOIN contas c            ON c.id = l.conta_id
  LEFT JOIN contas cd      ON cd.id = l.conta_destino_id
  LEFT JOIN categorias cat ON cat.id = l.categoria_id
  LEFT JOIN parcelamentos p ON p.id = l.parcelamento_id
`;

/**
 * RF04: lista do mes, mais recente primeiro. Dentro do dia vale a hora; os
 * lancamentos antigos, sem hora, vao para o fim do dia (NULL e o menor valor no
 * SQLite). Empate final desfeito pela ordem de criacao.
 */
export async function listarPorMes(mes: Mes): Promise<LancamentoDetalhado[]> {
  const db = await obterDb();
  const { inicio, fim } = intervaloDoMes(mes);
  return db.getAllAsync<LancamentoDetalhado>(
    `${SELECT_DETALHADO}
     WHERE l.data BETWEEN ? AND ?
     ORDER BY l.data DESC, l.hora DESC, l.id DESC`,
    inicio,
    fim,
  );
}

/** Ultimos lancamentos que tocam a conta, nos dois papeis (extrato curto). */
export async function listarDaConta(contaId: number, limite = 10): Promise<LancamentoDetalhado[]> {
  const db = await obterDb();
  return db.getAllAsync<LancamentoDetalhado>(
    `${SELECT_DETALHADO}
     WHERE l.conta_id = ? OR l.conta_destino_id = ?
     ORDER BY l.data DESC, l.hora DESC, l.id DESC
     LIMIT ?`,
    contaId,
    contaId,
    limite,
  );
}

export async function obter(id: number): Promise<Lancamento | null> {
  const db = await obterDb();
  return db.getFirstAsync<Lancamento>('SELECT * FROM lancamentos WHERE id = ?', id);
}

export async function criar(dados: DadosLancamento): Promise<number> {
  const db = await obterDb();
  const r = await db.runAsync(
    `INSERT INTO lancamentos
       (descricao, valor, tipo, data, hora, conta_id, conta_destino_id, categoria_id, observacao)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    dados.descricao.trim(),
    dados.valor,
    dados.tipo,
    dados.data,
    dados.hora,
    dados.conta_id,
    dados.conta_destino_id,
    dados.categoria_id,
    dados.observacao?.trim() || null,
  );
  return r.lastInsertRowId;
}

/**
 * Compra parcelada no cartao: um parcelamento + N despesas, uma por mes a
 * partir da data da compra, cada uma caindo na sua fatura. Tudo numa transacao
 * -- metade das parcelas gravadas seria uma divida que nao existe.
 *
 * As N parcelas entram no saldo do cartao desde ja (o limite e comprometido
 * inteiro na compra, como no banco), mas cada uma so pesa nas despesas do mes
 * em que cai -- e assim que a fatura chega.
 */
export async function criarParcelado(
  dados: DadosLancamento,
  vezes: number,
  jurosBp: number,
): Promise<number> {
  const parcelas = calcularParcelas(dados.valor, vezes, jurosBp);
  const total = parcelas.reduce((s, p) => s + p, 0);
  const descricao = dados.descricao.trim();
  const db = await obterDb();
  let parcelamentoId = 0;

  await db.withTransactionAsync(async () => {
    const r = await db.runAsync(
      `INSERT INTO parcelamentos (descricao, valor_original, juros_bp, vezes, total)
       VALUES (?, ?, ?, ?, ?)`,
      descricao,
      dados.valor,
      jurosBp,
      vezes,
      total,
    );
    parcelamentoId = r.lastInsertRowId;

    for (let k = 0; k < parcelas.length; k++) {
      await db.runAsync(
        `INSERT INTO lancamentos
           (descricao, valor, tipo, data, hora, conta_id, categoria_id, observacao,
            parcelamento_id, parcela)
         VALUES (?, ?, 'despesa', ?, ?, ?, ?, ?, ?, ?)`,
        `${descricao} (${k + 1}/${vezes})`,
        parcelas[k],
        somarMesesISO(dados.data, k),
        dados.hora,
        dados.conta_id,
        dados.categoria_id,
        dados.observacao?.trim() || null,
        parcelamentoId,
        k + 1,
      );
    }
  });

  return parcelamentoId;
}

/** Apaga a compra parcelada inteira; o ON DELETE CASCADE leva as parcelas. */
export async function excluirParcelamento(parcelamentoId: number): Promise<void> {
  const db = await obterDb();
  await db.runAsync('DELETE FROM parcelamentos WHERE id = ?', parcelamentoId);
}

export async function obterParcelamento(
  parcelamentoId: number,
): Promise<{ vezes: number; juros_bp: number; valor_original: number; total: number } | null> {
  const db = await obterDb();
  return db.getFirstAsync(
    'SELECT vezes, juros_bp, valor_original, total FROM parcelamentos WHERE id = ?',
    parcelamentoId,
  );
}

export async function atualizar(id: number, dados: DadosLancamento): Promise<void> {
  const db = await obterDb();
  await db.runAsync(
    `UPDATE lancamentos
     SET descricao = ?, valor = ?, tipo = ?, data = ?, hora = ?,
         conta_id = ?, conta_destino_id = ?, categoria_id = ?, observacao = ?
     WHERE id = ?`,
    dados.descricao.trim(),
    dados.valor,
    dados.tipo,
    dados.data,
    dados.hora,
    dados.conta_id,
    dados.conta_destino_id,
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

  // As transferencias ficam de fora por construcao: os dois CASE so olham
  // 'receita' e 'despesa'. Isso e o comportamento correto -- mover dinheiro
  // entre contas proprias nao e ganho nem gasto do mes.
  const r = await db.getFirstAsync<{ receitas: number; despesas: number }>(
    `SELECT COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor END), 0) AS receitas,
            COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN valor END), 0) AS despesas
     FROM lancamentos
     WHERE data BETWEEN ? AND ? AND ${FORA_INVESTIMENTO}`,
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
     WHERE l.tipo = ? AND l.data BETWEEN ? AND ? AND l.${FORA_INVESTIMENTO}
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

/**
 * RF11: receitas/despesas dos ultimos `quantidade` meses (incluindo `mes`),
 * para o grafico de evolucao em Relatorios. Meses sem nenhum lancamento entram
 * com zero -- sem isso o grafico "pularia" a coluna em vez de mostrar um mes
 * vazio, o que e enganoso (parece que o mes nao existiu).
 */
export async function evolucaoMensal(mes: Mes, quantidade = 6): Promise<EvolucaoMes[]> {
  const db = await obterDb();
  const primeiroMes = somarMeses(mes, -(quantidade - 1));
  const { inicio } = intervaloDoMes(primeiroMes);
  const { fim } = intervaloDoMes(mes);

  const linhas = await db.getAllAsync<{ mes: string; receitas: number; despesas: number }>(
    `SELECT substr(data, 1, 7) AS mes,
            COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor END), 0) AS receitas,
            COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN valor END), 0) AS despesas
     FROM lancamentos
     WHERE data BETWEEN ? AND ? AND ${FORA_INVESTIMENTO}
     GROUP BY substr(data, 1, 7)`,
    inicio,
    fim,
  );

  const porMes = new Map(linhas.map((l) => [l.mes, l]));
  const resultado: EvolucaoMes[] = [];
  for (let i = 0; i < quantidade; i++) {
    const chave = chaveMes(somarMeses(primeiroMes, i));
    const l = porMes.get(chave);
    resultado.push({ mes: chave, receitas: l?.receitas ?? 0, despesas: l?.despesas ?? 0 });
  }
  return resultado;
}

/**
 * Receitas e despesas de cada conta no mes (comparativo por conta).
 *
 * Transferencia fica de fora dos DOIS lados: ela nao e receita nem despesa, e
 * incluir a perna de saida faria a conta de origem parecer gastadora sem ter
 * gasto nada de verdade. Contas sem movimento no mes nao aparecem.
 */
export async function totaisPorConta(mes: Mes): Promise<TotalPorConta[]> {
  const db = await obterDb();
  const { inicio, fim } = intervaloDoMes(mes);

  return db.getAllAsync<TotalPorConta>(
    `SELECT c.id   AS conta_id,
            c.nome AS conta_nome,
            c.cor  AS cor,
            COALESCE(SUM(CASE WHEN l.tipo = 'receita' THEN l.valor END), 0) AS receitas,
            COALESCE(SUM(CASE WHEN l.tipo = 'despesa' THEN l.valor END), 0) AS despesas
     FROM contas c
     JOIN lancamentos l ON l.conta_id = c.id
                       AND l.data BETWEEN ? AND ?
                       AND l.tipo IN ('receita','despesa')
     WHERE c.ativo = 1 AND c.tipo <> 'investimento'
     GROUP BY c.id
     HAVING receitas > 0 OR despesas > 0
     ORDER BY (receitas + despesas) DESC`,
    inicio,
    fim,
  );
}

/**
 * Despesa de cada dia do mes, para achar visualmente o dia de maior gasto.
 * Dias sem lancamento entram com zero -- mesmo motivo do evolucaoMensal: sem
 * isso o grafico comprime os dias com gasto para o inicio, distorcendo o
 * espacamento real do mes.
 */
export async function totaisPorDia(mes: Mes): Promise<TotalPorDia[]> {
  const db = await obterDb();
  const { inicio, fim } = intervaloDoMes(mes);

  const linhas = await db.getAllAsync<{ data: string; total: number }>(
    `SELECT data, SUM(valor) AS total
     FROM lancamentos
     WHERE tipo = 'despesa' AND data BETWEEN ? AND ? AND ${FORA_INVESTIMENTO}
     GROUP BY data`,
    inicio,
    fim,
  );

  const porData = new Map(linhas.map((l) => [l.data, l.total]));
  const ultimoDia = new Date(mes.ano, mes.mes, 0).getDate();

  const resultado: TotalPorDia[] = [];
  for (let dia = 1; dia <= ultimoDia; dia++) {
    const chave = dataParaISO(new Date(mes.ano, mes.mes - 1, dia));
    resultado.push({ data: chave, total: porData.get(chave) ?? 0 });
  }
  return resultado;
}

/**
 * Quantos lancamentos existem numa data. Usado pelo lembrete diario para
 * pular o dia em que voce ja registrou alguma coisa.
 */
export async function contarNoDia(data: string): Promise<number> {
  const db = await obterDb();
  const r = await db.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) AS total FROM lancamentos WHERE data = ?`,
    data,
  );
  return r?.total ?? 0;
}
