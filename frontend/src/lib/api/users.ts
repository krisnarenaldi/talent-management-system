import api from "../api";
import type { User } from "@/types";

export interface UserListResponse {
  data: User[];
  total: number;
}

export interface UserCreatePayload {
  name: string;
  email: string;
  role: "admin" | "hr" | "manager";
  password: string;
}

export interface UserUpdatePayload {
  name?: string;
  email?: string;
  role?: "admin" | "hr" | "manager";
  password?: string;
  is_active?: boolean;
}

export interface ProfileUpdatePayload {
  name?: string;
  password?: string;
}

export interface AuthMeResponse {
  id: string;
  name: string;
  role: string;
  email: string;
}

export const userApi = {
  list: async (params?: {
    search?: string;
    role?: string;
    is_active?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<UserListResponse> => {
    const response = await api.get("/api/v1/users/", { params });
    const data = response.data;
    if (Array.isArray(data)) {
      return { data, total: data.length };
    }
    return data;
  },

  create: async (payload: UserCreatePayload): Promise<User> => {
    const response = await api.post("/api/v1/users/", payload);
    return response.data;
  },

  update: async (id: string, payload: UserUpdatePayload): Promise<User> => {
    const response = await api.put(`/api/v1/users/${id}/`, payload);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/v1/users/${id}/`);
  },
};

export const profileApi = {
  getMe: async (): Promise<AuthMeResponse> => {
    const response = await api.get("/api/v1/auth/me");
    return response.data;
  },

  updateMe: async (payload: ProfileUpdatePayload): Promise<AuthMeResponse> => {
    const response = await api.patch("/api/v1/auth/me", payload);
    return response.data;
  },
};
