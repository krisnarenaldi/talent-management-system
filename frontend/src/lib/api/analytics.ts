/**
 * API layer for analytics / dashboard endpoints.
 */
import api from "@/lib/api";
import type { 
  AnalyticsSummary, 
  RecentApplication, 
  ContractExpiring,
  PipelineAnalyticsItem,
  PositionSuccessRate,
  SourceSuccessRate,
  RecruiterWorkload
} from "@/types";

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

export async function fetchPipelineBreakdown(
  params?: { 
    position_id?: string; 
    period_start?: string; 
    period_end?: string 
  }
): Promise<PipelineAnalyticsItem[]> {
  const queryParams = new URLSearchParams();
  if (params?.position_id) queryParams.append('position_id', params.position_id);
  if (params?.period_start) queryParams.append('period_start', params.period_start);
  if (params?.period_end) queryParams.append('period_end', params.period_end);
  const queryString = queryParams.toString();
  const url = `/api/v1/analytics/pipeline-breakdown${queryString ? '?' + queryString : ''}`;
  const response = await api.get(url);
  return response.data as PipelineAnalyticsItem[];
}

export async function fetchSuccessRateByPosition(): Promise<PositionSuccessRate[]> {
  const response = await api.get("/api/v1/analytics/success-rate-by-position");
  return response.data as PositionSuccessRate[];
}

export async function fetchSuccessRateBySource(): Promise<SourceSuccessRate[]> {
  const response = await api.get("/api/v1/analytics/success-rate-by-source");
  return response.data as SourceSuccessRate[];
}

export async function fetchPipelineTrend(months = 6): Promise<{ period: string; count: number }[]> {
  const response = await api.get(`/api/v1/analytics/pipeline-trend?months=${months}`);
  return response.data as { period: string; count: number }[];
}

export async function fetchRecruiterWorkload(): Promise<RecruiterWorkload[]> {
  const response = await api.get("/api/v1/analytics/recruiter-workload");
  return response.data as RecruiterWorkload[];
}