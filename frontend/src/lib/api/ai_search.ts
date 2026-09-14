import api from "@/lib/api";
import type { NLSearchResponse } from "@/types";

export async function naturalLanguageSearch(query: string): Promise<NLSearchResponse> {
  const response = await api.post("/api/v1/ai/search", { query });
  return response.data as NLSearchResponse;
}
