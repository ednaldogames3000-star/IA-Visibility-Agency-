# C+V — Costa Visibility Agency

Estrutura digital para crescimento: IA, visibilidade, automação e infraestrutura.

## V7 / backend operacional

- Landing page V7 no `index.html`.
- Auditoria real em `api/audit.js` + motor compartilhado em `lib/audit.js`.
- Runtime Express em `server/index.js`.
- PostgreSQL em `lib/store.js` com clientes, auditorias, leads e logs.
- Schema reproduzível em `db/schema.sql`.
- Login administrativo com JWT + `scrypt` em `lib/auth.js`.
- Sessão administrativa em cookie `HttpOnly`, `Secure` em produção e `SameSite=Strict`.
- Painel administrativo em `/admin.html`.
- Endpoint de saúde em `GET /api/health`.
- Testes automatizados com Node Test Runner em `tests/`.
- GitHub Actions em `.github/workflows/ci.yml`.
- Deploy contínuo opcional em `.github/workflows/deploy.yml`.
- `vercel.json` com roteamento da API e headers de segurança.
- Páginas legais básicas em `/privacy.html` e `/terms.html`.

## Produção

Configure as variáveis de ambiente a partir de `.env.example`:

- `DATABASE_URL`: conexão PostgreSQL.
- `DB_SSL=true` por padrão; em produção, prefira uma URL/servidor PostgreSQL com TLS verificável.
- `DB_POOL_MAX=3` por padrão para ambiente serverless.
- `JWT_SECRET`: segredo aleatório com pelo menos 32 caracteres.
- `ADMIN_USER`: usuário administrativo.
- `ADMIN_PASSWORD_HASH`: valor `salt:hash` gerado por `createPasswordHash()`.
- `TRUST_PROXY=true` somente quando houver proxy reverso confiável.

O servidor cria/valida as tabelas automaticamente na primeira conexão. O SQL completo também está em `db/schema.sql`.

### Gerar o hash da senha

```bash
node -e "import('./lib/auth.js').then(({createPasswordHash}) => console.log(createPasswordHash(process.argv[1])))" "SUA-SENHA-FORTE"
```

Não coloque senha, hash, JWT ou DATABASE_URL no repositório.

## Endpoints

### Público

- `POST /api/audit` — executa e persiste uma auditoria.
- `POST /api/leads` — registra lead.
- `GET /api/health` — verifica disponibilidade do banco e uptime.

### Administrativo

As rotas administrativas usam a sessão `HttpOnly` criada pelo login; o token não é armazenado no `localStorage`.

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/admin/stats`
- `GET /api/admin/audits`
- `GET /api/admin/customers`
- `GET /api/admin/customers/:id/audits`
- `POST /api/admin/customers`
- `GET /api/admin/leads`
- `GET /api/admin/logs`

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

O painel usa cookie `HttpOnly` + `SameSite=Strict`, reduzindo a exposição do token a JavaScript e a ataques cross-site. O rate limit atual é em memória e funciona por instância; para múltiplas instâncias/serverless, substitua por Redis/Upstash ou outro rate limiter compartilhado.

O PostgreSQL é a persistência oficial da V7. O banco deve ser externo/durável em produção; não há fallback silencioso para JSONL.

## CI/CD

O workflow `.github/workflows/ci.yml` executa em pushes e pull requests para `main`, testa Node 20 e 22, instala dependências, executa `npm run check`, `npm test` e `npm audit --audit-level=high`.

O workflow `.github/workflows/deploy.yml` pode publicar no Vercel após CI aprovado, mas depende dos secrets da conta Vercel no GitHub.

## Monitoramento

O `/api/health` fornece health check básico e o painel mostra a saúde do PostgreSQL. Os logs de aplicação ficam em PostgreSQL. Para observabilidade de produção (alertas, métricas e traces), conecte um serviço externo de monitoramento à URL de health check.

## Antes do lançamento público

1. Criar PostgreSQL de produção e configurar `DATABASE_URL`.
2. Configurar `JWT_SECRET`, `ADMIN_USER` e `ADMIN_PASSWORD_HASH` como secrets.
3. Configurar os secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID` se usar o deploy via GitHub Actions.
4. Configurar domínio e HTTPS.
5. Definir backups e retenção do PostgreSQL.
6. Configurar monitoramento e alertas externos.
7. Revisar a política de privacidade/termos com profissional jurídico conforme a operação real e a LGPD.
8. Executar smoke tests no domínio real: site, análise, formulário de lead, login, painel, banco e logout.
