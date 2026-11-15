# Deploy no Netlify - Guia Rápido

## Passo a passo (5 minutos)

1. Acesse **https://app.netlify.com** e faça login
2. Clique em **"Add new site"** → **"Import an existing project"**
3. Conecte com **GitHub** e selecione o repo **Entretempo-prod**
4. Configure o deploy:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Clique em **"Deploy site"**

## Variáveis de ambiente (se necessário)

Nenhuma variável é necessária para a versão atual — todas as APIs são gratuitas (Cinemeta).

## URL de produção

Após o deploy, o Netlify gera uma URL como:
```
https://entretempo-prod-xxxxx.netlify.app
```

Para testar os endpoints da API:
```powershell
# Health check
curl https://entretempo-prod-xxxxx.netlify.app/api/health

# Busca de filmes
curl "https://entretempo-prod-xxxxx.netlify.app/api/search?type=movie&q=inception"

# Detalhes de filme
curl "https://entretempo-prod-xxxxx.netlify.app/api/details?type=movie&id=tt1375666"

# Busca de séries
curl "https://entretempo-prod-xxxxx.netlify.app/api/search?type=series&q=breaking+bad"

# Detalhes de série
curl "https://entretempo-prod-xxxxx.netlify.app/api/details?type=series&id=tt9054364"
```

## Validação programática

Após obter a URL, rode:
```powershell
$env:DEPLOY_URL = "https://entretempo-prod-xxxxx.netlify.app"
powershell -ExecutionPolicy Bypass -File validate-deploy.ps1
```

---

**Depois de configurar, atualize o AGENTS.md com a URL real de produção.**
