# C+V — Costa Visibility Agency

Estrutura digital para crescimento: IA, visibilidade, automação e infraestrutura.

## Estado atual

- Landing page V6.1 em `costa_visibility_agency_v6_1.html`.
- API de auditoria em `api/audit.js` e motor compartilhado em `lib/audit.js`.
- Runtime Express em `server/index.js`.
- Persistência de diagnósticos em `lib/store.js` (JSONL).
- Autenticação administrativa com JWT em `lib/auth.js`.
- Testes automatizados com Node Test Runner em `tests/`.
- `vercel.json` com headers de segurança.

## Rodar localmente

```bash
npm install
npm run check
npm test
npm start
```

Abra `http://localhost:3000`.

## API pública

`POST /api/audit`

```json
{ "url": "https://exemplo.com" }
```

Cada auditoria bem-sucedida recebe um `auditId` e é persistida no armazenamento configurado por `AUDIT_STORE_PATH`.

## Área administrativa

Configure as variáveis de ambiente:

- `JWT_SECRET`: segredo aleatório com pelo menos 32 caracteres.
- `ADMIN_USER`: usuário administrativo.
- `ADMIN_PASSWORD_HASH`: hash no formato `salt:hash`, gerado pela função `createPasswordHash` em `lib/auth.js`.
- `AUDIT_STORE_PATH`: caminho do arquivo JSONL de auditorias (opcional).

Login: `POST /api/auth/login` com `{ "username": "...", "password": "..." }`.

Auditorias: `GET /api/admin/audits` usando `Authorization: Bearer <token>`.

## Segurança

A auditoria limita HTTP/HTTPS, bloqueia destinos locais/privados, valida redirecionamentos, limita tamanho de resposta, aplica timeout e rate limit. A API administrativa exige JWT com issuer/audience e as credenciais usam `scrypt` + comparação em tempo constante.

O armazenamento JSONL é adequado para execução em servidor/VPS com disco persistente. Em Vercel/serverless, o filesystem pode ser efêmero; para produção, substitua `lib/store.js` por Postgres ou outro armazenamento externo durável.

Nunca coloque chaves de API, tokens ou senhas no frontend ou no Git. Use variáveis de ambiente/secret manager.
