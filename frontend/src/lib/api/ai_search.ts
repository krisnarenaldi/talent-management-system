import api from "@/lib/api";
import type { AIUsageStats, NLSearchResponse } from "@/types";

export async function naturalLanguageSearch(query: string): Promise<NLSearchResponse> {
  const response = await api.post("/api/v1/ai/search", { query });
  return response.data as NLSearchResponse;
}

export async function getAIUsage(): Promise<AIUsageStats> {
  const response = await api.get("/api/v1/ai/search/usage");
  return response.data as AIUsageStats;
}
