/**
 * Verificacao que roda no PC, sem celular e sem emulador.
 *
 * Executa o SQL REAL extraido de src/db e src/repos contra o node:sqlite, e as
 * funcoes de moeda/data importadas direto dos arquivos do app. Serve de rede de
 * seguranca para o criterio de aceite da Fase 4 ("os numeros conferem com o
 * calculo manual") antes de qualquer coisa ser digitada na mao no aparelho.
 *
 *   npm run verify
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

import { MIGRATIONS, VERSAO_ALVO } from '../src/db/migrations.ts';
import { formatarMoeda, formatarValor, parseMoeda } from '../src/utils/money.ts';
import {
  dataParaISO,
  formatarData,
  intervaloDoMes,
  isoParaData,
  somarMeses,
} from '../src/utils/date.ts';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

let falhas = 0;
function teste(nome: string, corpo: () => void) {
  try {
    corpo();
    console.log(`  ok   ${nome}`);
  } catch (erro) {
    falhas++;
    console.log(`  FALHA ${nome}`);
    console.log(`        ${erro instanceof Error ? erro.message : String(erro)}`);
  }
}

/** Le uma string entre crases do arquivo, escolhendo a que contem `marcador`. */
function sqlDoArquivo(caminho: string, marcador: string): string {
  const fonte = readFileSync(join(RAIZ, caminho), 'utf8');
  const blocos = fonte.match(/`[^`]*`/g) ?? [];
  const bloco = blocos.find((b) => b.includes(marcador));
  assert.ok(bloco, `Nao achei em ${caminho} um SQL contendo "${marcador}"`);
  return bloco.slice(1, -1);
}

// ---------------------------------------------------------------- moeda

console.log('\nmoeda');

teste('parseMoeda aceita os formatos que o usuario digita', () => {
  assert.equal(parseMoeda('1.234,56'), 123456);
  assert.equal(parseMoeda('1234,56'), 123456);
  assert.equal(parseMoeda('1234.56'), 123456);
  assert.equal(parseMoeda('1234'), 123400);
  assert.equal(parseMoeda('0,05'), 5);
  assert.equal(parseMoeda('12,5'), 1250);
  assert.equal(parseMoeda('R$ 89,90'), 8990);
});

teste('parseMoeda rejeita texto sem numero', () => {
  assert.equal(parseMoeda(''), null);
  assert.equal(parseMoeda('abc'), null);
});

teste('centavos inteiros nao acumulam erro de ponto flutuante', () => {
  // O caso que motivou trocar REAL por INTEGER: com float, 0.1 + 0.2 !== 0.3.
  const emFloat = Array.from({ length: 300 }, () => 0.1).reduce((a, b) => a + b, 0);
  assert.notEqual(emFloat, 30);

  const emCentavos = Array.from({ length: 300 }, () => 10).reduce((a, b) => a + b, 0);
  assert.equal(emCentavos, 3000);
  assert.equal(formatarValor(emCentavos), '30,00');
});

teste('formatarMoeda usa pt-BR', () => {
  const texto = formatarMoeda(123456);
  assert.match(texto, /1\.234,56/);
});

// ---------------------------------------------------------------- datas

console.log('\ndatas');

teste('dataParaISO usa o fuso local, nao UTC', () => {
  // 31/01 as 21h no horario de Brasilia vira 01/02 em UTC. O gasto tem de
  // continuar em janeiro.
  const noite = new Date(2026, 0, 31, 21, 30, 0);
  assert.equal(dataParaISO(noite), '2026-01-31');
});

teste('isoParaData nao volta um dia', () => {
  const d = isoParaData('2026-08-25');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 7);
  assert.equal(d.getDate(), 25);
});

teste('formatarData produz DD/MM/AAAA', () => {
  assert.equal(formatarData('2026-08-25'), '25/08/2026');
});

teste('intervaloDoMes cobre fevereiro bissexto e meses de 31', () => {
  assert.deepEqual(intervaloDoMes({ ano: 2024, mes: 2 }), {
    inicio: '2024-02-01',
    fim: '2024-02-29',
  });
  assert.deepEqual(intervaloDoMes({ ano: 2026, mes: 2 }), {
    inicio: '2026-02-01',
    fim: '2026-02-28',
  });
  assert.deepEqual(intervaloDoMes({ ano: 2026, mes: 1 }), {
    inicio: '2026-01-01',
    fim: '2026-01-31',
  });
});

teste('somarMeses atravessa o ano nos dois sentidos', () => {
  assert.deepEqual(somarMeses({ ano: 2026, mes: 12 }, 1), { ano: 2027, mes: 1 });
  assert.deepEqual(somarMeses({ ano: 2026, mes: 1 }, -1), { ano: 2025, mes: 12 });
  assert.deepEqual(somarMeses({ ano: 2026, mes: 8 }, -14), { ano: 2025, mes: 6 });
});

// ---------------------------------------------------------------- banco

console.log('\nbanco');

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON');

/**
 * Aplica as migrations REAIS, em ordem, com foreign_keys ligado -- igual ao
 * migrar() de src/db/migrations.ts. Antes este script montava o schema
 * extraindo blocos soltos por marcador, o que nao exercitava a SEQUENCIA das
 * migrations: um rebuild de tabela (migration 5) so quebra quando roda depois
 * das anteriores, com dados dentro.
 */
for (const m of MIGRATIONS) {
  db.exec(`BEGIN;${m.sql};PRAGMA user_version = ${m.versao};COMMIT;`);
}

teste('schema cria as tres tabelas e os indices', () => {
  const nomes = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((l: any) => l.name);
  assert.ok(nomes.includes('contas'));
  assert.ok(nomes.includes('categorias'));
  assert.ok(nomes.includes('lancamentos'));
  assert.ok(nomes.includes('preferencias'));

  const indices = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'")
    .all()
    .map((l: any) => l.name);
  assert.ok(indices.includes('idx_lanc_data_tipo'), 'falta o indice composto (data, tipo)');
});

teste('preferencias: SELECT do repo retorna null quando nao ha valor salvo', () => {
  const sqlSelect = sqlDoArquivo('src/repos/preferencias.ts', 'FROM preferencias');
  const r: any = db.prepare(sqlSelect).get('tema');
  assert.equal(r, undefined);
});

teste('preferencias: INSERT ... ON CONFLICT grava e depois atualiza (upsert real)', () => {
  const sqlUpsert = sqlDoArquivo('src/repos/preferencias.ts', 'ON CONFLICT');
  const sqlSelect = sqlDoArquivo('src/repos/preferencias.ts', 'FROM preferencias');

  db.prepare(sqlUpsert).run('tema', 'escuro');
  let r: any = db.prepare(sqlSelect).get('tema');
  assert.equal(r.valor, 'escuro');

  // Upsert de novo com a MESMA chave tem de trocar o valor, nao duplicar linha.
  db.prepare(sqlUpsert).run('tema', 'claro');
  r = db.prepare(sqlSelect).get('tema');
  assert.equal(r.valor, 'claro');

  const total: any = db.prepare('SELECT COUNT(*) AS n FROM preferencias').get();
  assert.equal(total.n, 1);
});

teste('CHECK barra valor zero ou negativo', () => {
  db.exec("INSERT INTO contas (nome, tipo, saldo_inicial) VALUES ('Teste', 'corrente', 0)");
  assert.throws(() =>
    db.exec(
      "INSERT INTO lancamentos (descricao, valor, tipo, data, conta_id) " +
        "VALUES ('x', 0, 'despesa', '2026-08-01', 1)",
    ),
  );
  assert.throws(() =>
    db.exec(
      "INSERT INTO lancamentos (descricao, valor, tipo, data, conta_id) " +
        "VALUES ('x', -500, 'despesa', '2026-08-01', 1)",
    ),
  );
  db.exec('DELETE FROM contas');
});

teste('CHECK barra tipo invalido', () => {
  assert.throws(() =>
    db.exec("INSERT INTO contas (nome, tipo, saldo_inicial) VALUES ('X', 'cripto', 0)"),
  );
});

teste('indice unico impede categoria duplicada no mesmo tipo', () => {
  db.exec("INSERT INTO categorias (nome, tipo, cor) VALUES ('Mercado', 'despesa', '#111')");
  assert.throws(() =>
    db.exec("INSERT INTO categorias (nome, tipo, cor) VALUES ('Mercado', 'despesa', '#222')"),
  );
  // Mesmo nome em tipo diferente e permitido ('Outros' existe nos dois).
  db.exec("INSERT INTO categorias (nome, tipo, cor) VALUES ('Mercado', 'receita', '#333')");
  db.exec('DELETE FROM categorias');
});

// Cenario com numeros redondos, para conferir no papel.
db.exec(`
  INSERT INTO contas (id, nome, tipo, saldo_inicial, ativo) VALUES
    (1, 'Corrente',  'corrente', 100000, 1),   -- R$ 1.000,00
    (2, 'Carteira',  'dinheiro',   5000, 1),   -- R$    50,00
    (3, 'Antiga',    'corrente',  90000, 0);   -- inativa, nao entra no total

  INSERT INTO categorias (id, nome, tipo, cor, sistema) VALUES
    (1, 'Alimentação', 'despesa', '#E53935', 0),
    (2, 'Transporte',  'despesa', '#FB8C00', 0),
    (3, 'Salário',     'receita', '#43A047', 0),
    (9, 'Ajuste de saldo', 'despesa', '#455A64', 1);

  INSERT INTO lancamentos (descricao, valor, tipo, data, conta_id, categoria_id) VALUES
    ('Salário',   500000, 'receita', '2026-08-05', 1, 3),
    ('Mercado',    25000, 'despesa', '2026-08-06', 1, 1),
    ('Padaria',     1250, 'despesa', '2026-08-06', 2, 1),
    ('Uber',        3750, 'despesa', '2026-08-07', 1, 2),
    ('Mês antigo', 99900, 'despesa', '2026-07-31', 1, 1);
`);

const AGOSTO = intervaloDoMes({ ano: 2026, mes: 8 });

teste('resumo do mes soma so o mes pedido', () => {
  const sql = sqlDoArquivo('src/repos/lancamentos.ts', "THEN valor END), 0) AS receitas");
  const r: any = db.prepare(sql).get(AGOSTO.inicio, AGOSTO.fim);

  // Conferindo na mao: receitas 5.000,00; despesas 250,00 + 12,50 + 37,50 = 300,00.
  assert.equal(r.receitas, 500000);
  assert.equal(r.despesas, 30000);
  assert.equal(r.receitas - r.despesas, 470000);
  assert.equal(formatarMoeda(r.receitas - r.despesas), formatarMoeda(470000));
});

teste('julho nao vaza para agosto', () => {
  const sql = sqlDoArquivo('src/repos/lancamentos.ts', "THEN valor END), 0) AS receitas");
  const julho = intervaloDoMes({ ano: 2026, mes: 7 });
  const r: any = db.prepare(sql).get(julho.inicio, julho.fim);
  assert.equal(r.despesas, 99900);
  assert.equal(r.receitas, 0);
});

teste('saldo por conta = inicial + receitas - despesas', () => {
  const sql = sqlDoArquivo('src/repos/contas.ts', 'AS saldo').replace('${filtro}', 'WHERE c.ativo = 1');
  const linhas: any[] = db.prepare(sql).all();

  const corrente = linhas.find((l) => l.id === 1);
  const carteira = linhas.find((l) => l.id === 2);

  // Corrente: 1.000,00 + 5.000,00 - 250,00 - 37,50 - 999,00 = 4.713,50
  assert.equal(corrente.saldo, 471350);
  // Carteira: 50,00 - 12,50 = 37,50
  assert.equal(carteira.saldo, 3750);
  // Conta inativa fora da lista.
  assert.equal(linhas.length, 2);
});

teste('saldo total ignora conta inativa', () => {
  const sql = sqlDoArquivo('src/repos/contas.ts', 'JOIN contas ld');
  const r: any = db.prepare(sql).get();
  assert.equal(r.total, 471350 + 3750);
});

teste('totais por categoria batem com o resumo do mes', () => {
  const sql = sqlDoArquivo('src/repos/lancamentos.ts', 'GROUP BY l.categoria_id');
  const linhas: any[] = db.prepare(sql).all('despesa', AGOSTO.inicio, AGOSTO.fim);

  assert.equal(linhas[0].categoria_nome, 'Alimentação');
  assert.equal(linhas[0].total, 26250); // 250,00 + 12,50
  assert.equal(linhas[1].total, 3750);

  const soma = linhas.reduce((a, l) => a + l.total, 0);
  assert.equal(soma, 30000, 'a soma da pizza tem de bater com as despesas do mes');
});

teste('ON DELETE RESTRICT protege conta com historico', () => {
  assert.throws(
    () => db.exec('DELETE FROM contas WHERE id = 1'),
    /FOREIGN KEY/i,
  );
});

teste('ON DELETE SET NULL preserva o lancamento e o total', () => {
  const antes: any = db
    .prepare("SELECT SUM(valor) AS t FROM lancamentos WHERE tipo = 'despesa' AND data BETWEEN ? AND ?")
    .get(AGOSTO.inicio, AGOSTO.fim);

  db.exec('DELETE FROM categorias WHERE id = 2'); // Transporte

  const depois: any = db
    .prepare("SELECT SUM(valor) AS t FROM lancamentos WHERE tipo = 'despesa' AND data BETWEEN ? AND ?")
    .get(AGOSTO.inicio, AGOSTO.fim);

  assert.equal(depois.t, antes.t, 'excluir categoria nao pode mudar o total gasto');

  const sql = sqlDoArquivo('src/repos/lancamentos.ts', 'GROUP BY l.categoria_id');
  const linhas: any[] = db.prepare(sql).all('despesa', AGOSTO.inicio, AGOSTO.fim);
  assert.ok(
    linhas.some((l) => l.categoria_nome === 'Sem categoria' && l.total === 3750),
    'o gasto orfao tem de aparecer como "Sem categoria" na pizza',
  );
});

teste('investimentos: CHECK barra valor negativo', () => {
  assert.throws(() =>
    db.exec("INSERT INTO investimentos (nome, valor) VALUES ('XP', -100)"),
  );
});

teste('investimentos: total() soma tudo em centavos', () => {
  db.exec(`
    INSERT INTO investimentos (nome, valor) VALUES
      ('XP', 150000),
      ('Nubank', 50000);
  `);
  const sqlTotal = sqlDoArquivo('src/repos/investimentos.ts', 'SUM(valor)');
  const r: any = db.prepare(sqlTotal).get();
  assert.equal(r.total, 200000); // R$ 1.500,00 + R$ 500,00
});

teste('investimentos: NAO entra no saldo total das contas (isolamento exigido pelo usuario)', () => {
  const sqlSaldoTotal = sqlDoArquivo('src/repos/contas.ts', 'JOIN contas ld');
  const antes: any = db.prepare(sqlSaldoTotal).get();

  // Mais um investimento grande, so pra garantir que mexeria no total SE houvesse
  // qualquer join ou referencia cruzada entre as duas tabelas.
  db.exec("INSERT INTO investimentos (nome, valor) VALUES ('Rico', 999999900)");

  const depois: any = db.prepare(sqlSaldoTotal).get();
  assert.equal(
    depois.total,
    antes.total,
    'saldoTotal() de contas.ts mudou depois de inserir em investimentos — nao deveria haver relacao nenhuma',
  );
});

teste('metas: CHECK barra valor zero ou negativo', () => {
  assert.throws(() => db.exec('INSERT INTO metas (categoria_id, valor) VALUES (1, 0)'));
  assert.throws(() => db.exec('INSERT INTO metas (categoria_id, valor) VALUES (1, -100)'));
});

teste('metas: UNIQUE(categoria_id) impede duas metas na mesma categoria', () => {
  db.exec('INSERT INTO metas (categoria_id, valor) VALUES (1, 20000)');
  assert.throws(() => db.exec('INSERT INTO metas (categoria_id, valor) VALUES (1, 30000)'));
});

teste('metas: definir() faz upsert de verdade (SQL real do repo)', () => {
  const sqlUpsert = sqlDoArquivo('src/repos/metas.ts', 'ON CONFLICT');
  db.prepare(sqlUpsert).run(1, 25000);

  const r: any = db.prepare('SELECT valor FROM metas WHERE categoria_id = 1').get();
  assert.equal(r.valor, 25000, 'upsert tinha que ATUALIZAR a meta existente, nao duplicar');

  const total: any = db.prepare('SELECT COUNT(*) AS n FROM metas WHERE categoria_id = 1').get();
  assert.equal(total.n, 1);
});

teste('metas: ON DELETE CASCADE remove a meta quando a categoria some', () => {
  db.exec("INSERT INTO categorias (nome, tipo, cor) VALUES ('Descartavel', 'despesa', '#000')");
  const cat: any = db.prepare("SELECT id FROM categorias WHERE nome = 'Descartavel'").get();
  db.exec(`INSERT INTO metas (categoria_id, valor) VALUES (${cat.id}, 10000)`);

  db.exec(`DELETE FROM categorias WHERE id = ${cat.id}`);

  const r: any = db.prepare('SELECT COUNT(*) AS n FROM metas WHERE categoria_id = ?').get(cat.id);
  assert.equal(r.n, 0, 'excluir a categoria tinha que levar a meta junto (CASCADE)');
});

teste('metas: listarComProgresso soma o gasto real da categoria no mes (SQL real do repo)', () => {
  // Categoria 1 (Alimentacao) ja tem R$ 262,50 de despesa em agosto/2026 dos
  // testes de lancamentos acima (Mercado 250,00 + Padaria 12,50).
  const sqlProgresso = sqlDoArquivo('src/repos/metas.ts', 'AS gasto');
  const linhas: any[] = db.prepare(sqlProgresso).all(AGOSTO.inicio, AGOSTO.fim);

  const alimentacao = linhas.find((l) => l.categoria_id === 1);
  assert.ok(alimentacao, 'meta da categoria 1 nao apareceu no resultado');
  assert.equal(alimentacao.meta, 25000); // R$ 250,00, definido no teste de upsert acima
  assert.equal(alimentacao.gasto, 26250); // R$ 262,50
  assert.ok(alimentacao.gasto > alimentacao.meta, 'este cenario tem de representar estouro de meta');
});

teste('totaisPorDia: agrega so despesa por dia e acha o dia de maior gasto (SQL real do repo)', () => {
  const sqlPorDia = sqlDoArquivo('src/repos/lancamentos.ts', 'GROUP BY data');
  const linhas: any[] = db.prepare(sqlPorDia).all(AGOSTO.inicio, AGOSTO.fim);

  // 06/08: Mercado 250,00 + Padaria 12,50 = 262,50 -- o dia de maior gasto do mes.
  const dia06 = linhas.find((l) => l.data === '2026-08-06');
  assert.equal(dia06.total, 26250);

  // 07/08: Uber 37,50, bem menor que o dia 06.
  const dia07 = linhas.find((l) => l.data === '2026-08-07');
  assert.equal(dia07.total, 3750);

  // 05/08 so tem RECEITA (Salario) -- o WHERE tipo='despesa' tem de excluir esse dia.
  const dia05 = linhas.find((l) => l.data === '2026-08-05');
  assert.equal(dia05, undefined, 'dia so com receita nao pode aparecer no grafico de gasto');

  const maior = linhas.reduce((m, l) => (l.total > m.total ? l : m));
  assert.equal(maior.data, '2026-08-06', 'dia 06 tem de ser identificado como o de maior gasto');
});

teste('evolucaoMensal: agrega receitas/despesas por mes (SQL real do repo)', () => {
  const sqlEvolucao = sqlDoArquivo('src/repos/lancamentos.ts', 'GROUP BY substr(data, 1, 7)');
  const linhas: any[] = db.prepare(sqlEvolucao).all('2026-07-01', '2026-08-31');

  const julho = linhas.find((l) => l.mes === '2026-07');
  const agosto = linhas.find((l) => l.mes === '2026-08');

  assert.equal(julho.despesas, 99900);
  assert.equal(julho.receitas, 0);
  assert.equal(agosto.despesas, 30000);
  assert.equal(agosto.receitas, 500000);
});

// -------------------------------------------- migration 5 (rebuild da tabela)

console.log('\nmigration 5 — rebuild de lancamentos');

/**
 * O cenario que assusta: um celular JA EM USO, com dados reais na versao 4,
 * recebendo a atualizacao que reconstroi a tabela `lancamentos`. Aqui isso e
 * simulado de verdade -- migrations 1..4, dados dentro, e so entao a 5.
 */
function bancoNaVersao(versaoMax: number): DatabaseSync {
  const b = new DatabaseSync(':memory:');
  b.exec('PRAGMA foreign_keys = ON');
  for (const m of MIGRATIONS) {
    if (m.versao > versaoMax) continue;
    b.exec(`BEGIN;${m.sql};PRAGMA user_version = ${m.versao};COMMIT;`);
  }
  return b;
}

const antigo = bancoNaVersao(4);
antigo.exec(`
  INSERT INTO contas (id, nome, tipo, saldo_inicial) VALUES
    (1, 'Corrente', 'corrente', 100000),
    (2, 'Poupanca', 'poupanca',  50000);
  INSERT INTO categorias (id, nome, tipo, cor) VALUES (1, 'Mercado', 'despesa', '#111');
  INSERT INTO lancamentos (id, descricao, valor, tipo, data, conta_id, categoria_id, observacao)
  VALUES (1, 'Compra antiga', 12345, 'despesa', '2026-08-10', 1, 1, 'obs preservada');
`);

const migration5 = MIGRATIONS.find((m) => m.versao === 5)!;
antigo.exec(`BEGIN;${migration5.sql};PRAGMA user_version = 5;COMMIT;`);

teste('rebuild preserva os lancamentos que ja existiam, campo a campo', () => {
  const l: any = antigo.prepare('SELECT * FROM lancamentos WHERE id = 1').get();
  assert.equal(l.descricao, 'Compra antiga');
  assert.equal(l.valor, 12345);
  assert.equal(l.tipo, 'despesa');
  assert.equal(l.data, '2026-08-10');
  assert.equal(l.conta_id, 1);
  assert.equal(l.categoria_id, 1);
  assert.equal(l.observacao, 'obs preservada');
  assert.equal(l.conta_destino_id, null, 'lancamento antigo nao pode ganhar destino');
});

teste('rebuild mantem o AUTOINCREMENT — proximo id nao colide com os antigos', () => {
  antigo.exec(
    "INSERT INTO lancamentos (descricao, valor, tipo, data, conta_id) " +
      "VALUES ('Depois do rebuild', 500, 'despesa', '2026-08-11', 1)",
  );
  const novo: any = antigo
    .prepare("SELECT id FROM lancamentos WHERE descricao = 'Depois do rebuild'")
    .get();
  assert.ok(novo.id > 1, `id ${novo.id} colidiria com o lancamento preservado`);
});

teste('rebuild recria os indices (senao as consultas do dashboard viram varredura)', () => {
  const indices = antigo
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_lanc%'")
    .all()
    .map((l: any) => l.name);
  for (const esperado of [
    'idx_lanc_data',
    'idx_lanc_data_tipo',
    'idx_lanc_categoria',
    'idx_lanc_conta',
    'idx_lanc_conta_destino',
  ]) {
    assert.ok(indices.includes(esperado), `indice ${esperado} nao foi recriado`);
  }
});

teste('rebuild mantem as FKs vivas (ON DELETE RESTRICT continua valendo)', () => {
  assert.throws(
    () => antigo.exec('DELETE FROM contas WHERE id = 1'),
    /FOREIGN KEY/i,
    'a FK conta_id se perdeu no rebuild',
  );
});

teste('foreign_key_check nao acusa nada depois do rebuild', () => {
  const problemas = antigo.prepare('PRAGMA foreign_key_check').all();
  assert.equal(problemas.length, 0, JSON.stringify(problemas));
});

teste('CHECK: transferencia exige conta de destino', () => {
  assert.throws(() =>
    antigo.exec(
      "INSERT INTO lancamentos (descricao, valor, tipo, data, conta_id) " +
        "VALUES ('sem destino', 100, 'transferencia', '2026-08-12', 1)",
    ),
  );
});

teste('CHECK: transferencia nao pode ter origem e destino iguais', () => {
  assert.throws(() =>
    antigo.exec(
      "INSERT INTO lancamentos (descricao, valor, tipo, data, conta_id, conta_destino_id) " +
        "VALUES ('pra si mesma', 100, 'transferencia', '2026-08-12', 1, 1)",
    ),
  );
});

teste('CHECK: transferencia nao pode ter categoria', () => {
  assert.throws(() =>
    antigo.exec(
      "INSERT INTO lancamentos (descricao, valor, tipo, data, conta_id, conta_destino_id, categoria_id) " +
        "VALUES ('com categoria', 100, 'transferencia', '2026-08-12', 1, 2, 1)",
    ),
  );
});

teste('CHECK: receita/despesa nao podem ter conta de destino', () => {
  assert.throws(() =>
    antigo.exec(
      "INSERT INTO lancamentos (descricao, valor, tipo, data, conta_id, conta_destino_id) " +
        "VALUES ('despesa com destino', 100, 'despesa', '2026-08-12', 1, 2)",
    ),
  );
});

teste('transferencia valida entra sem reclamar', () => {
  antigo.exec(
    "INSERT INTO lancamentos (descricao, valor, tipo, data, conta_id, conta_destino_id) " +
      "VALUES ('Corrente -> Poupanca', 30000, 'transferencia', '2026-08-12', 1, 2)",
  );
  const r: any = antigo
    .prepare("SELECT COUNT(*) AS n FROM lancamentos WHERE tipo = 'transferencia'")
    .get();
  assert.equal(r.n, 1);
});

// ---------------------------------------------- transferencia x saldos/KPIs

console.log('\ntransferencia — efeito nos numeros');

const tr = bancoNaVersao(VERSAO_ALVO);
tr.exec(`
  INSERT INTO contas (id, nome, tipo, saldo_inicial, ativo) VALUES
    (1, 'Corrente', 'corrente', 100000, 1),
    (2, 'Poupanca', 'poupanca',       0, 1),
    (3, 'Guardada', 'corrente',       0, 0);
  INSERT INTO categorias (id, nome, tipo, cor) VALUES (1, 'Mercado', 'despesa', '#111');
  INSERT INTO lancamentos (descricao, valor, tipo, data, conta_id, categoria_id)
    VALUES ('Mercado', 20000, 'despesa', '2026-08-03', 1, 1);
  INSERT INTO lancamentos (descricao, valor, tipo, data, conta_id, conta_destino_id)
    VALUES ('Corrente -> Poupanca', 30000, 'transferencia', '2026-08-04', 1, 2);
`);

const SQL_SALDOS = sqlDoArquivo('src/repos/contas.ts', 'AS saldo').replace(
  '${filtro}',
  'WHERE c.ativo = 1',
);
const SQL_SALDO_TOTAL = sqlDoArquivo('src/repos/contas.ts', 'JOIN contas ld');

teste('transferencia SAI da origem e ENTRA no destino', () => {
  const linhas: any[] = tr.prepare(SQL_SALDOS).all();
  const corrente = linhas.find((l) => l.id === 1);
  const poupanca = linhas.find((l) => l.id === 2);

  // Corrente: 1.000,00 - 200,00 (mercado) - 300,00 (transferencia) = 500,00
  assert.equal(corrente.saldo, 50000);
  // Poupanca: 0 + 300,00 recebidos = 300,00
  assert.equal(poupanca.saldo, 30000);
});

teste('transferencia entre contas ativas NAO muda o saldo total', () => {
  const antesTotal: any = tr.prepare(SQL_SALDO_TOTAL).get();

  tr.exec(
    "INSERT INTO lancamentos (descricao, valor, tipo, data, conta_id, conta_destino_id) " +
      "VALUES ('mais uma', 7777, 'transferencia', '2026-08-05', 2, 1)",
  );

  const depoisTotal: any = tr.prepare(SQL_SALDO_TOTAL).get();
  assert.equal(
    depoisTotal.total,
    antesTotal.total,
    'mover dinheiro entre contas proprias nao pode mudar quanto voce tem',
  );
});

teste('transferencia NAO entra em receitas nem despesas do mes', () => {
  const sqlResumo = sqlDoArquivo('src/repos/lancamentos.ts', "THEN valor END), 0) AS receitas");
  const r: any = tr.prepare(sqlResumo).get('2026-08-01', '2026-08-31');

  assert.equal(r.receitas, 0, 'transferencia virou receita');
  assert.equal(r.despesas, 20000, 'so o mercado e despesa; a transferencia vazou');
});

teste('transferencia NAO aparece no grafico de categoria', () => {
  const sqlCat = sqlDoArquivo('src/repos/lancamentos.ts', 'GROUP BY l.categoria_id');
  const linhas: any[] = tr.prepare(sqlCat).all('despesa', '2026-08-01', '2026-08-31');

  const soma = linhas.reduce((a, l) => a + l.total, 0);
  assert.equal(soma, 20000, 'a pizza tem de somar so as despesas de verdade');
});

teste('transferencia NAO aparece no grafico de gasto por dia', () => {
  const sqlDia = sqlDoArquivo('src/repos/lancamentos.ts', 'GROUP BY data');
  const linhas: any[] = tr.prepare(sqlDia).all('2026-08-01', '2026-08-31');

  assert.equal(linhas.length, 1, 'so o dia 03 teve despesa real');
  assert.equal(linhas[0].data, '2026-08-03');
});

teste('contarLancamentos enxerga a conta como DESTINO (senao a UI mente)', () => {
  const sqlContar = sqlDoArquivo('src/repos/contas.ts', 'OR conta_destino_id = ?');
  const r: any = tr.prepare(sqlContar).get(2, 2);
  assert.equal(r.total, 2, 'a poupanca participa de duas transferencias');
});

teste('totaisPorConta separa receita e despesa por conta, ignorando transferencia', () => {
  tr.exec(`
    INSERT INTO lancamentos (descricao, valor, tipo, data, conta_id, categoria_id)
      VALUES ('Salario', 400000, 'receita', '2026-08-02', 1, NULL);
  `);

  const sql = sqlDoArquivo('src/repos/lancamentos.ts', 'HAVING receitas > 0');
  const linhas: any[] = tr.prepare(sql).all('2026-08-01', '2026-08-31');

  const corrente = linhas.find((l) => l.conta_id === 1);
  assert.equal(corrente.receitas, 400000);
  assert.equal(corrente.despesas, 20000);

  // A poupanca so aparece em transferencias -- nao pode entrar no comparativo,
  // senao pareceria ter recebido 300,00 de receita.
  const poupanca = linhas.find((l) => l.conta_id === 2);
  assert.equal(poupanca, undefined, 'conta so com transferencia vazou para o comparativo');
});

teste('migration 6/7: contas e investimentos ganharam cor com default utilizavel', () => {
  const conta: any = tr.prepare('SELECT cor FROM contas WHERE id = 1').get();
  assert.match(conta.cor, /^#[0-9A-Fa-f]{6}$/);

  tr.exec("INSERT INTO investimentos (nome, valor) VALUES ('XP', 100000)");
  const inv: any = tr.prepare("SELECT cor FROM investimentos WHERE nome = 'XP'").get();
  assert.match(inv.cor, /^#[0-9A-Fa-f]{6}$/);
});

tr.close();
antigo.close();

db.close();

console.log(falhas === 0 ? '\nTudo certo.\n' : `\n${falhas} verificacao(oes) falharam.\n`);
process.exit(falhas === 0 ? 0 : 1);
