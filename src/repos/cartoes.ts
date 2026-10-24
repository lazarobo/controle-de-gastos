import { obterDb } from '../db';
import { agruparFaturas } from '../utils/cartao';
import { dataParaISO, hojeISO } from '../utils/date';
import type { CartaoResumo, FaturaResumo, ItemFatura } from '../types';
import * as contasRepo from './contas';

/**
 * Cartao de credito e uma conta tipo 'cartao' (desde o v1). Este repositorio
 * so le a conta do jeito que a fatura pede; saldo continua vindo de
 * contas.saldos() e compra continua sendo lancamento comum:
 *
 *   divida     = -saldo  (compras deixam o saldo negativo)
 *   disponivel = limite - divida
 *
 * Pagar a fatura e uma movimentacao corrente -> cartao: sobe o saldo do
 * cartao, a divida cai e o limite volta -- sem virar despesa duas vezes.
 */

export async function listar(incluirInativos = false): Promise<CartaoResumo[]> {
  const saldos = await contasRepo.saldos(incluirInativos);
  return saldos
    .filter((s) => s.conta.tipo === 'cartao')
    .map(({ conta, saldo }) => ({
      conta,
      divida: -saldo,
      disponivel: (conta.limite ?? 0) + saldo,
    }));
}

export async function obter(id: number): Promise<CartaoResumo | null> {
  const todos = await listar(true);
  return todos.find((c) => c.conta.id === id) ?? null;
}

/** Faturas que ainda importam: a fechada a pagar, a atual e as futuras (parcelas). */
export async function faturas(id: number): Promise<FaturaResumo[]> {
  const cartao = await obter(id);
  const { dia_fechamento, dia_vencimento } = cartao?.conta ?? {};
  if (!cartao || dia_fechamento == null || dia_vencimento == null) return [];

  const db = await obterDb();
  const itens = await db.getAllAsync<ItemFatura>(
    `SELECT data, tipo, valor FROM lancamentos
     WHERE conta_id = ? AND tipo IN ('receita','despesa')`,
    id,
  );

  // criado_em vem do datetime('now') do SQLite, em UTC; convertido para a data
  // local antes de decidir a fatura (D08).
  const criadoLocal = dataParaISO(new Date(cartao.conta.criado_em.replace(' ', 'T') + 'Z'));

  return agruparFaturas(itens, dia_fechamento, dia_vencimento, hojeISO(), {
    data: criadoLocal,
    valor: cartao.conta.fatura_inicial,
  });
}
