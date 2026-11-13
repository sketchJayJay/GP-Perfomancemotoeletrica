# GP Performance 1.1 — Compras e lotes

## Como usar

1. Entre na nova aba **Compras** e toque em **Nova compra**.
2. Preencha a data, o fornecedor (quem está vendendo as motos), o responsável pela compra e, se houver, a transportadora/freteiro e a previsão de chegada.
3. Adicione os modelos do lote, com quantidade e custo por moto. Um mesmo lote pode ter vários modelos. Cadastre modelos novos no Estoque com quantidade inicial zero antes de montar a compra.
4. Informe o frete e escolha a situação: **Em compra**, **Comprada** ou **Em transporte**.
5. O total é calculado pelas motos mais o frete. A compra ainda não altera estoque nem caixa.
6. Quando todas as motos chegarem, abra a compra e use **Receber lote no estoque**. Confira as quantidades e informe a data real de chegada. Se a entrega for diferente, ajuste a compra antes de confirmar o recebimento.
7. O sistema adiciona as quantidades de cada modelo, atualiza o custo médio com o frete distribuído e registra as entradas no histórico. A compra passa para **Recebida** e não pode ser recebida novamente.
8. Se o total do lote for pago naquele momento e não tiver sido lançado antes, marque **Registrar o pagamento desta compra no caixa agora**. A opção começa desmarcada para evitar duplicar pagamentos.

Compras ainda não recebidas podem ser editadas ou canceladas. Cancelamentos ficam no histórico e não adicionam motos ao estoque. Uma compra recebida fica preservada; eventuais devoluções devem ser registradas pelas movimentações apropriadas.

## Atualizar no Coolify

- Baixe um backup completo em Configurações antes de atualizar.
- Substitua os arquivos do código pelos deste pacote e faça o deploy com o mesmo Dockerfile.
- **Preserve o armazenamento persistente /app/data e o mesmo banco gp-performance.sqlite.** Não crie um volume vazio e não apague o volume da loja.
- A migração nova `drizzle/0004_purchases.sql` adiciona somente as tabelas de compras e itens. Os arquivos das migrações anteriores foram preservados, sem alteração.
- O sistema faz cópia do banco existente antes de iniciar, aplica a migração e mantém modelos, clientes, vendas e financeiro.
- Esta entrega atualiza o pacote de instalação. Ela não faz alterações diretamente no seu servidor Coolify.

## Verificação desta atualização

TypeScript, build de produção e os sete testes passaram. O teste de compras utiliza o servidor HTTP real e verifica: atualização de um banco anterior, compra com dois modelos e frete, estoque inalterado durante compra/transporte, edição, bloqueio de edição desatualizada, recebimentos concorrentes, proteção contra duplicação, custo médio com frete, pagamento opcional, cancelamento, preservação dos dados após reinício e inclusão das compras no backup.
