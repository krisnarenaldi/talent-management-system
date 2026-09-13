"use client";

import { useCallback } from "react";
import api from "@/lib/api";

export function useExport() {
  const exportCandidates = useCallback(
    async (params?: Record<string, string | undefined>) => {
      const response = await api.get("/api/v1/export/candidates", {
        params,
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const filename = response.headers["content-disposition"]?.split("filename=")[1] || 
        `candidates_export_${new Date().toISOString().split("T")[0]}.xlsx`;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
    []
  );

  const exportPipeline = useCallback(
    async (params?: Record<string, string | undefined>) => {
      const response = await api.get("/api/v1/export/pipeline", {
        params,
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const filename = response.headers["content-disposition"]?.split("filename=")[1] || 
        `pipeline_export_${new Date().toISOString().split("T")[0]}.xlsx`;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
    []
  );

  const exportIncomplete = useCallback(
    async (params?: Record<string, string | undefined>) => {
      const response = await api.get("/api/v1/export/incomplete", {
        params,
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const filename = response.headers["content-disposition"]?.split("filename=")[1] || 
        `incomplete_candidates_export_${new Date().toISOString().split("T")[0]}.xlsx`;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
    []
  );

  return {
    exportCandidates,
    exportPipeline,
    exportIncomplete,
  };
}