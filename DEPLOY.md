# COSTA — checklist de lançamento

## 1. Vercel
- Importar este repositório no Vercel.
- Usar `main` como Production Branch.
- Confirmar que o projeto faz deploy sem build command customizado.
- Em Settings → Environment Variables, configurar `DATABASE_URL`, `JWT_SECRET`, `ADMIN_USER`, `ADMIN_PASSWORD_HASH` para Production.
- Redeploy após alterar variáveis.

## 2. PostgreSQL
- Criar PostgreSQL gerenciado (Neon é uma opção compatível com Vercel).
- Executar `db/schema.sql` no SQL Editor do provedor.
- Copiar a connection string para `DATABASE_URL` apenas no ambiente seguro; nunca fazer commit dela.
- Confirmar que SSL está habilitado.

## 3. Administrador
- Gerar uma senha forte com pelo menos 12 caracteres.
- Gerar o hash usando `createPasswordHash` em ambiente local seguro ou outro processo equivalente.
- Configurar `ADMIN_USER` e `ADMIN_PASSWORD_HASH` na Vercel.
- Não colocar senha, hash ou JWT secret em arquivos versionados.

## 4. Domínio
- Adicionar o domínio em Vercel → Project Settings → Domains.
- Seguir os registros DNS apresentados pela Vercel.
- Aguardar a emissão automática do certificado HTTPS.
- Definir o domínio principal e testar a versão `www` caso seja usada.

## 5. Pós-deploy
- Abrir `/` e testar mobile/desktop.
- Testar `/api/health`.
- Testar uma auditoria com um site público permitido.
- Testar formulário de lead.
- Testar login administrativo.
- Confirmar criação de cliente, lead, auditoria e logs no PostgreSQL.
- Testar logout.
- Confirmar que arquivos internos como `/server/index.js`, `/lib/store.js`, `/db/schema.sql`, `/admin.html` e `/.env` não ficam públicos.
- Testar uma URL privada/localhost na auditoria e confirmar bloqueio.
- Abrir uma URL inexistente e confirmar a página 404.

## 6. Segurança operacional
- Ativar 2FA nas contas GitHub e Vercel.
- Usar segredos somente em variáveis de ambiente. O GitHub recomenda armazenar credenciais sensíveis como Actions secrets, com menor privilégio possível.
- Ativar backup/retention do PostgreSQL conforme o provedor escolhido.
- Configurar monitoramento de uptime e alertas antes de divulgar o site em escala.

## 7. SEO depois do domínio
- Definir canonical absoluto usando o domínio final.
- Criar sitemap.xml com o domínio final.
- Cadastrar o domínio no Google Search Console.
- Enviar sitemap.
- Testar Open Graph e compartilhamento em WhatsApp/Instagram.

## Regra de ouro
Nenhuma senha, token, connection string ou chave privada deve entrar no GitHub. Use as variáveis de ambiente da Vercel/GitHub.
