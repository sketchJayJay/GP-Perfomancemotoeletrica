# GP Performance — instalação no Coolify

**Versão 1.4:** este pacote inclui o cadastro inicial das sete motos enviadas, por R$ 8.000 cada, e estoque individual por chassi. Leia [ATUALIZACAO_LOTES_CHASSIS.md](ATUALIZACAO_LOTES_CHASSIS.md) para conferir os dados pendentes e a importação antes do deploy.

## Configuração rápida

| Campo no Coolify | Valor |
| --- | --- |
| Build Pack / Build strategy | **Dockerfile** |
| Base Directory | `/` (raiz dos arquivos deste pacote) |
| Dockerfile Location | `/Dockerfile` |
| Ports Exposes | **3000** |
| Health check path | `/api/health` |
| Persistent Storage — Destination Directory | **/app/data** |
| Persistent Storage — Source Directory (se usar Directory Mount) | **/data/gp-performance** |
| Variável `DATA_DIR` | `/app/data` |
| Variável `PUBLIC_URL` | URL completa do sistema, por exemplo `https://gp.seudominio.com.br` |

## 1. Enviar o código

1. Extraia este ZIP.
2. Envie os arquivos da pasta `GP_Performance_Coolify` para um repositório seu no GitHub. O arquivo `Dockerfile` deve ficar na raiz desse repositório.
3. No Coolify, crie uma aplicação a partir desse repositório.
4. Escolha **Dockerfile**, porta **3000** e configure o domínio.
5. O sistema escuta em `0.0.0.0`, como o proxy do Coolify precisa.

O ZIP contém código completo e lockfile. O Coolify instala as dependências e compila durante o deploy. Não é necessário enviar `node_modules`.

## 2. Salvar os dados fora do container — faça antes de usar

Em **Persistent Storage**, adicione um volume ou Directory Mount com destino **`/app/data`**.

Exemplo de Directory Mount:

- Source Directory: `/data/gp-performance`
- Destination Directory: `/app/data`

Salve e aplique o mount antes de cadastrar os dados da loja. Se o Coolify pedir, redeploy após adicionar o armazenamento. Use o mesmo mount nos próximos deploys.

O banco fica em `/app/data/gp-performance.sqlite`. Fotos dos modelos são guardadas junto dos registros no banco. Cópias automáticas ficam em `/app/data/backups`.

**Atualizar o código preserva os dados quando `/app/data` continua montado no mesmo volume. Não exclua nem recrie esse armazenamento nas atualizações.** Um mount novo e vazio abre uma loja vazia; ele não recupera dados de um container antigo.

O arquivo `docker-compose.yml` também está incluído. Se optar por Docker Compose a partir do repositório, ele já declara um volume nomeado `gp_performance_data:/app/data`. Nesse caso, preserve o volume declarado no Compose.

## 3. Primeiro acesso

Abra o domínio e crie seu usuário e senha de administrador. **Não existe senha padrão.** A senha precisa ter pelo menos 8 caracteres.

Se preferir criar o administrador pelas variáveis do Coolify antes do primeiro deploy:

- `ADMIN_USERNAME`: o usuário desejado;
- `ADMIN_PASSWORD`: a senha desejada, com pelo menos 8 caracteres.

Essas variáveis só criam o primeiro acesso quando ainda não há administrador. Elas não sobrescrevem uma senha existente. Configure-as como segredos e nunca envie senhas para o GitHub.

Esta versão usa login próprio. Não depende de login do ChatGPT. As informações reais começam vazias; a demonstração é opcional e separada.

## 4. Aniversários automáticos no servidor

A rotina já está incluída neste pacote e roda com o aplicativo aberto ou fechado no navegador. Ela verifica o dia a cada minuto e faz o processamento a partir das **09h, horário de Brasília**. Se o servidor iniciar mais tarde, processa o dia quando estiver disponível. O container precisa permanecer ligado.

