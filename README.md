# Controle de Gastos

App Android de finanças pessoais que roda **inteiramente no seu aparelho**. Sem
conta, sem login, sem servidor, sem telemetria — os dados moram num SQLite
dentro do app e nunca saem dele.

A pergunta que o app existe para responder é **"quanto eu gasto em cada coisa?"**.
Todo o resto é consequência disso.

## O que ele faz

- **Lançamentos** de receita e despesa, com categoria, conta e data
- **Movimentação interna** entre contas próprias — que não conta como receita
  nem despesa, e não mexe no seu saldo total
- **Contas** (corrente, poupança, cartão, dinheiro) com saldo calculado
- **Metas** mensais por categoria, com aviso de estouro
- **Investimentos** em aba própria, separados do saldo do dia a dia
- **Relatórios**: gasto por categoria, gasto por dia do mês, receitas × despesas
  no total e por conta, evolução de 6 meses
- **Tema claro/escuro**, seguindo o sistema ou fixo
- **Backup** em JSON, exportar e restaurar

## Rodando

Requer [Node](https://nodejs.org) 22+ e um celular Android com o
[Expo Go](https://expo.dev/go), ou um build próprio.

```bash
npm install
npm start        # abre o Metro e mostra o QR code
```

Outros comandos:

```bash
npm run typecheck   # tsc --noEmit, app e scripts
npm run verify      # roda o SQL real contra node:sqlite, sem celular
```

O `npm run verify` é a rede de segurança principal do projeto: ele aplica as
migrations de verdade, em ordem, e executa as consultas **extraídas dos próprios
arquivos** de `src/repos/` contra um banco em memória. Pega erro de contabilidade
e de migration sem precisar instalar nada no aparelho.

## Gerando um APK

O projeto usa [EAS Build](https://docs.expo.dev/build/introduction/). Se você
fez fork, precisa apontar para o **seu** projeto EAS e trocar o identificador do
app, senão o build tenta usar a conta original:

1. Em `app.json`, troque `expo.android.package` (ex.: `com.seunome.controledegastos`)
2. Remova o bloco `expo.extra.eas.projectId` — o `eas-cli` cria um novo na sua conta
3. Rode `npx eas-cli@latest build --platform android --profile preview`

## Estrutura

```
app/                 telas (Expo Router)
src/db/              conexão, migrations, seed
src/repos/           todo o SQL do projeto vive aqui
src/components/      componentes e gráficos (SVG e View, sem lib de chart)
src/utils/           dinheiro, datas, tema
scripts/verifica.mts verificação que roda no PC
```

Decisões de arquitetura — e o porquê de cada uma — estão em [`PLANO.md`](PLANO.md).
Vale a leitura antes de mexer em qualquer coisa: várias escolhas que parecem
estranhas à primeira vista (dinheiro como inteiro, datas sem `toISOString`,
transferência como uma linha só) existem para evitar bugs específicos que estão
documentados lá.

## Contribuindo

Contribuições são bem-vindas. Veja [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Licença

Este projeto é software livre com **copyleft**:

- **Código-fonte:** [GNU GPL v3](LICENSE) ou posterior. Se você distribuir uma
  versão modificada, precisa liberar o código dela sob a mesma licença.
- **Documentação** (`README.md`, `PLANO.md`, `CONTRIBUTING.md`, `AGENTS.md`):
  [CC BY-SA 4.0](LICENSE-docs.txt).

Documentação e código levam licenças diferentes de propósito: as licenças
Creative Commons [não são recomendadas para software](https://creativecommons.org/faq/#can-i-apply-a-creative-commons-license-to-software)
pela própria Creative Commons, porque não tratam da distinção entre código-fonte
e binário nem de patentes. Para texto, o `BY-SA` é o copyleft adequado.

Copyright © 2026 Lazaro e contribuidores.
