import { cached, fetchJson, toNumber } from "../http.js";

const BASE = "https://howlongtobeat.com";
const TOKEN_TTL_MS = 8 * 60 * 1000;
const SEARCH_TTL_MS = 15 * 60 * 1000;

type HltbGame = {
  game_id: number;
  game_name: string;
  game_image?: string;
  comp_main?: number;
  comp_plus?: number;
  comp_100?: number;
  release_world?: number;
  profile_platform?: string;
};

type HltbResponse = {
  count: number;
  data?: HltbGame[];
};

export type TitleResult = {
  id: string;
  type: "game";
  title: string;
  year: number | null;
  coverUrl: string;
  thumbUrl: string;
  source: "HowLongToBeat";
  externalUrl: string;
  description?: string;
  platforms?: string[];
  times: {
    main: number | null;
    mainExtra: number | null;
    completionist: number | null;
  };
};

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getToken(force = false): Promise<string> {
  if (!force && tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  const data = await fetchJson<{ token?: string }>(
    `${BASE}/api/search/site/init?t=${Date.now()}`,
    { headers: { referer: `${BASE}/`, origin: BASE } },
    10_000,
  );

  if (!data.token) throw new Error("HowLongToBeat não retornou um token de busca.");

  tokenCache = { token: data.token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return data.token;
}

function normalizeImage(image: string | undefined, width = 400): string {
  if (!image) return "";
  if (image.startsWith("http")) return image;
  const suffix = image.includes("?") ? "&" : "?";
  return `${BASE}/games/${image}${suffix}width=${width}`;
}

function secondsToMinutes(value: unknown): number | null {
  const seconds = toNumber(value);
  if (!seconds || seconds <= 0) return null;
  return Math.round(seconds / 60);
}

function normalizeGame(game: HltbGame): TitleResult {
  return {
    id: String(game.game_id),
    type: "game",
    title: game.game_name,
    year: game.release_world && game.release_world > 0 ? game.release_world : null,
    coverUrl: normalizeImage(game.game_image),
    thumbUrl: normalizeImage(game.game_image, 200),
    source: "HowLongToBeat",
    externalUrl: `${BASE}/game/${game.game_id}`,
    platforms: game.profile_platform
      ? game.profile_platform.split(",").map((platform) => platform.trim()).filter(Boolean).slice(0, 5)
      : [],
    times: {
      main: secondsToMinutes(game.comp_main),
      mainExtra: secondsToMinutes(game.comp_plus),
      completionist: secondsToMinutes(game.comp_100),
    },
  };
}

async function requestSearch(query: string, token: string): Promise<HltbResponse> {
  const body = {
    searchType: "games",
    searchTerms: query.trim().split(/\s+/).filter(Boolean),
    searchPage: 1,
    size: 10,
    searchOptions: {
      games: {
        userId: 0,
        platform: { mode: "include", values: [] },
        sortCategory: "popular",
        rangeCategory: "main",
        rangeTime: { min: 0, max: 0 },
        gameplay: {
          perspective: { mode: "include", values: [] },
          flow: { mode: "include", values: [] },
          genre: { mode: "include", values: [] },
        },
        modifier: "",
      },
      users: { sortCategory: "postcount" },
      lists: { sortCategory: "follows" },
      filter: "",
      sort: 0,
      randomizer: 0,
    },
    useCache: true,
  };

  return fetchJson<HltbResponse>(
    `${BASE}/api/search/site`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-auth-token": token,
        origin: BASE,
        referer: `${BASE}/`,
      },
      body: JSON.stringify(body),
    },
    15_000,
  );
}

export async function searchGames(query: string): Promise<TitleResult[]> {
  const key = `hltb:${query.toLowerCase()}`;

  return cached(key, SEARCH_TTL_MS, async () => {
    let token = await getToken();
    let response: HltbResponse;

    try {
      response = await requestSearch(query, token);
    } catch (error) {
      // O token expira sem aviso. Em caso de falha, renova e tenta uma vez.
      token = await getToken(true);
      response = await requestSearch(query, token);
    }

    return (response.data ?? []).map(normalizeGame).filter((game) => game.title);
  });
}

/** Aquece o token do HowLongToBeat para a primeira busca não pagar esse custo. */
export function warmUpHowLongToBeat(): void {
  void getToken().catch(() => {
    // Se o provedor estiver fora do ar, a busca tenta de novo sob demanda.
  });
}
