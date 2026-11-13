# GP Performance 1.4 — Lote primeiro, motos por chassi e usadas

## Fluxo para as motos que chegaram

1. Abra **Estoque → Novo lote**.
2. Informe o número do lote, fornecedor, transportador e data de chegada, quando conhecidos.
3. Depois de salvar, use **Adicionar moto neste lote**.
4. Escolha um modelo já cadastrado ou cadastre o nome, cor e marca dentro da própria tela.
5. Informe foto, chassi/série, condição **Nova / Usada / A informar**, preço de venda e, se conhecido, custo de compra.
6. Cada cadastro novo adiciona **uma unidade** ao estoque. Repita para as outras motos daquele lote.

O lote pode ser criado vazio: ele só ganha saldo quando as motos são adicionadas. O número do lote pode ser corrigido em **Editar número / dados do lote**, mantendo as unidades e seus chassis. Em **Motos / chassis**, pesquise pelo modelo, número de chassi ou lote. A guia **Usadas** filtra apenas as motos marcadas como usadas; ano e quilometragem são opcionais.

## Motos das fotos enviadas

Na primeira inicialização desta versão, o pacote cadastra as sete unidades abaixo. Todas recebem preço de venda de **R$ 8.000,00**. O cadastro é registrado uma única vez, com verificação de chassis que já existam, e não é repetido ao reiniciar ou atualizar novamente. Nenhuma venda ou pagamento é gerado por esse cadastro.

| Modelo | Cor | Chassi transcrito | Venda |
| --- | --- | --- | --- |
| Tank | Cinza | HK1NAX8A1T819H636 | R$ 8.000,00 |
| Tank piu piu | Verde | R5XBL6357TM800196 | R$ 8.000,00 |
| GT sport | Vermelha | KTDM1X26052200028 | R$ 8.000,00 |
| Veloster | Preta | VS202608SK01-00947 | R$ 8.000,00 |
| IM1000 | Vermelha e preta | LEK5MW510T2605170 | R$ 8.000,00 |
| SOYAN | Cinza | LX7TJDT26T1085653 | R$ 8.000,00 |
| GMAX | Branca | **Não enviado — a informar** | R$ 8.000,00 |

As fotos fornecidas acompanham o pacote e aparecem nos cadastros. A SOYAN e a GMAX usam a área da foto presente no respectivo print enviado. Não foram inventadas especificações de potência, bateria ou autonomia.

**O número real do lote não foi enviado.** Por isso, as novas unidades são agrupadas provisoriamente em **MOTOS-ENVIADAS-13112026**, com indicação para completar o cadastro. Esse código é uma referência do pacote, não uma afirmação sobre o número do fornecedor. Corrija-o pelo botão **Informar lote**. Se houver mais de um lote físico entre essas motos, crie os outros lotes e mova cada unidade em **Editar moto → Lote**. O chassi permanece com a mesma unidade.

A data física de chegada, o fornecedor, o transportador, a condição nova/usada e os custos de aquisição dessas sete motos não foram informados. Esses dados permanecem pendentes. A condição inicial é **A informar**: não se presume que todas sejam novas nem usadas. O valor de R$ 8.000 é de venda; não é usado como custo de aquisição.

Se um chassi já existir no estoque, o cadastro utiliza a unidade existente e atualiza sua foto e o preço de venda solicitado, preservando o custo e a condição registrados. Uma unidade já vendida não é recolocada no estoque. O pacote também reconhece vendas anteriores ativas com o mesmo chassi. Saldos antigos sem chassi não são associados por suposição a uma moto das fotos. Caso essas unidades já tenham sido lançadas apenas por quantidade, configure **SEED_GP_BIKES=0 antes do primeiro deploy desta versão** e complete as unidades existentes, evitando contar a mesma moto física novamente. A opção padrão é cadastrar as motos solicitadas uma vez; o parâmetro está no `.env.example`.

## Venda, chassi e devolução

Na venda, selecione o modelo e a **Moto / chassi**. A tela também mostra lote e condição. A quantidade é de uma moto por venda da tela, para identificar exatamente a unidade que está saindo. O preço inicial vem do cadastro daquela moto e pode ser ajustado na venda.

