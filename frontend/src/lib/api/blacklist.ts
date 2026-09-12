import api from "../api";
import type { Blacklist } from "@/types";

export interface BlacklistCreatePayload {
  candidate_id?: string;
  employee_id?: string;
  status_type_id: string;
  reason?: string | null;
  notes?: string | null;
  blacklisted_date?: string | null;
  pic_user_id?: string | null;
}

export const blacklistApi = {
  list: async (params?: {
    search?: string;
    status_type_id?: string;
    approval_status?: "pending" | "approved" | "all";
  }): Promise<Blacklist[]> => {
    const response = await api.get("/api/v1/blacklist", { params });
    return response.data as Blacklist[];
  },

  create: async (payload: BlacklistCreatePayload): Promise<Blacklist> => {
    const response = await api.post("/api/v1/blacklist", payload);
    return response.data as Blacklist;
  },

  approve: async (id: string): Promise<Blacklist> => {
    const response = await api.patch(`/api/v1/blacklist/${id}/approve`);
    return response.data as Blacklist;
  },

  revoke: async (id: string): Promise<Blacklist> => {
    const response = await api.patch(`/api/v1/blacklist/${id}/revoke`);
    return response.data as Blacklist;
  },

  check: async (email?: string, phone?: string, identity_no?: string) => {
    const response = await api.get("/api/v1/blacklist/check", { params: { email, phone, identity_no } });
    return response.data as { matched: boolean; candidates: unknown[] };
  },
};
