# C+V — Costa Visibility Agency

Estrutura digital para crescimento: IA, visibilidade, automação e infraestrutura.

## V7 / backend operacional

- Landing page V7 no `index.html`.
- Auditoria real em `api/audit.js` + motor compartilhado em `lib/audit.js`.
- Runtime Express em `server/index.js`.
- PostgreSQL em `lib/store.js` com clientes, auditorias, leads e logs.
- Schema reproduzível em `db/schema.sql`.
- Login administrativo com JWT + `scrypt` em `lib/auth.js`.
- Painel administrativo em `/admin.html`.
- Endpoint de saúde em `GET /api/health`.
- Testes automatizados com Node Test Runner em `tests/`.
- GitHub Actions em `.github/workflows/ci.yml`.
- `vercel.json` com headers de segurança.

## Produção

Configure as variáveis de ambiente a partir de `.env.example`:

- `DATABASE_URL`: conexão PostgreSQL.
- `DB_SSL=true` por padrão.
- `JWT_SECRET`: segredo aleatório com pelo menos 32 caracteres.
- `ADMIN_USER`: usuário administrativo.
- `ADMIN_PASSWORD_HASH`: valor `salt:hash` gerado por `createPasswordHash()`.
- `TRUST_PROXY=true` somente quando houver proxy reverso confiável.

O servidor cria/valida as tabelas automaticamente na primeira conexão. O SQL completo também está em `db/schema.sql`.

### Gerar o hash da senha

```bash
node -e "import('./lib/auth.js').then(({createPasswordHash}) => console.log(createPasswordHash(process.argv[1])))" "SUA-SENHA-FORTE"
```

Não coloque a senha ou o hash em arquivos públicos; use secrets/environment variables.

## Endpoints

### Público

- `POST /api/audit` — executa e persiste uma auditoria.
- `POST /api/leads` — registra lead.
- `GET /api/health` — verifica disponibilidade do banco e uptime.

### Administrativo

Todos exigem `Authorization: Bearer <JWT>`:

- `GET /api/admin/stats`
- `GET /api/admin/audits`
- `GET /api/admin/customers`
- `GET /api/admin/customers/:id/audits`
- `POST /api/admin/customers`
- `GET /api/admin/leads`
- `GET /api/admin/logs`

Login: `POST /api/auth/login`.

## Rodar localmente

```bash
npm install
npm run check
npm test
npm start
```

Abra `http://localhost:3000` e, com o servidor configurado, `http://localhost:3000/admin.html`.

## Segurança

A auditoria aceita HTTP/HTTPS, bloqueia destinos locais/privados, valida redirecionamentos, limita tamanho da resposta, aplica timeout e rate limit. A API usa headers de segurança, limite de JSON, IDs de requisição, logs estruturados e JWT com issuer/audience. A senha administrativa usa `scrypt` e comparação em tempo constante.

O rate limit atual é em memória e funciona por instância. Para múltiplas instâncias/serverless, substitua por Redis/Upstash ou outro rate limiter compartilhado.

O PostgreSQL é a persistência oficial da V7. O banco deve ser externo/durável em produção; não há fallback silencioso para JSONL.

## CI/CD

O workflow `.github/workflows/ci.yml` executa em pushes e pull requests para `main`, testa Node 20 e 22, instala dependências, executa `npm run check`, `npm test` e `npm audit --audit-level=high`.

O CI está configurado. Deploy contínuo depende da plataforma de hospedagem e de suas credenciais/secrets; elas não são armazenadas no repositório.

## Monitoramento

O `/api/health` fornece health check básico e o painel mostra a saúde do PostgreSQL. Os logs de aplicação ficam em PostgreSQL. Para observabilidade de produção (alertas, métricas e traces), conecte um serviço externo de monitoramento à URL de health check.
