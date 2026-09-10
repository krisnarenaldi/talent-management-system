"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import api from "@/lib/api";
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

function formatStageLabel(stage: string) {
  return stage
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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
  const queryClient = useQueryClient();
  const [selectedStage, setSelectedStage] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [result, setResult] = useState("");
  const [salaryCurrent, setSalaryCurrent] = useState("");
  const [salaryExpected, setSalaryExpected] = useState("");
  const [notes, setNotes] = useState("");

  const { data: application, isLoading } = useQuery({
    queryKey: ["application", id],
    queryFn: () => fetchApplication(id),
  });

  const { data: stageHistory = [] } = useQuery({
    queryKey: ["application-stages", id],
    queryFn: () => fetchStageHistory(id),
  });

  useEffect(() => {
    if (!application) return;
    setSelectedStage(application.next_possible_stages?.[0] ?? "");
  }, [application]);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, string | number | null | undefined>) => updateStage(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["application", id] });
      queryClient.invalidateQueries({ queryKey: ["application-stages", id] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      setScheduledDate("");
      setResult("");
      setSalaryCurrent("");
      setSalaryExpected("");
      setNotes("");
    },
  });

  const nextStages = application?.next_possible_stages ?? [];

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
                <span>{format(new Date(application.created_at), "dd MMM yyyy", { locale: idLocale })}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Updated</span>
                <span>{format(new Date(application.updated_at ?? application.created_at), "dd MMM yyyy", { locale: idLocale })}</span>
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
                {stageHistory.map((history) => (
                  <div key={history.id} className="relative rounded-lg border border-gray-200 p-4 pl-8">
                    <div className="absolute left-3 top-5 h-2.5 w-2.5 rounded-full bg-primary-500" />
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <p className="font-medium text-gray-900">{formatStageLabel(history.stage_name)}</p>
                      <span className="text-xs text-gray-500">
                        {format(new Date(history.created_at), "dd MMM yyyy, HH:mm", { locale: idLocale })}
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
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Update Tahapan</h2>

            {nextStages.length === 0 ? (
              <p className="text-sm text-gray-500">Tidak ada tahapan berikutnya yang tersedia.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Tahapan berikutnya</label>
                  <select
                    value={selectedStage}
                    onChange={(e) => setSelectedStage(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                  >
                    {nextStages.map((stage) => (
                      <option key={stage} value={stage}>
                        {formatStageLabel(stage)}
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
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
                    disabled={mutation.isPending}
                    className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
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
