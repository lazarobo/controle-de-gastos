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

const schema = sqlDoArquivo('src/db/migrations.ts', 'CREATE TABLE contas');
db.exec(schema);
const schemaPreferencias = sqlDoArquivo('src/db/migrations.ts', 'CREATE TABLE preferencias');
db.exec(schemaPreferencias);

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
  const sql = sqlDoArquivo('src/repos/contas.ts', 'AS total');
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

const schemaInvestimentos = sqlDoArquivo('src/db/migrations.ts', 'CREATE TABLE investimentos');
db.exec(schemaInvestimentos);

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
  const sqlSaldoTotal = sqlDoArquivo('src/repos/contas.ts', 'AS total');
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

db.close();

console.log(falhas === 0 ? '\nTudo certo.\n' : `\n${falhas} verificacao(oes) falharam.\n`);
process.exit(falhas === 0 ? 0 : 1);
