"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { useToastStore } from "@/stores/toast.store";
import { useRouter } from "next/navigation";
import type { Application, StageHistory } from "@/types";

async function fetchApplication(id: string) {
  const response = await api.get(`/api/v1/applications/${id}`);
  return response.data as Application & { next_possible_stages?: string[]; stage_history?: StageHistory[] };
}

async function fetchStageHistory(id: string) {
  const response = await api.get(`/api/v1/applications/${id}/stages/`);
  return response.data as StageHistory[];
}

async function updateStage(id: string, payload: Record<string, string | number | null | undefined>) {
  const response = await api.patch(`/api/v1/applications/${id}/stages/`, payload);
  return response.data;
}

function formatStageLabel(stage: string | null | undefined) {
  const normalizedStage = stage ?? "";
  return normalizedStage
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "-";
}

function formatSafeDate(dateValue: string | null | undefined, pattern: string) {
  if (!dateValue) return "-";

  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) return "-";

  return format(parsedDate, pattern, { locale: idLocale });
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-700";
    case "rejected":
      return "bg-red-100 text-red-700";
    case "hired":
      return "bg-blue-100 text-blue-700";
    case "withdrawn":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const trimmedId = id.trim();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const router = useRouter();
  const [selectedStage, setSelectedStage] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [result, setResult] = useState("");
  const [salaryCurrent, setSalaryCurrent] = useState("");
  const [salaryExpected, setSalaryExpected] = useState("");
  const [notes, setNotes] = useState("");

  const { data: application, isLoading } = useQuery({
    queryKey: ["application", trimmedId],
    queryFn: () => fetchApplication(trimmedId),
  });

  const { data: stageHistory = [] } = useQuery({
    queryKey: ["application-stages", trimmedId],
    queryFn: () => fetchStageHistory(trimmedId),
  });

  useEffect(() => {
    if (!application) return;
    setSelectedStage(application.current_stage ?? application.next_possible_stages?.[0] ?? "");
  }, [application]);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, string | number | null | undefined>) => updateStage(trimmedId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["application", trimmedId] });
      queryClient.invalidateQueries({ queryKey: ["application-stages", trimmedId] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      setScheduledDate("");
      setResult("");
      setSalaryCurrent("");
      setSalaryExpected("");
      setNotes("");
      
      // If stage was updated to "Existing", show toast and redirect to employee detail
      if (selectedStage === "Existing") {
        // Give backend a moment to create the employee, then show toast and redirect
        setTimeout(() => {
          const showToast = useToastStore.getState().showToast;
          showToast("success", "Karyawan berhasil dibuat, silahkan lengkapi data berikut");
          // Redirect to employees list - in a more advanced implementation, 
          // we would redirect to the specific employee detail page
          router.push("/employees");
        }, 1000);
      }
    },
  });

  const nextStages = application?.next_possible_stages ?? [];
  const currentStage = application?.current_stage ?? "";
  const stageList = currentStage ? [currentStage, ...nextStages] : nextStages;
  const allStageOptions: string[] = Array.from(new Set(stageList)).filter(
    (stage) => stage !== ""
  );

  // Check if current user is allowed to edit this application
  const isRecruiter = currentUser?.role === "hr";
  const isOwner = application?.recruiter_id === currentUser?.id;
  const canEdit = !isRecruiter || isOwner;

  const handleSubmit = () => {
    if (!selectedStage) return;

    const payload: Record<string, string | number | null | undefined> = {
      stage_name: selectedStage,
      scheduled_date: scheduledDate || null,
      result: result || null,
      notes: notes || null,
    };

    if (selectedStage === "Interview_HR" || selectedStage === "Offering") {
      payload.salary_current_input = salaryCurrent ? Number(salaryCurrent) : null;
      payload.salary_expected_input = salaryExpected ? Number(salaryExpected) : null;
    }

    mutation.mutate(payload);
  };

  if (isLoading || !application) {
    return <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Memuat detail lamaran...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/applications" className="text-sm font-medium text-primary-600 hover:underline">
            ← Kembali ke pipeline
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Detail Lamaran</h1>
        </div>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(application.status)}`}>
          {application.status}
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.95fr]">
        <aside className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Ringkasan Kandidat</h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Nama kandidat</p>
                <p className="mt-1 text-base font-semibold text-gray-900">{application.candidate_name || application.candidate?.full_name || "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Posisi</p>
                <p className="mt-1 text-sm text-gray-700">{application.position_title || "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Client</p>
                <p className="mt-1 text-sm text-gray-700">{application.client_name || "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Recruiter</p>
                <p className="mt-1 text-sm text-gray-700">{application.recruiter_name || "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Tahap saat ini</p>
                <p className="mt-1 text-sm font-medium text-gray-900">{formatStageLabel(application.current_stage)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Informasi</h2>
            <div className="space-y-3 text-sm text-gray-700">
              <div className="flex items-center justify-between gap-3">
                <span>Created</span>
                <span>{formatSafeDate(application.created_at, "dd MMM yyyy")}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Updated</span>
                <span>{formatSafeDate(application.updated_at ?? application.created_at, "dd MMM yyyy")}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Status</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(application.status)}`}>
                  {application.status}
                </span>
              </div>
            </div>
          </div>
        </aside>

        <main className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Timeline Tahapan</h2>
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                {application.current_stage}
              </span>
            </div>

            {stageHistory.length === 0 ? (
              <p className="text-sm text-gray-500">Belum ada riwayat tahap.</p>
            ) : (
              <div className="space-y-4">
                {stageHistory.map((history, index) => (
                  <div
                    key={history.id ?? `${history.stage_name ?? "stage"}-${history.created_at ?? index}`}
                    className="relative rounded-lg border border-gray-200 p-4 pl-8"
                  >
                    <div className="absolute left-3 top-5 h-2.5 w-2.5 rounded-full bg-primary-500" />
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <p className="font-medium text-gray-900">{formatStageLabel(history.stage_name)}</p>
                      <span className="text-xs text-gray-500">
                        {formatSafeDate(history.created_at, "dd MMM yyyy, HH:mm")}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                      {history.result && <span className="rounded-full bg-gray-100 px-2 py-1">Result: {history.result}</span>}
                      {history.scheduled_date && <span className="rounded-full bg-gray-100 px-2 py-1">Jadwal: {history.scheduled_date}</span>}
                      {history.notes && <span className="rounded-full bg-gray-100 px-2 py-1">Catatan: {history.notes}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Update Tahapan</h2>
              {canEdit ? null : (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                  Hanya recruiter yang ditugaskan yang dapat mengedit
                </span>
              )}
            </div>

            {allStageOptions.length === 0 ? (
              <p className="text-sm text-gray-500">Tidak ada tahapan berikutnya yang tersedia.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Tahapan yang akan disimpan
                  </label>
                  <select
                    value={selectedStage}
                    onChange={(e) => setSelectedStage(e.target.value)}
                    disabled={!canEdit}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    {allStageOptions.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage === currentStage
                          ? `${formatStageLabel(stage)} (Tahap saat ini — update jadwal/catatan)`
                          : formatStageLabel(stage)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Hasil</label>
                    <select
                      value={result}
                      onChange={(e) => setResult(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                    >
                      <option value="">Pilih hasil</option>
                      {selectedStage === "Konfirmasi_Kehadiran" && (
                        <>
                          <option value="ok">OK</option>
                          <option value="reschedule">Reschedule</option>
                        </>
                      )}
                      {selectedStage === "Interview_HR" && (
                        <>
                          <option value="pass">Pass</option>
                          <option value="fail">Fail</option>
                        </>
                      )}
                      {selectedStage === "Psikotest" && (
                        <>
                          <option value="lolos">Lolos</option>
                          <option value="tidak_lolos">Tidak Lolos</option>
                        </>
                      )}
                      {selectedStage === "Offering" && (
                        <>
                          <option value="lolos_kontrak">Lolos Kontrak</option>
                          <option value="negosiasi">Negosiasi</option>
                        </>
                      )}
                      {selectedStage === "Tanda_Tangan_Kontrak" && (
                        <>
                          <option value="signed">Ditandatangani</option>
                          <option value="pending">Pending</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Tanggal jadwal</label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                    />
                  </div>
                </div>

                {(selectedStage === "Interview_HR" || selectedStage === "Offering") && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Gaji saat ini</label>
                      <input
                        type="number"
                        value={salaryCurrent}
                        onChange={(e) => setSalaryCurrent(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Gaji yang diharapkan</label>
                      <input
                        type="number"
                        value={salaryExpected}
                        onChange={(e) => setSalaryExpected(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                        placeholder="0"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Catatan</label>
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={!canEdit}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Tambahkan catatan atau keputusan interview..."
                  />
                </div>

                {mutation.isError && (
                  <p className="text-sm text-red-600">
                    {(mutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Gagal memperbarui tahapan."}
                  </p>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={mutation.isPending || !canEdit}
                    className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {mutation.isPending ? "Menyimpan..." : "Simpan update"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
