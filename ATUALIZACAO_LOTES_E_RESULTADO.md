# GP Performance 1.2 — Lotes até a venda e resultado mensal

**Atualização 1.3:** o controle de gastos das motos e contas a pagar foi ampliado. Novas despesas entram no resultado pela data do gasto, inclusive valores ainda a pagar, sem duplicar o pagamento do caixa. Consulte [ATUALIZACAO_DESPESAS.md](ATUALIZACAO_DESPESAS.md) para o fluxo atual.

## Identificar o lote na compra

Em **Compras → Nova compra**, informe **Número do lote**, por exemplo `LOTE 001`, `LOTE 002` ou um código do fornecedor. Esse código acompanha as unidades do lote após o recebimento, nas movimentações, na venda e no recibo.

O campo **Transportador** fica na mesma compra, separado do fornecedor e do responsável pela compra. O fornecedor é quem vende as motos; o transportador é quem traz as motos para a loja.

A compra em andamento continua sem alterar estoque. Na chegada, use **Receber lote**: os modelos e as quantidades entram vinculados ao lote, e o custo inclui o rateio do frete.

## Ver o que sobrou de cada lote

Em **Estoque → Por lote**, veja:

- código do lote e fornecedor;
- modelo e cor;
- data de chegada, quando informada;
- quantidade restante e custo unitário;
- lotes esgotados, ativando a opção correspondente.

Clique no número do lote para consultar os saldos e as vendas vinculadas. A busca geral também localiza lotes pelo código ou pelo fornecedor.

Em entradas diretas no Estoque, informe o lote. No cadastro de um modelo com quantidade inicial, há um campo para o lote inicial; se ficar vazio, o sistema gera um código.

## Escolher o lote ao vender

Na venda, selecione o modelo e o **Lote da moto**. Confira o código do lote da unidade física antes de confirmar. O sistema baixa apenas a quantidade daquele lote, conserva o custo de origem da venda e mostra o lote no histórico e no recibo.

A partir da versão 1.4, cada venda feita pela tela seleciona a moto individual pelo chassi, vinculada ao lote. Para vender várias unidades, registre cada moto separadamente. O cadastro individual, a condição nova/usada e as sete motos enviadas estão descritos em [ATUALIZACAO_LOTES_CHASSIS.md](ATUALIZACAO_LOTES_CHASSIS.md). Vendas antigas por quantidade permanecem no histórico.

Se houver cancelamento, as unidades voltam aos mesmos lotes da venda. O sistema impede vender mais unidades do que o saldo do lote e protege contra pedidos duplicados e disputas simultâneas pelo estoque.

## Dados cadastrados antes desta atualização

Os modelos e saldos anteriores são preservados. Como não é possível adivinhar a origem física das motos que já estavam cadastradas, esse saldo aparece inicialmente em **ESTOQUE ANTERIOR**, com origem de compra não informada.

Para identificar esse saldo, use **Identificar / separar lote** na linha do modelo: informe a quantidade e o código do lote real. A operação mantém o total e o custo do estoque, não movimenta o caixa e deixa registro da identificação.

Vendas anteriores preservam os custos e o histórico já registrados, mas não recebem um lote inventado. Um cancelamento de venda antiga sem lote gera entrada identificada como **ESTORNO ANTERIOR**.

## Despesas e resultado de cada mês

Em **Financeiro → Resultado mensal**, escolha o mês. O relatório mostra:

1. Vendas ativas pela data da venda, incluindo o total das vendas parcialmente recebidas.
2. Custo das motos vendidas, usando o custo registrado no lote no momento da venda. Alterações futuras do estoque não reescrevem esse custo histórico.
3. Despesas operacionais: lançamentos avulsos pela data do caixa e, a partir da versão 1.3, novas despesas pela data do gasto, incluindo a parte a pagar.
4. Resultado gerencial: **vendas − custo das motos vendidas − despesas operacionais**.

Compras de estoque classificadas como **Fornecedor** não são subtraídas novamente como despesa operacional, porque o custo das motos é reconhecido na venda. O frete da compra já faz parte do custo do lote. Cancelamentos são desconsiderados nas vendas e no custo; o estorno do caixa não é descontado outra vez no resultado. Retiradas do proprietário aparecem separadas no caixa.

O relatório também mostra entradas efetivamente recebidas, saídas pagas e saldo de caixa do mês. Esses valores podem ser diferentes do resultado, por causa de parcelas a receber, compras de estoque, aportes e retiradas.

Cadastre aluguel, salários, energia, impostos pagos e demais gastos em **Nova despesa**, usando uma categoria apropriada. Lançamentos avulsos pagos também podem ser registrados no caixa, sem duplicar uma despesa já cadastrada. Sem os gastos lançados, o resultado não contempla essas despesas. É possível exportar o relatório do mês em CSV.

## Atualizar no Coolify

1. Baixe um backup completo antes do deploy.
2. Atualize o código pelos arquivos deste pacote, mantendo Dockerfile e porta 3000.
3. **Preserve o mesmo volume /app/data e o banco gp-performance.sqlite da loja.** Não recrie nem apague o armazenamento.
4. A nova migração `drizzle/0005_stock_lots.sql` adiciona as tabelas de lotes, saldos e vínculos de vendas, além dos campos de lote na compra e na movimentação. As migrações antigas não foram modificadas.
5. Na inicialização, o sistema faz a cópia de segurança do banco existente e identifica o saldo antigo sem perder as quantidades. As compras, clientes, vendas, financeiro e acessos existentes são preservados.

Esta entrega é o pacote atualizado. Ela não faz deploy ou altera diretamente seu servidor.

## Verificação

TypeScript e build de produção passaram. Os oito testes automatizados incluem servidor HTTP, banco real temporário, atualização de dados anteriores, três lotes do mesmo modelo com custos diferentes, baixa do lote escolhido, bloqueio de excesso e concorrência, estorno no lote original, preservação de vendas antigas, backup, reinício e conferência do resultado mensal sem duplicar compras ou estornos. Os dados de teste são fictícios.

O Dockerfile continua usando Node 24. O Docker não está disponível no ambiente de preparação; a imagem será construída no Coolify, com os comandos de build e inicialização verificados no Node 24.
