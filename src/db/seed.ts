import type { SQLiteDatabase } from 'expo-sqlite';
import type { TipoMovimento } from '../types';

interface CategoriaSeed {
  nome: string;
  tipo: TipoMovimento;
  cor: string;
  sistema?: boolean;
}

/**
 * Categorias iniciais (RF08).
 *
 * 'Ajuste de saldo' entra marcada como sistema porque a decisao D04 depende dela:
 * divergencia de saldo se corrige com um lancamento de ajuste, nunca editando o
 * saldo inicial da conta. Se o usuario pudesse excluir a categoria, perderia o
 * unico caminho previsto para isso.
 */
export const CATEGORIAS_INICIAIS: CategoriaSeed[] = [
  { nome: 'Alimentação',     tipo: 'despesa', cor: '#E53935' },
  { nome: 'Transporte',      tipo: 'despesa', cor: '#FB8C00' },
  { nome: 'Moradia',         tipo: 'despesa', cor: '#8E24AA' },
  { nome: 'Saúde',           tipo: 'despesa', cor: '#00ACC1' },
  { nome: 'Educação',        tipo: 'despesa', cor: '#3949AB' },
  { nome: 'Lazer',           tipo: 'despesa', cor: '#D81B60' },
  { nome: 'Assinaturas',     tipo: 'despesa', cor: '#6D4C41' },
  { nome: 'Vestuário',       tipo: 'despesa', cor: '#F4511E' },
  { nome: 'Outros',          tipo: 'despesa', cor: '#757575' },
  { nome: 'Ajuste de saldo', tipo: 'despesa', cor: '#455A64', sistema: true },

  { nome: 'Salário',         tipo: 'receita', cor: '#43A047' },
  { nome: 'Freelance',       tipo: 'receita', cor: '#7CB342' },
  { nome: 'Rendimentos',     tipo: 'receita', cor: '#00897B' },
  { nome: 'Outros',          tipo: 'receita', cor: '#9E9E9E' },
  { nome: 'Ajuste de saldo', tipo: 'receita', cor: '#455A64', sistema: true },
];

/**
 * Idempotente: `INSERT OR IGNORE` apoiado no indice unico (nome, tipo).
 * Rodar de novo nao duplica nem sobrescreve a cor que o usuario tenha trocado.
 */
export async function semear(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const c of CATEGORIAS_INICIAIS) {
      await db.runAsync(
        'INSERT OR IGNORE INTO categorias (nome, tipo, cor, sistema) VALUES (?, ?, ?, ?)',
        c.nome,
        c.tipo,
        c.cor,
        c.sistema ? 1 : 0,
      );
    }
  });
}
