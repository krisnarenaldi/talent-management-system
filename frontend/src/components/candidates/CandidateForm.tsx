"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { settingsApi } from "@/lib/api/settings";
import { useToastStore } from "@/stores/toast.store";
import { getErrorMessage } from "@/lib/errors";
import TagInput from "@/components/shared/TagInput";
import type { Candidate, CandidateEducation, CandidateExperience, SourceChannel } from "@/types";

const educationItemSchema = z.object({
  id: z.string().optional(),
  institution: z.string().optional(),
  major: z.string().optional(),
  graduation_year: z.string().optional(),
  gpa: z.string().optional(),
});

const experienceItemSchema = z.object({
  id: z.string().optional(),
  company_name: z.string().optional(),
  job_title: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  description: z.string().optional(),
  tools: z.array(z.string()).default([]),
});

const candidateFormSchema = z.object({
  full_name: z.string().min(1, "Nama lengkap wajib diisi"),
  email: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  identity_no: z.string().optional().or(z.literal("")),
  birth_date: z.string().optional().or(z.literal("")),
  birth_place: z.string().optional().or(z.literal("")),
  gender: z.string().optional().or(z.literal("")),
  blood_type: z.string().optional().or(z.literal("")),
  marital_status: z.string().optional().or(z.literal("")),
  domicile: z.string().optional().or(z.literal("")),
  source_channel: z.string().optional().or(z.literal("")),
  current_salary: z.string().optional().or(z.literal("")),
  expected_salary: z.string().optional().or(z.literal("")),
  notice_period_days: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  photo_url: z.string().optional().or(z.literal("")),
  skills: z.array(z.string()).default([]),
  education: z.array(educationItemSchema).default([]),
  experience: z.array(experienceItemSchema).default([]),
});

type CandidateFormValues = z.infer<typeof candidateFormSchema>;

export interface CreateCandidateResult {
  candidateId: string;
  isBlacklisted: boolean;
  isDuplicate: boolean;
}

const defaultEducation = {
  id: "",
  institution: "",
  major: "",
  graduation_year: "",
  gpa: "",
};

const defaultExperience = {
  id: "",
  company_name: "",
  job_title: "",
  start_date: "",
  end_date: "",
  description: "",
  tools: [] as string[],
};

