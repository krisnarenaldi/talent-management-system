"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { settingsApi } from "@/lib/api/settings";
import { useToastStore } from "@/stores/toast.store";
import { getErrorMessage } from "@/lib/errors";
import type { BulkUploadResult, FileUploadStatus, SourceChannel } from "@/types";

const MAX_FILES = 20;
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
const ACCEPTED_EXT = ".pdf,.docx";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: FileUploadStatus["status"] }) {
  if (status === "done")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
        ✅ Berhasil diekstrak
      </span>
    );
  if (status === "uploading")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
        ⏳ Sedang diupload
      </span>
    );
  if (status === "error")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
        ❌ Gagal dibaca
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
      — Menunggu
    </span>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function BulkCVUploadPage() {
  const showToast = useToastStore((s) => s.showToast);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileStatuses, setFileStatuses] = useState<FileUploadStatus[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(null);
  const [hasUploaded, setHasUploaded] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Source channels
  const { data: sourceChannels = [] } = useQuery<SourceChannel[]>({
    queryKey: ["source-channels-active"],
    queryFn: () => settingsApi.listSourceChannels({ is_active: true }),
  });

  // ── file management ────────────────────────────────────────────────────────

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const valid = arr.filter((f) => {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        showToast("error", `File "${f.name}" bukan PDF atau DOCX.`);
        return false;
      }
      if (f.size > MAX_SIZE_BYTES) {
        showToast("error", `File "${f.name}" melebihi batas 5 MB.`);
        return false;
      }
      return true;
    });

    setFileStatuses((prev) => {
      const existing = new Set(prev.map((s) => s.file.name));
      const fresh = valid.filter((f) => !existing.has(f.name));
      const combined = [...prev, ...fresh.map<FileUploadStatus>((file) => ({ file, status: "pending" }))];
      if (combined.length > MAX_FILES) {
        showToast("warning", `Maksimal ${MAX_FILES} file. File ke-${MAX_FILES + 1} dst diabaikan.`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
  }, [showToast]);

  const removeFile = (index: number) => {
    setFileStatuses((prev) => prev.filter((_, i) => i !== index));
  };

  // ── drag & drop handlers ───────────────────────────────────────────────────

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => setDragActive(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  };

  // ── upload mutation ────────────────────────────────────────────────────────

  const uploadMutation = useMutation<BulkUploadResult, unknown, void>({
    mutationFn: async () => {
      const formData = new FormData();
      fileStatuses.forEach(({ file }) => formData.append("files", file));
      if (selectedChannel) formData.append("source_channel", selectedChannel);

      // Mark all as uploading
      setFileStatuses((prev) => prev.map((s) => ({ ...s, status: "uploading" as const })));

      const response = await api.post("/api/v1/candidates/bulk-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const percent = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(percent);
        },
      });
      return response.data as BulkUploadResult;
    },
    onSuccess: (data) => {
      setUploadResult(data);
      setHasUploaded(true);
      setUploadProgress(0);
      // Mark all as done (API is async — actual per-file status comes from screening IDs)
      setFileStatuses((prev) => prev.map((s) => ({ ...s, status: "done" as const })));
      showToast("success", data.message || "CV berhasil diupload dan sedang diproses.");
    },
    onError: (error) => {
      setUploadProgress(0);
      // Mark all as error on general failure
      setFileStatuses((prev) => prev.map((s) => ({
        ...s,
        status: "error" as const,
        errorMessage: getErrorMessage(error, "Upload gagal."),
      })));
      showToast("error", getErrorMessage(error, "Gagal mengupload CV."));
    },
  });

  const canUpload = fileStatuses.length > 0 && !uploadMutation.isPending;

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upload CV Kandidat</h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload satu atau beberapa CV sekaligus. AI akan mengekstrak data kandidat secara otomatis.
          </p>
        </div>
        <Link
          href="/candidates/manual/new"
          className="shrink-0 text-sm font-medium text-primary hover:underline"
        >
          Input Manual →
        </Link>
      </div>

      {/* ── Dropzone card ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">File CV (PDF / DOCX)</h2>

        <div
          role="button"
          tabIndex={0}
          aria-label="Area drag-and-drop untuk upload CV"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 transition-colors ${
            dragActive
              ? "border-primary bg-primary/5"
              : "border-gray-300 bg-gray-50 hover:border-primary/80 hover:bg-primary/5"
          }`}
        >
          <span className="material-symbols-outlined text-4xl text-gray-400">upload_file</span>
          <p className="text-sm font-medium text-gray-700">
            Seret file ke sini, atau <span className="text-primary">pilih file</span>
          </p>
          <p className="text-xs text-gray-400">
            PDF / DOCX · Maks. {MAX_FILES} file · Maks. 5 MB per file
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXT}
            className="hidden"
            onChange={handleFileInput}
          />
        </div>

        {/* ── File list ── */}
        {fileStatuses.length > 0 && (
          <ul className="mt-4 space-y-2">
            {fileStatuses.map((item, idx) => (
              <li
                key={`${item.file.name}-${idx}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">{item.file.name}</p>
                  <p className="text-xs text-gray-400">{formatBytes(item.file.size)}</p>
                  {item.errorMessage && (
                    <p className="mt-0.5 text-xs text-red-600">{item.errorMessage}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge status={item.status} />
                  {item.status === "error" && (
                    <Link
                      href="/candidates/manual/new"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Input Manual
                    </Link>
                  )}
                  {item.status === "pending" && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                      className="text-xs text-red-500 hover:text-red-700"
                      aria-label={`Hapus ${item.file.name}`}
                    >
                      Hapus
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* ── Upload progress bar ── */}
        {uploadMutation.isPending && uploadProgress > 0 && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
              <span>Mengupload...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-200">
              <div
                className="h-1.5 rounded-full bg-primary transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Post-upload informational message ── */}
        {hasUploaded && !uploadMutation.isPending && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-blue-600 mt-0.5 text-xl">check_circle</span>
              <div className="space-y-1">
                <p className="font-semibold text-blue-950">File berhasil diupload dan sedang diproses!</p>
                <p className="text-blue-800">
                  AI sedang mengekstrak data teks dan identitas kandidat di latar belakang.
                  Kandidat yang berhasil diekstrak akan otomatis muncul di{" "}
                  <Link href="/candidates" className="font-semibold underline hover:text-blue-950">
                    Database Kandidat
                  </Link>
                  . Anda juga akan menerima notifikasi lonceng ketika seluruh file selesai diproses.
                </p>
                <p className="text-xs text-blue-700 pt-1">
                  Jika terdapat CV yang format teksnya tidak terbaca / gagal diproses, Anda dapat melihatnya di{" "}
                  <Link href="/candidates/pending-review" className="font-medium underline hover:text-blue-900">
                    Pending Review Kandidat
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Channel Asal ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <label htmlFor="source-channel" className="mb-1.5 block text-sm font-semibold text-gray-700">
          Channel Asal <span className="font-normal text-gray-400">(opsional)</span>
        </label>
        <select
          id="source-channel"
          value={selectedChannel}
          onChange={(e) => setSelectedChannel(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        >
          <option value="">— Pilih channel asal —</option>
          {sourceChannels.map((ch) => (
            <option key={ch.id} value={ch.label}>
              {ch.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Action button ── */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/candidates/manual/new"
          className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
        >
          Lewati — input manual
        </Link>
        {hasUploaded ? (
          <button
            type="button"
            onClick={() => {
              setFileStatuses([]);
              setUploadResult(null);
              setHasUploaded(false);
              setUploadProgress(0);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            Upload File Lainnya
          </button>
        ) : (
          <button
            type="button"
            disabled={!canUpload}
            onClick={() => uploadMutation.mutate()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
          >
            {uploadMutation.isPending ? (
              <>
                <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                Mengupload...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">cloud_upload</span>
                Upload &amp; Ekstrak CV
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
