"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { FileText, Users, UserMinus } from "lucide-react";
import api from "@/lib/api";
import DocumentUploader from "@/components/candidates/DocumentUploader";
import TalentPoolModal from "@/components/candidates/TalentPoolModal";
import { useAuthStore } from "@/stores/auth.store";
import { useToastStore } from "@/stores/toast.store";
import type {
  Application,
  Candidate,
  CandidateEducation,
  CandidateExperience,
  StageHistory,
} from "@/types";

interface DraftProjectItem {
  id: string;
  project_name: string;
  role: string;
  summary: string;
  impact: string;
  tech_stack: string[];
  duration: string;
  is_draft: boolean;
}

type TabKey = "profil" | "dokumen" | "lamaran" | "catatan";

function normalizeRole(role: string | undefined): string {
  if (!role) return "";
  return role.split(".").pop()?.toLowerCase() || role;
}

async function fetchCandidate(id: string): Promise<Candidate> {
  const response = await api.get(`/api/v1/candidates/${id}`);
  return response.data;
}

async function fetchCandidateEducation(id: string): Promise<CandidateEducation[]> {
  const response = await api.get(`/api/v1/candidates/${id}/education/`);
  return response.data;
}

async function fetchCandidateExperience(id: string): Promise<CandidateExperience[]> {
  const response = await api.get(`/api/v1/candidates/${id}/experience/`);
  return response.data;
}

async function fetchApplications(): Promise<Application[]> {
  const response = await api.get("/api/v1/applications");
  return response.data;
}

async function fetchApplicationDetail(appId: string): Promise<Application> {
  const response = await api.get(`/api/v1/applications/${appId}`);
  return response.data;
}

async function fetchCandidateProjects(id: string): Promise<DraftProjectItem[]> {
  const response = await api.get(`/api/v1/candidates/${id}/projects`);
  return response.data;
}

