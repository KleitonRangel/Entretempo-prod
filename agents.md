# Agências e Ferramentas

## Sobre Nós

Somos uma equipe de desenvolvimento focado em criar aplicações web modernas. Nosso objetivo é fornecer ferramentas completas para deployment, testes e integração com APIs como Supabase.

## Resumo do Projeto

- **Entretempo** - Aplicativo de entretenimento com integração Supabase
- **Framework** - Next.js com Vitest para testes
- **Teste** - 58 testes passando, incluindo bugs corrigidos

## Regressão de Testes

**Sempre que um bug for encontrado e corrigido, crie um teste regressivo correspondente.**
O teste deve cobrir o caso exato que falhou para garantir que não se repita em futuras alterações.
Exemplo: quando a API `/api/details` retornava dados sem envolver em `{ details }`, o frontend crashava ao acessar `.runtime`. O bug foi corrigido e um teste regressivo foi adicionado em `server/api-response.test.ts` para validar o formato de resposta da API.

## Deploy no Vercel

1. Inicialize o Git: `git init → git add . → git commit → git branch -M main`
2. Configure Supabase em `.env.local` com credenciais reais
3. Importe na Vercel e configure a integração com Supabase
4. Rode `npm test` para confirmar que nada quebrou

## Monitoramento de Deploy (OBRIGATÓRIO)

**Sempre após fazer push, acompanhe o deploy do Vercel até o final.** Não assuma que deu certo só porque o commit foi empurrado. Siga estes passos:

1. Após `git push`, aguarde o Vercel finalizar a build (verifique no painel ou force com novo commit)
2. Teste **todas** as rotas da API no ar:
   - `GET /api/health` → deve retornar `{"ok":true}`
   - `GET /api/search?type=movie&q=teste` → deve retornar `{ "results": [...] }` (array dentro de `results`)
   - `GET /api/details?type=movie&id=tt1375666` → deve retornar `{ details: {...} }` (objeto dentro de `details`)
   - `GET /api/details?type=series&id=tt9054364` → mesmo padrão `{ details: {...} }`
3. Acesse a URL de produção (`https://entretempo-five.vercel.app`) e verifique se o frontend carrega sem erros no console
4. Se qualquer rota falhar, corrija o código, faça commit+push, e **repita os passos 1-3**

**Nunca encerre a sessão até confirmar que todas as rotas estão funcionando na produção.**

## Suporte

Se você tiver alguma dúvida, sinta-se à vontade para perguntar em Português do Brasil.