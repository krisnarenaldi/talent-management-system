/**
 * API layer for analytics / dashboard endpoints.
 */
import api from "@/lib/api";
import type { AnalyticsSummary, RecentApplication, ContractExpiring } from "@/types";

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  const response = await api.get("/api/v1/analytics/summary");
  return response.data as AnalyticsSummary;
}

export async function fetchRecentApplications(limit = 5): Promise<RecentApplication[]> {
  const response = await api.get(`/api/v1/analytics/recent-applications?limit=${limit}`);
  return response.data as RecentApplication[];
}

export async function fetchContractsExpiring(limit = 5): Promise<ContractExpiring[]> {
  const response = await api.get(`/api/v1/analytics/contracts-expiring?limit=${limit}`);
  return response.data as ContractExpiring[];
}
