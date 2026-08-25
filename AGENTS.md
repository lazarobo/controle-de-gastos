# Controle de Gastos

App Android pessoal de finanças. React Native + Expo Router + SQLite local, sem
backend. O plano completo, com as decisões e seus porquês, está em `PLANO.md`.

## Comandos

```bash
npm start          # Metro + QR code
npm run typecheck  # tsc --noEmit
npm run verify     # roda o SQL real contra node:sqlite, sem celular nem emulador
```

## Regras que valem para qualquer alteração

- **Dinheiro é `INTEGER` de centavos, nunca `REAL`/float.** A divisão por 100 só
  acontece na formatação (`src/utils/money.ts`). Float acumula erro de
  arredondamento e faz o app deixar de bater com o extrato.
- **Datas vêm de `src/utils/date.ts`, nunca de `toISOString()`.** Em UTC−3 um
  gasto lançado à noite pula para o dia seguinte e cai no mês errado.
- **SQL só dentro de `src/repos/` e `src/db/`** (RNF06). Telas chamam repositório.
- **Migration publicada não se edita.** Adicione outra em `src/db/migrations.ts`
  com `versao` sequencial; `PRAGMA user_version` controla o resto.
- **Antes de dar qualquer coisa por pronta:** `npm run typecheck && npm run verify`.
- **Build nativo falhou? Rode `npm ls` primeiro.** Duas vezes o Expo SDK 57 entregou
  versões incoerentes que o `expo-doctor` aprovou (21/21) e o `npm ls` marcou como
  `invalid`. As correções vivem em `overrides` no `package.json` — leia o porquê de
  cada uma no `PLANO.md` antes de mexer.
