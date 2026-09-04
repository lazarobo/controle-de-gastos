# Como contribuir

Obrigado pelo interesse. Este é um app de finanças pessoais — o tipo de software
onde um número errado é pior que uma tela feia, porque destrói a confiança de
quem usa. As regras abaixo existem quase todas por causa disso.

## Antes de qualquer coisa

```bash
npm install
npm run typecheck && npm run verify
```

Se isso não passar na `master` limpa, abra uma issue — o problema é nosso, não seu.

## As regras que não se negociam

Estas não são preferências de estilo. Cada uma existe por um bug concreto,
documentado em [`PLANO.md`](PLANO.md):

- **Dinheiro é `INTEGER` de centavos, nunca `REAL`/float.** A divisão por 100 só
  acontece na formatação. Float acumula erro de arredondamento e o app deixa de
  bater com o extrato do banco.
- **Datas vêm de `src/utils/date.ts`, nunca de `toISOString()`.** Em UTC−3, um
  gasto lançado às 21h do dia 31 pula para o mês seguinte.
- **SQL só dentro de `src/repos/` e `src/db/`.** Telas chamam repositório.
- **Migration publicada não se edita.** Adicione outra com `versao` sequencial.
  Se a sua migration reconstrói uma tabela, ela **precisa** de teste que simule
  um banco já povoado na versão anterior (veja os testes da migration 5).
- **Transferência não é receita nem despesa.** Se você tocar em qualquer consulta
  que soma valores, confira se ela trata `tipo = 'transferencia'` corretamente.

## Testes

O `npm run verify` roda no PC, sem celular nem emulador. Ele aplica as migrations
reais e extrai o SQL dos próprios arquivos de repositório, então testa o que o app
realmente executa — não uma cópia que pode envelhecer.

**Toda mudança que mexe em dinheiro, data, saldo ou migration precisa de teste lá.**
Prefira cenários com números redondos, conferíveis no papel, e diga no `assert` o
que quebraria se falhasse:

```ts
assert.equal(
  depois.total,
  antes.total,
  'mover dinheiro entre contas proprias nao pode mudar quanto voce tem',
);
```

O que o `verify` **não** cobre, e precisa de teste no aparelho: qualquer coisa que
dependa de módulo nativo (backup, seletor de arquivo, compartilhamento) e a
sensação de uso da interface.

## Estilo

- Código, comentários e commits em **português**, como o resto do projeto
- Comentário explica **por quê**, não o quê — se o código precisa de comentário
  dizendo o que faz, geralmente ele precisa é de um nome melhor
- Sem dependência nova sem um motivo forte. O projeto evita bibliotecas de
  gráfico e de ícone de propósito; leia o `PLANO.md` para o histórico doloroso
  de conflitos de dependência no Expo SDK 57

## Pull requests

1. Descreva **o problema**, não só a solução
2. `npm run typecheck && npm run verify` passando
3. Se mudou tela, um print ajuda muito
4. Commits pequenos e com mensagem que explica o motivo

## Licença das suas contribuições

Ao enviar código, você concorda em licenciá-lo sob a **GPL v3**; documentação, sob
**CC BY-SA 4.0**. São as mesmas licenças do projeto — você mantém seu copyright.
