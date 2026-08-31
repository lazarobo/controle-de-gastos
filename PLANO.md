# Plano de Ação — App de Finanças Pessoais

**Responsável:** Lazaro
**Início:** 24/08/2026
**Última revisão:** 25/08/2026
**Status geral:** Fases 0–6 implementadas, aguardando uso real no aparelho

---

## 1. Visão

Aplicativo mobile pessoal para controle de finanças. O objetivo número um é
responder **"quanto eu gasto em cada coisa?"**. Tudo o mais é consequência disso.

Uso individual, offline, sem login e sem integração bancária.

---

## 2. Stack técnica

| Item | Escolha |
|---|---|
| Framework | React Native + Expo (SDK 57) |
| Linguagem | TypeScript (`strict`) |
| Navegação | Expo Router |
| Persistência | SQLite local (`expo-sqlite`) |
| Gráficos | `react-native-svg` (rosca desenhada à mão) |
| Backup | `expo-file-system` + `expo-sharing` + `expo-document-picker` |
| Plataforma alvo | Android |
| Backend | Nenhum — 100% no dispositivo |

**Nota:** não há servidor, mas há banco de dados. O SQLite roda como um arquivo
dentro do app. Consequência direta: desinstalar o app apaga os dados — por isso
o backup entra ainda no v1.

**Conflito de dependências do Expo SDK 57 (resolvido).** `expo-router@57.0.16`
traz `react-dom@19.2.8`, que exige `react@^19.2.8`, mas o SDK fixa `react@19.2.3`.
Inconsistência do próprio Expo: com ela, **qualquer** `npm install` no projeto
falha. Corrigido com `overrides: { "react-dom": "19.2.3" }` no `package.json` —
alinha o `react-dom` ao `react` já instalado. `react-dom` não entra no bundle
Android (é usado pelas ferramentas de web/devtools), então o alinhamento não muda
o app. Alternativa descartada: `--legacy-peer-deps`, que silenciaria todo conflito
de peer no projeto, inclusive os legítimos que ainda venham a aparecer.

**Segundo conflito do SDK 57: `react-native-worklets` (resolvido).** O primeiro build
de APK falhou compilando C++ do `expo-modules-core`:

```
WorkletJSCallInvoker.cpp:27:21: error: no member named 'executeSync' in 'worklets::WorkletRuntime'
```

Causa: `expo-modules-core@57.0.13` aceita `react-native-worklets` até a série **0.10**,
mas o npm instalou a **0.12.1**, onde `executeSync` não existe mais. Nem o worklets nem
o `react-native-reanimated` são dependências reais de alguma coisa — os dois são *peer
opcionais* (do `@expo/ui` e do `expo-router`) que o npm resolveu para a versão mais alta
que casa com `*`. O app não importa nenhum dos dois; o build quebrou compilando suporte
a bibliotecas que não usamos.

Corrigido fixando o par coerente por `overrides`:

| pacote | versão | motivo |
|---|---|---|
| `react-native-worklets` | `0.10.4` | última da 0.10, dentro do `^0.10.0` que o `expo-modules-core` exige |
| `react-native-reanimated` | `4.5.1` | única série que pede `worklets 0.10.x` **e** aceita RN 0.86 |

A `4.6.0` (escolha automática do npm) é a primeira que salta para `worklets 0.12.x`.

**Lição para o próximo erro de build nativo:** `expo-doctor` deu 21/21 nas duas
inconsistências, e `npm ls` marcou `invalid` nas duas. Quando um build nativo falhar,
rodar `npm ls` antes de qualquer outra coisa. E dá para conferir a correção **sem gastar
build**: procurar o símbolo direto no header em `node_modules` (`grep -rn executeSync
node_modules/react-native-worklets/Common/cpp`) confirma a assinatura antes de subir.

**Mudança em relação ao plano original:** `react-native-gifted-charts` foi
descartada — não pelo conflito acima, que era do Expo e já está resolvido, mas
porque a rosca em `react-native-svg` (biblioteca que o Expo já gerencia) custa
~60 linhas, dá controle total sobre a legenda e evita mais uma dependência com
histórico de acompanhar mal as versões do React Native. Se em algum momento os
gráficos do v2 (RF11) exigirem mais, adotar a biblioteca continua sendo uma
opção aberta. `@expo/vector-icons` também ficou de fora; os ícones das abas são
glifos de texto — trocar por ícones de verdade é candidato natural à Fase 7.

---

## 3. Decisões tomadas