export default function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<TabKey>("profil");
  const [isTalentPoolModalOpen, setIsTalentPoolModalOpen] = useState(false);
  const [isRemoveTalentPoolOpen, setIsRemoveTalentPoolOpen] = useState(false);
  const [isRemovingTalentPool, setIsRemovingTalentPool] = useState(false);
  const queryClient = useQueryClient();
  const { showToast } = useToastStore();

  const user = useAuthStore((state) => state.user);
  const canMoveTalentPool = user
    ? ["admin", "hr", "manager"].includes(normalizeRole(user.role))
    : false;

  const { data: candidate, isLoading } = useQuery({
    queryKey: ["candidate", id],
    queryFn: () => fetchCandidate(id),
  });

  const { data: educations = [] } = useQuery({
    queryKey: ["candidate-education", id],
    queryFn: () => fetchCandidateEducation(id),
  });

  const { data: experiences = [] } = useQuery({
    queryKey: ["candidate-experience", id],
    queryFn: () => fetchCandidateExperience(id),
  });

  const { data: applications = [] } = useQuery({
    queryKey: ["candidate-applications", id],
    queryFn: async () => {
      const result = await fetchApplications();
      return result.filter((application) => application.candidate_id === id);
    },
  });

  // Fetch detail (with stage_history) for each application — used in Catatan tab
  const { data: applicationDetails = [] } = useQuery({
    queryKey: ["candidate-application-details", id, applications.map((a) => a.id).join(",")],
    queryFn: async () => {
      if (applications.length === 0) return [];
      return Promise.all(applications.map((a) => fetchApplicationDetail(a.id)));
    },
    enabled: applications.length > 0,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["candidate-documents", id],
    queryFn: () => api.get(`/api/v1/candidates/${id}/documents/`).then((r) => r.data),
  });

  // Fetch existing projects on page load
  const { data: savedProjects = [] } = useQuery({
    queryKey: ["candidate-projects", id],
    queryFn: () => fetchCandidateProjects(id),
  });

  const generateDraftMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/api/v1/candidates/${id}/ai/draft-projects`);
      return response.data as DraftProjectItem[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate-projects", id] });
    },
  });

  // PATCH individual project fields (debounce not needed — called on blur / explicit action)
  const updateProjectMutation = useMutation({
    mutationFn: async ({
      projectId,
      payload,
    }: {
      projectId: string;
      payload: Partial<DraftProjectItem>;
    }) => {
      const response = await api.patch(
        `/api/v1/candidates/${id}/projects/${projectId}`,
        payload,
      );
      return response.data as DraftProjectItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate-projects", id] });
    },
  });

  const handleFieldBlur = (
    project: DraftProjectItem,
    field: keyof DraftProjectItem,
    value: DraftProjectItem[keyof DraftProjectItem],
  ) => {
    // Only call API if value actually changed
    if (project[field] === value) return;
    updateProjectMutation.mutate({ projectId: project.id, payload: { [field]: value } });
  };

  const handleApproveToggle = (project: DraftProjectItem) => {
    updateProjectMutation.mutate({
      projectId: project.id,
      payload: { is_draft: !project.is_draft },
    });
  };

  if (isLoading || !candidate) {
    return <div className="p-6 text-gray-500">Memuat detail kandidat...</div>;
  }

  const inTalentPool = Boolean(
    candidate?.pool_status === "talent_pool" ||
      (candidate as any)?.talent_pool === 1 ||
      (candidate as any)?.talent_pool === true ||
      (candidate as any)?.is_talent_pool
  );

  const handleRemoveFromTalentPool = async () => {
    if (!candidate) return;
    setIsRemovingTalentPool(true);
    try {
      await api.patch(`/api/v1/candidates/${id}/talent-pool`, {
        pool_status: "database",
        talent_pool_reason: null,
        talent_pool_notes: null,
      });
      queryClient.invalidateQueries({ queryKey: ["candidate", id] });
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      showToast("success", `${candidate.full_name} berhasil dikeluarkan dari Talent Pool`);
      setIsRemoveTalentPoolOpen(false);
    } catch (error: any) {
      showToast(
        "error",
        error?.response?.data?.detail || "Gagal mengeluarkan kandidat dari Talent Pool"
      );
    } finally {
      setIsRemovingTalentPool(false);
    }
  };

  const tabs: Array<{ key: TabKey; label: string; icon: string; desc: string }> = [
    { key: "profil", label: "Profil", icon: "person", desc: "Data pribadi, pendidikan & pengalaman" },
    { key: "dokumen", label: "Dokumen", icon: "folder", desc: "CV, KTP, Ijazah, dll" },
    { key: "lamaran", label: "Lamaran", icon: "work", desc: "Posisi & tahap seleksi" },
    { key: "catatan", label: "Catatan", icon: "note", desc: "Catatan recruiter" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 font-bold text-lg flex-shrink-0 overflow-hidden">
            {candidate.photo_url ? (
              <img
                src={candidate.photo_url}
                alt={candidate.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              candidate.full_name.slice(0, 2).toUpperCase()
            )}
          </div>
          <div>
            <Link href="/candidates" className="text-sm font-medium text-primary hover:underline">
              ← Kembali ke kandidat
            </Link>
            <div className="mt-2 flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{candidate.full_name}</h1>
              {(candidate.pool_status === "talent_pool" ||
                (candidate as any).talent_pool === 1 ||
                (candidate as any).talent_pool === true ||
                (candidate as any).is_talent_pool) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  <Users className="h-3.5 w-3.5" />
                  Talent Pool
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/candidates/${id}/cv`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100"
          >
            <FileText className="h-4 w-4" />
            CV Standar
          </Link>
          {canMoveTalentPool && (
            inTalentPool ? (
              <button
                type="button"
                onClick={() => setIsRemoveTalentPoolOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 transition-colors"
              >
                <UserMinus className="h-4 w-4" />
                Keluarkan dari Talent Pool
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsTalentPoolModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                <Users className="h-4 w-4" />
                Pindahkan ke Talent Pool
              </button>
            )
          )}
          <Link
            href={`/candidates/${id}/edit`}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Edit kandidat
          </Link>
        </div>
      </div>

      {/* Talent Pool Modal */}
      {candidate && (
        <TalentPoolModal
          candidateId={id}
          candidateName={candidate.full_name}
          isOpen={isTalentPoolModalOpen}
          onClose={() => setIsTalentPoolModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["candidate", id] });
          }}
        />
      )}

      {/* Remove from Talent Pool Modal */}
      {isRemoveTalentPoolOpen && candidate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setIsRemoveTalentPoolOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                <UserMinus className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Keluarkan dari Talent Pool</h2>
                <p className="text-sm text-gray-500">{candidate.full_name}</p>
              </div>
            </div>
            <p className="mb-6 text-sm text-gray-600">
              Apakah Anda yakin ingin mengeluarkan <strong>{candidate.full_name}</strong> dari Talent Pool? Status kandidat akan dikembalikan menjadi Database kandidat biasa.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsRemoveTalentPoolOpen(false)}
                disabled={isRemovingTalentPool}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleRemoveFromTalentPool}
                disabled={isRemovingTalentPool}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {isRemovingTalentPool ? "Mengeluarkan..." : "Keluarkan"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                tab === item.key
                  ? "bg-secondary text-on-secondary shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              title={item.desc}
            >
              <span className="material-symbols-outlined text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "profil" && (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Data Pribadi</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <InfoRow label="Email" value={candidate.email || "-"} />
                <InfoRow label="No. HP" value={candidate.phone || "-"} />
                <InfoRow label="NIK" value={candidate.identity_no || "-"} />
                <InfoRow label="Domisili" value={candidate.domicile || "-"} />
                <InfoRow label="Sumber" value={candidate.source_channel || "-"} />
                <InfoRow label="Notice period" value={candidate.notice_period_days ? `${candidate.notice_period_days} hari` : "-"} />
                <InfoRow label="Current salary" value={candidate.current_salary ? `Rp ${Number(candidate.current_salary).toLocaleString("id-ID")}` : "-"} />
                <InfoRow label="Expected salary" value={candidate.expected_salary ? `Rp ${Number(candidate.expected_salary).toLocaleString("id-ID")}` : "-"} />
              </div>
              {candidate.skills && candidate.skills.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Skill</p>
                  <div className="flex flex-wrap gap-2">
                    {candidate.skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Pendidikan</h2>
              {educations.length === 0 ? (
                <p className="text-sm text-gray-500">Belum ada riwayat pendidikan.</p>
              ) : (
                <div className="space-y-4">
                  {educations.map((education) => (
                    <div key={education.id} className="rounded-lg border border-gray-200 p-4">
                      <p className="font-medium text-gray-900">{education.institution || "-"}</p>
                      <p className="text-sm text-gray-600">{education.major || "-"}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-500">
                        {education.graduation_year && <span>Tahun: {education.graduation_year}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900">Pengalaman Kerja</h2>
                <button
                  type="button"
                  onClick={() => generateDraftMutation.mutate()}
                  disabled={generateDraftMutation.isPending || experiences.length === 0}
                  className="rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-on-secondary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {generateDraftMutation.isPending ? "Membuat draft..." : "Generate Draft Project AI"}
                </button>
              </div>

              {experiences.length === 0 ? (
                <p className="text-sm text-gray-500">Belum ada pengalaman kerja.</p>
              ) : (
                <div className="space-y-4">
                  {experiences.map((exp) => (
                    <div key={exp.id} className="rounded-lg border border-gray-200 p-4">
                      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <p className="font-medium text-gray-900">{exp.job_title || "-"}</p>
                        <p className="text-sm text-gray-500">
                          {exp.start_date ? format(new Date(exp.start_date), "MMM yyyy", { locale: idLocale }) : "-"}
                          {" - "}
                          {exp.end_date ? format(new Date(exp.end_date), "MMM yyyy", { locale: idLocale }) : "Sekarang"}
                        </p>
                      </div>
                      <p className="mt-2 text-sm text-gray-600">{exp.company_name || "-"}</p>
                      <p className="mt-2 whitespace-pre-line text-sm text-gray-600">{exp.description || "-"}</p>
                    </div>
                  ))}
                </div>
              )}

              {savedProjects.length > 0 && (
                <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-gray-900">Draft Project AI</h3>
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                      Review sebelum CV
                    </span>
                  </div>

                  <div className="space-y-4">
                    {savedProjects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onBlur={handleFieldBlur}
                        onApproveToggle={handleApproveToggle}
                        isSaving={updateProjectMutation.isPending}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Status</h2>
              <div className="space-y-3 text-sm text-gray-700">
                <div className="flex items-center justify-between">
                  <span>Kontak</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${candidate.contact_status === "aktif" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {candidate.contact_status === "aktif" ? "Aktif" : "Tidak bisa dihubungi"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Kelengkapan</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${candidate.completeness_status === "lengkap" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                    {candidate.completeness_status === "lengkap" ? "Lengkap" : "Belum lengkap"}
                  </span>
                </div>
                {candidate.completeness_status !== "lengkap" && (
                  <div className="col-span-full mt-1 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-700">
                    <p className="font-medium">Dokumen yang belum lengkap:</p>
                    <ul className="mt-1 list-disc pl-4 space-y-0.5">
                      {(["Foto", "KTP", "Ijazah", "Transkrip", "CV_asli", "Sertifikat"] as const)
                        .filter((type) => !documents.some((d: { doc_type: string }) => d.doc_type === type))
                        .map((type) => (
                          <li key={type}>{type}</li>
                        ))}
                    </ul>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>Duplikat</span>
                  <span>{candidate.possible_duplicate ? "Ya" : "Tidak"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Terakhir update</span>
                  <span>{format(new Date(candidate.updated_at), "dd MMM yyyy", { locale: idLocale })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "dokumen" && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Dokumen Kandidat</h2>
          <DocumentUploader candidateId={id} />
        </div>
      )}

      {tab === "lamaran" && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Lamaran</h2>
          {applications.length === 0 ? (
            <p className="text-sm text-gray-500">Belum ada lamaran untuk kandidat ini.</p>
          ) : (
            <div className="space-y-3">
              {applications.map((application) => (
                <div key={application.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{application.position_title || "-"}</p>
                      <p className="text-sm text-gray-600">{application.client_name || "-"}</p>
                    </div>
                    <div className="text-sm text-gray-500">
                      <span className="font-medium">Tahap:</span> {application.current_stage}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                      {application.status}
                    </span>
                    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                      {application.current_stage}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "catatan" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          {/* Catatan Recruiter — dari form edit kandidat */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-violet-600">edit_note</span>
              <h2 className="text-base font-semibold text-gray-900">Catatan Recruiter</h2>
            </div>
            {candidate.notes ? (
              <p className="whitespace-pre-line text-sm text-gray-700 leading-relaxed">
                {candidate.notes}
              </p>
            ) : (
              <p className="text-sm text-gray-400 italic">Belum ada catatan recruiter.</p>
            )}
            <div className="mt-4 border-t border-gray-100 pt-3">
              <Link
                href={`/candidates/${id}/edit`}
                className="text-xs font-medium text-primary hover:underline"
              >
                Edit catatan →
              </Link>
            </div>
          </div>

          {/* Catatan Tahapan Seleksi — dari stage_history */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-amber-600">history</span>
              <h2 className="text-base font-semibold text-gray-900">Catatan Tahapan Seleksi</h2>
            </div>

            {applicationDetails.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Belum ada lamaran atau catatan tahapan.</p>
            ) : (
              <div className="space-y-5">
                {applicationDetails.map((app) => {
                  const stagesWithNotes = (app.stage_history ?? []).filter(
                    (h: StageHistory) => h.notes && h.notes.trim()
                  );
                  if (stagesWithNotes.length === 0) return null;
                  return (
                    <div key={app.id}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                          {app.position_title || "Posisi tidak diketahui"}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          app.status === "hired"
                            ? "bg-emerald-100 text-emerald-700"
                            : app.status === "rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {app.status}
                        </span>
                      </div>
                      <ol className="relative border-l border-gray-200 pl-4 space-y-4">
                        {stagesWithNotes.map((h: StageHistory) => (
                          <li key={h.id} className="relative">
                            <span className="absolute -left-[1.1rem] top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-amber-400 ring-2 ring-white" />
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1">
                              <span className="text-xs font-semibold text-gray-800">
                                {h.stage_name.replace(/_/g, " ")}
                              </span>
                              {h.result && (
                                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                  ["pass", "lolos", "lanjut", "ok"].includes(h.result.toLowerCase())
                                    ? "bg-emerald-100 text-emerald-700"
                                    : ["fail", "tidak_lolos", "not_recommended"].includes(h.result.toLowerCase())
                                    ? "bg-red-100 text-red-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}>
                                  {h.result}
                                </span>
                              )}
                              {h.created_at && (
                                <span className="text-[10px] text-gray-400">
                                  {format(new Date(h.created_at), "dd MMM yyyy", { locale: idLocale })}
                                </span>
                              )}
                            </div>
                            <p className="whitespace-pre-line text-sm text-gray-600 leading-relaxed">
                              {h.notes}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  );
                })}
                {applicationDetails.every(
                  (app) => !(app.stage_history ?? []).some((h: StageHistory) => h.notes?.trim())
                ) && (
                  <p className="text-sm text-gray-400 italic">Belum ada catatan di tahapan seleksi.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm text-gray-900">{value}</p>
    </div>
  );
}

// ── ProjectCard ───────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  onBlur,
  onApproveToggle,
  isSaving,
}: {
  project: DraftProjectItem;
  onBlur: (
    project: DraftProjectItem,
    field: keyof DraftProjectItem,
    value: DraftProjectItem[keyof DraftProjectItem],
  ) => void;
  onApproveToggle: (project: DraftProjectItem) => void;
  isSaving: boolean;
}) {
  // Local state for controlled inputs — synced to DB on blur
  const [fields, setFields] = useState({
    project_name: project.project_name,
    role: project.role,
    summary: project.summary,
    impact: project.impact,
    tech_stack: project.tech_stack,
    duration: project.duration,
  });

  const handleChange = (field: keyof typeof fields, value: string | string[]) => {
    setFields((prev) => ({ ...prev, [field]: value }));
  };

  const approved = !project.is_draft;

  return (
    <div className="rounded-xl border border-blue-100 bg-white p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm text-gray-700">
          <span className="mb-1 block font-medium">Nama proyek</span>
          <input
            value={fields.project_name}
            onChange={(e) => handleChange("project_name", e.target.value)}
            onBlur={(e) => onBlur(project, "project_name", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block text-sm text-gray-700">
          <span className="mb-1 block font-medium">Peran</span>
          <input
            value={fields.role}
            onChange={(e) => handleChange("role", e.target.value)}
            onBlur={(e) => onBlur(project, "role", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="block text-sm text-gray-700 md:col-span-2">
          <span className="mb-1 block font-medium">Summary</span>
          <textarea
            value={fields.summary}
            onChange={(e) => handleChange("summary", e.target.value)}
            onBlur={(e) => onBlur(project, "summary", e.target.value)}
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block text-sm text-gray-700 md:col-span-2">
          <span className="mb-1 block font-medium">Impact</span>
          <textarea
            value={fields.impact}
            onChange={(e) => handleChange("impact", e.target.value)}
            onBlur={(e) => onBlur(project, "impact", e.target.value)}
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block text-sm text-gray-700">
          <span className="mb-1 block font-medium">Durasi</span>
          <input
            value={fields.duration}
            onChange={(e) => handleChange("duration", e.target.value)}
            onBlur={(e) => onBlur(project, "duration", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block text-sm text-gray-700">
          <span className="mb-1 block font-medium">Tech stack</span>
          <input
            value={fields.tech_stack.join(", ")}
            onChange={(e) =>
              handleChange(
                "tech_stack",
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
            onBlur={(e) =>
              onBlur(
                project,
                "tech_stack",
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => onApproveToggle(project)}
          className={`rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-60 ${
            approved
              ? "bg-emerald-100 text-emerald-700"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {approved ? "Disetujui ✓" : "Setujui draft"}
        </button>
      </div>
    </div>
  );
}
