# GP Performance — custos protegidos por senha (1.6.0)

## Ativar após atualizar

1. Entre na operação real da loja.
2. Abra **Configurações → Privacidade dos custos → Ativar proteção por senha**. Também é possível usar **Proteger custos** no topo.
3. Confirme a senha de entrada do administrador.
4. Defina e repita uma **senha dos custos**, com pelo menos 8 caracteres, e salve. Ela pode ser diferente da senha usada para entrar no sistema.

A opção deve ser ativada pelo responsável após a atualização. Não existe uma senha dos custos padrão no pacote. A confirmação da senha é feita pelo servidor; somente o hash com sal é armazenado, sem guardar a senha em texto.

## Consultar e ocultar

Com a proteção ativada, abra **Ver custos** e digite a senha dos custos. A consulta é liberada por **cinco minutos**, somente para a página e a sessão que fizeram a verificação.

Clique em **Ocultar custos** para bloquear imediatamente. Atualizar a página, abrir o sistema em outra aba ou janela, ou sair da conta exige outra liberação. O aplicativo mantém a liberação apenas em memória, sem gravá-la para a próxima abertura. Trocar a senha ou desativar a proteção encerra as liberações anteriores.

## Informações protegidas

- Custo individual da moto, custo médio do modelo e investimento no estoque.
- Custos nas unidades vendidas, saldos por lote e movimentações.
- Compras, seus valores e os cadastros/alterações que exigem informar custos.
- Lucro, margem, prévia da apuração, relatório por moto, resultado mensal e fluxo de caixa completo, pois esses valores permitem deduzir o custo.
- Exportação completa em JSON e download do backup SQLite.

Enquanto estiver bloqueado, a resposta de dados não envia os custos reais ao navegador. Não é apenas uma máscara visual. Os arquivos básicos de estoque continuam podendo ser exportados, com **Protegido** na coluna de custo. Relatórios que revelam os custos e o backup completo exigem liberação. A senha e seu hash não são enviados nas respostas normais do sistema.

O recibo e a mensagem ao cliente seguem sem custo, margem ou lucro.

## Operação com os custos ocultos

Clientes, identificação dos lotes, consultas de estoque, chassi, preço de venda, vendas e recebimentos continuam funcionando. Despesas como comissão, montagem e entrega continuam no controle de contas a pagar.

Ao vender, o servidor utiliza o custo original da moto para calcular o resultado, mesmo que ele esteja oculto para quem registrou a venda. Ao editar os dados de uma moto com os custos ocultos, o custo já registrado é preservado. Novas motos podem ser cadastradas com o custo pendente; para informar ou alterar custos, libere a visualização. Compras, modelos e entradas com custo também exigem a senha.

## Trocar ou desativar

Em **Configurações → Privacidade dos custos → Gerenciar senha dos custos**, informe a senha atual dos custos e escolha trocar a senha ou desativar a proteção. A senha de entrada do administrador, sozinha, não substitui a senha dos custos quando a proteção já está ativada.

Depois de cinco tentativas incorretas, novas verificações ficam bloqueadas por quinze minutos. O limite é mantido se o servidor reiniciar.

A proteção controla o acesso dentro do sistema; quem administra diretamente o servidor, o banco ou uma cópia já baixada continua responsável por esses arquivos. Valores digitados manualmente em observações ou descrições livres continuam sendo texto do registro.

## Atualizar no Coolify

Preserve o volume em **/app/data**, as variáveis existentes e o banco da instalação. Faça o backup habitual, substitua o código e faça o redeploy. A migração **0010_cost_privacy.sql** é aplicada automaticamente. As migrações 0000–0009 não foram alteradas e o servidor mantém sua cópia anterior ao início de uma base existente.

Ative a opção seguindo o primeiro tópico. A atualização não troca as senhas de entrada, não apaga motos, chassis, fotos, clientes, compras, vendas ou despesas. Não remova o volume e não use `docker compose down -v` para atualizar.

## Verificação

Os testes cobrem a ocultação dos campos na API, liberação com senha, sessão diferente, expiração, bloqueio de backup, limites de tentativas, reinício, troca e desativação da senha, encerramento da sessão e preservação dos custos ao vender ou editar uma moto enquanto os valores estão ocultos. A máscara e o formulário de consulta foram conferidos no computador e no celular.
