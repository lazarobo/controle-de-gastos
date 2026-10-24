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
import {
  formatarMoeda,
  formatarMoedaOculta,
  formatarValor,
  MASCARA_MOEDA,
  parseMoeda,
} from '../src/utils/money.ts';
import {
  proximosLembretesBackup,
  proximosLembretesDiarios,
} from '../src/utils/lembretes.ts';
import { hexParaHsv, hsvParaHex, luminancia, normalizarHex } from '../src/utils/cor.ts';
import {
  agruparFaturas,
  calcularParcelas,
  faturaDe,
  lerJurosBp,
  somarMesesISO,
} from '../src/utils/cartao.ts';
import {
  dataParaISO,
  formatarData,
  horaDe,
  textoParaHora,
  intervaloDoMes,
  isoParaData,
  lerHora,
  mascararData,
  mascararHora,
  somarMeses,
  textoParaISO,
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

  // Trechos compartilhados (`const FORA_INVESTIMENTO = \`...\``) entram no SQL
  // por interpolacao; resolve aqui como o JS resolveria. Interpolacao de
  // variavel local (ex.: ${filtro}) fica intacta para o teste trocar.
  const constantes = new Map<string, string>();
  for (const m of fonte.matchAll(/const (\w+) = `([^`]*)`;/g)) constantes.set(m[1], m[2]);
  return bloco
    .slice(1, -1)
    .replace(/\$\{(\w+)\}/g, (inteiro, nome) => constantes.get(nome) ?? inteiro);
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

teste('olhinho fechado esconde o valor; aberto mostra igual a antes', () => {
  assert.equal(formatarMoedaOculta(123456, false), formatarMoeda(123456));
  assert.equal(formatarMoedaOculta(123456, true), MASCARA_MOEDA);
});

teste('mascara nao deixa escapar a ordem de grandeza', () => {
  // Mascara de largura fixa: R$ 12,00 e R$ 1.200.000,00 tem de ficar iguais,
  // senao da para adivinhar o tamanho do numero so de olhar.
  assert.equal(formatarMoedaOculta(1200, true), formatarMoedaOculta(120000000, true));
  assert.ok(!/[0-9]/.test(MASCARA_MOEDA), 'a mascara nao pode conter digito');
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

teste('textoParaISO aceita data valida e recusa data inexistente', () => {
  assert.equal(textoParaISO('25/08/2026'), '2026-08-25');
  assert.equal(textoParaISO('31/02/2026'), null, '31/02 viraria 03/03 sem a checagem');
  assert.equal(textoParaISO('29/02/2024'), '2024-02-29');
  assert.equal(textoParaISO('2026-08-25'), null);
  assert.equal(textoParaISO('5/8/2026'), null);
});

teste('mascararData insere as barras e ignora o que nao e digito', () => {
  assert.equal(mascararData('2508'), '25/08');
  assert.equal(mascararData('25082026'), '25/08/2026');
  assert.equal(mascararData('25/08/2026'), '25/08/2026');
  assert.equal(mascararData('250820269999'), '25/08/2026');
});

/**
 * Espelha o migrar() de src/db/migrations.ts, INCLUSIVE o ramo que desliga as
 * FKs fora da transacao. Se este script aplicasse tudo do jeito antigo, a
 * migration 8 quebraria aqui por um motivo que o app nao tem -- ou pior, se
 * alguem "consertasse" o teste, deixaria de testar o que o app executa.
 */
function aplicarMigration(b: DatabaseSync, m: (typeof MIGRATIONS)[number]) {
  if (!m.desligaChavesEstrangeiras) {
    b.exec(`BEGIN;${m.sql};PRAGMA user_version = ${m.versao};COMMIT;`);
    return;
  }
  b.exec('PRAGMA foreign_keys = OFF');
  try {
    b.exec('BEGIN');
    b.exec(m.sql);
    const orfas = b.prepare('PRAGMA foreign_key_check').all();
    if (orfas.length > 0) throw new Error(`referencias orfas: ${JSON.stringify(orfas)}`);
    b.exec(`PRAGMA user_version = ${m.versao}`);
    b.exec('COMMIT');
  } catch (erro) {
    try { b.exec('ROLLBACK'); } catch {}
    throw erro;
  } finally {
    b.exec('PRAGMA foreign_keys = ON');
  }
}


console.log('\nlembretes');

teste('lerHora recusa horario que nao existe no relogio', () => {
  assert.deepEqual(lerHora('20:00'), { hora: 20, minuto: 0 });
  assert.deepEqual(lerHora('00:00'), { hora: 0, minuto: 0 });
  assert.equal(lerHora('24:00'), null);
  assert.equal(lerHora('10:75'), null);
  assert.equal(lerHora('8:30'), null);
});

teste('mascararHora insere os dois pontos', () => {
  assert.equal(mascararHora('20'), '20');
  assert.equal(mascararHora('2030'), '20:30');
  assert.equal(mascararHora('20:30'), '20:30');
  assert.equal(mascararHora('20309999'), '20:30');
});

teste('lembrete diario pula hoje quando voce JA lancou', () => {
  // 16/09 as 18h, lembrete as 20h: ainda daria para tocar hoje...
  const agora = new Date(2026, 8, 16, 18, 0);
  const datas = proximosLembretesDiarios(agora, { hora: 20, minuto: 0 }, true, 3);
  assert.equal(datas[0].getDate(), 17, '...mas ja lancou, entao comeca amanha');
  assert.equal(datas[0].getHours(), 20);
});

teste('lembrete diario toca hoje se ainda nao lancou e a hora nao passou', () => {
  const agora = new Date(2026, 8, 16, 18, 0);
  const datas = proximosLembretesDiarios(agora, { hora: 20, minuto: 0 }, false, 3);
  assert.equal(datas[0].getDate(), 16);
});

teste('lembrete diario nao agenda no passado', () => {
  // 22h, lembrete de 20h ja passou: nao adianta agendar para tras.
  const agora = new Date(2026, 8, 16, 22, 0);
  const datas = proximosLembretesDiarios(agora, { hora: 20, minuto: 0 }, false, 3);
  assert.equal(datas[0].getDate(), 17);
  assert.ok(datas.every((d) => d.getTime() > agora.getTime()));
});

teste('lembrete diario devolve dias consecutivos, cobrindo quem sumiu', () => {
  const agora = new Date(2026, 8, 16, 18, 0);
  const datas = proximosLembretesDiarios(agora, { hora: 21, minuto: 30 }, false, 7);
  assert.equal(datas.length, 7);
  for (let i = 1; i < datas.length; i++) {
    const diff = datas[i].getTime() - datas[i - 1].getTime();
    assert.equal(diff, 24 * 60 * 60 * 1000, 'as datas tem de ser dias seguidos');
  }
  assert.equal(datas[0].getHours(), 21);
  assert.equal(datas[0].getMinutes(), 30);
});

teste('lembrete diario atravessa a virada do mes', () => {
  const agora = new Date(2026, 8, 30, 22, 0);
  const datas = proximosLembretesDiarios(agora, { hora: 20, minuto: 0 }, false, 2);
  assert.equal(datas[0].getDate(), 1);
  assert.equal(datas[0].getMonth(), 9, 'outubro');
});

teste('lembrete de backup conta a partir do ultimo backup, nao de hoje', () => {
  const agora = new Date(2026, 8, 16, 12, 0);
  const datas = proximosLembretesBackup(agora, isoParaData('2026-09-10'), { hora: 20, minuto: 0 }, 2);
  // 10/09 + 30 dias = 10/10
  assert.equal(datas[0].getDate(), 10);
  assert.equal(datas[0].getMonth(), 9);
});

teste('backup vencido ha muito tempo cobra amanha, nao no passado', () => {
  const agora = new Date(2026, 8, 16, 12, 0);
  const datas = proximosLembretesBackup(agora, isoParaData('2026-01-01'), { hora: 20, minuto: 0 }, 1);
  assert.ok(datas[0].getTime() > agora.getTime());
  assert.equal(datas[0].getDate(), 17);
});

teste('sem backup nenhum, cobra em 30 dias', () => {
  const agora = new Date(2026, 8, 16, 12, 0);
  const datas = proximosLembretesBackup(agora, null, { hora: 20, minuto: 0 }, 1);
  assert.equal(datas[0].getMonth(), 9);
  assert.equal(datas[0].getDate(), 16);
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
for (const m of MIGRATIONS) aplicarMigration(db, m);

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
    aplicarMigration(b, m);
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
aplicarMigration(antigo, migration5);

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

teste('migration 6: contas ganharam cor com default utilizavel', () => {
  const conta: any = tr.prepare('SELECT cor FROM contas WHERE id = 1').get();
  assert.match(conta.cor, /^#[0-9A-Fa-f]{6}$/);
});

tr.close();
antigo.close();

// -------------------------------------------- migration 8 (rebuild de contas)

console.log('\nmigration 8 — rebuild de contas (tabela referenciada)');

function bancoV7ComDados(): DatabaseSync {
  const b = bancoNaVersao(7);
  b.exec(`
    INSERT INTO contas (id, nome, tipo, saldo_inicial, cor) VALUES
      (1, 'Nubank', 'corrente', 100000, '#8E24AA'),
      (2, 'Carteira', 'dinheiro', 5000, '#43A047');
    INSERT INTO lancamentos (descricao, valor, tipo, data, conta_id)
      VALUES ('Mercado', 20000, 'despesa', '2026-09-01', 1);
    INSERT INTO lancamentos (descricao, valor, tipo, data, conta_id, conta_destino_id)
      VALUES ('Nubank -> Carteira', 3000, 'transferencia', '2026-09-02', 1, 2);
  `);
  return b;
}

const migration8 = MIGRATIONS.find((m) => m.versao === 8)!;

teste('sem desligar as FKs, a migration 8 FALHA (prova que o flag e necessario)', () => {
  const b = bancoV7ComDados();
  assert.throws(() =>
    b.exec(`BEGIN;${migration8.sql};PRAGMA user_version = 8;COMMIT;`),
  );
  try { b.exec('ROLLBACK'); } catch {}
  const v: any = b.prepare('PRAGMA user_version').get();
  assert.equal(v.user_version, 7, 'falha tem de deixar o banco intacto na versao 7');
  b.close();
});

const v8 = bancoV7ComDados();
aplicarMigration(v8, migration8);

teste('rebuild de contas preserva as contas campo a campo (inclusive a cor)', () => {
  const c: any = v8.prepare('SELECT * FROM contas WHERE id = 1').get();
  assert.equal(c.nome, 'Nubank');
  assert.equal(c.tipo, 'corrente');
  assert.equal(c.saldo_inicial, 100000);
  assert.equal(c.cor, '#8E24AA');
  assert.equal(c.data_inicio, null);
});

teste('lancamentos continuam apontando para as contas certas', () => {
  const sql = sqlDoArquivo('src/repos/contas.ts', 'AS saldo').replace('${filtro}', '');
  const linhas: any[] = v8.prepare(sql).all();
  // Nubank: 1.000 - 200 - 30 = 770 ; Carteira: 50 + 30 = 80
  assert.equal(linhas.find((l) => l.id === 1).saldo, 77000);
  assert.equal(linhas.find((l) => l.id === 2).saldo, 8000);
});

teste('FKs religadas depois: RESTRICT de contas continua valendo', () => {
  const fk: any = v8.prepare('PRAGMA foreign_keys').get();
  assert.equal(fk.foreign_keys, 1, 'o runner tem de religar as FKs');
  assert.throws(() => v8.exec('DELETE FROM contas WHERE id = 1'), /FOREIGN KEY/i);
});

teste('foreign_key_check limpo e versao 8 gravada', () => {
  assert.equal(v8.prepare('PRAGMA foreign_key_check').all().length, 0);
  const v: any = v8.prepare('PRAGMA user_version').get();
  assert.equal(v.user_version, 8);
});

teste('CHECK: aceita tipo evento com datas; recusa datas em conta comum', () => {
  v8.exec(
    "INSERT INTO contas (nome, tipo, data_inicio, data_fim) VALUES ('Floripa', 'evento', '2026-10-10', '2026-10-15')",
  );
  assert.throws(() =>
    v8.exec("INSERT INTO contas (nome, tipo, data_inicio) VALUES ('X', 'corrente', '2026-10-10')"),
  );
});

teste('CHECK: evento nao pode terminar antes de comecar', () => {
  assert.throws(() =>
    v8.exec(
      "INSERT INTO contas (nome, tipo, data_inicio, data_fim) VALUES ('Y', 'evento', '2026-10-15', '2026-10-10')",
    ),
  );
});

teste('eventos.listar separa entrou, gasto e devolvido (SQL real do repo)', () => {
  const floripa: any = v8.prepare("SELECT id FROM contas WHERE nome = 'Floripa'").get();
  v8.exec(`
    INSERT INTO lancamentos (descricao, valor, tipo, data, conta_id, conta_destino_id)
      VALUES ('Reserva', 50000, 'transferencia', '2026-10-01', 1, ${floripa.id});
    INSERT INTO lancamentos (descricao, valor, tipo, data, conta_id)
      VALUES ('Jantar', 12000, 'despesa', '2026-10-11', ${floripa.id});
    INSERT INTO lancamentos (descricao, valor, tipo, data, conta_id, conta_destino_id)
      VALUES ('Sobra', 8000, 'transferencia', '2026-10-16', ${floripa.id}, 1);
  `);

  const sql = sqlDoArquivo('src/repos/eventos.ts', 'AS devolvido').replace('${filtro}', '');
  const e: any = v8.prepare(sql).all().find((l: any) => l.id === floripa.id);

  assert.equal(e.entrou, 50000, 'reserva de 500,00');
  assert.equal(e.gasto, 12000, 'so o jantar e gasto');
  assert.equal(e.devolvido, 8000, 'devolver a sobra NAO e gastar');
  // Mesma conta que contas.saldos() faz: 500 - 120 - 80 = 300
  assert.equal(e.entrou - e.gasto - e.devolvido, 30000);
});

teste('evento bate com contas.saldos() (as duas contabilidades nao divergem)', () => {
  const floripa: any = v8.prepare("SELECT id FROM contas WHERE nome = 'Floripa'").get();
  const sqlSaldos = sqlDoArquivo('src/repos/contas.ts', 'AS saldo').replace('${filtro}', '');
  const s: any = v8.prepare(sqlSaldos).all().find((l: any) => l.id === floripa.id);
  assert.equal(s.saldo, 30000);
});

v8.close();

// ------------------------- migration 9 (investimentos viram contas; hora)

console.log('\nmigration 9 — investimentos como conta, hora nos lancamentos');

function bancoV8ComDados(): DatabaseSync {
  const b = bancoNaVersao(8);
  b.exec(`
    INSERT INTO contas (id, nome, tipo, saldo_inicial, cor) VALUES
      (1, 'Nubank', 'corrente', 100000, '#8E24AA'),
      (2, 'Floripa', 'evento', 0, '#00897B');
    INSERT INTO lancamentos (descricao, valor, tipo, data, conta_id)
      VALUES ('Mercado', 20000, 'despesa', '2026-09-01', 1);
    INSERT INTO lancamentos (descricao, valor, tipo, data, conta_id, conta_destino_id)
      VALUES ('Reserva', 30000, 'transferencia', '2026-09-02', 1, 2);
    INSERT INTO investimentos (nome, valor, observacao, cor) VALUES
      ('XP', 150000, 'CDB', '#1E88E5'),
      ('Rico', 50000, NULL, '#F57C00');
  `);
  return b;
}

const migration9 = MIGRATIONS.find((m) => m.versao === 9)!;
const v9 = bancoV8ComDados();
aplicarMigration(v9, migration9);

const SQL_INVESTIMENTOS = sqlDoArquivo('src/repos/investimentos.ts', 'AS rendimento').replace(
  '${filtro}',
  '',
);
const SQL_SALDO_TOTAL_V9 = sqlDoArquivo('src/repos/contas.ts', 'JOIN contas ld');
const SQL_SALDOS_V9 = sqlDoArquivo('src/repos/contas.ts', 'AS saldo').replace('${filtro}', '');

/** Mesma conta que investimentos.listar() faz depois da consulta. */
function investimentosV9(b: DatabaseSync) {
  return (b.prepare(SQL_INVESTIMENTOS).all() as any[]).map((l) => ({
    ...l,
    valor: l.aportado + l.rendimento,
  }));
}

teste('cada investimento virou uma conta, com valor, cor e observacao', () => {
  const xp: any = v9.prepare("SELECT * FROM contas WHERE nome = 'XP'").get();
  assert.equal(xp.tipo, 'investimento');
  assert.equal(xp.saldo_inicial, 150000);
  assert.equal(xp.cor, '#1E88E5');
  assert.equal(xp.observacao, 'CDB');
  assert.equal(xp.ativo, 1);
  assert.ok(xp.id > 2, 'id novo, depois das contas que ja existiam');
});

teste('as contas antigas ficaram intactas e os lancamentos apontando certo', () => {
  const evento: any = v9.prepare('SELECT * FROM contas WHERE id = 2').get();
  assert.equal(evento.tipo, 'evento');
  const s: any[] = v9.prepare(SQL_SALDOS_V9).all();
  assert.equal(s.find((l) => l.id === 1).saldo, 50000); // 1.000 - 200 - 300
  assert.equal(s.find((l) => l.id === 2).saldo, 30000);
});

teste('a tabela investimentos sumiu, FKs limpas, versao 9 gravada', () => {
  const t: any = v9
    .prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'investimentos'")
    .get();
  assert.equal(t.n, 0);
  assert.equal(v9.prepare('PRAGMA foreign_key_check').all().length, 0);
  const v: any = v9.prepare('PRAGMA user_version').get();
  assert.equal(v.user_version, 9);
  assert.throws(() => v9.exec('DELETE FROM contas WHERE id = 1'), /FOREIGN KEY/i);
});

teste('lancamentos antigos ficam sem hora (nada inventado)', () => {
  const l: any = v9.prepare("SELECT hora FROM lancamentos WHERE descricao = 'Mercado'").get();
  assert.equal(l.hora, null);
});

teste('CHECK de hora aceita HH:MM e recusa horario impossivel', () => {
  const inserir = (hora: string) =>
    v9.exec(
      `INSERT INTO lancamentos (descricao, valor, tipo, data, hora, conta_id) VALUES ('x', 1, 'despesa', '2026-09-03', '${hora}', 1)`,
    );
  inserir('23:59');
  inserir('00:00');
  assert.throws(() => inserir('24:00'));
  assert.throws(() => inserir('12:60'));
  assert.throws(() => inserir('9:30'));
  v9.exec("DELETE FROM lancamentos WHERE descricao = 'x'");
});

teste('saldo total NAO inclui investimento (o migrado nao infla o saldo)', () => {
  const r: any = v9.prepare(SQL_SALDO_TOTAL_V9).get();
  // Nubank 500 + Floripa 300; XP e Rico ficam de fora.
  assert.equal(r.total, 80000);
});

const xpId = (v9.prepare("SELECT id FROM contas WHERE nome = 'XP'").get() as any).id;

teste('aporte (corrente -> investimento) baixa o saldo total e aumenta o investido', () => {
  v9.exec(`
    INSERT INTO lancamentos (descricao, valor, tipo, data, hora, conta_id, conta_destino_id)
    VALUES ('Aporte em XP', 40000, 'transferencia', '2026-09-05', '10:00', 1, ${xpId});
  `);
  const total: any = v9.prepare(SQL_SALDO_TOTAL_V9).get();
  assert.equal(total.total, 40000, 'saiu R$ 400,00 do que da para gastar');

  const xp = investimentosV9(v9).find((i) => i.id === xpId);
  assert.equal(xp.aportado, 190000);
  assert.equal(xp.rendimento, 0);
  assert.equal(xp.valor, 190000);
});

teste('aporte NAO e despesa: nao entra no resumo, na pizza nem no gasto por dia', () => {
  const setembro = intervaloDoMes({ ano: 2026, mes: 9 });
  const resumo: any = v9
    .prepare(sqlDoArquivo('src/repos/lancamentos.ts', "THEN valor END), 0) AS receitas"))
    .get(setembro.inicio, setembro.fim);
  assert.equal(resumo.despesas, 20000, 'so o mercado');
  const pizza: any[] = v9
    .prepare(sqlDoArquivo('src/repos/lancamentos.ts', 'GROUP BY l.categoria_id'))
    .all('despesa', setembro.inicio, setembro.fim);
  assert.equal(pizza.reduce((s, l) => s + l.total, 0), 20000);
});

teste('rendimento muda o valor do investimento, mas fica fora dos KPIs do mes', () => {
  // O que registrarValorAtual() grava: a diferenca como receita na propria conta.
  v9.exec(`
    INSERT INTO lancamentos (descricao, valor, tipo, data, hora, conta_id)
    VALUES ('Rendimento', 2500, 'receita', '2026-09-30', '18:00', ${xpId});
  `);
  const setembro = intervaloDoMes({ ano: 2026, mes: 9 });
  const resumo: any = v9
    .prepare(sqlDoArquivo('src/repos/lancamentos.ts', "THEN valor END), 0) AS receitas"))
    .get(setembro.inicio, setembro.fim);
  assert.equal(resumo.receitas, 0, 'render nao e salario');

  const evolucao: any[] = v9
    .prepare(sqlDoArquivo('src/repos/lancamentos.ts', 'GROUP BY substr(data, 1, 7)'))
    .all(setembro.inicio, setembro.fim);
  assert.equal(evolucao[0].receitas, 0);

  const porConta: any[] = v9
    .prepare(sqlDoArquivo('src/repos/lancamentos.ts', 'HAVING receitas > 0'))
    .all(setembro.inicio, setembro.fim);
  assert.equal(porConta.find((l) => l.conta_id === xpId), undefined);

  const xp = investimentosV9(v9).find((i) => i.id === xpId);
  assert.equal(xp.aportado, 190000, 'o que voce colocou nao muda');
  assert.equal(xp.rendimento, 2500);
  assert.equal(xp.valor, 192500);

  const total: any = v9.prepare(SQL_SALDO_TOTAL_V9).get();
  assert.equal(total.total, 40000, 'rendimento nao mexe no saldo do Inicio');
});

teste('investimento bate com contas.saldos() (as duas contabilidades nao divergem)', () => {
  const s: any = (v9.prepare(SQL_SALDOS_V9).all() as any[]).find((l) => l.id === xpId);
  assert.equal(s.saldo, 192500);
});

teste('resgate (investimento -> corrente) devolve ao saldo e reduz o aportado', () => {
  v9.exec(`
    INSERT INTO lancamentos (descricao, valor, tipo, data, conta_id, conta_destino_id)
    VALUES ('Resgate', 10000, 'transferencia', '2026-10-01', ${xpId}, 1);
  `);
  const total: any = v9.prepare(SQL_SALDO_TOTAL_V9).get();
  assert.equal(total.total, 50000);
  const xp = investimentosV9(v9).find((i) => i.id === xpId);
  assert.equal(xp.aportado, 180000);
  assert.equal(xp.valor, 182500);
  assert.equal(xp.ultima_movimentacao, '2026-10-01');
});

// A lista usa o SELECT atual, que ja junta parcelamentos (migration 10): leva
// este banco migrado da 9 para a 10, com dados dentro -- o caminho de quem atualiza.
aplicarMigration(v9, MIGRATIONS.find((m) => m.versao === 10)!);

teste('lista do mes ordena por hora dentro do dia; sem hora vai para o fim', () => {
  v9.exec(`
    INSERT INTO lancamentos (descricao, valor, tipo, data, hora, conta_id) VALUES
      ('Cafe',   500, 'despesa', '2026-11-02', '08:15', 1),
      ('Antigo', 500, 'despesa', '2026-11-02', NULL,    1),
      ('Janta', 4000, 'despesa', '2026-11-02', '20:40', 1),
      ('Almoco',2500, 'despesa', '2026-11-02', '12:30', 1);
  `);
  const sql = sqlDoArquivo('src/repos/lancamentos.ts', 'WHERE l.data BETWEEN');
  const novembro = intervaloDoMes({ ano: 2026, mes: 11 });
  const linhas: any[] = v9.prepare(sql).all(novembro.inicio, novembro.fim);
  assert.deepEqual(
    linhas.map((l) => l.descricao),
    ['Janta', 'Almoco', 'Cafe', 'Antigo'],
  );
  assert.equal(linhas[0].conta_tipo, 'corrente');
});

v9.close();

// -------------------------------------------- cartao de credito (migration 10)

console.log('\ncartao de credito');

teste('faturaDe: compra ate o fechamento cai na fatura do mes; depois, na seguinte', () => {
  // Fecha dia 28, vence dia 5 do mes seguinte.
  assert.deepEqual(faturaDe('2026-10-28', 28, 5), {
    fechamento: '2026-10-28',
    vencimento: '2026-11-05',
  });
  assert.deepEqual(faturaDe('2026-10-29', 28, 5), {
    fechamento: '2026-11-28',
    vencimento: '2026-12-05',
  });
  // Virada do ano.
  assert.deepEqual(faturaDe('2026-12-30', 28, 5), {
    fechamento: '2027-01-28',
    vencimento: '2027-02-05',
  });
  // Fecha dia 3, vence dia 10 do MESMO mes.
  assert.deepEqual(faturaDe('2026-10-02', 3, 10), {
    fechamento: '2026-10-03',
    vencimento: '2026-10-10',
  });
});

teste('faturaDe: fechamento dia 31 vira o ultimo dia em fevereiro', () => {
  assert.deepEqual(faturaDe('2026-02-28', 31, 10), {
    fechamento: '2026-02-28',
    vencimento: '2026-03-10',
  });
  assert.equal(faturaDe('2026-03-01', 31, 10).fechamento, '2026-03-31');
});

teste('somarMesesISO nao passa do ultimo dia do mes', () => {
  assert.equal(somarMesesISO('2026-01-31', 1), '2026-02-28');
  assert.equal(somarMesesISO('2026-11-15', 3), '2027-02-15');
});

teste('parcelas sem juros somam exatamente o valor (sobra na primeira)', () => {
  assert.deepEqual(calcularParcelas(10000, 3), [3334, 3333, 3333]);
  assert.deepEqual(calcularParcelas(12000, 1), [12000]);
  const p = calcularParcelas(99999, 7);
  assert.equal(p.reduce((s, x) => s + x, 0), 99999);
  assert.ok(p.every((x) => Number.isInteger(x)));
});

teste('parcelas com juros: tabela Price, parcela fixa e inteira, total acima do valor', () => {
  // R$ 1.000,00 em 12x a 1,99% a.m. = 12 x R$ 94,50 (1000 * 0,0199 / (1 - 1,0199^-12)).
  const p = calcularParcelas(100000, 12, 199);
  assert.equal(p.length, 12);
  assert.ok(p.every((x) => x === p[0] && Number.isInteger(x)));
  assert.equal(p[0], 9450);
  assert.ok(p[0] * 12 > 100000);
});

teste('lerJurosBp: virgula ou ponto; vazio e sem juros; texto invalido e null', () => {
  assert.equal(lerJurosBp('1,99'), 199);
  assert.equal(lerJurosBp('2'), 200);
  assert.equal(lerJurosBp(''), 0);
  assert.equal(lerJurosBp('abc'), null);
  assert.equal(lerJurosBp('1,999'), null);
});

teste('agruparFaturas: atual, futuras com parcelas, fechada a pagar e fatura inicial', () => {
  const faturas = agruparFaturas(
    [
      { data: '2026-10-10', tipo: 'despesa', valor: 30000 }, // fatura que vence 05/11
      { data: '2026-10-25', tipo: 'despesa', valor: 10000 }, // parcela 1 -> vence 05/11
      { data: '2026-11-25', tipo: 'despesa', valor: 10000 }, // parcela 2 -> vence 05/12
      { data: '2026-12-25', tipo: 'despesa', valor: 10000 }, // parcela 3 -> vence 05/01
      { data: '2026-10-12', tipo: 'receita', valor: 5000 }, //  estorno
      { data: '2026-08-10', tipo: 'despesa', valor: 777 }, //   ja vencida, some
    ],
    28,
    5,
    '2026-10-31', // fatura de 28/10 ja fechou; a atual fecha 28/11
    { data: '2026-10-01', valor: 20000 },
  );
  assert.deepEqual(
    faturas.map((f) => [f.vencimento, f.total, f.atual]),
    [
      ['2026-11-05', 55000, false], // fechada, a pagar: 300 + 100 - 50 + 200 inicial
      ['2026-12-05', 10000, true],
      ['2027-01-05', 10000, false],
    ],
  );
});

const cc = bancoNaVersao(VERSAO_ALVO);
cc.exec(`
  INSERT INTO contas (id, nome, tipo, saldo_inicial, limite, dia_fechamento, dia_vencimento, fatura_inicial)
  VALUES
    (1, 'Corrente', 'corrente', 500000, NULL, NULL, NULL, 0),
    -- Ja tinha R$ 300,00 usados do limite de R$ 2.000,00 no cadastro.
    (2, 'Roxinho',  'cartao',   -30000, 200000, 28, 5, 30000);
  INSERT INTO categorias (id, nome, tipo, cor) VALUES (1, 'Eletrônicos', 'despesa', '#111');
  INSERT INTO parcelamentos (id, descricao, valor_original, juros_bp, vezes, total)
    VALUES (1, 'Fone', 30000, 0, 3, 30000);
  INSERT INTO lancamentos (descricao, valor, tipo, data, conta_id, categoria_id, parcelamento_id, parcela) VALUES
    ('Fone (1/3)', 10000, 'despesa', '2026-10-10', 2, 1, 1, 1),
    ('Fone (2/3)', 10000, 'despesa', '2026-11-10', 2, 1, 1, 2),
    ('Fone (3/3)', 10000, 'despesa', '2026-12-10', 2, 1, 1, 3);
`);
const SQL_SALDOS_CC = sqlDoArquivo('src/repos/contas.ts', 'AS saldo').replace('${filtro}', '');
const saldoDe = (b: DatabaseSync, id: number) =>
  (b.prepare(SQL_SALDOS_CC).all() as any[]).find((l) => l.id === id).saldo;

teste('compra parcelada compromete o limite inteiro na hora', () => {
  // disponivel = limite + saldo = 2.000 - 300 - 300
  assert.equal(200000 + saldoDe(cc, 2), 140000);
});

teste('cada mes so conta a parcela que cai nele nas despesas', () => {
  const sql = sqlDoArquivo('src/repos/lancamentos.ts', "THEN valor END), 0) AS receitas");
  const nov = intervaloDoMes({ ano: 2026, mes: 11 });
  const r: any = cc.prepare(sql).get(nov.inicio, nov.fim);
  assert.equal(r.despesas, 10000);
});

teste('pagar a fatura (corrente -> cartao) devolve limite e NAO e despesa', () => {
  cc.exec(`
    INSERT INTO lancamentos (descricao, valor, tipo, data, conta_id, conta_destino_id)
    VALUES ('Pagamento fatura', 40000, 'transferencia', '2026-11-05', 1, 2);
  `);
  assert.equal(200000 + saldoDe(cc, 2), 180000, 'o limite voltou R$ 400,00');
  assert.equal(saldoDe(cc, 1), 460000, 'saiu da corrente');
  const sql = sqlDoArquivo('src/repos/lancamentos.ts', "THEN valor END), 0) AS receitas");
  const nov = intervaloDoMes({ ano: 2026, mes: 11 });
  const r: any = cc.prepare(sql).get(nov.inicio, nov.fim);
  assert.equal(r.despesas, 10000, 'pagamento nao duplica o gasto');
});

teste('excluir o parcelamento apaga todas as parcelas (CASCADE)', () => {
  cc.exec('DELETE FROM parcelamentos WHERE id = 1');
  const r: any = cc
    .prepare('SELECT COUNT(*) AS n FROM lancamentos WHERE parcelamento_id IS NOT NULL')
    .get();
  assert.equal(r.n, 0);
  assert.equal(cc.prepare('PRAGMA foreign_key_check').all().length, 0);
});

teste('CHECKs do cartao: dia 1..31, limite e fatura inicial nao negativos, 2..48 vezes', () => {
  assert.throws(() => cc.exec("UPDATE contas SET dia_fechamento = 32 WHERE id = 2"));
  assert.throws(() => cc.exec("UPDATE contas SET limite = -1 WHERE id = 2"));
  assert.throws(() => cc.exec("UPDATE contas SET fatura_inicial = -1 WHERE id = 2"));
  assert.throws(() =>
    cc.exec(
      "INSERT INTO parcelamentos (descricao, valor_original, vezes, total) VALUES ('x', 100, 1, 100)",
    ),
  );
});

cc.close();

console.log('\nhora e cor');

teste('horaDe usa o relogio local e sempre dois digitos', () => {
  assert.equal(horaDe(new Date(2026, 0, 31, 7, 5)), '07:05');
  assert.equal(horaDe(new Date(2026, 0, 31, 23, 59)), '23:59');
});

teste('textoParaHora: vazio e null, invalido e undefined', () => {
  assert.equal(textoParaHora(''), null);
  assert.equal(textoParaHora('  '), null);
  assert.equal(textoParaHora('09:30'), '09:30');
  assert.equal(textoParaHora('25:00'), undefined);
  assert.equal(textoParaHora('9:3'), undefined);
});

teste('normalizarHex aceita 3 e 6 digitos, com ou sem #, e recusa o resto', () => {
  assert.equal(normalizarHex('#abc'), '#AABBCC');
  assert.equal(normalizarHex('1e88e5'), '#1E88E5');
  assert.equal(normalizarHex('#12345'), null);
  assert.equal(normalizarHex('red'), null);
});

teste('hex -> HSV -> hex devolve a mesma cor para a paleta inteira', () => {
  for (const c of ['#E53935', '#FDD835', '#00897B', '#1E88E5', '#546E7A', '#000000', '#FFFFFF']) {
    assert.equal(hsvParaHex(hexParaHsv(c)), c);
  }
});

teste('HSV nos extremos: matiz 0/120/240 em saturacao e brilho cheios', () => {
  assert.equal(hsvParaHex({ h: 0, s: 1, v: 1 }), '#FF0000');
  assert.equal(hsvParaHex({ h: 120, s: 1, v: 1 }), '#00FF00');
  assert.equal(hsvParaHex({ h: 240, s: 1, v: 1 }), '#0000FF');
  assert.equal(hsvParaHex({ h: 360, s: 1, v: 1 }), '#FF0000');
  assert.equal(hsvParaHex({ h: 200, s: 0, v: 0.5 }), '#808080');
});

teste('luminancia separa cor clara de escura (texto sobre a cor)', () => {
  assert.ok(luminancia('#FFFFFF') > 0.99);
  assert.ok(luminancia('#000000') < 0.01);
  assert.ok(luminancia('#FDD835') > 0.45, 'amarelo pede texto escuro');
  assert.ok(luminancia('#1E88E5') < 0.45, 'azul pede texto branco');
});

db.close();

console.log(falhas === 0 ? '\nTudo certo.\n' : `\n${falhas} verificacao(oes) falharam.\n`);
process.exit(falhas === 0 ? 0 : 1);
