# Agências e Ferramentas

## Sobre Nós

Somos uma equipe de desenvolvimento focado em criar aplicações web modernas. Nosso objetivo é fornecer ferramentas completas para deployment, testes e integração com APIs como Supabase.

## Resumo do Projeto

- **Entretempo** - Aplicativo de entretenimento com integração Supabase
- **Framework** - Vite + React (frontend) + Serverless Functions (API)
- **Teste** - 58 testes passando no Vitest, incluindo bugs corrigidos
- **Deploy** - Vercel (free tier — limite crítico!)

---

## ⚠️ REGRAS CRÍTICAS DE DEPLOY (LEIA ANTES DE TUDO)

### 🛑 NUNCA force-push para testar ou validar!

Cada push ao GitHub **dispara automaticamente** um deploy no Vercel. No free tier, o limite é **100 deploys por dia**. Já atingimos esse limite devido a pushes desnecessários de teste/validação.

**Regra absoluta:**
- Teste **TUDO** localmente (`npm test`, `npx vite build`, `validate-deploy.ps1`) ANTES de qualquer commit.
- Faça **UM ÚNICO COMMIT** com todas as alterações.
- Force-push **APENAS UMA VEZ** quando estiver 100% pronto para produção.
- NUNCA force-push para "verificar se funcionou" — use o script de validação local.

### 🛑 NUNCA faça commits pequenos apenas para testar!

Cada commit = deploy automático no Vercel. Se você precisa fazer 5 tentativas, são 5 deploys gastos.

**Fluxo correto:**
```
1. Faça TODAS as alterações necessárias
2. Rode npm test → deve passar 58/58
3. Rode npx vite build → deve compilar sem erros
4. Rode validate-deploy.ps1 contra a URL de produção existente
5. SOMENTE SE TUDO PASSAR: git add . → commit único → force-push UMA VEZ
```

### 🛑 Use sempre o deploy pessoal, NUNCA o da equipe!

- ✅ **Correto:** `https://entretempo-five.vercel.app` (sem SSO, API funciona)
- ❌ **Errado:** URLs com `-kleitonrangels-projects.vercel.app` (SSO bloqueia a API)

O projeto de equipe (`kleitonrangels-projects`) tem autenticação obrigatória ativada. Isso impede que a API responda JSON — retorna página de login do Vercel no lugar.

---

## Configuração do Git (OBRIGATÓRIO)

**Antes de qualquer commit, verifique a autoria:**

```bash
git config user.name    # deve ser "Kleiton Rangel"
git config user.email   # deve ser KleitonRangel@users.noreply.github.com
```

Se estiver diferente, corrija ANTES de commitar:

```bash
git config --global user.name "Kleiton Rangel"
git config --global user.email "KleitonRangel@users.noreply.github.com"
```

> ⚠️ **NUNCA use `SEU_NOME` ou `SEU_EMAIL`** — o Vercel bloqueia deploys se a autoria do commit não corresponder à conta GitHub.

---

## Deploy no Vercel

1. Configure o Git corretamente (veja seção acima)
2. Faça **TODAS** as alterações de uma vez
3. Rode `npm test` — deve passar 58/58
4. Rode `npx vite build` — deve compilar sem erros
5. Rode `powershell -ExecutionPolicy Bypass -File validate-deploy.ps1` contra a URL existente
6. **SOMENTE SE TUDO PASSAR:** `git add . → git commit -m "descrição" → git push --force origin main` (UMA ÚNICA VEZ)

---

## Monitoramento de Deploy (OBRIGATÓRIO)

**Sempre após fazer push, acompanhe o deploy do Vercel até o final.** Não assuma que deu certo só porque o commit foi empurrado. Siga estes passos:

1. Após `git push`, aguarde o Vercel finalizar a build (verifique no painel ou use `npx vercel ls`)
2. Teste **todas** as rotas da API usando o script de validação:
   ```bash
   powershell -ExecutionPolicy Bypass -File validate-deploy.ps1
   ```
3. Acesse a URL de produção (`https://entretempo-five.vercel.app`) e verifique se o frontend carrega sem erros no console
4. Se qualquer rota falhar, corrija o código, faça **UM ÚNICO** commit+push, e repita

> ⚠️ **Nunca encerre a sessão até confirmar que todas as rotas estão funcionando na produção.**
> ⚠️ **Se precisar de mais de 2 tentativas, pare e avise — estamos perto do limite diário.**

---

## Regressão de Testes

**Sempre que um bug for encontrado e corrigido, crie um teste regressivo correspondente.**
O teste deve cobrir o caso exato que falhou para garantir que não se repita em futuras alterações.
Exemplo: quando a API `/api/details` retornava dados sem envolver em `{ details }`, o frontend crashava ao acessar `.runtime`. O bug foi corrigido e um teste regressivo foi adicionado em `server/api-response.test.ts` para validar o formato de resposta da API.

---

## Problemas Conhecidos

### HLTB (HowLongToBeat) Bloqueando Requests
- A API do HLTB retorna 403 (IFW-U01) bloqueando requisições serverless.
- Busca de jogos retorna array vazio.
- Solução: usar outra API gratuita de jogos (IGDB via Stremio/Cinemeta, ou RAWG).

### Limite de Deploys Diários (Free Tier)
- **100 deploys por dia** no plano gratuito.
- Já atingimos esse limite devido a pushes desnecessários.
- Após atingir o limite, é preciso esperar 24h ou fazer upgrade.
- **Resumo:** cada push conta como deploy. Seja cirúrgico.

---

## Suporte

Se você tiver alguma dúvida, sinta-se à vontade para perguntar em Português do Brasil.
