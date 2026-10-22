"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { AgreementType, Client, ClientPic, Position } from "@/types";
import { useModalEscape } from "@/hooks/useModalEscape";
import { useToastStore } from "@/stores/toast.store";
import { getErrorMessage } from "@/lib/errors";
import { getClientPics } from "@/lib/clients";
import TagInput from "@/components/shared/TagInput";
import RupiahInput from "@/components/shared/RupiahInput";

const optionalNumber = z.preprocess(
  (val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    if (typeof val === "number") return Number.isNaN(val) ? undefined : val;
    if (typeof val === "string") {
      const num = Number(val);
      return Number.isNaN(num) ? undefined : num;
    }
    return val;
  },
  z.number().min(0, "Nilai tidak boleh negatif").optional(),
);

const optionalText = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
  z.string().optional(),
);

const clientUserNamesSchema = z
  .array(z.string())
  .min(1, "PIC klien wajib dipilih dari master klien");

export const positionCreateSchema = z.object({
  client_id: z.string().min(1, "Klien wajib dipilih"),
  title: z.string().min(1, "Judul posisi wajib diisi"),
  requirement: z.string().optional(),
  job_description: z.string().optional(),
  employment_type: z.string().optional(),
  contract_duration_months: z
    .preprocess(
      (val) => (val === "" || val === null || (typeof val === "number" && Number.isNaN(val)) ? undefined : val),
      z.number().optional().default(0),
    ),
  salary_budget: optionalNumber,
  location: optionalText,
  client_user_names: clientUserNamesSchema,
  ai_required_skills: z.array(z.string()).default([]),
  ai_min_experience_years: optionalNumber,
  is_active: z.boolean().default(true),
});

export const positionUpdateSchema = z
  .object({
    title: z.string().min(1, "Judul posisi wajib diisi").optional(),
    requirement: z.string().optional(),
    job_description: z.string().optional(),
    employment_type: z.string().optional(),
    contract_duration_months: z
      .preprocess(
        (val) => (val === "" || val === null || (typeof val === "number" && Number.isNaN(val)) ? undefined : val),
        z.number().optional().default(0),
      ),
    salary_budget: optionalNumber,
    location: optionalText,
    client_user_names: clientUserNamesSchema.optional(),
    is_active: z.boolean().optional(),
    ai_threshold_auto: z.number().min(0).max(100).optional(),
    ai_threshold_manual: z.number().min(0).max(100).optional(),
    ai_weight_education: z.number().min(0).max(100).optional(),
    ai_weight_experience: z.number().min(0).max(100).optional(),
    ai_weight_skill: z.number().min(0).max(100).optional(),
    ai_weight_domain: z.number().min(0).max(100).optional(),
    ai_required_skills: z.array(z.string()).default([]),
    ai_min_experience_years: optionalNumber,
  })
  .partial()
  .refine(
    (data) => {
      const fields = [data.ai_weight_education, data.ai_weight_experience, data.ai_weight_skill, data.ai_weight_domain];
      if (fields.every((v) => v !== undefined)) {
        return (fields as number[]).reduce((a, b) => a + b, 0) === 100;
      }
      return true;
    },
    {
      message: "Total bobot penilaian harus tepat 100",
      path: ["ai_weight_education"],
    },
  );

export type PositionCreateForm = z.infer<typeof positionCreateSchema>;
export type PositionUpdateForm = z.infer<typeof positionUpdateSchema>;

export interface ExtractCriteriaResponse {
  salary_budget: number | null;
  location: string | null;
  required_skills: string[];
  min_experience_years: number | null;
  message: string;
}

