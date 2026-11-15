# Entretempo

Sua fila pessoal de **jogos, filmes e séries** — na ordem em que você quer viver cada história.

O Entretempo foi feito para responder uma pergunta simples: *o que vem a seguir?* Você monta a lista, arrasta para definir a ordem, marca o que está em andamento e vê quanto tempo falta para colocar tudo em dia.

## O que já funciona

- **Três colunas:** Agora, Finalizados e Descartados, com contadores e busca na lista.
- **Reordenação por arrastar** (mouse ou teclado) em cada coluna.
- **Em andamento:** destaca o item com borda e pill, além de mostrar no topo da página o que você está consumindo agora.
- **Adicionar item buscando a capa:**
  - Jogos: busca no HowLongToBeat e traz **Main Story**, **Main + Extra** e **Completionist**.
  - Filmes: busca no IMDb (via Cinemeta) e traz a duração.
  - Séries: busca no IMDb e traz episódios, duração por episódio e temporadas.
- **Séries e animes:** busca no IMDb e traz episódios, duração por episódio, temporadas e a **quebra de episódios por temporada**.
- **Escolha de temporada:** ao selecionar uma série, dá para marcar só a temporada que você está vendo (ex.: T2) ou somar várias; o tempo total recalcula na hora.
- **Tempos editáveis:** escolha o modo do jogo e ajuste qualquer valor; nas séries, escolha a velocidade **1x / 1,3x / 1,5x**.
- **Troca de capa** no editor expandido, buscando outro título ou colando uma URL de imagem.
- **Edição no próprio card:** título, tipo, tempos, capa, status e "em andamento", com salvamento automático.
- **Backup:** exportar/importar `.json`, copiar JSON e apagar a lista.
- **Desfazer** ao mover, excluir ou adicionar um item.
- **Itens de exemplo** na primeira visita, com o botão "Começar do zero".
- Layout responsivo, atalhos `Ctrl K` (busca) e `N` (novo item).

## Rodando localmente

Requisitos: **Node.js 20+** e npm.

```bash
cd Entretempo
npm install
npm run dev
```

- App: <http://localhost:5173>
- API local: <http://localhost:8787>

O `npm run dev` sobe o Vite e o Express ao mesmo tempo. O Vite faz proxy de `/api` para a API local.

### Outros comandos

```bash
npm run build      # type-check + build de produção em dist/
npm run start      # sobe a API e serve o dist/ em http://localhost:8787
npm run preview    # preview do build em http://localhost:4173 (com proxy da API)
```

### Testes de regressão

```bash
npm test            # roda a suíte uma vez (Vitest + Testing Library)
npm run test:watch  # fica observando as mudanças
npm run test:coverage
```

A suíte cobre os pontos que já quebraram ou que são fáceis de quebrar:

- **Tempos**: duração de jogo/filme/série, velocidade e formatação (`src/lib/time.test.ts`).
- **Persistência**: normalização de itens antigos sem `seasonEpisodes`, temporadas inválidas, backup/importação e seeds (`src/lib/storage.test.ts`).
- **Temporadas**: escolher T2, somar T2+T3, voltar para “Todas” e tolerar resposta nula da API (`src/components/TimeFields.test.tsx`).
- **Adicionar série**: busca → detalhes → chips de temporada → payload salvo, incluindo o botão “Tentar de novo” (`src/components/AddItemModal.test.tsx`).
- **Card expandido**: item série salvo sem temporadas se completa sozinho ao abrir (`src/components/ItemCard.test.tsx`).
- **Cache da API**: reaproveitamento, deduplicação de chamadas simultâneas e expiração (`server/http.test.ts`).

### Sem chaves de API

Nada de `.env`: o servidor Express faz as buscas públicas por você.

| Rota | Para que serve |
| --- | --- |
| `GET /api/search?type=game&q=elden` | Busca jogos no HowLongToBeat |
| `GET /api/search?type=movie&q=duna` | Busca filmes no Cinemeta (IMDb) |
| `GET /api/search?type=series&q=ruptura` | Busca séries no Cinemeta (IMDb) |
| `GET /api/details?type=series&id=tt11280740` | Episódios, temporadas e duração |
| `GET /api/image?url=...` | Proxy de capas (HowLongToBeat bloqueia hotlink) |
| `GET /api/health` | Verificação rápida do servidor |

As respostas ficam em cache por alguns minutos no processo do servidor, o que deixa a busca repetida instantânea.

## Como os dados são salvos

Hoje tudo fica no **localStorage** do navegador, na chave `entretempo:v1`:

