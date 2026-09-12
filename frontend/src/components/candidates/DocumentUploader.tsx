"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import api from "@/lib/api";
import { useToastStore } from "@/stores/toast.store";
import { getErrorMessage } from "@/lib/errors";
import type { CandidateDocument } from "@/types";

async function fetchDocuments(candidateId: string): Promise<CandidateDocument[]> {
  const response = await api.get(`/api/v1/candidates/${candidateId}/documents/`);
  return response.data;
}

export default function DocumentUploader({ candidateId }: { candidateId: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);
  const [docType, setDocType] = useState("CV_asli");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["candidate-documents", candidateId],
    queryFn: () => fetchDocuments(candidateId),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) {
        throw new Error("Pilih file terlebih dahulu");
      }

      const formData = new FormData();
      formData.append("file", selectedFile);

      const uploadResponse = await api.post(
        `/api/v1/candidates/${candidateId}/documents/?doc_type=${encodeURIComponent(docType)}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );

      const uploadedDoc = uploadResponse.data as { file_url?: string } | undefined;
      if (docType === "Foto" && uploadedDoc?.file_url) {
        await api.put(`/api/v1/candidates/${candidateId}`, {
          photo_url: uploadedDoc.file_url,
        });
      }

      return uploadResponse.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate-documents", candidateId] });
      queryClient.invalidateQueries({ queryKey: ["candidate", candidateId] });
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
      showToast(
        "success",
        docType === "Foto" ? "Foto profil berhasil diupload dan disimpan." : "Dokumen berhasil diupload.",
      );
    },
    onError: (error: unknown) => {
      showToast("error", getErrorMessage(error, "Gagal mengupload dokumen."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      await api.delete(`/api/v1/candidates/${candidateId}/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate-documents", candidateId] });
      queryClient.invalidateQueries({ queryKey: ["candidate", candidateId] });
      showToast("success", "Dokumen berhasil dihapus.");
    },
    onError: (error: unknown) => {
      showToast("error", getErrorMessage(error, "Gagal menghapus dokumen."));
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (docId: string) => {
      await api.patch(`/api/v1/candidates/${candidateId}/documents/${docId}/verify`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate-documents", candidateId] });
    },
  });

  const previewUrl = useMemo(() => {
    if (!selectedFile) return null;
    if (selectedFile.type.startsWith("image/")) {
      return URL.createObjectURL(selectedFile);
    }
    return null;
  }, [selectedFile]);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0] || null;
    setSelectedFile(file);
  };

  return (
    <div className="space-y-5">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
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
              <option value="CV_asli">CV Asli</option>
              <option value="Foto">Foto</option>
              <option value="KTP">KTP</option>
              <option value="KK">KK</option>
              <option value="Ijazah">Ijazah</option>
              <option value="Transkrip">Transkrip</option>
              <option value="Sertifikat">Sertifikat</option>
            </select>
          </div>

          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              File
            </label>
            <input
              ref={inputRef}
              type="file"
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
              <div className="space-y-3">
                <img src={previewUrl} alt="Preview upload" className="max-h-52 rounded-lg object-cover" />
                {docType === "Foto" && (
                  <p className="text-xs text-secondary font-medium">
                    ✨ File ini akan otomatis dijadikan foto profil kandidat.
                  </p>                
                )}

                
                <button
                  type="button"
                  disabled={uploadMutation.isPending}
                  onClick={() => uploadMutation.mutate()}
                  className="w-full rounded-lg bg-secondary py-2.5 text-sm font-semibold text-white shadow-md hover:bg-secondary/90 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  {uploadMutation.isPending ? "Sedang Menyimpan..." : "Simpan Sekarang"}
                </button>
              </div>
            ) : selectedFile.type === "application/pdf" ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                  Preview PDF tidak tersedia, file siap diupload.
                </div>
                <button
                  type="button"
                  disabled={uploadMutation.isPending}
                  onClick={() => uploadMutation.mutate()}
                  className="w-full rounded-lg bg-secondary py-2.5 text-sm font-semibold text-white shadow-md hover:bg-secondary/90 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">upload</span>
                  {uploadMutation.isPending ? "Sedang Mengupload..." : "Upload & Simpan"}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Dokumen Terupload</h3>
        {isLoading ? (
          <p className="text-sm text-gray-500">Memuat dokumen...</p>
        ) : documents.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada dokumen untuk kandidat ini.</p>
        ) : (
          documents.map((doc) => (
            <div key={doc.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{doc.doc_type}</p>
                  <p className="text-xs text-gray-500">
                    {doc.uploaded_at ? format(new Date(doc.uploaded_at), "dd MMM yyyy", { locale: idLocale }) : "-"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => verifyMutation.mutate(doc.id)}
                  disabled={verifyMutation.isPending}
                  className={`rounded-full px-2 py-1 text-[10px] font-medium cursor-pointer transition-colors hover:opacity-80 disabled:cursor-not-allowed ${
                    doc.is_verified ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {doc.is_verified ? "✓ Verified" : "Belum diverifikasi"}
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {doc.file_url ? (
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Download
                  </a>
                ) : null}
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
