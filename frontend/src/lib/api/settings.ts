import api from "@/lib/api";
import type { SourceChannel, SourceChannelCreate, SourceChannelUpdate } from "@/types";

export const settingsApi = {
  async getAIBudget(): Promise<{ budget_usd: number }> {
    const res = await api.get("/api/v1/settings/ai-budget");
    return res.data;
  },

  async updateAIBudget(budget_usd: number): Promise<{ budget_usd: number }> {
    const res = await api.put("/api/v1/settings/ai-budget", { budget_usd });
    return res.data;
  },

  async listSourceChannels(options?: { is_active?: boolean }) {
    const params = new URLSearchParams();
    if (options?.is_active !== undefined) params.append("is_active", String(options.is_active));
    const res = await api.get(`/api/v1/settings/source-channels?${params}`);
    return res.data as SourceChannel[];
  },

  async createSourceChannel(data: SourceChannelCreate) {
    const res = await api.post("/api/v1/settings/source-channels", data);
    return res.data as SourceChannel;
  },

  async updateSourceChannel(id: string, data: SourceChannelUpdate) {
    const res = await api.put(`/api/v1/settings/source-channels/${id}`, data);
    return res.data as SourceChannel;
  },

  async deleteSourceChannel(id: string) {
    await api.delete(`/api/v1/settings/source-channels/${id}`);
  },
};