/** Susun payload `ai_scoring_config` dari field form yang datar. */
export function buildAiScoringConfig(data: Record<string, unknown>): Record<string, unknown> {
  const config: Record<string, unknown> = {};

  const requiredSkills = Array.isArray(data.ai_required_skills)
    ? (data.ai_required_skills as string[])
    : [];
  config.required_skills = requiredSkills;

  if (typeof data.ai_threshold_auto === "number") {
    config.threshold_auto_recommend = data.ai_threshold_auto;
  }
  if (typeof data.ai_threshold_manual === "number") {
    config.threshold_manual_review = data.ai_threshold_manual;
  }
  if (typeof data.ai_min_experience_years === "number" && !Number.isNaN(data.ai_min_experience_years)) {
    config.min_experience_years = data.ai_min_experience_years;
  }

  const weights = {
    education: data.ai_weight_education as number | undefined,
    experience_years: data.ai_weight_experience as number | undefined,
    skill_match: data.ai_weight_skill as number | undefined,
    domain_relevance: data.ai_weight_domain as number | undefined,
  };
  if (Object.values(weights).every((v) => typeof v === "number")) {
    config.weights = weights;
  }

  return config;
}

interface PositionFormModalProps {
  position: Position | null;
  agreementTypes: AgreementType[];
  /** Digunakan bila klien sudah pasti / fixed (misal di halaman detail klien) */
  clientPics?: ClientPic[];
  defaultClientId?: string;
  defaultClientName?: string;
  /** Daftar opsi klien aktif untuk dropdown pemilihan klien (misal di landing page agregasi) */
  clients?: Client[];
  onClose: () => void;
  onCreate: (payload: PositionCreateForm) => Promise<unknown>;
  onUpdate: ({ id, payload }: { id: string; payload: PositionUpdateForm }) => Promise<unknown>;
  isCreatingPending: boolean;
  isUpdatingPending: boolean;
}

