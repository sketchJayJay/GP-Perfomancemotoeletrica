# GP Performance — atualização 1.4.1

## Excluir um lote

1. Abra **Estoque → Por lote**.
2. Use a lixeira no cartão ou **Abrir lote → Excluir lote**.
3. Confira o número e quantas motos disponíveis sairão do estoque. Marque a confirmação quando houver motos e clique em **Excluir lote**.

O lote sai da lista ativa. As motos que estavam disponíveis passam a constar como **Lote excluído** e deixam de aparecer como disponíveis para venda. O estoque por modelo e por lote é recalculado na mesma transação.

Chassis, fotos, condição nova/usada, custos e identificadores são preservados. Compras, despesas, contas a pagar, vendas e lançamentos financeiros continuam no histórico; excluir o lote não cancela dívidas nem gera estorno de dinheiro. Cada retirada fica nas Movimentações.

**Lotes com venda ativa não podem ser excluídos.** Confira a venda vinculada; não cancele uma venda legítima apenas para remover o lote da lista. A aplicação mantém a venda e os pagamentos protegidos.

## Restaurar

Abra **Estoque → Por lote → Excluídos → Restaurar lote** e confirme.

Somente as motos retiradas pela exclusão voltam ao estoque, com os mesmos dados. Motos que já tinham uma saída anterior, como devolução, permanecem fora. O número do lote continua reservado enquanto estiver excluído; restaure o lote para reutilizá-lo.

## Atualizar no Coolify

- Preserve o volume persistente montado em **/app/data** e as variáveis já configuradas.
- Faça o backup habitual, substitua os arquivos do código e faça o redeploy.
- A migração **0008_lot_exclusion.sql** é aplicada automaticamente. As migrações anteriores não foram alteradas. O servidor mantém a cópia automática antes de iniciar uma base existente.
- O pacote contém código e fotos; não substitui o banco de dados da instalação. Não remova o volume e não execute `docker compose down -v` durante a atualização.
- As sete motos fornecidas continuam com a importação única: excluir o lote não faz as motos reaparecerem após reiniciar.

## Validação

A versão foi verificada com TypeScript, build de produção e testes usando bases temporárias. Os casos incluem exclusão e restauração, saldo por modelo/lote, fotos e chassis preservados, despesas e pagamentos intactos, bloqueio de venda ativa, saídas anteriores, solicitações repetidas, concorrência, separação de escopos e reinício com importação ativada. A interface de confirmação e restauração foi conferida também na largura de celular.