O sistema baixa somente a unidade selecionada. Lote, chassi e condição ficam vinculados ao histórico, à venda e ao recibo. Um chassi cadastrado não pode ser reutilizado em outra unidade, mesmo que ela tenha sido vendida ou tenha saído do estoque. Letras minúsculas, espaços e separadores não permitem cadastrar o mesmo identificador novamente.

Ao cancelar uma venda, a mesma unidade volta ao lote de origem, preservando seu chassi e condição. Outras saídas podem ser registradas no detalhe da moto, com motivo e data, sem gerar venda nem recebimento no caixa. Também é possível consultar as vendas anteriores de cada moto.

Em vendas anteriores a esta versão, as quantidades, valores e custos existentes continuam preservados. Chassis que não eram conhecidos não são inventados retroativamente.

## Custo e resultado financeiro

Cada moto pode ter custo e preço de venda diferentes, inclusive dentro do mesmo modelo e lote. O custo da venda é o da unidade escolhida; não é substituído pelo custo de outra moto mais cara ou mais barata do mesmo lote. O estoque por modelo e os saldos por lote são calculados a partir das unidades disponíveis.

Quando o custo ainda não foi informado, a moto fica com **Custo a informar**. Se ela for vendida assim, o resultado da venda e do mês é sinalizado como **parcial**, sem tratar a ausência de custo como lucro confirmado. Abra o cadastro da moto vendida e complete o custo pendente para atualizar a apuração. Um custo de venda já conhecido não é alterado pela edição posterior de outra moto ou do estoque. Em moto vendida, os campos já registrados ficam protegidos; é possível completar chassi ou custo que estavam pendentes.

Os controles de viagens, montagem, despesas e contas a pagar da versão 1.3 continuam disponíveis no lote, na compra, na venda e no Financeiro. Os gastos extras permanecem separados do custo de aquisição da moto e são considerados no resultado mensal, sem duplicar os pagamentos do caixa.

## Compras e estoque já existentes

A aba **Compras** continua controlando as compras em andamento e o recebimento. Ao usar **Receber lote**, as unidades são criadas automaticamente dentro do lote. Abra o lote e use **Editar moto** para completar os chassis dessas unidades. **Adicionar moto** representa uma unidade extra; não é necessário adicionar novamente as que já foram recebidas.

Saldos anteriores desta loja são convertidos em unidades com identificação e condição pendentes, mantendo a quantidade e o custo que estavam cadastrados. Não há limpeza de estoque, clientes, compras, despesas, financeiro ou vendas.

## Atualização no Coolify

1. Baixe um backup completo no sistema antes de atualizar.
2. Atualize o código com o conteúdo deste ZIP e mantenha o Dockerfile, Node 24 e porta 3000.
3. **Preserve o mesmo volume `/app/data` e o banco `gp-performance.sqlite`. Não apague nem recrie o armazenamento da loja.**
4. A migração nova é `drizzle/0007_bike_units.sql`. As migrações de `0000` a `0006` foram mantidas intactas.
5. O servidor salva um backup do banco existente antes da inicialização, aplica apenas as migrações pendentes e registra a importação das motos para não repeti-la em próximos deploys.

Esta entrega é o pacote para instalar ou atualizar. Não foi feito deploy no servidor da loja nem alteração no Site hospedado anteriormente. O pacote contém os dados de cadastro solicitados e as fotos; não contém banco operacional, credenciais ou dados fictícios dos testes.

## Verificação

TypeScript, build de produção e 13 testes automatizados passaram em Node 24. Os testes incluem migração preservando saldo anterior, cadastro de lote vazio, motos usadas, chassis duplicados, duas unidades do mesmo modelo com custos diferentes, venda da unidade escolhida, concorrência, devolução da mesma unidade, mudança de lote sem perder a identidade, custo pendente e seu preenchimento, importação das sete fotos sem repetição, reinício, backup e os módulos anteriores de compras, despesas, vendas e acesso.

As telas de lote, cadastro de moto, nova/usada, venda, recibo e devolução foram conferidas em navegador. Foto, preço, chassi e busca também foram inspecionados em uma área móvel de 390 px. As operações de conferência usaram uma demonstração isolada, sem alterar a operação da loja. A imagem Docker será construída pelo Coolify na instalação.
