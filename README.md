# GP Performance — edição Coolify

Sistema de vendas de motos elétricas com estoque, entradas/saídas, modelos com fotos, clientes, vendas com desconto e pagamento parcial, financeiro, recibos para imprimir/salvar em PDF, exportações e aniversários via Z-API.

**Instalação:** leia [LEIA_PRIMEIRO_COOLIFY.md](LEIA_PRIMEIRO_COOLIFY.md).

## Stack

React + Vite, servidor HTTP Node 24, SQLite nativo. Banco e backups em `/app/data` no container. Use uma única instância com um volume persistente para esse caminho.

## Executar sem Docker

```sh
npm ci
npm run check
npm run build
DATA_DIR=./data PORT=3000 npm start
```

O aplicativo escuta em `0.0.0.0:3000`. Abra o endereço e crie o administrador no primeiro acesso. Configure as variáveis do arquivo `.env.example` no seu ambiente. O Node não carrega `.env` automaticamente pelo comando `npm start`; use as variáveis do Coolify/Compose ou exporte-as antes de executar.

## Executar com Docker Compose

```sh
docker compose up -d --build
```

A porta é 3000, e o Compose inclui volume persistente. Para atualizar:

```sh
docker compose up -d --build
```

Preserve o volume. Não use `docker compose down -v` para atualizar a loja.

## Testar

```sh
npm run build
npm test
```

Os testes usam base temporária, clientes fictícios, nenhum telefone real e credenciais WhatsApp vazias. A integração de aniversário precisa da configuração da Z-API no ambiente de instalação.

O arquivo `package-lock.json` fixa as dependências. As migrações de `drizzle/` são aplicadas automaticamente, somente as ainda não aplicadas. O processo verifica o hash das migrações antigas; preserve os arquivos que já foram usados.

A edição hospedada originalmente foi adaptada para um processo Node independente. Este pacote não contém credenciais, banco preenchido, cache de testes ou dependências de autenticação/hospedagem do ChatGPT. O agendador de aniversários e os backups executam no próprio servidor.

Logo fornecida pelo cliente em `public/images/gp-logo.jpeg`. Hero gerado como conceito ilustrativo, sem representar modelo comercial ou especificação técnica.