| # | Tema | Decisão |
|---|---|---|
| D01 | Cartão de crédito | Entra como conta normal no v1. Fatura/competência fica para o v2. |
| D02 | Categorias | Categoria única (sem subcategoria). Usuário pode criar as suas livremente. |
| D03 | Contas | Cadastro manual com saldo informado. Saldo = saldo inicial + receitas − despesas. |
| D04 | Divergência de saldo | Corrigir com lançamento de "Ajuste de saldo", nunca editando o saldo inicial. |
| D05 | Histórico | Começa do zero a partir de hoje. Sem importação de meses anteriores. |
| D06 | Valores | Sempre positivos; o sinal vem da coluna `tipo` (receita/despesa). |
| **D07** | **Representação de dinheiro** | **`INTEGER` de centavos, nunca `REAL`.** Float binário não representa decimais exatos (`0.1 + 0.2 = 0.30000000000000004`); somando centenas de lançamentos o erro se acumula e o app deixa de bater com o extrato. A divisão por 100 só acontece na formatação. |
| **D08** | **Fuso horário** | **Datas nascem de `getFullYear/getMonth/getDate` locais, nunca de `toISOString()`.** No Brasil (UTC−3) um gasto lançado às 21h de 31/01 viraria 01/02 em UTC e cairia no mês errado. |
| **D09** | **Integridade referencial** | `PRAGMA foreign_keys = ON` em toda abertura de conexão — é OFF por padrão no SQLite e vale por conexão. Sem isso as FKs do schema seriam decorativas. |
| **D10** | **Exclusão** | Conta com lançamentos: `ON DELETE RESTRICT`, e a UI oferece inativar. Categoria: `ON DELETE SET NULL` — o gasto vira "Sem categoria" e os totais continuam batendo. |
| **D11** | **Categorias de sistema** | "Ajuste de saldo" nasce com `sistema = 1`: só a cor é editável. Ela sustenta D04; se o usuário pudesse excluí-la, perderia o único caminho previsto para corrigir divergência. |
| **D12** | **Investimentos** | Tabela própria (`investimentos`), sem FK com `contas`, fora de toda query de saldo. Valor é digitado manualmente pelo usuário a cada conferência de extrato — investimento rende/cai sozinho, não é gerado por lançamento (receita/despesa) como em D03. Pedido explícito do usuário: "não vai contar pro saldo". |

---

## 4. Requisitos funcionais

### v1 — MVP

- [x] **RF01** — CRUD de contas (nome, tipo, saldo inicial, ativo/inativo)
- [x] **RF02** — CRUD de categorias (nome, tipo, cor)
- [x] **RF03** — CRUD de lançamentos (descrição, valor, data, conta, categoria, observação)
- [x] **RF04** — Lista de lançamentos com filtro por mês, agrupada por dia
- [x] **RF05** — Dashboard: saldo total, receitas do mês, despesas do mês, resultado do mês
- [x] **RF06** — Gráfico de despesas por categoria (rosca) + legenda com % e valor
- [x] **RF07** — Saldo atual por conta
- [x] **RF08** — Seed de categorias iniciais (idempotente)
- [x] **RF14** — Exportar backup em JSON *(promovido de v2 — sem servidor, é a única rede de proteção)*
- [x] **RF16** — Importar backup JSON *(promovido de v2 — backup que não restaura é só um arquivo)*
- [x] **RF17** — Registro rápido: FAB → formulário já preenchido com hoje, despesa e última conta usada *(novo: transforma o RNF02 em feature, não em boa intenção)*
- [x] **RF18** — Cadastro de investimentos (banco/corretora + valor), com total geral. Fora do dashboard e do saldo total (D12) — tela própria em Ajustes › Investimentos

### v2 — evolução (congelado até a Fase 7)

- [ ] **RF09** — Transferência entre contas
- [ ] **RF10** — Orçamento mensal por categoria + alerta de estouro
- [ ] **RF11** — Gráfico de evolução mensal (últimos 6 meses)
- [ ] **RF12** — Lançamentos recorrentes
- [ ] **RF13** — Busca e filtros avançados
- [ ] **RF15** — Fatura de cartão de crédito (competência ≠ pagamento)

---

## 5. Requisitos não funcionais

- **RNF01** — Funciona 100% offline
- **RNF02** — Registrar um gasto em até 3 toques a partir da tela inicial
  *(FAB → digitar valor → Salvar; descrição em branco cai para o nome da categoria)*
- **RNF03** — Formatação `pt-BR` para moeda e datas na exibição
- **RNF04** — Dados persistem entre aberturas do app
- **RNF05** — Migrations versionadas via `PRAGMA user_version`, cada uma numa transação
- **RNF06** — Nenhum SQL fora da camada de repositórios
- **RNF07** — Os números conferem com o cálculo manual *(verificável no PC: `npm run verify`)*

---

## 6. Modelo de dados

Fonte de verdade: [`src/db/migrations.ts`](src/db/migrations.ts). Resumo:

```sql
-- migration 1
contas        (id, nome, tipo, saldo_inicial INTEGER, ativo, criado_em)
categorias    (id, nome, tipo, cor, sistema)          -- UNIQUE (nome, tipo)
lancamentos   (id, descricao, valor INTEGER, tipo, data,
               conta_id     REFERENCES contas(id)      ON DELETE RESTRICT,
               categoria_id REFERENCES categorias(id)  ON DELETE SET NULL,
               observacao, criado_em)

-- migration 2
preferencias  (chave TEXT PRIMARY KEY, valor TEXT)     -- hoje só guarda o tema

-- migration 3
investimentos (id, nome, valor INTEGER, observacao, criado_em, atualizado_em)
              -- SEM FK com contas (D12) -- de proposito, nao entra em saldo nenhum
```

