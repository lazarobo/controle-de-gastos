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
  {
    versao: 4,
    nome: 'metas',
    sql: `
      -- RF10: orcamento mensal por categoria. UNIQUE(categoria_id) porque a
      -- meta e RECORRENTE -- um teto por categoria que vale todo mes, nao um
      -- valor diferente cadastrado mes a mes. Editar a meta muda o teto dali
      -- pra frente; nao ha historico de "quanto era a meta em marco".
      -- ON DELETE CASCADE: sem a categoria a meta nao tem mais sentido, e
      -- metas nao tem nenhum dado historico dependente delas (diferente de
      -- lancamentos, que usam SET NULL para preservar o gasto ja registrado).
      CREATE TABLE metas (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        categoria_id INTEGER NOT NULL UNIQUE REFERENCES categorias(id) ON DELETE CASCADE,
        -- Centavos. Teto de gasto mensal para a categoria.
        valor        INTEGER NOT NULL CHECK (valor > 0)
      );
    `,
  },
  {
    versao: 5,
    nome: 'movimentacao interna entre contas',
    sql: `
      -- RF09: transferencia entre contas. Precisa de DUAS mudancas que o SQLite
      -- nao faz por ALTER TABLE -- ampliar o CHECK de 'tipo' e adicionar uma
      -- coluna com REFERENCES -- entao a tabela e reconstruida. Este e o
      -- procedimento oficial do SQLite para alterar restricoes.
      --
      -- Seguro com foreign_keys = ON porque NENHUMA tabela referencia
      -- lancamentos; as FKs aqui sao todas de saida (para contas/categorias) e
      -- sao revalidadas no INSERT abaixo, com os mesmos dados que ja passavam.
      CREATE TABLE lancamentos_novo (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        descricao        TEXT    NOT NULL,
        valor            INTEGER NOT NULL CHECK (valor > 0),
        tipo             TEXT    NOT NULL CHECK (tipo IN ('receita','despesa','transferencia')),
        data             TEXT    NOT NULL,
        -- Na transferencia, conta_id e a ORIGEM (de onde o dinheiro sai).
        conta_id         INTEGER NOT NULL REFERENCES contas(id) ON DELETE RESTRICT,
        -- Só existe em transferencia: o destino (para onde o dinheiro vai).
        conta_destino_id INTEGER REFERENCES contas(id) ON DELETE RESTRICT,
        categoria_id     INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
        observacao       TEXT,
        criado_em        TEXT    NOT NULL DEFAULT (datetime('now')),

        -- Impede no banco os tres jeitos de uma transferencia nascer incoerente:
        -- sem destino, com destino igual a origem, ou com categoria (transferencia
        -- nao e gasto nem receita, entao nao entra em nenhuma categoria). E impede
        -- que receita/despesa ganhem destino por engano.
        CHECK (
          (tipo =  'transferencia' AND conta_destino_id IS NOT NULL
                                   AND conta_destino_id <> conta_id
                                   AND categoria_id IS NULL)
          OR
          (tipo <> 'transferencia' AND conta_destino_id IS NULL)
        )
      );

      INSERT INTO lancamentos_novo
        (id, descricao, valor, tipo, data, conta_id, conta_destino_id, categoria_id, observacao, criado_em)
      SELECT
         id, descricao, valor, tipo, data, conta_id, NULL,             categoria_id, observacao, criado_em
      FROM lancamentos;

      DROP TABLE lancamentos;
      ALTER TABLE lancamentos_novo RENAME TO lancamentos;

      -- Os indices morreram junto com a tabela antiga; recriar e obrigatorio.
      CREATE INDEX idx_lanc_data          ON lancamentos(data);
      CREATE INDEX idx_lanc_data_tipo     ON lancamentos(data, tipo);
      CREATE INDEX idx_lanc_categoria     ON lancamentos(categoria_id);
      CREATE INDEX idx_lanc_conta         ON lancamentos(conta_id);
      CREATE INDEX idx_lanc_conta_destino ON lancamentos(conta_destino_id);
    `,
  },
  {
    versao: 6,
    nome: 'cor nas contas',
    sql: `
      -- Contas ganham cor para poderem aparecer em grafico (comparativo por
      -- conta) com a mesma linguagem visual das categorias. ALTER TABLE ADD
      -- COLUMN basta aqui -- ao contrario da migration 5, nao ha CHECK novo
      -- nem REFERENCES, e o DEFAULT e uma constante, entao o SQLite aceita.
      -- Contas que ja existiam adotam o cinza-azulado neutro.
      ALTER TABLE contas ADD COLUMN cor TEXT NOT NULL DEFAULT '#546E7A';
    `,
  },
  {
    versao: 7,
    nome: 'cor nos investimentos',
    sql: `
      -- Mesmo motivo da migration 6: a tela de Investimentos passa a ter rosca
      -- de distribuicao por banco, e fatia sem cor propria nao se distingue.
      ALTER TABLE investimentos ADD COLUMN cor TEXT NOT NULL DEFAULT '#1E88E5';
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
