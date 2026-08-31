import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Migrations versionadas via `PRAGMA user_version` (RNF05).
 *
 * Regras:
 * - Nunca edite uma migration ja publicada; adicione outra no fim da lista.
 * - `versao` deve ser sequencial a partir de 1.
 * - Cada migration roda dentro de uma transacao unica junto com o bump da versao,
 *   entao ou o schema inteiro avanca ou nada avanca.
 */
export interface Migration {
  versao: number;
  nome: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    versao: 1,
    nome: 'schema inicial',
    sql: `
      CREATE TABLE contas (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        nome          TEXT    NOT NULL,
        tipo          TEXT    NOT NULL CHECK (tipo IN ('corrente','poupanca','cartao','dinheiro')),
        -- Centavos. Inteiro, nunca REAL: float acumula erro de arredondamento.
        saldo_inicial INTEGER NOT NULL DEFAULT 0,
        ativo         INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1)),
        criado_em     TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE categorias (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        nome    TEXT    NOT NULL,
        tipo    TEXT    NOT NULL CHECK (tipo IN ('receita','despesa')),
        cor     TEXT    NOT NULL DEFAULT '#9E9E9E',
        -- 1 = criada pelo seed; a UI bloqueia renomear/excluir (ex.: 'Ajuste de saldo').
        sistema INTEGER NOT NULL DEFAULT 0 CHECK (sistema IN (0,1))
      );

      CREATE UNIQUE INDEX idx_cat_nome_tipo ON categorias(nome, tipo);

      CREATE TABLE lancamentos (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        descricao    TEXT    NOT NULL,
        -- Centavos, sempre positivo. O sinal vem da coluna tipo (decisao D06).
        valor        INTEGER NOT NULL CHECK (valor > 0),
        tipo         TEXT    NOT NULL CHECK (tipo IN ('receita','despesa')),
        -- 'YYYY-MM-DD' no fuso local, gerado por src/utils/date.ts.
        data         TEXT    NOT NULL,
        -- RESTRICT: conta com historico nao some por acidente; a UI oferece inativar.
        conta_id     INTEGER NOT NULL REFERENCES contas(id) ON DELETE RESTRICT,
        -- SET NULL: excluir categoria nao apaga o gasto, ele vira 'Sem categoria'.
        categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
        observacao   TEXT,
        criado_em    TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX idx_lanc_data      ON lancamentos(data);
      -- Composto: todas as consultas do dashboard filtram por periodo E tipo.
      CREATE INDEX idx_lanc_data_tipo ON lancamentos(data, tipo);
      CREATE INDEX idx_lanc_categoria ON lancamentos(categoria_id);
      CREATE INDEX idx_lanc_conta     ON lancamentos(conta_id);
    `,
  },
  {
    versao: 2,
    nome: 'preferencias',
    sql: `
      -- Chave-valor genérico para configurações do app (hoje só o tema).
      -- Uma tabela para todas as preferências evita nova migration a cada
      -- opção nova de configuração.
      CREATE TABLE preferencias (
        chave TEXT PRIMARY KEY,
        valor TEXT NOT NULL
      );
    `,
  },
  {
    versao: 3,
    nome: 'investimentos',
    sql: `
      -- Deliberadamente SEM referencia a contas: investimento nao e conta e
      -- nao entra no saldo total do dashboard (RF05). O valor nao vem de
      -- lancamentos (receita/despesa) como em D03 -- ele e digitado direto
      -- pelo usuario cada vez que confere o extrato da corretora/banco,
      -- porque render/queda de investimento nao e um "gasto" nem uma "receita"
      -- no sentido do resto do app.
      CREATE TABLE investimentos (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        -- Nome do banco/corretora, ex: "XP", "Nubank", "Rico".
        nome          TEXT    NOT NULL,
        -- Centavos. Saldo atual investido, informado manualmente pelo usuario.
        valor         INTEGER NOT NULL CHECK (valor >= 0),
        observacao    TEXT,
        criado_em     TEXT    NOT NULL DEFAULT (datetime('now')),
        -- Distinto de criado_em: atualizado toda vez que o usuario confere e
        -- reajusta o valor, para a tela mostrar ha quanto tempo isso ocorreu.
        atualizado_em TEXT    NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
];

export const VERSAO_ALVO = MIGRATIONS.reduce((max, m) => Math.max(max, m.versao), 0);

export async function migrar(db: SQLiteDatabase): Promise<void> {
  const linha = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const atual = linha?.user_version ?? 0;

  if (atual > VERSAO_ALVO) {
    throw new Error(
      `Banco na versao ${atual}, mais nova que a suportada por este app (${VERSAO_ALVO}). ` +
        'Atualize o aplicativo.',
    );
  }

  for (const migration of MIGRATIONS) {
    if (migration.versao <= atual) continue;
    // PRAGMA user_version nao aceita parametro vinculado, por isso a interpolacao.
    // O valor vem de constante do codigo, nunca de entrada do usuario.
    await db.execAsync(
      `BEGIN;${migration.sql};PRAGMA user_version = ${migration.versao};COMMIT;`,
    );
  }
}
