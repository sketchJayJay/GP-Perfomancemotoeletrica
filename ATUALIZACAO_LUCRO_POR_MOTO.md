# GP Performance — lucro por moto e comissões (1.5.0)

## Na hora da venda

1. Selecione o cliente e a moto pelo chassi.
2. Informe preço, desconto e recebimento.
3. Em **Despesas desta venda**, clique em **Adicionar comissão** para cada funcionário e informe o nome e o valor em reais. É possível lançar várias comissões na mesma venda.
4. Use **Adicionar despesa** para frete, montagem, viagem, manutenção e outros gastos. Cada linha permite marcar **A pagar**, com vencimento, ou **Já paga**, com data e forma de pagamento.
5. Confira a prévia: **venda após desconto − custo da moto − gastos vinculados/rateios − comissões e despesas desta venda = lucro**.
6. Confirme. A moto, a venda, as despesas e os lançamentos do caixa são salvos na mesma transação. Se a venda falhar, as despesas não ficam soltas.

Comissões são informadas em **valor fixo em reais por funcionário**. Os nomes já usados ficam disponíveis como sugestão. Até 40 linhas de despesas podem acompanhar uma venda; outros lançamentos podem ser feitos depois nos detalhes.

## Depois de salvar

O resumo **Lucro desta moto** mostra valor vendido, custo, despesas, lucro/prejuízo, margem, despesas ainda a pagar e saldo da venda a receber. Em **Conferir gastos descontados**, confira cada gasto, o nome do favorecido e a parte do rateio utilizada. Clique em um gasto para abrir os pagamentos. É possível adicionar novas despesas ou comissões depois da venda; o lucro é recalculado.

O resumo do lucro é interno: **não aparece no recibo impresso/PDF nem na mensagem de resumo ao cliente**.

Em **Financeiro → Lucro por moto**, filtre pelo mês da venda, moto, chassi, cliente ou número da venda e exporte CSV. O relatório considera vendas ativas; vendas canceladas ficam no histórico.

## Gastos de uma moto ou do lote

- **Uma moto / chassi:** vincule a despesa diretamente à unidade, inclusive antes de vender. O gasto acompanha essa moto se ela mudar de lote.
- **Venda:** comissão, entrega e outros gastos exclusivos daquela venda. Em vendas com mais de uma moto, o valor é dividido entre as unidades da venda.
- **Lote ou compra:** o gasto comum é dividido igualmente entre as motos identificadas para o lançamento, incluindo as que já foram vendidas. Os centavos restantes são distribuídos de maneira estável, sem perder nem duplicar valor.
- **Despesa geral:** continua no resultado da loja; não é atribuída automaticamente a uma moto.

A lista de motos do rateio fica preservada: adicionar mais motos depois não redistribui os gastos já atribuídos. Para uma compra ainda em transporte, a atribuição acontece no recebimento. Se um lote ainda estiver vazio, o rateio fica provisório até ter motos e ser fixado na primeira venda ou reinicialização; por isso, termine de cadastrar as motos do lote antes da primeira venda. Ao atualizar, os gastos antigos por compra/lote são atribuídos às motos identificadas naquele momento. Confira os rateios de lançamentos antigos após a atualização.

O **frete informado na compra já integra o custo das motos**. Lance novamente somente frete extra/entrega que seja outro gasto, para evitar cadastrar a mesma despesa duas vezes.

## Exemplo

Uma moto vendida por R$ 8.000, com custo de R$ 5.000, R$ 200 de comissão para um funcionário, R$ 100 para outro, R$ 150 de entrega, R$ 80 de montagem final, R$ 50 de preparação e R$ 150 da montagem comum do lote deixa **R$ 2.270 de lucro**. O gasto comum do exemplo é R$ 300 dividido entre duas motos, então apenas R$ 150 entra nesta venda.

## Lucro, caixa e resultado mensal

O lucro desconta a despesa inteira, **mesmo a pagar**. Pagar depois movimenta o caixa e reduz o saldo pendente; não desconta o gasto pela segunda vez. A venda entra pelo total com desconto, independentemente de já ter sido totalmente recebida.

O relatório por moto agrupa as vendas pela data da venda e inclui todos os gastos vinculados, mesmo registrados em outro mês. O **Resultado mensal da loja** conserva o critério anterior: vendas e custos na data da venda; despesas na data do gasto, incluindo despesas gerais e gastos de motos ainda no estoque. Por isso, os relatórios podem diferir quando há gastos em meses diferentes ou motos ainda não vendidas. Um pagamento posterior não duplica as despesas em nenhum deles.

Se faltar custo de compra, o sistema mostra **Resultado parcial** até preencher o custo no cadastro da moto. Vendas antigas sem identificação individual também ficam marcadas como parciais. As sete fotos/motos fornecidas continuam preservadas; o preço de venda de R$ 8.000 não é tratado como custo de compra.

Cancelar a venda mantém as despesas e pagamentos realizados. Confira as despesas pendentes daquela venda antes de cancelá-las separadamente; uma comissão ou frete efetivamente pago não é apagado pelo cancelamento.

## Atualização no Coolify

Preserve o volume montado em **/app/data**, as variáveis existentes e o banco da instalação. Faça o backup habitual, substitua os arquivos e faça o redeploy. A migração **0009_sale_profit.sql** é aplicada automaticamente; as migrações 0000–0008 permanecem iguais. O servidor também cria a cópia anterior ao início de uma base existente.

Não remova o volume e não use `docker compose down -v` durante a atualização. O ZIP contém código e imagens, sem banco de produção nem credenciais.

## Verificação

TypeScript, build de produção e testes com bancos temporários verificam duas ou mais comissões, custo individual, rateio, centavos, transferência entre lotes, novas motos, despesas de compra antes da chegada, frete sem duplicação, pagamento em outro mês, concorrência, repetição de solicitações, cancelamento, reinício e migração com registros antigos. A interface foi conferida no computador e em 390 pixels de largura.
