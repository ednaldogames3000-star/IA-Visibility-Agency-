# C+V — Costa Visibility Agency

Estrutura digital para crescimento: IA, visibilidade, automação e infraestrutura.

## Estado atual

- Landing page responsiva em `costa_visibility_agency_v6_1.html`.
- API de auditoria em `api/audit.js`.
- Motor de auditoria compartilhado em `lib/audit.js`.
- Runtime Express em `server/index.js` para execução local/VPS.
- `vercel.json` com headers de segurança para deploy.

## Rodar localmente

```bash
npm install
npm start
```

Abra `http://localhost:3000`.

## API

`POST /api/audit`

```json
{ "url": "https://exemplo.com" }
```

A auditoria possui proteções contra SSRF: somente HTTP/HTTPS, resolução DNS com bloqueio de redes privadas, validação de cada redirecionamento, limite de tamanho, timeout, limite de redirecionamentos e rate limit básico.

## Próxima etapa recomendada

Separar o frontend em `public/`, conectar o formulário à API real, adicionar persistência de auditorias, autenticação/JWT, banco de dados, observabilidade e integrações de sinais públicos verificáveis (Google/Maps, Search Console e redes sociais) somente com APIs/autorização adequadas.

Nunca coloque chaves de API, tokens ou senhas no frontend ou no Git. Use variáveis de ambiente/secret manager.