```json
{
  "version": 1,
  "items": [
    {
      "title": "Elden Ring",
      "type": "game",
      "status": "current",
      "order": 1,
      "inProgress": false,
      "gameTimes": { "main": 3608, "mainExtra": 6086, "completionist": 8174 },
      "gameTimeMode": "mainExtra"
    }
  ]
}
```

Os tempos são sempre em **minutos**; a interface converte para horas e minutos. A capa e os tempos são consultados apenas na criação/edição — depois ficam salvos junto com o item, mesmo sem internet.

> Limpar os dados do site no navegador apaga a lista. Use **Dados → Exportar backup** de vez em quando.

## Estrutura

```text
Entretempo/
├─ src/
│  ├─ App.tsx                 # estado, abas, drag-and-drop, toasts
│  ├─ components/
│  │  ├─ AddItemModal.tsx     # busca de capa → configuração do tempo
│  │  ├─ ItemCard.tsx         # card + editor expandido
│  │  ├─ CoverPicker.tsx      # troca de capa
│  │  ├─ TimeFields.tsx       # campos por tipo (jogo/filme/série)
│  │  └─ DataModal.tsx        # backup, importação e limpeza
│  ├─ lib/
│  │  ├─ storage.ts           # localStorage, seeds, importação
│  │  ├─ api.ts               # cliente da API local
│  │  └─ time.ts              # cálculos e formatação
│  └─ styles.css
├─ server/
│  ├─ index.ts                # Express: busca, detalhes e proxy de imagens
│  ├─ http.ts                 # fetch com timeout e cache em memória
│  └─ providers/
│     ├─ hltb.ts              # HowLongToBeat
│     └─ cinemeta.ts          # Cinemeta (IMDb)
├─ supabase/schema.sql        # tabela items + RLS para a fase na nuvem
└─ public/favicon.svg
```

## Segurança e proteção quando publicar

Ainda **não há login** — o app é local e usa o navegador. Antes de abrir para outras pessoas, o plano é:

1. **Autenticação**
   - Supabase Auth (e-mail/senha ou magic link) e `user_id` em cada linha.
   - RLS já preparada no `supabase/schema.sql`: cada usuário só lê e altera os próprios itens.
   - Sessão no cliente com refresh token; nunca guardar `service_role` no front-end.
2. **Proteção contra abuso e DDoS**
   - Rate limit por IP e por usuário nas rotas de busca e no proxy de imagens.
   - Cache agressivo (as buscas já têm cache; o proxy de imagens ganhou cache em memória e pode ir para CDN).
   - Cloudflare ou Vercel Firewall/WAF na frente do domínio, com desafio para tráfego suspeito.
   - Cloudflare Turnstile no formulário de login/cadastro, se houver bots.
3. **Cabeçalhos e superfície de ataque**
   - CSP, `X-Content-Type-Options`, `Referrer-Policy` e HSTS.
   - Proxy de imagens só para hosts permitidos (HowLongToBeat e Metahub), bloqueando IPs privados — a base disso já existe em `server/index.ts`.
   - Limite de tamanho de upload no backup e validação do JSON importado.
4. **Operação**
   - Chaves e segredos só em variáveis de ambiente.
   - Logs sem dados pessoais e alertas de erro/limite de uso.
   - Backups do banco e teste de restauração.

## Próxima fase: Vercel + Supabase

O app foi desenhado para essa migração, mas **ainda não está publicado**. O caminho sugerido:

1. **Supabase**
   - Crie o projeto e rode `supabase/schema.sql` no SQL Editor.
   - Ative o login (e-mail/senha ou magic link) e preencha `user_id` com `auth.uid()`.
   - Troque o acesso ao localStorage por chamadas ao Supabase no `src/lib/storage.ts`. O mapeamento entre o JSON local e as colunas está no fim do schema.
2. **API de busca**
   - O navegador não pode chamar HowLongToBeat/Cinemeta direto (CORS e bloqueio de hotlink). Na Vercel, leve as rotas de `server/` para `api/` como funções serverless — ou mantenha o proxy em um serviço separado.
3. **Vercel**
   - Importe o repositório, use `npm run build` e publique `dist/`.
   - Enquanto a API não estiver na nuvem, a busca de capas não funciona no domínio publicado; os itens já salvos continuam abrindo.

## Limites conhecidos

- Os provedores (HowLongToBeat e Cinemeta) são não oficiais e podem mudar sem aviso. Se uma busca falhar, o app oferece cadastro manual ou nova tentativa.
- A duração de séries usa a duração média por episódio informada pelo IMDb; para séries com episódios muito irregulares, ajuste o valor manualmente.
- Não há rastreamento de progresso ou tempo assistido — por enquanto, o Entretempo guarda apenas o **tempo total de conclusão**.
- Os dados são por navegador e por dispositivo até a migração para o Supabase.
