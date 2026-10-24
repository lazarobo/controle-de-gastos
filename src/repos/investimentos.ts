import { obterDb } from '../db';
import type { Conta, InvestimentoResumo } from '../types';

/**
 * Investimento e uma conta com tipo = 'investimento' (migration 9). Como no
 * repositorio de eventos, nada aqui duplica a contabilidade: aporte e resgate
 * sao movimentacoes comuns (lancamentos.criar), e o saldo e o mesmo de
 * contas.saldos(). Este arquivo so separa "quanto voce pos" de "quanto rendeu".
 */

export interface DadosInvestimento {
  nome: string;
  cor: string;
  observacao: string | null;
}

/**
 * Quatro papeis de lancamento, cada um com seu sinal:
 *   - transferencia recebida (destino)  -> aporte    (+aportado)
 *   - transferencia enviada  (origem)   -> resgate   (-aportado)
 *   - receita na propria conta          -> rendeu    (+rendimento)
 *   - despesa na propria conta          -> desvalorizou (-rendimento)
 */
export async function listar(incluirEncerrados = false): Promise<InvestimentoResumo[]> {
  const db = await obterDb();
  const filtro = incluirEncerrados ? '' : 'AND c.ativo = 1';

  const linhas = await db.getAllAsync<
    Conta & { aportado: number; rendimento: number; ultima_movimentacao: string | null }
  >(
    `SELECT c.*,
            c.saldo_inicial
            + COALESCE((SELECT SUM(l.valor) FROM lancamentos l
                        WHERE l.conta_destino_id = c.id AND l.tipo = 'transferencia'), 0)
            - COALESCE((SELECT SUM(l.valor) FROM lancamentos l
                        WHERE l.conta_id = c.id AND l.tipo = 'transferencia'), 0)
              AS aportado,
            COALESCE((SELECT SUM(CASE l.tipo WHEN 'receita' THEN l.valor ELSE -l.valor END)
                      FROM lancamentos l
                      WHERE l.conta_id = c.id AND l.tipo IN ('receita','despesa')), 0)
              AS rendimento,
            (SELECT MAX(l.data) FROM lancamentos l
             WHERE l.conta_id = c.id OR l.conta_destino_id = c.id) AS ultima_movimentacao
     FROM contas c
     WHERE c.tipo = 'investimento' ${filtro}
     ORDER BY c.ativo DESC, c.nome COLLATE NOCASE`,
  );

  return linhas.map(({ aportado, rendimento, ultima_movimentacao, ...conta }) => ({
    conta,
    aportado,
    rendimento,
    valor: aportado + rendimento,
    ultima_movimentacao: ultima_movimentacao ?? conta.criado_em.slice(0, 10),
  }));
}

export async function obter(id: number): Promise<InvestimentoResumo | null> {
  const todos = await listar(true);
  return todos.find((i) => i.conta.id === id) ?? null;
}

/**
 * `valorInicial` vira saldo_inicial: e o "ja tenho isso la" de quem comeca a
 * usar o app com dinheiro investido. Daqui pra frente o valor so muda por
 * movimentacao ou por registrarValorAtual().
 */
export async function criar(dados: DadosInvestimento, valorInicial: number): Promise<number> {
  const db = await obterDb();
  const r = await db.runAsync(
    `INSERT INTO contas (nome, tipo, saldo_inicial, ativo, cor, observacao)
     VALUES (?, 'investimento', ?, 1, ?, ?)`,
    dados.nome.trim(),
    valorInicial,
    dados.cor,
    dados.observacao?.trim() || null,
  );
  return r.lastInsertRowId;
}

export async function atualizar(id: number, dados: DadosInvestimento, ativo: boolean): Promise<void> {
  const db = await obterDb();
  await db.runAsync(
    `UPDATE contas SET nome = ?, cor = ?, observacao = ?, ativo = ?
     WHERE id = ? AND tipo = 'investimento'`,
    dados.nome.trim(),
    dados.cor,
    dados.observacao?.trim() || null,
    ativo ? 1 : 0,
    id,
  );
}

/**
 * "Conferi o extrato e hoje esta em X": lanca a DIFERENCA como receita
 * (rendimento) ou despesa (desvalorizacao) na propria conta. Assim o historico
 * fica no extrato do app e o aportado nao se mistura com o que o mercado fez.
 * Devolve a diferenca lancada (0 = nada mudou, nada foi gravado).
 */
export async function registrarValorAtual(
  id: number,
  valorAtual: number,
  data: string,
  hora: string | null,
): Promise<number> {
  const atual = await obter(id);
  if (!atual) throw new Error('Investimento não encontrado.');

  const diferenca = valorAtual - atual.valor;
  if (diferenca === 0) return 0;

  const db = await obterDb();
  await db.runAsync(
    `INSERT INTO lancamentos (descricao, valor, tipo, data, hora, conta_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    diferenca > 0 ? 'Rendimento' : 'Desvalorização',
    Math.abs(diferenca),
    diferenca > 0 ? 'receita' : 'despesa',
    data,
    hora,
    id,
  );
  return diferenca;
}

/** Soma do valor atual de todos os investimentos ativos, em centavos. */
export async function total(): Promise<number> {
  const lista = await listar();
  return lista.reduce((soma, i) => soma + i.valor, 0);
}
