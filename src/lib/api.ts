import type { MediaType, SearchResult, TitleDetails } from "../types";

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, { signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("Não foi possível falar com o servidor local. Ele está rodando?");
  }

  const data = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok) {
    throw new ApiError(data?.error || "A busca não respondeu agora. Tente novamente.");
  }

  return data as T;
}

export async function searchTitles(
  type: MediaType,
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ type, q: query });
  const data = await request<{ results: SearchResult[] }>(`/api/search?${params}`, signal);
  return data.results;
}

export async function getTitleDetails(
  type: "movie" | "series",
  id: string,
  signal?: AbortSignal,
): Promise<TitleDetails> {
  const params = new URLSearchParams({ type, id });
  const data = await request<{ details: TitleDetails }>(`/api/details?${params}`, signal);
  return data.details;
}
