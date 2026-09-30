"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import api from "@/lib/api";
import { useToastStore } from "@/stores/toast.store";
import { getErrorMessage } from "@/lib/errors";
import type { CandidateDocument } from "@/types";

// Tipe dokumen yang memungkinkan lebih dari satu per kandidat
const MULTI_ALLOWED_TYPES = new Set(["Ijazah", "Transkrip", "Sertifikat"]);

// Label placeholder per tipe
const LABEL_PLACEHOLDER: Record<string, string> = {
  Ijazah: "mis. S1 Teknik Informatika - Universitas Indonesia",
  Transkrip: "mis. Transkrip S2 Universitas Gadjah Mada",
  Sertifikat: "mis. AWS Solutions Architect 2024, Coursera ML",
};

async function fetchDocuments(candidateId: string): Promise<CandidateDocument[]> {
  const response = await api.get(`/api/v1/candidates/${candidateId}/documents/`);
  return response.data;
}

export default function DocumentUploader({ candidateId }: { candidateId: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);
  const [docType, setDocType] = useState("CV_asli");
  const [label, setLabel] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const showLabelInput = MULTI_ALLOWED_TYPES.has(docType);

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

      // Build query params
      const params = new URLSearchParams({ doc_type: docType });
      if (showLabelInput && label.trim()) {
        params.append("label", label.trim());
      }

      const uploadResponse = await api.post(
        `/api/v1/candidates/${candidateId}/documents/?${params.toString()}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
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
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      setSelectedFile(null);
      setLabel("");
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
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
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

  // Group documents by doc_type for display
  const groupedDocs = documents.reduce<Record<string, CandidateDocument[]>>((acc, doc) => {
    if (!acc[doc.doc_type]) acc[doc.doc_type] = [];
    acc[doc.doc_type].push(doc);
    return acc;
  }, {});

  const docTypeOrder = ["CV_asli", "Foto", "KTP", "KK", "Ijazah", "Transkrip", "Sertifikat"];
  const sortedGroups = Object.keys(groupedDocs).sort((a, b) => {
    const ia = docTypeOrder.indexOf(a);
    const ib = docTypeOrder.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return (
    <div className="space-y-5">
      {/* ── Upload Form ─────────────────────────────────── */}
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
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:flex-wrap">
          {/* Tipe Dokumen */}
          <div className="flex-1 min-w-[160px]">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Tipe Dokumen
            </label>
            <select
              value={docType}
              onChange={(e) => {
                setDocType(e.target.value);
                setLabel("");
              }}
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

          {/* Label — hanya muncul untuk tipe yang bisa lebih dari 1 */}
          {showLabelInput && (
            <div className="flex-[2] min-w-[200px]">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Keterangan <span className="normal-case text-gray-400">(opsional)</span>
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={LABEL_PLACEHOLDER[docType] ?? "Keterangan dokumen..."}
                maxLength={255}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500"
              />
            </div>
          )}

          {/* File */}
          <div className="flex-1 min-w-[160px]">
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
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-secondary/90 disabled:cursor-not-allowed disabled:bg-gray-300 whitespace-nowrap"
          >
            {uploadMutation.isPending ? "Menyimpan..." : "Simpan Dokumen"}
          </button>
        </div>

        {/* Preview area */}
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

      {/* ── Uploaded Documents List (grouped by type) ───── */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Dokumen Terupload</h3>

        {isLoading ? (
          <p className="text-sm text-gray-500">Memuat dokumen...</p>
        ) : documents.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada dokumen untuk kandidat ini.</p>
        ) : (
          sortedGroups.map((type) => {
            const docs = groupedDocs[type];
            const isMulti = docs.length > 1 || MULTI_ALLOWED_TYPES.has(type);

            return (
              <div key={type}>
                {/* Group header — hanya tampil jika ada lebih dari 1 dokumen dalam tipe ini */}
                {isMulti && (
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{type}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                      {docs.length}
                    </span>
                  </div>
                )}

                <div className={`space-y-2 ${isMulti ? "pl-3 border-l-2 border-gray-100" : ""}`}>
                  {docs.map((doc) => (
                    <div key={doc.id} className="rounded-lg border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          {/* Nama dokumen: label jika ada, fallback ke doc_type */}
                          <p className="font-medium text-gray-900">
                            {doc.label ? doc.label : doc.doc_type}
                          </p>
                          {/* Tampilkan doc_type sebagai subtitle kalau ada label */}
                          {doc.label && (
                            <p className="text-xs text-gray-400">{doc.doc_type}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-0.5">
                            {doc.uploaded_at
                              ? format(new Date(doc.uploaded_at), "dd MMM yyyy", { locale: idLocale })
                              : "-"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => verifyMutation.mutate(doc.id)}
                          disabled={verifyMutation.isPending}
                          className={`rounded-full px-2 py-1 text-[10px] font-medium cursor-pointer transition-colors hover:opacity-80 disabled:cursor-not-allowed ${
                            doc.is_verified
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
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
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
