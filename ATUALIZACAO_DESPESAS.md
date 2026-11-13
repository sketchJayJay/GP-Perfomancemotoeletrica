# GP Performance 1.3 — Gastos das motos e valores a pagar

## Onde encontrar

Abra **Financeiro → Despesas / a pagar**. A tela mostra o saldo total a pagar, as despesas vencidas e o que já foi pago. Use os filtros **A pagar**, **Vencidas**, **Pagas**, **Todas** e **Canceladas**, a busca e a exportação CSV. No celular, cada despesa aparece em um cartão com valores, favorecido, vínculo e vencimento.

Também é possível abrir uma **compra**, um **lote** ou uma **venda** e usar **Despesas vinculadas → Adicionar despesa**. O vínculo vem preenchido. Gastos lançados na compra continuam visíveis no lote depois do recebimento: trata-se do mesmo registro, sem duplicação.

## O que pode ser lançado

- Viagem para comprar as motos.
- Viagem para vender ou entregar uma moto.
- Montagem das motos.
- Combustível, pedágio, alimentação e hospedagem.
- Frete extra, manutenção/reparo, comissão e outras despesas.

Informe descrição, tipo, favorecido (quem vai receber), compra/lote/venda ou despesa geral, quantidade, valor por unidade, data do gasto, vencimento e observações. O vínculo com uma venda permite identificar a moto pelo número da venda e pelo chassi/série já informado nessa venda.

Para montagem, por exemplo: **10 motos × R$ 50 = R$ 500**. O sistema calcula o total. Para um gasto único de viagem, use quantidade **1** e o valor total do gasto. É possível registrar cada gasto da viagem separadamente, como combustível e alimentação.

## A pagar, pago e pagamento parcial

No cadastro, escolha **A pagar**, **Já paguei o total** ou **Paguei uma parte**. Nos dois últimos casos, informe a data e a forma do pagamento. O valor pago gera uma saída no caixa automaticamente; o saldo restante continua a pagar.

Depois, abra a despesa e use **Pagar despesa**. Informe o valor pago agora. O sistema permite pagamentos parciais, mantém o histórico e impede que a soma ultrapasse o total. Uma operação repetida com o mesmo identificador não gera uma nova saída no caixa. A revisão do registro também protege contra duas baixas simultâneas do mesmo saldo.

Essa função registra o pagamento no controle interno da loja. Ela não faz transferência bancária nem envia dinheiro ao favorecido.

Despesas sem pagamento podem ser editadas ou canceladas. O cancelamento conserva o histórico e retira o valor do saldo a pagar e do resultado. Depois de existir pagamento, edição e cancelamento ficam bloqueados para preservar a conciliação com o caixa. O saldo restante pode continuar sendo quitado.

Os avisos do sistema incluem despesas vencidas. Cancelar uma venda ou compra não cancela automaticamente os gastos vinculados: combustível, montagem ou entrega já realizados podem continuar devidos. Confira cada despesa separadamente.

## Como os valores entram no resultado

Em **Financeiro → Resultado mensal**, as novas despesas ativas entram **pela data do gasto**, pelo total, incluindo a parte ainda a pagar. O pagamento movimenta apenas o caixa na data em que foi registrado e não desconta o gasto novamente no resultado.

Exemplo: montagem de R$ 500 lançada em novembro, com pagamento de R$ 200 em novembro e R$ 300 em dezembro. O resultado de novembro contempla os R$ 500. O caixa tem saída de R$ 200 em novembro e R$ 300 em dezembro. Dezembro não recebe mais R$ 300 de despesa no resultado pela quitação.

O relatório mantém vendas menos custo das motos vendidas menos despesas operacionais. As despesas avulsas que já existiam no caixa continuam pela data do lançamento, sem serem convertidas automaticamente em contas a pagar. A lista de despesas do relatório indica o saldo atual ainda não pago dos gastos daquele mês; não é um extrato histórico das dívidas na data de fechamento.

O custo unitário do estoque continua sendo o custo da compra com o frete informado nela. Os gastos extras são mostrados separadamente na compra/lote e reconhecidos como despesas no mês do gasto, sem reescrever os custos históricos das vendas. O total **Compra + despesas** ajuda a conferir o desembolso e os compromissos daquela compra.

**Evite duplicar lançamentos:** o frete já informado na compra faz parte do custo do lote. Não cadastre esse mesmo frete novamente como despesa. Também não registre manualmente no caixa um pagamento que já foi lançado pela própria despesa. Se um gasto antigo já está no caixa, ele já compõe o resultado avulso; não recadastre o mesmo valor como nova despesa.

## Atualização no Coolify

1. Baixe um backup completo pelo sistema antes de atualizar.
2. Substitua o código pelo conteúdo deste pacote e faça o deploy usando o Dockerfile e a porta 3000 existentes.
3. **Mantenha o mesmo volume `/app/data` e o banco `gp-performance.sqlite`. Não apague, recrie nem renomeie o armazenamento.**
4. A nova migração `drizzle/0006_expenses.sql` adiciona o cadastro de despesas e o vínculo dos pagamentos no caixa. As migrações de `0000` a `0005` continuam intactas. Não há limpeza de clientes, vendas, estoque, lotes ou financeiro.
5. O servidor gera uma cópia de segurança do banco existente antes de aplicar as migrações pendentes na inicialização.

Esta entrega é o ZIP para atualização. Ela não altera diretamente o servidor da loja. O pacote não inclui banco preenchido, dados de teste ou credenciais.

## Validação

TypeScript, build de produção e os dez testes automatizados passaram. Os testes usam banco SQLite temporário e dados fictícios. Incluem atualização de uma base anterior, gastos vinculados antes e depois do recebimento do lote, montagem por quantidade, pagamento parcial, concorrência, bloqueio de excesso, idempotência, cancelamento sem pagamentos, isolamento dos vínculos, resultado em meses diferentes, backup e reinício. Os fluxos de cadastro, baixa parcial e consulta do resultado também foram conferidos em navegador, em tela de computador e em uma área móvel de 390 px, com dados de demonstração.

O build foi verificado em Node 24. A imagem Docker será construída no ambiente de instalação pelo Coolify.
