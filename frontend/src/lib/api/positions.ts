import api from "@/lib/api";
import type { Position } from "@/types";

export const positionsApi = {
  async listActive(): Promise<Position[]> {
    const res = await api.get("/api/v1/positions", { params: { is_active: true } });
    return res.data as Position[];
  },

  async getById(id: string): Promise<Position> {
    const res = await api.get(`/api/v1/positions/${id}`);
    return res.data as Position;
  },
};