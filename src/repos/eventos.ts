import { obterDb } from '../db';
import type { Conta, EventoResumo } from '../types';

/**
 * Evento e uma conta com tipo = 'evento' (migration 8). Este repositorio so
 * existe para as consultas que olham o evento como "dinheiro separado": quanto
 * entrou, quanto foi gasto, quanto sobrou. Saldo, transferencia e lancamento
 * continuam passando pelos repositorios de contas e lancamentos -- nada aqui
 * duplica essa contabilidade.
 */

export interface DadosEvento {
  nome: string;
  cor: string;
  /** 'YYYY-MM-DD' ou null. */
  data_inicio: string | null;
  data_fim: string | null;
}

export interface ReservaInicial {
  /** Conta de onde sai o dinheiro separado para o evento. */
  conta_id: number;
  /** Centavos, > 0. */
  valor: number;
  /** 'YYYY-MM-DD'. */
  data: string;
}

/**
 * Quatro subconsultas porque o evento aparece em papeis diferentes nos
 * lancamentos: como conta de receita/despesa (conta_id) e como ORIGEM ou
 * DESTINO de transferencia. Separar "gasto" de "devolvido" e o que deixa a
 * barra de progresso honesta: devolver a sobra para a conta corrente nao e
 * gastar.
 */
export async function listar(incluirEncerrados = false): Promise<EventoResumo[]> {
  const db = await obterDb();
  const filtro = incluirEncerrados ? '' : 'AND c.ativo = 1';

  const linhas = await db.getAllAsync<
    Conta & { entrou: number; gasto: number; devolvido: number }
  >(
    `SELECT c.*,
            c.saldo_inicial
            + COALESCE((SELECT SUM(l.valor) FROM lancamentos l
                        WHERE l.conta_id = c.id AND l.tipo = 'receita'), 0)
            + COALESCE((SELECT SUM(l.valor) FROM lancamentos l
                        WHERE l.conta_destino_id = c.id AND l.tipo = 'transferencia'), 0)
              AS entrou,
            COALESCE((SELECT SUM(l.valor) FROM lancamentos l
                      WHERE l.conta_id = c.id AND l.tipo = 'despesa'), 0) AS gasto,
            COALESCE((SELECT SUM(l.valor) FROM lancamentos l
                      WHERE l.conta_id = c.id AND l.tipo = 'transferencia'), 0) AS devolvido
     FROM contas c
     WHERE c.tipo = 'evento' ${filtro}
     ORDER BY c.ativo DESC, COALESCE(c.data_inicio, c.criado_em) DESC`,
  );

  return linhas.map(({ entrou, gasto, devolvido, ...conta }) => ({
    conta,
    entrou,
    gasto,
    devolvido,
    saldo: entrou - gasto - devolvido,
  }));
}

export async function obter(id: number): Promise<EventoResumo | null> {
  const todos = await listar(true);
  return todos.find((e) => e.conta.id === id) ?? null;
}

/**
 * Cria o evento e, opcionalmente, ja separa o dinheiro nele -- numa transacao
 * so. Sem a transacao, uma falha entre os dois INSERTs deixaria um evento
 * vazio que o usuario acha que tem dinheiro.
 */
export async function criar(dados: DadosEvento, reserva: ReservaInicial | null): Promise<number> {
  const db = await obterDb();
  let id = 0;

  await db.withTransactionAsync(async () => {
    const r = await db.runAsync(
      `INSERT INTO contas (nome, tipo, saldo_inicial, ativo, cor, data_inicio, data_fim)
       VALUES (?, 'evento', 0, 1, ?, ?, ?)`,
      dados.nome.trim(),
      dados.cor,
      dados.data_inicio,
      dados.data_fim,
    );
    id = r.lastInsertRowId;

    if (reserva && reserva.valor > 0) {
      await db.runAsync(
        `INSERT INTO lancamentos (descricao, valor, tipo, data, conta_id, conta_destino_id)
         VALUES (?, ?, 'transferencia', ?, ?, ?)`,
        `Reserva para ${dados.nome.trim()}`,
        reserva.valor,
        reserva.data,
        reserva.conta_id,
        id,
      );
    }
  });

  return id;
}

export async function atualizar(id: number, dados: DadosEvento, ativo: boolean): Promise<void> {
  const db = await obterDb();
  await db.runAsync(
    `UPDATE contas
     SET nome = ?, cor = ?, data_inicio = ?, data_fim = ?, ativo = ?
     WHERE id = ? AND tipo = 'evento'`,
    dados.nome.trim(),
    dados.cor,
    dados.data_inicio,
    dados.data_fim,
    ativo ? 1 : 0,
    id,
  );
}
