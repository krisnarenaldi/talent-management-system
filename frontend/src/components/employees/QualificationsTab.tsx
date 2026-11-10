"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useToastStore } from "@/stores/toast.store";
import { getErrorMessage } from "@/lib/errors";
import TagInput from "@/components/shared/TagInput";
import type { CandidateEducation, CandidateExperience } from "@/types";

interface EducationItem {
  id?: string;
  institution: string;
  major: string;
  graduation_year: string;
  gpa: string;
}

interface ExperienceItem {
  id?: string;
  company_name: string;
  job_title: string;
  start_date: string;
  end_date: string;
  description: string;
  tools: string[];
}

export default function QualificationsTab({
  candidateId,
  initialSkills = [],
}: {
  candidateId: string;
  initialSkills?: string[];
}) {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.showToast);

  // ── Skills state ──
  const [skills, setSkills] = useState<string[]>(initialSkills);
  const [skillInput, setSkillInput] = useState("");
  const skillInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSkills(initialSkills);
  }, [initialSkills]);

  // ── Fetch educations & experiences from candidate endpoints ──
  const { data: initialEducations = [], isLoading: isLoadingEdu } = useQuery<CandidateEducation[]>({
    queryKey: ["candidate-education", candidateId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/candidates/${candidateId}/education/`);
      return res.data;
    },
  });

  const { data: initialExperiences = [], isLoading: isLoadingExp } = useQuery<CandidateExperience[]>({
    queryKey: ["candidate-experience", candidateId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/candidates/${candidateId}/experience/`);
      return res.data;
    },
  });

  // Local form states
  const [educations, setEducations] = useState<EducationItem[]>([]);
  const [experiences, setExperiences] = useState<ExperienceItem[]>([]);

  useEffect(() => {
    if (initialEducations.length > 0) {
      setEducations(
        initialEducations.map((e) => ({
          id: e.id,
          institution: e.institution || "",
          major: e.major || "",
          graduation_year: e.graduation_year ? String(e.graduation_year) : "",
          gpa: e.gpa !== undefined && e.gpa !== null ? String(e.gpa) : "",
        }))
      );
    } else {
      setEducations([]);
    }
  }, [initialEducations]);

  useEffect(() => {
    if (initialExperiences.length > 0) {
      setExperiences(
        initialExperiences.map((e) => ({
          id: e.id,
          company_name: e.company_name || "",
          job_title: e.job_title || "",
          start_date: e.start_date || "",
          end_date: e.end_date || "",
          description: e.description || "",
          tools: e.tools || [],
        }))
      );
    } else {
      setExperiences([]);
    }
  }, [initialExperiences]);

  // ── Save Mutation ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      // 1. Update candidate skills
      await api.put(`/api/v1/candidates/${candidateId}`, { skills });

      // 2. Sync Educations
      const existingEduIds = new Set(initialEducations.map((e) => e.id));
      const currentEduIds = new Set(educations.filter((e) => e.id).map((e) => e.id));

      // Delete removed educations
      for (const oldEdu of initialEducations) {
        if (!currentEduIds.has(oldEdu.id)) {
          await api.delete(`/api/v1/candidates/${candidateId}/education/${oldEdu.id}`);
        }
      }

      // Add or Update educations
      for (const edu of educations) {
        if (!edu.institution && !edu.major && !edu.graduation_year) continue;
        const payload = {
          institution: edu.institution.trim() || null,
          major: edu.major.trim() || null,
          graduation_year: edu.graduation_year ? Number(edu.graduation_year) : null,
          gpa: edu.gpa ? Number(edu.gpa) : null,
        };
        if (!edu.id) {
          await api.post(`/api/v1/candidates/${candidateId}/education`, payload);
        } else if (existingEduIds.has(edu.id)) {
          await api.put(`/api/v1/candidates/${candidateId}/education/${edu.id}`, payload);
        }
      }

      // 3. Sync Experiences
      const existingExpIds = new Set(initialExperiences.map((e) => e.id));
      const currentExpIds = new Set(experiences.filter((e) => e.id).map((e) => e.id));

      // Delete removed experiences
      for (const oldExp of initialExperiences) {
        if (!currentExpIds.has(oldExp.id)) {
          await api.delete(`/api/v1/candidates/${candidateId}/experience/${oldExp.id}`);
        }
      }

      // Add or Update experiences
      for (const exp of experiences) {
        if (!exp.company_name && !exp.job_title && !exp.start_date && !exp.end_date && !exp.description) continue;
        const payload = {
          company_name: exp.company_name.trim() || null,
          job_title: exp.job_title.trim() || null,
          start_date: exp.start_date || null,
          end_date: exp.end_date || null,
          description: exp.description.trim() || null,
          tools: exp.tools && exp.tools.length > 0 ? exp.tools : null,
        };
        if (!exp.id) {
          await api.post(`/api/v1/candidates/${candidateId}/experience`, payload);
        } else if (existingExpIds.has(exp.id)) {
          await api.put(`/api/v1/candidates/${candidateId}/experience/${exp.id}`, payload);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate-education", candidateId] });
      queryClient.invalidateQueries({ queryKey: ["candidate-experience", candidateId] });
      queryClient.invalidateQueries({ queryKey: ["employee"] });
      queryClient.invalidateQueries({ queryKey: ["candidate", candidateId] });
      showToast("success", "Kualifikasi, skill, dan pengalaman kerja berhasil disimpan.");
    },
    onError: (err: unknown) => {
      showToast("error", getErrorMessage(err, "Gagal menyimpan kualifikasi."));
    },
  });

  // ── Handlers for Skills ──
  const addSkill = (val: string) => {
    const trimmed = val.trim().replace(/,$/, "");
    if (trimmed && !skills.includes(trimmed)) {
      setSkills((prev) => [...prev, trimmed]);
    }
    setSkillInput("");
  };

  const removeSkill = (index: number) => {
    setSkills((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Handlers for Education ──
  const appendEducation = () => {
    setEducations((prev) => [
      ...prev,
      { institution: "", major: "", graduation_year: "", gpa: "" },
    ]);
  };

  const updateEducationField = (index: number, field: keyof EducationItem, value: string) => {
    setEducations((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeEducation = (index: number) => {
    setEducations((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Handlers for Experience ──
  const appendExperience = () => {
    setExperiences((prev) => [
      ...prev,
      { company_name: "", job_title: "", start_date: "", end_date: "", description: "", tools: [] },
    ]);
  };

  const updateExperienceField = <K extends keyof ExperienceItem>(index: number, field: K, value: ExperienceItem[K]) => {
    setExperiences((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeExperience = (index: number) => {
    setExperiences((prev) => prev.filter((_, i) => i !== index));
  };

  const isLoading = isLoadingEdu || isLoadingExp;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
        Memuat data kualifikasi, skill, dan pengalaman...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── SKILL SECTION ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-gray-900">Skill</h2>
        <p className="mb-4 text-xs text-gray-500">
          Ketik skill lalu tekan <kbd className="rounded border border-gray-300 bg-gray-100 px-1 py-0.5 font-mono text-xs">Enter</kbd> atau <kbd className="rounded border border-gray-300 bg-gray-100 px-1 py-0.5 font-mono text-xs">,</kbd> untuk menambah.
        </p>
        <div
          className="flex min-h-[42px] flex-wrap gap-2 rounded-lg border border-gray-300 px-3 py-2 cursor-text"
          onClick={() => skillInputRef.current?.focus()}
        >
          {skills.map((skill, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800"
            >
              {skill}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeSkill(index);
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
                addSkill(skillInput);
              } else if (e.key === "Backspace" && skillInput === "") {
                if (skills.length > 0) {
                  removeSkill(skills.length - 1);
                }
              }
            }}
            onBlur={() => {
              if (skillInput.trim()) {
                addSkill(skillInput);
              }
            }}
            className="flex-1 min-w-[120px] border-none bg-transparent text-sm outline-none placeholder:text-gray-400"
            placeholder={skills.length === 0 ? "Contoh: JavaScript, Python, PostgreSQL..." : "Tambah skill..."}
          />
        </div>
      </div>

      {/* ── PENDIDIKAN SECTION ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Pendidikan</h2>
            <p className="text-xs text-gray-500">Riwayat pendidikan formal karyawan</p>
          </div>
          <button
            type="button"
            onClick={appendEducation}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            + Tambah Pendidikan
          </button>
        </div>

        {educations.length === 0 ? (
          <p className="text-sm text-gray-400">Belum ada data pendidikan.</p>
        ) : (
          <div className="space-y-4">
            {educations.map((item, index) => (
              <div key={item.id ?? `edu-${index}`} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Pendidikan {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeEducation(index)}
                    className="text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    Hapus
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Institusi</label>
                    <input
                      type="text"
                      value={item.institution}
                      onChange={(e) => updateEducationField(index, "institution", e.target.value)}
                      placeholder="Contoh: Universitas Indonesia"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Jurusan</label>
                    <input
                      type="text"
                      value={item.major}
                      onChange={(e) => updateEducationField(index, "major", e.target.value)}
                      placeholder="Contoh: Teknik Informatika"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Tahun Lulus</label>
                    <input
                      type="number"
                      value={item.graduation_year}
                      onChange={(e) => updateEducationField(index, "graduation_year", e.target.value)}
                      placeholder="Contoh: 2022"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">IPK</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.gpa}
                      onChange={(e) => updateEducationField(index, "gpa", e.target.value)}
                      placeholder="Contoh: 3.75"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── PENGALAMAN KERJA SECTION ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Pengalaman Kerja</h2>
            <p className="text-xs text-gray-500">Riwayat pengalaman kerja & proyek karyawan</p>
          </div>
          <button
            type="button"
            onClick={appendExperience}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            + Tambah Pengalaman
          </button>
        </div>

        {experiences.length === 0 ? (
          <p className="text-sm text-gray-400">Belum ada riwayat pengalaman kerja.</p>
        ) : (
          <div className="space-y-4">
            {experiences.map((item, index) => (
              <div key={item.id ?? `exp-${index}`} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Pengalaman {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeExperience(index)}
                    className="text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    Hapus
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Nama Perusahaan / Proyek</label>
                    <input
                      type="text"
                      value={item.company_name}
                      onChange={(e) => updateExperienceField(index, "company_name", e.target.value)}
                      placeholder="Nama perusahaan"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Posisi / Role</label>
                    <input
                      type="text"
                      value={item.job_title}
                      onChange={(e) => updateExperienceField(index, "job_title", e.target.value)}
                      placeholder="Contoh: Senior Full Stack Engineer"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Tanggal Mulai</label>
                    <input
                      type="date"
                      value={item.start_date}
                      onChange={(e) => updateExperienceField(index, "start_date", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Tanggal Selesai <span className="font-normal text-gray-400">(kosongkan jika masih bekerja)</span>
                    </label>
                    <input
                      type="date"
                      value={item.end_date}
                      onChange={(e) => updateExperienceField(index, "end_date", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700">Deskripsi Pekerjaan / Kontribusi</label>
                    <textarea
                      rows={3}
                      value={item.description}
                      onChange={(e) => updateExperienceField(index, "description", e.target.value)}
                      placeholder="Ringkasan tanggung jawab dan pencapaian..."
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700">Tools & Teknologi Digunakan</label>
                    <p className="mb-1.5 text-xs text-gray-500">
                      Ketik tool lalu tekan <kbd className="rounded border border-gray-300 bg-gray-100 px-1 py-0.5 font-mono text-xs">Enter</kbd> atau <kbd className="rounded border border-gray-300 bg-gray-100 px-1 py-0.5 font-mono text-xs">,</kbd> untuk menambah.
                    </p>
                    <TagInput
                      value={item.tools ?? []}
                      onChange={(tags) => updateExperienceField(index, "tools", tags)}
                      placeholder="Contoh: React, Docker, PostgreSQL..."
                      ariaLabel={`Tools untuk pengalaman ${index + 1}`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── SUBMIT BUTTON ── */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:opacity-60"
        >
          {saveMutation.isPending ? "Menyimpan..." : "Simpan Kualifikasi & Skill"}
        </button>
      </div>
    </div>
  );
}
