"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useToastStore } from "@/stores/toast.store";
import type { Candidate, CandidateEducation, CandidateExperience } from "@/types";

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
  domicile: z.string().optional().or(z.literal("")),
  source_channel: z.string().optional().or(z.literal("")),
  current_salary: z.string().optional().or(z.literal("")),
  expected_salary: z.string().optional().or(z.literal("")),
  notice_period_days: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  photo_url: z.string().optional().or(z.literal("")),
  education: z.array(educationItemSchema).default([]),
  experience: z.array(experienceItemSchema).default([]),
});

type CandidateFormValues = z.infer<typeof candidateFormSchema>;

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
}: {
  mode: "create" | "edit";
  candidateId?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(mode === "edit");
  const [initialEducation, setInitialEducation] = useState<CandidateEducation[]>([]);
  const [initialExperience, setInitialExperience] = useState<CandidateExperience[]>([]);

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
      domicile: "",
      source_channel: "",
      current_salary: "",
      expected_salary: "",
      notice_period_days: "",
      notes: "",
      photo_url: "",
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
        form.reset({
          full_name: candidate.full_name || "",
          email: candidate.email || "",
          phone: candidate.phone || "",
          identity_no: candidate.identity_no || "",
          birth_date: candidate.birth_date ? candidate.birth_date.slice(0, 10) : "",
          birth_place: candidate.birth_place || "",
          gender: candidate.gender || "",
          blood_type: candidate.blood_type || "",
          domicile: candidate.domicile || "",
          source_channel: candidate.source_channel || "",
          current_salary: candidate.current_salary != null ? String(candidate.current_salary) : "",
          expected_salary: candidate.expected_salary != null ? String(candidate.expected_salary) : "",
          notice_period_days:
            candidate.notice_period_days != null ? String(candidate.notice_period_days) : "",
          notes: candidate.notes || "",
          photo_url: candidate.photo_url || "",
          education:
            educations.length > 0
              ? educations.map((item) => ({
                  id: item.id,
                  institution: item.institution || "",
                  major: item.major || "",
                  graduation_year: item.graduation_year != null ? String(item.graduation_year) : "",
                  gpa: item.gpa != null ? String(item.gpa) : "",
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
                }))
              : [defaultExperience],
        });
      } catch (error) {
        const message =
          (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          "Gagal memuat data kandidat.";
        showToast("error", message);
      } finally {
        setIsLoadingData(false);
      }
    };

    loadCandidate();
  }, [candidateId, form, mode, showToast]);

  const handleSubmitForm = async (values: CandidateFormValues) => {
    setIsSubmitting(true);

    try {
      const photoUrl = values.photo_url?.trim();
      const candidatePayload = {
        full_name: values.full_name.trim(),
        email: values.email?.trim() || null,
        phone: values.phone?.trim() || null,
        identity_no: values.identity_no?.trim() || null,
        domicile: values.domicile?.trim() || null,
        source_channel: values.source_channel?.trim() || null,
        current_salary: toNumber(values.current_salary),
        expected_salary: toNumber(values.expected_salary),
        notice_period_days: toNumber(values.notice_period_days),
        notes: values.notes?.trim() || null,
        ...(photoUrl ? { photo_url: photoUrl } : {}),
      };

      let targetId = candidateId;

      if (mode === "create") {
        const response = await api.post("/api/v1/candidates", candidatePayload);
        const createdCandidate = response.data?.candidate ?? response.data ?? null;
        targetId = createdCandidate?.id ?? null;

        if (response.data?.is_blacklisted) {
          showToast("warning", "Kandidat masuk daftar blacklist. Mohon cek kembali sebelum lanjut.");
        }
        if (response.data?.is_duplicate) {
          showToast("warning", "Kemungkinan kandidat duplikat terdeteksi.");
        }
      } else if (candidateId) {
        await api.put(`/api/v1/candidates/${candidateId}`, candidatePayload);
      }

      if (!targetId) {
        throw new Error("ID kandidat tidak tersedia");
      }

      const normalizedEducation = values.education
        .filter((item) => item.institution || item.major || item.graduation_year || item.gpa)
        .map((item) => ({
          id: item.id || undefined,
          institution: item.institution?.trim() || null,
          major: item.major?.trim() || null,
          graduation_year: item.graduation_year ? Number(item.graduation_year) : null,
          gpa: item.gpa ? Number(item.gpa) : null,
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
      queryClient.invalidateQueries({ queryKey: ["candidate", targetId] });
      queryClient.invalidateQueries({ queryKey: ["candidate-education", targetId] });
      queryClient.invalidateQueries({ queryKey: ["candidate-experience", targetId] });
      queryClient.invalidateQueries({ queryKey: ["candidate-applications", targetId] });
      router.push(`/candidates/${targetId}`);
    } catch (error) {
      const message =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Gagal menyimpan data kandidat.";
      showToast("error", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (mode === "edit" && isLoadingData) {
    return <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Memuat form kandidat...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/candidates" className="text-sm font-medium text-primary-600 hover:underline">
            ← Kembali ke Kandidat
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">
            {mode === "create" ? "Tambah Kandidat" : "Edit Kandidat"}
          </h1>
        </div>
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                placeholder="Nama lengkap"
              />
              {form.formState.errors.full_name && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.full_name.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input {...form.register("email")} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">No. HP</label>
              <input {...form.register("phone")} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">NIK</label>
              <input {...form.register("identity_no")} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tempat Lahir</label>
              <input {...form.register("birth_place")} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tanggal Lahir</label>
              <input {...form.register("birth_date")} type="date" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Jenis Kelamin</label>
              <select {...form.register("gender")} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500">
                <option value="">Pilih</option>
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Golongan Darah</label>
              <select {...form.register("blood_type")} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500">
                <option value="">Pilih</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="AB">AB</option>
                <option value="O">O</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Domisili</label>
              <input {...form.register("domicile")} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Sumber</label>
              <select {...form.register("source_channel")} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500">
                <option value="">Pilih sumber</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Glints">Glints</option>
                <option value="Email">Email</option>
                <option value="Referral">Referral</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Gaji saat ini</label>
              <input {...form.register("current_salary")} type="number" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Gaji yang diharapkan</label>
              <input {...form.register("expected_salary")} type="number" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Notice period (hari)</label>
              <input {...form.register("notice_period_days")} type="number" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Catatan</label>
              <textarea {...form.register("notes")} rows={4} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>
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
                    <input {...form.register(`education.${index}.institution`)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Jurusan</label>
                    <input {...form.register(`education.${index}.major`)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Tahun lulus</label>
                    <input type="number" {...form.register(`education.${index}.graduation_year`)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">IPK</label>
                    <input type="number" step="0.01" {...form.register(`education.${index}.gpa`)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
                  </div>
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
                    <input {...form.register(`experience.${index}.company_name`)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Posisi</label>
                    <input {...form.register(`experience.${index}.job_title`)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Awal</label>
                    <input type="date" {...form.register(`experience.${index}.start_date`)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Akhir</label>
                    <input type="date" {...form.register(`experience.${index}.end_date`)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700">Deskripsi</label>
                    <textarea rows={4} {...form.register(`experience.${index}.description`)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
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
    </div>
  );
}