Índices: `(data)`, `(data, tipo)`, `(categoria_id)`, `(conta_id)`.
O composto `(data, tipo)` existe porque **toda** consulta do dashboard filtra pelos dois.

`CHECK` no banco garante o que a UI promete: `valor > 0` em lançamentos (`valor >= 0`
em investimentos, que aceita zero), `tipo` dentro do domínio, `ativo` e `sistema`
booleanos.

`user_version` atual: **3**. Backup (RF14/16) inclui as três tabelas; um backup
exportado antes da migration 3 não tem `investimentos` no JSON — a importação trata
isso como lista vazia, não como erro.

---

## 7. Estrutura de pastas

```
/app                        -> telas (Expo Router)
  /(tabs)                   -> Início, Lançamentos, Relatórios, Ajustes
  /lancamento/[id].tsx      -> formulário ('novo' ou id numérico)
  /conta/[id].tsx           -> formulário ('nova' ou id numérico)
  /categoria/[id].tsx       -> formulário ('nova' ou id numérico)
  contas.tsx, categorias.tsx
/src/db                     -> conexão, migrations, seed
/src/repos                  -> queries por entidade (único lugar com SQL)
/src/hooks                  -> useConsulta (refetch ao focar a tela)
/src/components             -> ui.tsx, SeletorMes, GraficoPizza
/src/utils                  -> money (centavos), date (fuso local), tema
/src/types                  -> tipos compartilhados
/scripts/verifica.mts       -> verificação no PC, sem celular
```

---

## 8. Fases de execução

| Fase | Entrega | Critério de aceite | Status |
|---|---|---|---|
| 0 | Ambiente + app abrindo no celular | ~~QR code do Expo funciona~~ → APK instalado | ⬜ bloqueado no Expo Go, ver 6.5 |
| 1 | Banco, migrations e seed | Tabelas criadas e categorias populadas | ✅ |
| 2 | CRUD de contas e categorias | Cadastrar suas contas reais | ✅ |
| 3 | CRUD e listagem de lançamentos | Registrar 10 gastos reais | ✅ |
| 4 | Dashboard com KPIs | Números conferem com cálculo manual | ✅ (`npm run verify`: 20/20) |
| 5 | Gráfico por categoria | Pergunta "onde eu gasto?" respondida | ✅ |
| 6 | Exportar **e restaurar** backup | Arquivo JSON gerado, compartilhável e restaurável | ✅ |
| **6.5** | **Build do APK** *(antecipada, agora obrigatória)* | App instalado sem depender do Expo Go | ⬜ configuração pronta (`eas.json`), falta rodar o build |
| 7 | Refino de UX | Uso contínuo por 1 semana sem irritação | ⬜ |

**Por que a Fase 0 depende da 6.5.** O Expo Go da Play Store para neste aparelho numa
versão anterior à exigida pelo SDK 57 — a Play Store serve a última build compatível
com a versão do Android do celular, e não há como forçar outra por ali. Isso derruba
o critério original da Fase 0 ("QR code do Expo funciona"): não existe caminho pelo
Expo Go neste aparelho. O critério passa a ser o APK instalado, que era o destino
de qualquer forma.

Build local (`npx expo run:android`) foi descartado: a máquina não tem Android SDK
nem adb, e o JDK instalado é o 26 — o Gradle do React Native pede o 17. Seriam ~10 GB
de instalação para chegar onde o EAS Build chega sem instalar nada.

**Por que a Fase 8 virou 6.5:** o critério da Fase 7 é *"uso contínuo por 1 semana"*.
Isso é impossível se o app depender do Metro rodando no PC — o celular precisa estar
com o APK instalado antes da semana começar, não depois.

---

## 9. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Abandonar o registro diário | O app deixa de ter valor | RNF02 + RF17: lançamento em 3 toques com tudo pré-preenchido |
| Perda de dados por desinstalação | Alto | RF14 **e RF16** no v1 |
| Escopo crescer antes do v1 rodar | Projeto não termina | v2 permanece congelado até a Fase 7 |
| Divergência entre saldo real e do app | Perda de confiança nos números | D04 + categoria de sistema (D11) |
| Erro silencioso de arredondamento | Números "quase certos", pior que errados | D07 (centavos inteiros) + `npm run verify` |
| Gasto caindo no mês errado | Fechamento nunca bate | D08 (data no fuso local) |

---

## 10. Fora de escopo

Multiusuário · Sincronização em nuvem · Open Banking / integração bancária ·
Investimentos e carteira de ativos · Multimoeda · Versão iOS · Versão web

---

## 11. Como rodar

```bash
npm start          # Metro + QR code para o Expo Go
npm run typecheck  # tsc --noEmit
npm run verify     # roda o SQL real contra node:sqlite, sem celular
```
