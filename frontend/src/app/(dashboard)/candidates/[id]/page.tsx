"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import api from "@/lib/api";
import DocumentUploader from "@/components/candidates/DocumentUploader";
import type {
  Application,
  Candidate,
  CandidateEducation,
  CandidateExperience,
} from "@/types";

type TabKey = "profil" | "dokumen" | "lamaran" | "catatan";

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

export default function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<TabKey>("profil");

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

  const { data: documents = [] } = useQuery({
    queryKey: ["candidate-documents", id],
    queryFn: () => api.get(`/api/v1/candidates/${id}/documents/`).then((r) => r.data),
  });

  if (isLoading || !candidate) {
    return <div className="p-6 text-gray-500">Memuat detail kandidat...</div>;
  }

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
            <Link href="/candidates" className="text-sm font-medium text-primary-600 hover:underline">
              ← Kembali ke kandidat
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">{candidate.full_name}</h1>
          </div>
        </div>
        <Link
          href={`/candidates/${id}/edit`}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Edit kandidat
        </Link>
      </div>

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
                        {education.gpa && <span>IPK: {Number(education.gpa).toFixed(2)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Pengalaman Kerja</h2>
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
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Catatan Recruiter</h2>
          <p className="whitespace-pre-line text-sm text-gray-700">
            {candidate.notes || "Belum ada catatan untuk kandidat ini."}
          </p>
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