export function PositionFormModal({
  position,
  agreementTypes,
  clientPics: initialClientPics,
  defaultClientId,
  defaultClientName,
  clients,
  onClose,
  onCreate,
  onUpdate,
  isCreatingPending,
  isUpdatingPending,
}: PositionFormModalProps) {
  const isCreating = !position;
  const schema = isCreating ? positionCreateSchema : positionUpdateSchema;
  const isSubmitting = isCreating ? isCreatingPending : isUpdatingPending;

  useModalEscape(onClose, !isSubmitting);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    control,
    setValue,
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: isCreating
      ? {
          client_id: defaultClientId ?? "",
          title: "",
          requirement: "",
          job_description: "",
          employment_type: "",
          contract_duration_months: 0,
          salary_budget: undefined,
          location: "",
          client_user_names: [],
          ai_required_skills: [],
          ai_min_experience_years: undefined,
          is_active: true,
        }
      : {
          client_id: position?.client_id ?? "",
          title: position?.title ?? "",
          requirement: position?.requirement ?? "",
          job_description: position?.job_description ?? "",
          employment_type: position?.employment_type ?? "",
          contract_duration_months: position?.contract_duration_months ?? undefined,
          salary_budget: position?.salary_budget != null ? Number(position.salary_budget) : undefined,
          location: position?.location ?? "",
          client_user_names: position?.client_user_names ?? [],
          is_active: position?.is_active ?? true,
          ai_threshold_auto: position?.ai_scoring_config?.threshold_auto_recommend ?? 80,
          ai_threshold_manual: position?.ai_scoring_config?.threshold_manual_review ?? 60,
          ai_weight_education: position?.ai_scoring_config?.weights?.education ?? 25,
          ai_weight_experience: position?.ai_scoring_config?.weights?.experience_years ?? 25,
          ai_weight_skill: position?.ai_scoring_config?.weights?.skill_match ?? 25,
          ai_weight_domain: position?.ai_scoring_config?.weights?.domain_relevance ?? 25,
          ai_required_skills: position?.ai_scoring_config?.required_skills ?? [],
          ai_min_experience_years: position?.ai_scoring_config?.min_experience_years ?? 0,
        },
  });

  const showToast = useToastStore((state) => state.showToast);
  const selectedClientId = watch("client_id");

  // Jika klien dipilih dari dropdown dinamis (mis. di agregasi), fetch detail klien untuk mendapatkan daftar PIC
  const isSelectableClient = !defaultClientId && isCreating && Array.isArray(clients);
  const { data: dynamicClientDetail, isLoading: isLoadingPics } = useQuery<Client>({
    queryKey: ["client", selectedClientId],
    queryFn: () => api.get(`/api/v1/clients/${selectedClientId}`).then((r) => r.data),
    enabled: isSelectableClient && !!selectedClientId,
  });

  // Tentukan clientPics yang aktif
  let activeClientPics: ClientPic[] = initialClientPics ?? [];
  if (isSelectableClient) {
    activeClientPics = dynamicClientDetail ? getClientPics(dynamicClientDetail) : [];
  }

  // Opsi PIC: PIC master klien + PIC posisi lama yang sudah tidak terdaftar
  const selectedPics = (watch("client_user_names") as string[] | undefined) ?? [];
  const picOptions = [
    ...activeClientPics.map((pic) => ({ name: pic.name, contact: pic.contact, isStale: false })),
    ...selectedPics
      .filter(
        (name) =>
          !activeClientPics.some((pic) => pic.name.toLowerCase() === name.toLowerCase()),
      )
      .map((name) => ({ name, contact: null, isStale: true })),
  ];

  // ── Ekstraksi Kriteria Posisi via AI ────────────────────────
  const extractMutation = useMutation({
    mutationFn: (text: string) =>
      api
        .post("/api/v1/positions/extract-criteria", { text })
        .then((res) => res.data as ExtractCriteriaResponse),
    onSuccess: (data) => {
      if (data.salary_budget != null) {
        setValue("salary_budget", data.salary_budget, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      if (data.location) {
        setValue("location", data.location, { shouldDirty: true, shouldValidate: true });
      }
      if (data.required_skills?.length) {
        setValue("ai_required_skills", data.required_skills, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      if (data.min_experience_years != null) {
        setValue("ai_min_experience_years", data.min_experience_years, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      showToast("success", data.message || "Kriteria posisi berhasil diekstrak.");
    },
    onError: (err: unknown) => {
      showToast("error", getErrorMessage(err, "Gagal mengekstrak kriteria posisi."));
    },
  });

  const extractSourceText = [watch("title"), watch("requirement"), watch("job_description")]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0)
    .join("\n\n");

  const canExtract = extractSourceText.length >= 20 && !extractMutation.isPending;

  const onSubmit = async (data: Record<string, unknown>) => {
    try {
      const location = typeof data.location === "string" ? data.location.trim() : "";
      const base: Record<string, unknown> = {
        title: data.title,
        requirement: typeof data.requirement === "string" ? data.requirement : null,
        job_description: typeof data.job_description === "string" ? data.job_description : null,
        employment_type:
          typeof data.employment_type === "string" && data.employment_type
            ? data.employment_type
            : null,
        contract_duration_months:
          typeof data.contract_duration_months === "number" && !Number.isNaN(data.contract_duration_months)
            ? data.contract_duration_months
            : 0,
        salary_budget:
          data.salary_budget != null &&
          data.salary_budget !== "" &&
          !Number.isNaN(Number(data.salary_budget))
            ? Number(data.salary_budget)
            : null,
        location: location || null,
        client_user_names: Array.isArray(data.client_user_names)
          ? (data.client_user_names as string[])
          : [],
        is_active: typeof data.is_active === "boolean" ? data.is_active : true,
        ai_scoring_config: buildAiScoringConfig(data),
      };

      if (isCreating) {
        await onCreate({ ...base, client_id: data.client_id } as unknown as PositionCreateForm);
      } else if (position) {
        await onUpdate({ id: position.id, payload: base as unknown as PositionUpdateForm });
      }
    } catch {
      // Handled by onError callback of mutation
    }
  };

  // ── Shared form fields ──────────────────────────────────────────────────
  const formFields = (
    <div className="space-y-4">
      <div>
        <label className="block text-label-md text-on-surface mb-1.5">
          Klien <span className="text-error">*</span>
        </label>
        {isSelectableClient ? (
          <select
            {...register("client_id", {
              onChange: () => {
                // Reset selected PIC jika klien berganti
                setValue("client_user_names", [], { shouldDirty: true, shouldValidate: true });
              },
            })}
            className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
          >
            <option value="">Pilih Klien</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <select
            {...register("client_id")}
            disabled
            className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all disabled:opacity-50"
          >
            <option value={defaultClientId ?? position?.client_id ?? ""}>
              {position?.client_name ?? defaultClientName ?? defaultClientId}
            </option>
          </select>
        )}
        {errors.client_id && (
          <p className="text-error text-xs mt-1">{errors.client_id.message}</p>
        )}
      </div>

      <div>
        <label className="block text-label-md text-on-surface mb-1.5">
          Judul Posisi <span className="text-error">*</span>
        </label>
        <input
          type="text"
          placeholder="Senior Backend Engineer"
          {...register("title")}
          className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
        />
        {errors.title && (
          <p className="text-error text-xs mt-1">{errors.title.message}</p>
        )}
      </div>

      <div>
        <label className="block text-label-md text-on-surface mb-1.5">Tipe Pekerjaan</label>
        <select
          {...register("employment_type")}
          className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
        >
          <option value="">Pilih Tipe Pekerjaan</option>
          {agreementTypes.map((agreementType) => (
            <option key={agreementType.id} value={agreementType.label}>
              {agreementType.label}
            </option>
          ))}
        </select>
        {errors.employment_type && (
          <p className="text-error text-xs mt-1">{errors.employment_type.message}</p>
        )}
      </div>

      <div>
        <label className="block text-label-md text-on-surface mb-1.5">
          Durasi Kontrak (bulan)
        </label>
        <input
          type="number"
          placeholder="12"
          {...register("contract_duration_months", { valueAsNumber: true })}
          className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
        />
        {errors.contract_duration_months && (
          <p className="text-error text-xs mt-1">{errors.contract_duration_months.message}</p>
        )}
      </div>

      <div>
        <label className="block text-label-md text-on-surface mb-1.5">
          Budget Gaji Maksimal
          <span className="text-on-surface-variant font-normal ml-1">(opsional)</span>
        </label>
        <Controller
          name="salary_budget"
          control={control}
          render={({ field }) => (
            <RupiahInput
              value={field.value ?? undefined}
              onChange={(value) => field.onChange(value ?? null)}
              placeholder="15.000.000"
            />
          )}
        />
        {errors.salary_budget && (
          <p className="text-error text-xs mt-1">{errors.salary_budget.message}</p>
        )}
      </div>

      <div>
        <label className="block text-label-md text-on-surface mb-1.5">
          Lokasi / Kota Penempatan
          <span className="text-on-surface-variant font-normal ml-1">(opsional)</span>
        </label>
        <input
          type="text"
          placeholder="Jakarta"
          {...register("location")}
          className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
        />
        {errors.location && (
          <p className="text-error text-xs mt-1">{errors.location.message}</p>
        )}
      </div>

      <div>
        <label className="block text-label-md text-on-surface mb-1.5">
          PIC Klien Penanggung Jawab
          <span className="text-error ml-1">*</span>
        </label>
        {!selectedClientId ? (
          <div className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5">
            <p className="text-body-sm text-on-surface-variant">
              Silakan pilih klien terlebih dahulu untuk melihat daftar PIC.
            </p>
          </div>
        ) : isLoadingPics ? (
          <div className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 flex items-center gap-2">
            <span className="material-symbols-outlined animate-spin text-base text-primary">
              progress_activity
            </span>
            <p className="text-body-sm text-on-surface-variant">Memuat PIC klien...</p>
          </div>
        ) : activeClientPics.length === 0 ? (
          <div className="rounded-lg border border-error/30 bg-error-container px-3 py-2.5">
            <p className="text-body-sm text-on-error-container">
              Klien ini belum memiliki PIC. Tambahkan PIC pada master klien terlebih dahulu.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {picOptions.map(({ name, contact, isStale }) => {
              const selected = selectedPics.includes(name);
              return (
                <label
                  key={name}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-outline-variant bg-surface hover:border-primary/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="pic_klien_radio"
                    checked={selected}
                    onChange={() => {
                      setValue("client_user_names", [name], {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                    className="w-4 h-4 border-outline-variant text-primary focus:ring-primary cursor-pointer"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-body-sm text-on-surface">{name}</span>
                    {contact && (
                      <span className="block text-xs text-on-surface-variant">{contact}</span>
                    )}
                    {isStale && (
                      <span className="block text-xs text-warning">
                        PIC ini tidak lagi terdaftar di master klien — hapus pilihannya.
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        )}
        <p className="text-xs text-on-surface-variant mt-1">
          PIC diambil dari master klien dan wajib dipilih. PIC ini yang bertanggung jawab atas
          lamaran untuk posisi ini.
        </p>
        {errors.client_user_names && (
          <p className="text-error text-xs mt-1">{errors.client_user_names.message}</p>
        )}
      </div>

      <div>
        <label className="block text-label-md text-on-surface mb-1.5">Persyaratan</label>
        <textarea
          placeholder="Minimal S1 Teknik, pengalaman 3+ tahun dengan Node.js..."
          {...register("requirement")}
          rows={3}
          className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none"
        />
        {errors.requirement && (
          <p className="text-error text-xs mt-1">{errors.requirement.message}</p>
        )}
      </div>

      <div>
        <label className="block text-label-md text-on-surface mb-1.5">
          Deskripsi Pekerjaan
          <span className="text-on-surface-variant font-normal ml-1">(opsional)</span>
        </label>
        <textarea
          placeholder={"• Bertanggung jawab atas pengembangan fitur baru\n• Berkolaborasi dengan tim lintas fungsi\n• Melakukan code review dan menjaga kualitas kode"}
          {...register("job_description")}
          rows={5}
          className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none"
        />
        {errors.job_description && (
          <p className="text-error text-xs mt-1">{errors.job_description.message}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => extractMutation.mutate(extractSourceText)}
            disabled={!canExtract}
            className="inline-flex items-center gap-2 rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-label-md text-on-surface transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span
              className={`material-symbols-outlined text-base ${
                extractMutation.isPending ? "animate-spin" : ""
              }`}
            >
              {extractMutation.isPending ? "progress_activity" : "auto_awesome"}
            </span>
            {extractMutation.isPending
              ? "Mengekstrak..."
              : "Ekstrak Kriteria dari Deskripsi (AI)"}
          </button>
          <span className="text-xs text-on-surface-variant">
            Mengisi budget gaji, lokasi, skill wajib, dan minimal pengalaman dari teks lowongan.
          </span>
        </div>
      </div>

      {/* ── Konfigurasi AI Screening ─────────────────────────────────────── */}
      <div className="border-t border-outline-variant pt-4 mt-2">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-primary text-lg">tune</span>
          <h3 className="text-label-lg font-semibold text-on-surface">Konfigurasi AI Screening</h3>
        </div>

        {/* Required Skills */}
        <div className="mb-4">
          <label className="block text-label-sm text-on-surface mb-1">
            Skill yang Dibutuhkan
            <span className="text-on-surface-variant font-normal ml-1">(pisahkan dengan koma)</span>
          </label>
          <Controller
            name="ai_required_skills"
            control={control}
            render={({ field }) => (
              <TagInput
                value={field.value ?? []}
                onChange={field.onChange}
                placeholder="Python, SQL, React, AWS"
                ariaLabel="Skill yang dibutuhkan"
              />
            )}
          />
        </div>

        {/* Min Experience */}
        <div className="mb-4">
          <label className="block text-label-sm text-on-surface mb-1">
            Pengalaman Minimum (tahun)
          </label>
          <input
            type="number"
            min={0}
            {...register("ai_min_experience_years", { valueAsNumber: true })}
            className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
          />
        </div>

        {!isCreating && (
          <>
            {/* Thresholds */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-label-sm text-on-surface mb-1">
                  Threshold Otomatis (<span className="text-on-surface-variant">≥ skor ini = langsung terima</span>)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  {...register("ai_threshold_auto", { valueAsNumber: true })}
                  className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-label-sm text-on-surface mb-1">
                  Threshold Review (<span className="text-on-surface-variant">skor di antara = perlu review</span>)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  {...register("ai_threshold_manual", { valueAsNumber: true })}
                  className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>

            {/* Weights */}
            <div className="space-y-3 mb-4">
              <label className="block text-label-sm text-on-surface">
                Bobot Penilaian AI (<span className="text-on-surface-variant">total harus 100%</span>)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-on-surface-variant block mb-1">Pendidikan (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    {...register("ai_weight_education", { valueAsNumber: true })}
                    className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div>
                  <span className="text-xs text-on-surface-variant block mb-1">Pengalaman (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    {...register("ai_weight_experience", { valueAsNumber: true })}
                    className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div>
                  <span className="text-xs text-on-surface-variant block mb-1">Skill Match (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    {...register("ai_weight_skill", { valueAsNumber: true })}
                    className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div>
                  <span className="text-xs text-on-surface-variant block mb-1">Domain Relevance (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    {...register("ai_weight_domain", { valueAsNumber: true })}
                    className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>
              {errors.ai_weight_education && (
                <p className="text-error text-xs mt-1">{errors.ai_weight_education.message}</p>
              )}
            </div>
          </>
        )}
      </div>

      {!isCreating && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_active"
            {...register("is_active")}
            className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary cursor-pointer"
          />
          <label htmlFor="is_active" className="text-body-sm text-on-surface cursor-pointer">
            Posisi aktif
          </label>
        </div>
      )}
    </div>
  );

  const formId = isCreating ? "position-create-form" : "position-edit-form";

  // ── Action buttons ───
  const actionButtons = (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={onClose}
        disabled={isSubmitting}
        className="flex-1 px-4 py-2 bg-surface-container border border-outline-variant text-on-surface rounded-lg font-medium hover:bg-surface-container-highest transition-colors disabled:opacity-50"
      >
        Batal
      </button>
      <button
        type="submit"
        form={formId}
        disabled={isSubmitting}
        className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-80 disabled:cursor-wait"
      >
        {isSubmitting ? (
          <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
        ) : (
          <span className="material-symbols-outlined text-lg">{isCreating ? "add" : "save"}</span>
        )}
        {isSubmitting ? "Menyimpan..." : isCreating ? "Tambah" : "Simpan"}
      </button>
    </div>
  );

  // ── Create: centered modal (short form) ─────────────────────────────────
  if (isCreating) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col shadow-xl">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 shrink-0">
            <h2 className="text-headline-md font-semibold text-on-surface">Tambah Posisi Baru</h2>
          </div>
          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 pb-2">
            <form id={formId} onSubmit={handleSubmit(onSubmit)}>
              {formFields}
            </form>
          </div>
          {/* Sticky footer */}
          <div className="px-6 py-4 border-t border-outline-variant shrink-0">{actionButtons}</div>
        </div>
      </div>
    );
  }

  // ── Edit: right slide-over drawer ────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop — click to close */}
      <div
        className="flex-1 bg-black/40"
        onClick={!isSubmitting ? onClose : undefined}
      />
      {/* Drawer panel */}
      <div className="w-full max-w-lg bg-surface-container-lowest h-full flex flex-col shadow-2xl">
        {/* Sticky header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant shrink-0 bg-surface-container-lowest">
          <div className="min-w-0">
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-0.5">
              Edit Posisi
            </p>
            <h2 className="text-headline-sm font-semibold text-on-surface truncate">
              {position?.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="ml-4 p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors disabled:opacity-50 shrink-0"
            title="Tutup"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form id={formId} onSubmit={handleSubmit(onSubmit)}>
            {formFields}
          </form>
        </div>

        {/* Sticky footer */}
        <div className="px-6 py-4 border-t border-outline-variant shrink-0 bg-surface-container-lowest">
          {actionButtons}
        </div>
      </div>
    </div>
  );
}