Para conectar o WhatsApp da loja, configure como segredos no Coolify:

- `ZAPI_INSTANCE_ID`
- `ZAPI_TOKEN`
- `ZAPI_CLIENT_TOKEN`

Conecte a instância na Z-API pelo QR Code e reinicie/republique o container para aplicar as variáveis. No sistema, entre em **Relacionamento → Mensagem de aniversário**, personalize o texto e ative o envio. No cadastro de cada cliente, preencha telefone, nascimento e autorização para receber mensagens.

Não é necessário agendar uma tarefa no ChatGPT para esta instalação. O agendamento da versão online anterior continua vinculado àquela versão e não acessa o banco do Coolify.

Sem credenciais ou com a opção desativada, nenhuma mensagem é enviada. Cada cliente tem no máximo um processamento automático por aniversário/ano. Resultados incertos ficam no histórico para conferência; não são repetidos automaticamente. Nos anos não bissextos, 29/02 é tratado em 01/03.

`Aceita pelo provedor` significa que a Z-API recebeu o pedido. A entrega e a leitura no WhatsApp dependem do provedor. A conta/serviço Z-API é configurado separadamente.

## 5. Backup e atualização

- O sistema cria uma cópia do banco existente antes de iniciar, incluindo durante atualizações, e outra diariamente. Conserva as cópias automáticas por 14 dias.
- Em **Configurações → Baixar backup completo**, baixe uma cópia SQLite consistente. Esse arquivo contém os dados e a configuração de acesso da loja.
- **Exportar dados** baixa JSON dos registros comerciais; as tabelas de vendas e caixa também exportam CSV.
- Para uma cópia pelo terminal do container: `node scripts/backup.mjs`.
- Guarde também uma cópia fora do servidor. O volume persistente e os backups nele não protegem contra perda do próprio servidor.

### Restaurar uma cópia SQLite

1. Pare a aplicação no Coolify.
2. Faça uma cópia da pasta persistente atual antes de substituir qualquer arquivo.
3. Coloque o backup escolhido na pasta persistente com o nome `gp-performance.sqlite`.
4. Com a aplicação ainda parada, mova os arquivos antigos `gp-performance.sqlite-wal` e `gp-performance.sqlite-shm` para a cópia de segurança, caso existam. Não os misture com o banco restaurado.
5. Inicie a aplicação com o mesmo `/app/data` montado.

O usuário e a senha serão os existentes no momento do backup. A restauração substitui os dados atuais pelo conteúdo daquela cópia.

## 6. Verificar o deploy

O log deve mostrar `GP Performance pronta na porta 3000`. A rota `/api/health` deve retornar `status: ok`.

Depois do primeiro cadastro, reinicie a aplicação e confira que o registro continua aparecendo. Essa é a confirmação de que o volume foi montado corretamente no seu servidor.

## O que foi verificado neste pacote

- Checagem TypeScript e compilação de produção com Node 24.
- Seis testes automatizados, incluindo o servidor HTTP real.
- Criação do administrador, login, logout, bloqueio de chamadas sem sessão e rejeição de origem externa.
- Cadastro de modelo e cliente, desconto, venda parcial, quitação, cancelamento, duplicidade de requisições e disputa por recebimentos.
- Download de backup, leitura da cópia e reinício do processo com persistência e geração de cópia antes de iniciar.
- Verificação de aniversário sem credenciais, sem envio de mensagens.

O Docker não está disponível no ambiente de preparação: o Dockerfile foi fornecido e seus comandos de checagem/compilação/inicialização foram testados no Node 24. O build da imagem ocorrerá no Coolify. Nenhum contato real foi usado para testes de envio.

## Referências oficiais

- Dockerfile no Coolify: https://coolify.io/docs/applications/builds/dockerfile
- Persistência no Coolify: https://coolify.io/docs/applications/configuration/persistent-storage
- API de mensagem Z-API: https://v2.developer.z-api.io/message/send-message-text