function toNumber(value: string | undefined) {
  if (!value || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchCandidateById(candidateId: string) {
  const response = await api.get(`/api/v1/candidates/${candidateId}`);
  return response.data as Candidate;
}

async function fetchEducationById(candidateId: string) {
  const response = await api.get(`/api/v1/candidates/${candidateId}/education/`);
  return response.data as CandidateEducation[];
}

async function fetchExperienceById(candidateId: string) {
  const response = await api.get(`/api/v1/candidates/${candidateId}/experience/`);
  return response.data as CandidateExperience[];
}

export default function CandidateForm({
  mode,
  candidateId,
  onCreateResult,
  preventNavigationOnCreate = false,
}: {
  mode: "create" | "edit";
  candidateId?: string;
  onCreateResult?: (result: CreateCandidateResult) => void;
  preventNavigationOnCreate?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromSource = searchParams?.get("from");
  const isFromTalentPool = fromSource === "talent-pool";

  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(mode === "edit");
  const [initialEducation, setInitialEducation] = useState<CandidateEducation[]>([]);
  const [initialExperience, setInitialExperience] = useState<CandidateExperience[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [pendingSourceChannel, setPendingSourceChannel] = useState<string | null>(null);
  // ── Upload Latest Data modal state ──
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const { data: sourceChannels = [] } = useQuery<SourceChannel[]>({
    queryKey: ["source-channels-active"],
    queryFn: () => settingsApi.listSourceChannels({ is_active: true }),
  });
  const skillInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<CandidateFormValues>({
    resolver: zodResolver(candidateFormSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      identity_no: "",
      birth_date: "",
      birth_place: "",
      gender: "",
      blood_type: "",
      marital_status: "",
      domicile: "",
      source_channel: "",
      current_salary: "",
      expected_salary: "",
      notice_period_days: "",
      notes: "",
      photo_url: "",
      skills: [],
      education: [defaultEducation],
      experience: [defaultExperience],
    },
  });

  const {
    fields: educationFields,
    append: appendEducation,
    remove: removeEducation,
  } = useFieldArray({
    control: form.control,
    name: "education",
  });

  const {
    fields: experienceFields,
    append: appendExperience,
    remove: removeExperience,
  } = useFieldArray({
    control: form.control,
    name: "experience",
  });

  useEffect(() => {
    if (mode !== "edit" || !candidateId) return;

    const loadCandidate = async () => {
      setIsLoadingData(true);
      try {
        const [candidate, educations, experiences] = await Promise.all([
          fetchCandidateById(candidateId),
          fetchEducationById(candidateId),
          fetchExperienceById(candidateId),
        ]);

        setInitialEducation(educations);
        setInitialExperience(experiences);
        // Simpan source_channel kandidat — akan di-sync ke form setelah sourceChannels tersedia
        setPendingSourceChannel(candidate.source_channel || "");
        form.reset({
          full_name: candidate.full_name || "",
          email: candidate.email || "",
          phone: candidate.phone || "",
          identity_no: candidate.identity_no || "",
          birth_date: candidate.birth_date ? candidate.birth_date.slice(0, 10) : "",
          birth_place: candidate.birth_place || "",
          gender: candidate.gender || "",
          blood_type: candidate.blood_type || "",
          marital_status: candidate.marital_status || "",
          domicile: candidate.domicile || "",
          source_channel: candidate.source_channel || "",
          current_salary: candidate.current_salary != null ? String(candidate.current_salary) : "",
          expected_salary: candidate.expected_salary != null ? String(candidate.expected_salary) : "",
          notice_period_days:
            candidate.notice_period_days != null ? String(candidate.notice_period_days) : "",
          notes: candidate.notes || "",
          photo_url: candidate.photo_url || "",
          skills: candidate.skills ?? [],
          education:
            educations.length > 0
              ? educations.map((item, idx) => ({
                  id: item.id,
                  institution: item.institution || "",
                  major: item.major || "",
                  graduation_year: item.graduation_year != null ? String(item.graduation_year) : "",
                  gpa: idx === 0 && item.gpa != null ? String(item.gpa) : "",
                }))
              : [defaultEducation],
          experience:
            experiences.length > 0
              ? experiences.map((item) => ({
                  id: item.id,
                  company_name: item.company_name || "",
                  job_title: item.job_title || "",
                  start_date: item.start_date ? item.start_date.slice(0, 10) : "",
                  end_date: item.end_date ? item.end_date.slice(0, 10) : "",
                  description: item.description || "",
                  tools: item.tools ?? [],
                }))
              : [defaultExperience],
        });
      } catch (error) {
        showToast("error", getErrorMessage(error, "Gagal memuat data kandidat."));
      } finally {
        setIsLoadingData(false);
      }
    };

    loadCandidate();
  }, [candidateId, form, mode, showToast]);

  // Sync source_channel ke form setelah sourceChannels selesai di-fetch.
  // Diperlukan karena form.reset() bisa dipanggil sebelum options tersedia,
  // sehingga browser tidak bisa match value ke option dan fallback ke default.
  useEffect(() => {
    if (pendingSourceChannel === null || sourceChannels.length === 0) return;
    form.setValue("source_channel", pendingSourceChannel, { shouldDirty: false });
  }, [pendingSourceChannel, sourceChannels, form]);

  const handleSubmitForm = async (values: CandidateFormValues) => {
    setIsSubmitting(true);

    try {
      const photoUrl = values.photo_url?.trim();
      const candidatePayload = {
        full_name: values.full_name.trim(),
        email: values.email?.trim() || null,
        phone: values.phone?.trim() || null,
        identity_no: values.identity_no?.trim() || null,
        birth_date: values.birth_date?.trim() || null,
        birth_place: values.birth_place?.trim() || null,
        gender: values.gender?.trim() || null,
        blood_type: values.blood_type?.trim() || null,
        marital_status: values.marital_status?.trim() || null,
        domicile: values.domicile?.trim() || null,
        source_channel: values.source_channel?.trim() || null,
        current_salary: toNumber(values.current_salary),
        expected_salary: toNumber(values.expected_salary),
        notice_period_days: toNumber(values.notice_period_days),
        notes: values.notes?.trim() || null,
        skills: values.skills.length > 0 ? values.skills : null,
        ...(photoUrl ? { photo_url: photoUrl } : {}),
      };

      let targetId = candidateId;
      let isBlacklisted = false;
      let isDuplicate = false;

      if (mode === "create") {
        const response = await api.post("/api/v1/candidates", candidatePayload);
        const createdCandidate = response.data?.candidate ?? response.data ?? null;
        targetId = createdCandidate?.id ?? null;

        isBlacklisted = Boolean(response.data?.is_blacklisted);
        isDuplicate = Boolean(response.data?.is_duplicate);

        if (!preventNavigationOnCreate) {
          if (isBlacklisted) {
            showToast("warning", "Kandidat masuk daftar blacklist. Mohon cek kembali sebelum lanjut.");
          }
          if (isDuplicate) {
            showToast("warning", "Kemungkinan kandidat duplikat terdeteksi.");
          }
        }
      } else if (candidateId) {
        await api.put(`/api/v1/candidates/${candidateId}`, candidatePayload);
      }

      if (!targetId) {
        throw new Error("ID kandidat tidak tersedia");
      }

      const normalizedEducation = values.education
        .filter((item) => item.institution || item.major || item.graduation_year)
        .map((item) => ({
          id: item.id || undefined,
          institution: item.institution?.trim() || null,
          major: item.major?.trim() || null,
          graduation_year: item.graduation_year ? Number(item.graduation_year) : null,
        }));

      const normalizedExperience = values.experience
        .filter((item) => item.company_name || item.job_title || item.start_date || item.end_date || item.description)
        .map((item) => ({
          id: item.id || undefined,
          company_name: item.company_name?.trim() || null,
          job_title: item.job_title?.trim() || null,
          start_date: item.start_date || null,
          end_date: item.end_date || null,
          description: item.description?.trim() || null,
          tools: item.tools && item.tools.length > 0 ? item.tools : null,
        }));
      if (mode === "edit" && candidateId) {
        const existingEducationIds = new Set(initialEducation.map((item) => item.id));
        const existingExperienceIds = new Set(initialExperience.map((item) => item.id));

        for (const oldEducation of initialEducation) {
          const currentMatch = normalizedEducation.find((item) => item.id === oldEducation.id);
          if (!currentMatch && oldEducation.id) {
            await api.delete(`/api/v1/candidates/${candidateId}/education/${oldEducation.id}`);
          }
        }

        for (const oldExperience of initialExperience) {
          const currentMatch = normalizedExperience.find((item) => item.id === oldExperience.id);
          if (!currentMatch && oldExperience.id) {
            await api.delete(`/api/v1/candidates/${candidateId}/experience/${oldExperience.id}`);
          }
        }

        for (const item of normalizedEducation) {
          if (!item.id) {
            await api.post(`/api/v1/candidates/${candidateId}/education`, item);
          } else if (existingEducationIds.has(item.id)) {
            await api.put(`/api/v1/candidates/${candidateId}/education/${item.id}`, item);
          }
        }

        for (const item of normalizedExperience) {
          if (!item.id) {
            await api.post(`/api/v1/candidates/${candidateId}/experience`, item);
          } else if (existingExperienceIds.has(item.id)) {
            await api.put(`/api/v1/candidates/${candidateId}/experience/${item.id}`, item);
          }
        }
      } else {
        for (const item of normalizedEducation) {
          await api.post(`/api/v1/candidates/${targetId}/education`, item);
        }
        for (const item of normalizedExperience) {
          await api.post(`/api/v1/candidates/${targetId}/experience`, item);
        }
      }

      showToast("success", mode === "create" ? "Kandidat berhasil dibuat." : "Kandidat berhasil diperbarui.");
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      queryClient.invalidateQueries({ queryKey: ["candidate", targetId] });
      queryClient.invalidateQueries({ queryKey: ["candidate-education", targetId] });
      queryClient.invalidateQueries({ queryKey: ["candidate-experience", targetId] });
      queryClient.invalidateQueries({ queryKey: ["candidate-applications", targetId] });
      if (mode === "create" && preventNavigationOnCreate) {
        if (onCreateResult && targetId) {
          onCreateResult({ candidateId: targetId, isBlacklisted, isDuplicate });
        }
      } else {
        router.push(
          isFromTalentPool
            ? `/candidates/${targetId}?from=talent-pool`
            : `/candidates/${targetId}`
        );
      }
    } catch (error) {
      showToast("error", getErrorMessage(error, "Gagal menyimpan data kandidat."));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Handler untuk upload data terbaru PDF ──
  const handleUploadLatestData = async () => {
    if (!uploadFile || !candidateId) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      const res = await api.post(
        `/api/v1/candidates/${candidateId}/upload-latest-data`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      showToast("success", res.data?.message || "Data kandidat berhasil diperbarui dari PDF.");
      setShowUploadModal(false);
      setUploadFile(null);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
      // Reload data form agar fields experience + tools ter-update
      const [updatedCandidate, updatedEducations, updatedExperiences] = await Promise.all([
        fetchCandidateById(candidateId),
        fetchEducationById(candidateId),
        fetchExperienceById(candidateId),
      ]);
      setInitialExperience(updatedExperiences);
      setInitialEducation(updatedEducations);

      // Sinkronisasi data pribadi yang mungkin baru terisi
      if (updatedCandidate.full_name) form.setValue("full_name", updatedCandidate.full_name);
      if (updatedCandidate.email) form.setValue("email", updatedCandidate.email);
      if (updatedCandidate.phone) form.setValue("phone", updatedCandidate.phone);
      if (updatedCandidate.gender) form.setValue("gender", updatedCandidate.gender);
      if (updatedCandidate.marital_status) form.setValue("marital_status", updatedCandidate.marital_status);

      form.setValue("skills", updatedCandidate.skills ?? []);

      // Sinkronisasi pendidikan
      if (updatedEducations.length > 0) {
        form.setValue(
          "education",
          updatedEducations.map((item, idx) => ({
            id: item.id,
            institution: item.institution || "",
            major: item.major || "",
            graduation_year: item.graduation_year != null ? String(item.graduation_year) : "",
            gpa: idx === 0 && item.gpa != null ? String(item.gpa) : "",
          })),
        );
      }

      // Sinkronisasi pengalaman kerja beserta tools & tanggal
      form.setValue(
        "experience",
        updatedExperiences.length > 0
          ? updatedExperiences.map((item) => ({
              id: item.id,
              company_name: item.company_name || "",
              job_title: item.job_title || "",
              start_date: item.start_date ? item.start_date.slice(0, 10) : "",
              end_date: item.end_date ? item.end_date.slice(0, 10) : "",
              description: item.description || "",
              tools: item.tools ?? [],
            }))
          : [defaultExperience],
      );
      queryClient.invalidateQueries({ queryKey: ["candidate", candidateId] });
      queryClient.invalidateQueries({ queryKey: ["candidate-education", candidateId] });
      queryClient.invalidateQueries({ queryKey: ["candidate-experience", candidateId] });
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    } catch (error) {
      showToast("error", getErrorMessage(error, "Gagal memproses PDF data terbaru."));
    } finally {
      setIsUploading(false);
    }
  };

  if (mode === "edit" && isLoadingData) {
    return <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Memuat form kandidat...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link
            href={
              candidateId
                ? isFromTalentPool
                  ? `/candidates/${candidateId}?from=talent-pool`
                  : `/candidates/${candidateId}`
                : isFromTalentPool
                ? "/talent-pool"
                : "/candidates"
            }
            className="text-sm font-medium text-primary hover:underline"
          >
            ← Kembali ke {candidateId ? "Detail" : isFromTalentPool ? "Talent Pool" : "Kandidat"}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">
            {mode === "create" ? "Tambah Kandidat" : "Edit Kandidat"}
          </h1>
        </div>
        {/* Tombol Upload Data Terakhir — hanya di mode edit */}
        {mode === "edit" && candidateId && (
          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
          >
            <span className="material-symbols-outlined text-base">upload_file</span>
            Upload Data Terakhir untuk Edit
          </button>
        )}
      </div>

      <form onSubmit={form.handleSubmit(handleSubmitForm)} className="space-y-6 pb-16">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Data Pribadi</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {mode === "edit" && (
              <div className="md:col-span-2 flex items-center gap-4">
                <div className="flex-shrink-0 w-20 h-20 rounded-full bg-gray-200 overflow-hidden">
                  {form.watch("photo_url") ? (
                    <img
                      src={form.watch("photo_url")}
                      alt="Preview foto"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                      No photo
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-gray-700">URL Foto Profil</label>
                  <input
                    {...form.register("photo_url")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
                    placeholder="https://contoh.com/foto.jpg"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Atau upload via tab Dokumen &gt; pilih tipe "Foto"
                  </p>
                </div>
              </div>
            )}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Nama lengkap</label>
              <input
                {...form.register("full_name")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
                placeholder="Nama lengkap"
              />
              {form.formState.errors.full_name && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.full_name.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input {...form.register("email")} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">No. HP</label>
              <input {...form.register("phone")} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">NIK</label>
              <input {...form.register("identity_no")} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tempat Lahir</label>
              <input {...form.register("birth_place")} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tanggal Lahir</label>
              <input {...form.register("birth_date")} type="date" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Jenis Kelamin</label>
              <select {...form.register("gender")} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary">
                <option value="">Pilih</option>
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Golongan Darah</label>
              <select {...form.register("blood_type")} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary">
                <option value="">Pilih</option>
                <option value="A" selected>A</option>
                <option value="B">B</option>
                <option value="AB">AB</option>
                <option value="O">O</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Status Perkawinan</label>
              <select {...form.register("marital_status")} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary">
                <option value="">Pilih</option>
                <option value="Belum Menikah">Belum Menikah</option>
                <option value="Menikah" selected>Menikah</option>
                <option value="Cerai Hidup">Cerai Hidup</option>
                <option value="Cerai Mati">Cerai Mati</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Domisili</label>
              <input {...form.register("domicile")} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Sumber</label>
              <select {...form.register("source_channel")} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary">
                <option value="">Pilih sumber</option>
                {sourceChannels.map((ch) => (
                  <option key={ch.id} value={ch.label}>{ch.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Gaji saat ini</label>
              <input {...form.register("current_salary")} type="number" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Gaji yang diharapkan</label>
              <input {...form.register("expected_salary")} type="number" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Notice period (hari)</label>
              <input {...form.register("notice_period_days")} type="number" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Catatan</label>
              <textarea {...form.register("notes")} rows={4} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Skill</h2>
          <p className="mb-4 text-xs text-gray-500">
            Ketik skill lalu tekan <kbd className="rounded border border-gray-300 bg-gray-100 px-1 py-0.5 font-mono text-xs">Enter</kbd> atau <kbd className="rounded border border-gray-300 bg-gray-100 px-1 py-0.5 font-mono text-xs">,</kbd> untuk menambah.
          </p>
          <div
            className="flex min-h-[42px] flex-wrap gap-2 rounded-lg border border-gray-300 px-3 py-2 cursor-text"
            onClick={() => skillInputRef.current?.focus()}
          >
            {form.watch("skills").map((skill, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800"
              >
                {skill}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const current = form.getValues("skills");
                    form.setValue("skills", current.filter((_, i) => i !== index));
                  }}
                  className="ml-0.5 text-blue-600 hover:text-blue-900"
                  aria-label={`Hapus ${skill}`}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              ref={skillInputRef}
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  const trimmed = skillInput.trim().replace(/,$/, "");
                  if (trimmed && !form.getValues("skills").includes(trimmed)) {
                    form.setValue("skills", [...form.getValues("skills"), trimmed]);
                  }
                  setSkillInput("");
                } else if (e.key === "Backspace" && skillInput === "") {
                  const current = form.getValues("skills");
                  if (current.length > 0) {
                    form.setValue("skills", current.slice(0, -1));
                  }
                }
              }}
              onBlur={() => {
                const trimmed = skillInput.trim().replace(/,$/, "");
                if (trimmed && !form.getValues("skills").includes(trimmed)) {
                  form.setValue("skills", [...form.getValues("skills"), trimmed]);
                }
                setSkillInput("");
              }}
              className="flex-1 min-w-[120px] border-none bg-transparent text-sm outline-none placeholder:text-gray-400"
              placeholder={form.watch("skills").length === 0 ? "Contoh: PHP, Next.js, Python..." : "Tambah skill..."}
            />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Pendidikan</h2>
            <button
              type="button"
              onClick={() => appendEducation(defaultEducation)}
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              + Tambah Pendidikan
            </button>
          </div>

          <div className="space-y-4">
            {educationFields.map((item, index) => (
              <div key={item.id ?? `edu-${index}`} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Pendidikan {index + 1}</span>
                  {educationFields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEducation(index)}
                      className="text-xs font-medium text-red-600 hover:text-red-700"
                    >
                      Hapus
                    </button>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Institusi</label>
                    <input {...form.register(`education.${index}.institution`)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Jurusan</label>
                    <input {...form.register(`education.${index}.major`)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Tahun lulus</label>
                    <input type="number" {...form.register(`education.${index}.graduation_year`)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" />
                  </div>

                  {index === 0 && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">IPK</label>
                      <input type="number" step="0.01" {...form.register(`education.${index}.gpa`)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Pengalaman Kerja</h2>
            <button
              type="button"
              onClick={() => appendExperience(defaultExperience)}
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              + Tambah Pengalaman
            </button>
          </div>

          <div className="space-y-4">
            {experienceFields.map((item, index) => (
              <div key={item.id ?? `exp-${index}`} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Pengalaman {index + 1}</span>
                  {experienceFields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeExperience(index)}
                      className="text-xs font-medium text-red-600 hover:text-red-700"
                    >
                      Hapus
                    </button>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Nama perusahaan</label>
                    <input {...form.register(`experience.${index}.company_name`)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Posisi</label>
                    <input {...form.register(`experience.${index}.job_title`)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Awal</label>
                    <input type="date" {...form.register(`experience.${index}.start_date`)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Akhir</label>
                    <input type="date" {...form.register(`experience.${index}.end_date`)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700">Deskripsi</label>
                    <textarea rows={4} {...form.register(`experience.${index}.description`)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary" />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700">Tools</label>
                    <p className="mb-1.5 text-xs text-gray-500">
                      Ketik tool lalu tekan <kbd className="rounded border border-gray-300 bg-gray-100 px-1 py-0.5 font-mono text-xs">Enter</kbd> atau <kbd className="rounded border border-gray-300 bg-gray-100 px-1 py-0.5 font-mono text-xs">,</kbd> untuk menambah.
                    </p>
                    <TagInput
                      value={form.watch(`experience.${index}.tools`) ?? []}
                      onChange={(tags) => form.setValue(`experience.${index}.tools`, tags)}
                      placeholder="Contoh: Katalon, Selenium, JMeter..."
                      ariaLabel={`Tools untuk pengalaman ${index + 1}`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/candidates" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Batal
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isSubmitting ? "Menyimpan..." : mode === "create" ? "Simpan Kandidat" : "Update Kandidat"}
          </button>
        </div>
      </form>

      {/* ── Modal Upload Data Terakhir ── */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Upload Data Terakhir</h2>
                <p className="mt-0.5 text-sm text-gray-500">Upload PDF formulir data kandidat hasil interview</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                  if (uploadInputRef.current) uploadInputRef.current.value = "";
                }}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                <p className="font-medium mb-1">Cara kerja:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-xs text-blue-700">
                  <li>Sistem akan membaca teks dari PDF secara otomatis</li>
                  <li>AI akan mengekstrak data pengalaman kerja &amp; tools per perusahaan</li>
                  <li>Data kandidat akan diperbarui langsung di form</li>
                </ul>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Pilih file PDF
                </label>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
                />
                {uploadFile && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-600">
                    <span className="material-symbols-outlined text-sm text-green-600">check_circle</span>
                    {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                  if (uploadInputRef.current) uploadInputRef.current.value = "";
                }}
                disabled={isUploading}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleUploadLatestData}
                disabled={!uploadFile || isUploading}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isUploading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Memproses...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">auto_awesome</span>
                    Proses &amp; Update Data
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
