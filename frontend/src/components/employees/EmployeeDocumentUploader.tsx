"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import api from "@/lib/api";
import { useToastStore } from "@/stores/toast.store";
import type { EmployeeDocument } from "@/types";

async function fetchDocuments(employeeId: string): Promise<EmployeeDocument[]> {
  const response = await api.get(`/api/v1/employees/${employeeId}/documents/`);
  return response.data as EmployeeDocument[];
}

export default function EmployeeDocumentUploader({ employeeId }: { employeeId: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);
  const [docType, setDocType] = useState("KTP");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["employee-documents", employeeId],
    queryFn: () => fetchDocuments(employeeId),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("Pilih file terlebih dahulu");
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await api.post(
        `/api/v1/employees/${employeeId}/documents/?doc_type=${encodeURIComponent(docType)}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return response.data as EmployeeDocument;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-documents", employeeId] });
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
      showToast("success", "Dokumen berhasil diupload.");
    },
    onError: (error: unknown) => {
      const msg =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Gagal mengupload dokumen.";
      showToast("error", msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      await api.delete(`/api/v1/employees/${employeeId}/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-documents", employeeId] });
      showToast("success", "Dokumen berhasil dihapus.");
    },
    onError: (error: unknown) => {
      const msg =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Gagal menghapus dokumen.";
      showToast("error", msg);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (docId: string) => {
      await api.patch(`/api/v1/employees/${employeeId}/documents/${docId}/verify`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-documents", employeeId] });
    },
  });

  const previewUrl = useMemo(() => {
    if (!selectedFile) return null;
    if (selectedFile.type.startsWith("image/")) return URL.createObjectURL(selectedFile);
    return null;
  }, [selectedFile]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    setSelectedFile(e.dataTransfer.files?.[0] || null);
  };

  const downloadDocument = async (doc: EmployeeDocument) => {
    try {
      const res = await api.get(
        `/api/v1/employees/${employeeId}/documents/${doc.id}/download-url`,
      );
      const { download_url } = res.data as { download_url: string };
      if (download_url) window.open(download_url, "_blank");
    } catch {
      // Fallback ke file_url langsung
      if (doc.file_url) window.open(doc.file_url, "_blank");
    }
  };

  const DOC_TYPES = [
    "KTP",
    "Ijazah",
    "Transkrip",
    "CV_asli",
    "Foto",
    "Sertifikat",
    "BPJS_TK",
    "BPJS_Kesehatan",
    "NPWP",
  ];

  return (
    <div className="space-y-5">
      {/* Upload area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-4 transition-colors ${
          dragActive ? "border-primary-500 bg-primary-50" : "border-gray-300 bg-gray-50"
        }`}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Tipe Dokumen
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500"
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              File
            </label>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          <button
            type="button"
            disabled={!selectedFile || uploadMutation.isPending}
            onClick={() => uploadMutation.mutate()}
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-secondary/90 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {uploadMutation.isPending ? "Menyimpan..." : "Simpan Dokumen"}
          </button>
        </div>

        {selectedFile && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">{selectedFile.type || "Unknown type"}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="text-xs font-medium text-red-600 hover:text-red-700"
              >
                Hapus file
              </button>
            </div>
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="max-h-48 rounded-lg object-contain" />
            ) : selectedFile.type === "application/pdf" ? (
              <p className="text-sm text-red-700">Preview PDF tidak tersedia — file siap diupload.</p>
            ) : null}
            <button
              type="button"
              disabled={uploadMutation.isPending}
              onClick={() => uploadMutation.mutate()}
              className="mt-3 w-full rounded-lg bg-secondary py-2.5 text-sm font-semibold text-white shadow-md hover:bg-secondary/90 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">upload</span>
              {uploadMutation.isPending ? "Sedang Mengupload..." : "Upload & Simpan"}
            </button>
          </div>
        )}
      </div>

      {/* Document list */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Dokumen Terupload</h3>
        {isLoading ? (
          <p className="text-sm text-gray-500">Memuat dokumen...</p>
        ) : documents.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada dokumen untuk karyawan ini.</p>
        ) : (
          documents.map((doc) => (
            <div key={doc.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{doc.doc_type}</p>
                  <p className="text-xs text-gray-500">
                    {doc.uploaded_at
                      ? format(new Date(doc.uploaded_at), "dd MMM yyyy", { locale: idLocale })
                      : "-"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => verifyMutation.mutate(doc.id)}
                  disabled={verifyMutation.isPending}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors hover:opacity-80 disabled:cursor-not-allowed ${
                    doc.is_verified
                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {doc.is_verified ? "✓ Verified" : "Belum diverifikasi"}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => downloadDocument(doc)}
                  disabled={uploadMutation.isPending}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed"
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(doc.id)}
                  disabled={deleteMutation.isPending}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed"
                >
                  Hapus
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
