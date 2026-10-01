"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { useToastStore } from "@/stores/toast.store";
import { getErrorMessage } from "@/lib/errors";
import { useRouter } from "next/navigation";
import type { Application, StageHistory, User } from "@/types";
import { FileText, AlertTriangle } from "lucide-react";
import { useModalEscape } from "@/hooks/useModalEscape";

const FAIL_RESULTS = new Set(["fail", "tidak_lolos"]);

async function fetchApplication(id: string) {
  const response = await api.get(`/api/v1/applications/${id}`);
  return response.data as Application & { next_possible_stages?: string[]; stage_history?: StageHistory[]; last_result?: string | null };
}

async function fetchStageHistory(id: string) {
  const response = await api.get(`/api/v1/applications/${id}/stages/`);
  return response.data as StageHistory[];
}

async function updateStage(id: string, payload: Record<string, any>) {
  const response = await api.patch(`/api/v1/applications/${id}/stages`, payload);
  return response.data;
}

async function assignRecruiter(id: string, recruiter_id: string) {
  const response = await api.patch(`/api/v1/applications/${id}/assign-recruiter`, { recruiter_id });
  return response.data;
}

async function fetchHRUsers() {
  const response = await api.get(`/api/v1/users/recruiters`);
  return response.data as User[];
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

function aiScoreBadgeClass(score: number | null | undefined) {
  if (score === null || score === undefined) return "bg-slate-100 text-slate-600";
  if (score >= 80) return "bg-emerald-100 text-emerald-800";
  if (score >= 60) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
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
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignRecruiterInput, setAssignRecruiterInput] = useState("");
  // Confirmation modal for irreversible reject action
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [pendingRejectPayload, setPendingRejectPayload] = useState<Record<string, any> | null>(null);

  const { data: application, isLoading } = useQuery({
    queryKey: ["application", trimmedId],
    queryFn: () => fetchApplication(trimmedId),
  });

  const { data: stageHistory = [] } = useQuery({
    queryKey: ["application-stages", trimmedId],
    queryFn: () => fetchStageHistory(trimmedId),
  });

  // Hanya load HR/Manager user list saat modal terbuka
  const { data: hrUsers = [] } = useQuery({
    queryKey: ["hr-users"],
    queryFn: fetchHRUsers,
    enabled: showAssignModal,
  });

  useEffect(() => {
    if (!application) return;
    setSelectedStage(application.current_stage ?? application.next_possible_stages?.[0] ?? "");
  }, [application]);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, any>) => updateStage(trimmedId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["application", trimmedId] });
      queryClient.invalidateQueries({ queryKey: ["application-stages", trimmedId] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      setScheduledDate("");
      setResult("");
      setSalaryCurrent("");
      setSalaryExpected("");
      setNotes("");
      
      // If stage was updated to "Existing", show toast and redirect to employee detail
      if (variables.stage_name === "Existing") {
        setTimeout(() => {
          const showToast = useToastStore.getState().showToast;
          showToast("success", "Karyawan berhasil dibuat, silahkan lengkapi data berikut");
          router.push("/employees");
        }, 1000);
      }
    },
    onError: () => {},
  });

  // Separate mutation for the second step of reject flow (stage_name: "Rejected")
  const rejectMutation = useMutation({
    mutationFn: (payload: Record<string, any>) => updateStage(trimmedId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["application", trimmedId] });
      queryClient.invalidateQueries({ queryKey: ["application-stages", trimmedId] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      useToastStore.getState().showToast("success", "Lamaran telah ditutup sebagai Rejected");
    },
  });

  const assignMutation = useMutation({
    mutationFn: (recruiter_id: string) => assignRecruiter(trimmedId, recruiter_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["application", trimmedId] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      setShowAssignModal(false);
      setAssignRecruiterInput("");
      useToastStore.getState().showToast("success", "Recruiter berhasil diganti");
    },
  });

  const nextStages = application?.next_possible_stages ?? [];
  const currentStage = application?.current_stage ?? "";
  const stageList = currentStage ? [currentStage, ...nextStages] : nextStages;
  const baseStageOptions: string[] = Array.from(new Set(stageList)).filter(
    (stage) => stage !== ""
  );

  // Semua HR/Manager/Admin dapat mengedit — tidak ada lagi ownership lock
  const canEdit = currentUser?.role === "hr" || currentUser?.role === "manager" || currentUser?.role === "admin";
  // Hanya manager/admin yang bisa assign recruiter
  const canAssignRecruiter = currentUser?.role === "manager" || currentUser?.role === "admin";

  // Cek apakah current stage sudah punya hasil FAIL → tampilkan banner + tombol reject langsung
  const lastResult = application?.last_result ?? null;
  const isStageFailed = lastResult !== null && FAIL_RESULTS.has(lastResult);
  // Application sudah ditutup (rejected/withdrawn) — form tidak relevan lagi
  const isApplicationClosed = application?.status === "rejected" || application?.status === "withdrawn";

  const buildPayload = (): Record<string, any> => {
    const payload: Record<string, any> = {
      stage_name: selectedStage,
      scheduled_date: scheduledDate || null,
      result: result || null,
      notes: notes || null,
    };
    if (selectedStage === "Interview_HR" || selectedStage === "Offering") {
      payload.salary_current_input = salaryCurrent ? Number(salaryCurrent) : null;
      payload.salary_expected_input = salaryExpected ? Number(salaryExpected) : null;
    }
    // Jika kandidat blacklist, selalu sertakan flag override — lamaran sudah dibuat dengan persetujuan HR
    if (application?.is_blacklisted) {
      payload.force_blacklisted = true;
    }
    return payload;
  };

  const handleSubmit = () => {
    if (!selectedStage) return;

    // Jika hasil adalah fail/tidak_lolos → tampilkan konfirmasi reject
    if (result && FAIL_RESULTS.has(result)) {
      const payload = buildPayload();
      setPendingRejectPayload(payload);
      setShowRejectConfirm(true);
      return;
    }

    mutation.mutate(buildPayload());
  };

  const handleConfirmReject = async () => {
    if (!pendingRejectPayload) return;
    setShowRejectConfirm(false);

    const isDirectReject = pendingRejectPayload.stage_name === "Rejected";

    if (isDirectReject) {
      // Kasus: stage sudah FAIL dari sebelumnya, langsung reject
      rejectMutation.mutate({ stage_name: "Rejected", notes: pendingRejectPayload.notes ?? null });
    } else {
      // Kasus: user baru saja memilih result=fail → simpan dulu, lalu reject
      try {
        await updateStage(trimmedId, pendingRejectPayload);
        rejectMutation.mutate({ stage_name: "Rejected", notes: null });
      } catch {
        queryClient.invalidateQueries({ queryKey: ["application", trimmedId] });
      }
    }
    setPendingRejectPayload(null);
  };

  const handleDirectReject = () => {
    setPendingRejectPayload({
      stage_name: "Rejected",
      result: null,
      notes: notes || null,
    });
    setShowRejectConfirm(true);
  };

  // Close modals with Esc key
  useModalEscape(() => { setShowAssignModal(false); setAssignRecruiterInput(""); }, showAssignModal && !assignMutation.isPending);
  useModalEscape(() => { setShowRejectConfirm(false); setPendingRejectPayload(null); }, showRejectConfirm && !rejectMutation.isPending);

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
        <div className="flex items-center gap-2">
          <Link
            href={`/applications/${trimmedId}/cv`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
          >
            <FileText className="h-4 w-4" />
            CV Standar
          </Link>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(application.status)}`}>
            {application.status}
          </span>
        </div>
      </div>

      {/* ── Blacklist Warning Banner ─────────────────────────────────────── */}
      {application.is_blacklisted && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Kandidat Dalam Blacklist</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Kandidat ini terdaftar dalam daftar blacklist. Setiap perubahan tahapan memerlukan konfirmasi eksplisit.
            </p>
          </div>
        </div>
      )}

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
                <p className="text-xs uppercase tracking-wide text-gray-500">Dipegang oleh (Recruiter)</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{application.recruiter_name || "-"}</p>
                  {canAssignRecruiter && (
                    <button
                      type="button"
                      onClick={() => {
                        setAssignRecruiterInput(application.recruiter_id ?? "");
                        setShowAssignModal(true);
                      }}
                      className="rounded-md border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                    >
                      Ganti
                    </button>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Tahap saat ini</p>
                <p className="mt-1 text-sm font-medium text-gray-900">{formatStageLabel(application.current_stage)}</p>
              </div>
            </div>
          </div>

          {/* ── AI Screening Panel ─────────────────────────────────── */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-primary text-lg">smart_toy</span>
              <h2 className="text-lg font-semibold text-gray-900">Hasil AI Screening</h2>
            </div>
            {application.ai_screening ? (
              <div className="space-y-4">
                {/* Score */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 w-20">AI Score</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${aiScoreBadgeClass(application.ai_screening.score ?? application.ai_score)}`}>
                    {application.ai_screening.score ?? application.ai_score ?? "-"}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({application.ai_screening.ai_screening_status === "sudah_direview" ? "Terd_review" : application.ai_screening.ai_screening_status === "siap_review" ? "Siap review" : "Menunggu review"})
                  </span>
                </div>
                {/* Notes */}
                {application.ai_screening.notes && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Catatan AI</p>
                    <p className="text-sm text-gray-700 italic bg-gray-50 rounded-lg px-3 py-2">{application.ai_screening.notes}</p>
                  </div>
                )}
                {/* Summary table */}
                {application.ai_screening.extracted_summary && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Ringkasan Match per Dimensi</p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-200">
                          <th className="pb-1.5 pr-4 font-medium">Dimensi</th>
                          <th className="pb-1.5 font-medium">Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(application.ai_screening.extracted_summary)
                          .filter(([k]) => !["_ai_scoring_config", "nama", "name", "email", "telepon", "phone", "kontak", "skills", "pendidikan", "pengalaman_kerja"].includes(k))
                          .slice(0, 8)
                          .map(([key, val]) => (
                            <tr key={key} className="border-b border-gray-100 last:border-0">
                              <td className="py-1.5 pr-4 text-gray-500 capitalize">{key.replace(/_/g, " ")}</td>
                              <td className="py-1.5 text-gray-800 font-medium">
                                {typeof val === "number" ? `${val}/100` : String(val)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {/* Link to review */}
                {!application.ai_screening.ai_screening_status || application.ai_screening.ai_screening_status === "siap_review" ? (
                  <Link
                    href={`/applications/pending-review/${application.id}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
                  >
                    <span className="material-symbols-outlined text-sm">rate_review</span>
                    Review Hasil AI
                  </Link>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <span className="material-symbols-outlined text-gray-300 text-4xl mb-2">smart_toy</span>
                <p className="text-sm text-gray-400">Belum ada hasil screening AI</p>
                <p className="text-xs text-gray-400 mt-1">CV akan diproses secara otomatis setelah upload</p>
              </div>
            )}
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
                      <div className="flex items-center gap-2">
                        {history.handler_name && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                            <span className="material-symbols-outlined text-[11px]">person</span>
                            {history.handler_name}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {formatSafeDate(history.created_at, "dd MMM yyyy, HH:mm")}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                      {history.result && <span className="rounded-full bg-gray-100 px-2 py-1">Result: {history.result}</span>}
                      {history.scheduled_date && <span className="rounded-full bg-gray-100 px-2 py-1">Jadwal: {history.scheduled_date}</span>}
                      {history.notes && <span className="rounded-full bg-gray-100 px-2 py-1">Catatan: {history.notes}</span>}
                      {history.salary_current_input != null && (
                        <span className="rounded-full bg-gray-100 px-2 py-1">
                          Gaji saat ini: Rp {Number(history.salary_current_input).toLocaleString("id-ID")}
                        </span>
                      )}
                      {history.salary_expected_input != null && (
                        <span className="rounded-full bg-gray-100 px-2 py-1">
                          Gaji diharapkan: Rp {Number(history.salary_expected_input).toLocaleString("id-ID")}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Update Tahapan</h2>
            </div>

            {isApplicationClosed ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-600">
                <p className="font-medium text-gray-800">
                  Lamaran sudah ditutup dengan status{" "}
                  <span className={`font-semibold ${application.status === "rejected" ? "text-red-600" : "text-gray-700"}`}>
                    {application.status === "rejected" ? "Rejected" : "Withdrawn"}
                  </span>.
                </p>
                <p className="mt-1 text-gray-500">Tidak ada tindakan lebih lanjut yang dapat dilakukan.</p>
              </div>
            ) : baseStageOptions.length === 0 ? (
              <p className="text-sm text-gray-500">Tidak ada tahapan berikutnya yang tersedia.</p>
            ) : (
              <div className="space-y-4">
                {/* Banner: stage sudah FAIL — tampilkan tombol reject langsung */}
                {isStageFailed && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <p className="font-medium">
                      Tahap <span className="font-semibold">{formatStageLabel(currentStage)}</span> sudah ditandai{" "}
                      <span className="font-semibold uppercase">{lastResult}</span>.
                    </p>
                    <p className="mt-1 text-red-600 mb-3">
                      Kandidat tidak lolos. Klik tombol di bawah untuk menutup lamaran ini sebagai <span className="font-semibold">Rejected</span>.
                    </p>
                    <button
                      type="button"
                      onClick={handleDirectReject}
                      disabled={!canEdit || mutation.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                    >
                      Reject Lamaran Ini
                    </button>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Tahapan yang akan disimpan
                  </label>
                  <select
                    value={selectedStage}
                    onChange={(e) => setSelectedStage(e.target.value)}
                    disabled={!canEdit || isStageFailed}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    {baseStageOptions.map((stage) => (
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
                      disabled={isStageFailed}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                      disabled={isStageFailed}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                        disabled={isStageFailed}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Gaji yang diharapkan</label>
                      <input
                        type="number"
                        value={salaryExpected}
                        onChange={(e) => setSalaryExpected(e.target.value)}
                        disabled={isStageFailed}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                    disabled={!canEdit || isStageFailed}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Tambahkan catatan atau keputusan interview..."
                  />
                </div>

                {mutation.isError && (
                  <p className="text-sm text-red-600">
                    {getErrorMessage(mutation.error, "Gagal memperbarui tahapan.")}
                  </p>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={mutation.isPending || !canEdit || isStageFailed}
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

      {/* ── Modal Ganti Recruiter ─────────────────────────────────────────── */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-base font-semibold text-gray-900">Ganti Recruiter Pemegang Lamaran</h3>
            <p className="mb-4 text-sm text-gray-500">
              Pilih HR/Manager yang akan menangani lamaran ini. Recruiter lama masih tercatat di riwayat tahapan.
            </p>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">Recruiter baru</label>
              <select
                value={assignRecruiterInput}
                onChange={(e) => setAssignRecruiterInput(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
              >
                <option value="">-- Pilih recruiter --</option>
                {hrUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            {assignMutation.isError && (
              <p className="mb-3 text-sm text-red-600">
                {getErrorMessage(assignMutation.error, "Gagal mengganti recruiter.")}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowAssignModal(false); setAssignRecruiterInput(""); }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!assignRecruiterInput || assignMutation.isPending}
                onClick={() => assignMutation.mutate(assignRecruiterInput)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {assignMutation.isPending ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Konfirmasi Reject ──────────────────────────────────────────── */}
      {showRejectConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-base font-semibold text-gray-900">Konfirmasi: Reject Lamaran</h3>
            <p className="mb-1 text-sm text-gray-700">
              Tindakan ini akan mengubah status lamaran menjadi <span className="font-semibold text-red-600">Rejected</span> secara permanen.
            </p>
            <p className="mb-5 text-sm text-red-600 font-medium">Proses ini tidak dapat dibatalkan.</p>
            {rejectMutation.isError && (
              <p className="mb-3 text-sm text-red-600">
                {getErrorMessage(rejectMutation.error, "Gagal menutup lamaran.")}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowRejectConfirm(false); setPendingRejectPayload(null); }}
                disabled={rejectMutation.isPending}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={rejectMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                {rejectMutation.isPending ? "Memproses..." : "Ya, Reject Lamaran"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
