"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import type { AIScreeningResult } from "@/types";

interface AIExtractionReviewProps {
  screening: AIScreeningResult;
}

type ActionKind = "accept" | "review" | "save_only" | "force_process";

function parseExtractedData(raw: any): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      let parsed = JSON.parse(raw);
      // Handle double-encoded JSON (string inside string)
      if (typeof parsed === "string") {
        parsed = JSON.parse(parsed);
      }
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? raw : {};
}

export default function AIExtractionReview({ screening }: AIExtractionReviewProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [applying, setApplying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  // Cooldown confirmation state — set when backend returns 400 cooldown during application creation
  const [cooldownPending, setCooldownPending] = useState<{ kind: ActionKind; candidateId: string } | null>(null);
  const [cooldownMessage, setCooldownMessage] = useState<string>("");
  // Blacklist confirmation state — set when created/found candidate is blacklisted
  const [blacklistPending, setBlacklistPending] = useState<{ kind: ActionKind; candidateId: string } | null>(null);

  const parsedJson = parseExtractedData(screening.extracted_json);

  // Form fields pre-filled from extracted_json
  const [fullName, setFullName] = useState<string>(() => {
    const ej = parsedJson;
    return typeof ej.nama === "string" ? ej.nama :
           typeof ej.name === "string" ? ej.name :
           "";
  });
  const [email, setEmail] = useState<string>(() => {
    const ej = parsedJson;
    return typeof ej.email === "string" ? ej.email :
           typeof ej.kontak?.email === "string" ? ej.kontak.email :
           "";
  });
  const [phone, setPhone] = useState<string>(() => {
    const ej = parsedJson;
    return typeof ej.telepon === "string" ? ej.telepon :
           typeof ej.kontak?.telepon === "string" ? ej.kontak.telepon :
           typeof ej.phone === "string" ? ej.phone :
           "";
  });
  const [skills, setSkills] = useState<string[]>(() => {
    const ej = parsedJson;
    return Array.isArray(ej.skills) ? ej.skills : [];
  });
  const [education, setEducation] = useState<Array<{institution?: string; major?: string; graduation_year?: number | null; gpa?: number | null}>>(() => {
    const ej = parsedJson;
    if (!Array.isArray(ej.pendidikan)) return [];
    return ej.pendidikan.map((ed: any) => ({
      institution: ed.institution ?? ed.institusi ?? "",
      major: ed.major ?? ed.jurusan ?? "",
      graduation_year: ed.graduation_year ?? ed.tahun_lulus ?? null,
      gpa: ed.gpa ?? null,
    }));
  });
  const [experience, setExperience] = useState<Array<{company_name?: string; job_title?: string; start_date?: string | null; end_date?: string | null; description?: string | null}>>(() => {
    const ej = parsedJson;
    if (!Array.isArray(ej.pengalaman_kerja)) return [];
    return ej.pengalaman_kerja.map((exp: any) => ({
      company_name: exp.company_name ?? exp.perusahaan ?? "",
      job_title: exp.job_title ?? exp.jabatan ?? exp.posisi ?? "",
      start_date: exp.start_date ?? exp.tanggal_mulai ?? exp.mulai ?? null,
      end_date: exp.end_date ?? exp.tanggal_selesai ?? exp.selesai ?? null,
      description: exp.description ?? exp.deskripsi ?? null,
    }));
  });
  const [notes, setNotes] = useState("");

  // Auto-apply AI extraction when screening data loads (handles initial null → data transition)
  useEffect(() => {
    if (screening.extracted_json) applyAI();
  }, [screening.extracted_json]);

  const thresholds = getThresholds(screening);

  function getThresholds(screening: AIScreeningResult) {
    const ej = parseExtractedData(screening.extracted_json);
    const config = ej._ai_scoring_config as Record<string, unknown> | undefined;
    return {
      high: typeof config?.threshold_auto_recommend === "number" ? config.threshold_auto_recommend : 80,
      low: typeof config?.threshold_manual_review === "number" ? config.threshold_manual_review : 60,
    };
  }

  function getScoreBadge(score: number | null | undefined) {
    if (score === null || score === undefined) return { label: "-", className: "bg-gray-100 text-gray-800" };
    if (score >= thresholds.high) return { label: `${score} — Tinggi`, className: "bg-emerald-100 text-emerald-800" };
    if (score >= thresholds.low) return { label: `${score} — Menengah`, className: "bg-amber-100 text-amber-800" };
    return { label: `${score} — Rendah`, className: "bg-red-100 text-red-800" };
  }

  async function applyAI() {
    const ej = parseExtractedData(screening.extracted_json);
    if (!ej || Object.keys(ej).length === 0) return;
    setApplying(true);
    try {
      setFullName(
        typeof ej.nama === "string" ? ej.nama :
        typeof ej.name === "string" ? ej.name : fullName
      );
      setEmail(
        typeof ej.email === "string" ? ej.email :
        typeof ej.kontak?.email === "string" ? ej.kontak.email : email
      );
      setPhone(
        typeof ej.telepon === "string" ? ej.telepon :
        typeof ej.kontak?.telepon === "string" ? ej.kontak.telepon :
        typeof ej.phone === "string" ? ej.phone : phone
      );
      if (Array.isArray(ej.skills)) setSkills(ej.skills as string[]);
      if (Array.isArray(ej.pendidikan)) setEducation(
        ej.pendidikan.map((ed: any) => ({
          institution: ed.institution ?? ed.institusi ?? "",
          major: ed.major ?? ed.jurusan ?? "",
          graduation_year: ed.graduation_year ?? ed.tahun_lulus ?? null,
          gpa: ed.gpa ?? null,
        }))
      );
      if (Array.isArray(ej.pengalaman_kerja)) setExperience(
        ej.pengalaman_kerja.map((exp: any) => ({
          company_name: exp.company_name ?? exp.perusahaan ?? "",
          job_title: exp.job_title ?? exp.jabatan ?? exp.posisi ?? "",
          start_date: exp.start_date ?? exp.tanggal_mulai ?? exp.mulai ?? null,
          end_date: exp.end_date ?? exp.tanggal_selesai ?? exp.selesai ?? null,
          description: exp.description ?? exp.deskripsi ?? null,
        }))
      );
    } finally {
      setApplying(false);
    }
  }

  /** Returns ISO string if parseable, null otherwise. Handles "Present", "August 2021", etc. */
  function toISODateOrNull(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === "present" || trimmed.toLowerCase() === "sekarang") return null;
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  async function handleSubmit(kind: ActionKind) {
    setSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    if (!fullName.trim()) {
      setActionError("Nama tidak boleh kosong");
      setSubmitting(false);
      return;
    }
    if (!email.trim()) {
      setActionError("Email tidak boleh kosong");
      setSubmitting(false);
      return;
    }
    if (!phone.trim()) {
      setActionError("Telepon tidak boleh kosong");
      setSubmitting(false);
      return;
    }

    try {
      // 1. Create candidate from form data
      const candidatePayload = {
        full_name: fullName,
        email: email || null,
        phone: phone || null,
        skills: skills.length > 0 ? skills : undefined,
        notes: notes || null,
      };
      // 409 = kandidat sudah ada → ambil ID dari detail, lanjut tanpa error
      const candidateRes = await api.post("/api/v1/candidates", candidatePayload).catch(async (err: any) => {
        if (err?.response?.status === 409) {
          const detail: string = err.response.data?.detail ?? "";
          const match = detail.match(/ID:\s*([a-f0-9-]+)/i);
          if (match) {
            // Fetch the existing candidate so we get their blacklist status
            const existing = await api.get(`/api/v1/candidates/${match[1]}`).catch(() => null);
            // Return in the same shape as a new-candidate response so downstream code works
            return { data: { id: match[1], is_blacklisted: existing?.data?.is_blacklisted ?? false } };
          }
        }
        throw err;
      });
      // Sukses → data.candidate.id; duplikat → data.id
      const candidateId: string = candidateRes.data?.candidate?.id ?? candidateRes.data?.id;
      if (!candidateId) throw new Error("Gagal mendapatkan ID kandidat");

      // 2. Save education if any (skip jika kandidat duplikat — data sudah ada)
      const isDuplicateCandidate = !candidateRes.data?.candidate;
      if (!isDuplicateCandidate) {
        for (let i = 0; i < education.length; i++) {
          const ed = education[i];
          if (ed.institution || ed.major) {
            await api.post("/api/v1/candidates/" + candidateId + "/education", {
              institution: ed.institution || null,
              major: ed.major || null,
              graduation_year: ed.graduation_year || null,
              gpa: i === 0 ? (ed.gpa || null) : null,
            });
          }
        }

        // 3. Save experience if any
        for (const exp of experience) {
          if (exp.company_name || exp.job_title) {
            await api.post("/api/v1/candidates/" + candidateId + "/experience", {
              company_name: exp.company_name || null,
              job_title: exp.job_title || null,
              start_date: toISODateOrNull(exp.start_date),
              end_date: toISODateOrNull(exp.end_date),
              description: exp.description || null,
            });
          }
        }
      }

      // 3b. Blacklist check — after saving candidate data, confirm before creating application
      // NOTE: force_process juga harus melewati modal konfirmasi — tidak boleh skip otomatis.
      const isBlacklisted: boolean = candidateRes.data?.is_blacklisted === true;
      if (isBlacklisted && kind !== "save_only") {
        setBlacklistPending({ kind, candidateId });
        const handled = new Error("__blacklist_handled__");
        (handled as any).__blacklist_handled__ = true;
        throw handled;
      }

      // 4. Create application if action is accept/review/force_process
      // 409 = lamaran aktif sudah ada → ambil ID existing, lanjut tanpa error
      let applicationId: string | null = null;
      if (kind !== "save_only") {
        const appPayload: Record<string, string | boolean | null> = {
          candidate_id: candidateId,
          position_id: screening.position_id,
          recruiter_id: user?.id ?? null,
        };
        if (kind === "accept") appPayload.current_stage = "Interview_HR";
        else if (kind === "review") appPayload.current_stage = "Dijadwalkan_Interview";
        else appPayload.current_stage = "Dijadwalkan_Interview";

        // CATATAN: force_cooldown dan force_blacklisted TIDAK di-set di sini untuk force_process.
        // Kedua flag ini hanya boleh dikirim setelah HR mengkonfirmasi lewat modal,
        // yaitu melalui handleForceCooldown() / handleForceBlacklist() → handleSubmitWithCandidateId().
        // Tanpa ini, tombol "Tetap Proses" akan bypass cooldown/blacklist check tanpa konfirmasi HR.

        const appRes = await api.post("/api/v1/applications", appPayload).catch((err: any) => {
          if (err?.response?.status === 409) {
            const detail: string = err.response.data?.detail ?? "";
            const match = detail.match(/ID:\s*([a-f0-9-]+)/i);
            if (match) return { data: { id: match[1] } };
          }
          // 400 errors → intercept untuk semua action (termasuk force_process) agar modal konfirmasi muncul
          if (err?.response?.status === 400) {
            const detail: string = err.response?.data?.detail ?? "";
            if (detail.includes("pernah ditolak")) {
              setCooldownMessage(detail);
              setCooldownPending({ kind, candidateId });
              // Signal to outer catch that this was handled
              const handled = new Error("__cooldown_handled__");
              (handled as any).__cooldown_handled__ = true;
              throw handled;
            }
            if (detail.includes("blacklist")) {
              setBlacklistPending({ kind, candidateId });
              const handled = new Error("__blacklist_handled__");
              (handled as any).__blacklist_handled__ = true;
              throw handled;
            }
          }
          throw err;
        });
        applicationId = appRes.data.id;
      }

      // 5. Update screening result status to sudah_direview
      await api.patch(`/api/v1/applications/screening/${screening.id}/review`, {
        status: "sudah_direview",
        reviewed_by: user?.id ?? null,
        candidate_id: candidateId,
        application_id: applicationId,
        notes: notes || null,
      });

      // 6. Mark related notifications as read
      await api.patch("/api/v1/notifications/read-all", {}).catch(() => {});

      setActionSuccess(
        kind === "save_only"
          ? "Kandidat berhasil disimpan"
          : kind === "accept"
          ? "Lamaran berhasil dibuat & diterima"
          : kind === "force_process"
          ? "Proses tetap dilanjutkan"
          : "Lamaran berhasil dibuat untuk review"
      );
      if (applicationId) {
        router.push(`/applications/${applicationId}`);
      } else {
        router.push("/applications/pending-review");
      }
    } catch (err: any) {
      // Cooldown / blacklist was already handled via modal — skip setting actionError
      if ((err as any).__cooldown_handled__ || (err as any).__blacklist_handled__) {
        setSubmitting(false);
        return;
      }
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : (err instanceof Error ? err.message : "Terjadi kesalahan");
      setActionError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  /** Called when HR confirms to override the cooldown restriction. */
  async function handleForceCooldown() {
    if (!cooldownPending) return;
    const { kind, candidateId } = cooldownPending;
    setCooldownPending(null);
    setCooldownMessage("");
    await handleSubmitWithCandidateId(kind, candidateId, true, false);
  }

  /** Called when HR confirms to process a blacklisted candidate anyway. */
  async function handleForceBlacklist() {
    if (!blacklistPending) return;
    const { kind, candidateId } = blacklistPending;
    setBlacklistPending(null);
    await handleSubmitWithCandidateId(kind, candidateId, false, true);
  }

  /**
   * Inner submit that accepts a pre-resolved candidateId and optional force flags.
   * Used by handleForceCooldown / handleForceBlacklist to skip candidate-creation step.
   */
  async function handleSubmitWithCandidateId(
    kind: ActionKind,
    candidateId: string,
    forceCooldown: boolean,
    forceBlacklisted: boolean,
  ) {
    setSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const appPayload: Record<string, string | boolean | null> = {
        candidate_id: candidateId,
        position_id: screening.position_id,
        recruiter_id: user?.id ?? null,
        force_cooldown: forceCooldown,
        force_blacklisted: forceBlacklisted || forceCooldown,
      };
      if (kind === "accept") appPayload.current_stage = "Interview_HR";
      else appPayload.current_stage = "Dijadwalkan_Interview";

      const appRes = await api.post("/api/v1/applications", appPayload).catch((err: any) => {
        if (err?.response?.status === 409) {
          const detail: string = err.response.data?.detail ?? "";
          const match = detail.match(/ID:\s*([a-f0-9-]+)/i);
          if (match) return { data: { id: match[1] } };
        }
        throw err;
      });
      const applicationId: string = appRes.data.id;

      await api.patch(`/api/v1/applications/screening/${screening.id}/review`, {
        status: "sudah_direview",
        reviewed_by: user?.id ?? null,
        candidate_id: candidateId,
        application_id: applicationId,
        notes: notes || null,
      });
      await api.patch("/api/v1/notifications/read-all", {}).catch(() => {});

      setActionSuccess(forceCooldown ? "Proses tetap dilanjutkan (cooldown diabaikan)" : "Lamaran berhasil dibuat");
      router.push(`/applications/${applicationId}`);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : (err instanceof Error ? err.message : "Terjadi kesalahan");
      setActionError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const scoreBadge = getScoreBadge(screening.ai_score);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT PANEL — AI Extraction Results */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">smart_toy</span>
          <h2 className="text-lg font-semibold">Hasil Ekstraksi AI</h2>
        </div>

        {/* Score Card */}
        <div className="border border-outline-variant rounded-xl p-4 bg-surface">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-on-surface">AI Score</span>
            <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${scoreBadge.className}`}>
              {scoreBadge.label}
            </span>
          </div>
          {screening.ai_notes && (
            <div className="mt-3 pt-3 border-t border-outline-variant">
              <p className="text-xs font-medium text-on-surface-variant mb-1">Catatan AI</p>
              <p className="text-sm italic text-on-surface-variant">{screening.ai_notes}</p>
            </div>
          )}
        </div>

        {/* Extracted JSON Read-Only */}
        <div className="border border-outline-variant rounded-xl p-4 bg-surface">
          <p className="text-sm font-medium text-on-surface mb-3">Data yang diekstrak</p>
          <pre className="text-xs bg-surface-container-highest p-3 rounded overflow-auto max-h-96 text-on-surface">
            {JSON.stringify(parsedJson, null, 2)}
          </pre>
        </div>

        {/* CV File Link */}
        {screening.cv_file_url && (
          <a
            href={screening.cv_file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:text-primary-dark"
          >
            <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
            Lihat CV Asli
          </a>
        )}
      </div>

      {/* RIGHT PANEL — Editable Candidate Form */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary">person_edit</span>
            <h2 className="text-lg font-semibold">Form Kandidat</h2>
          </div>
          <button
            onClick={applyAI}
            disabled={applying}
            className="text-xs font-medium text-primary hover:text-primary-dark disabled:opacity-50"
          >
            {applying ? "Memproses..." : "Terapkan Hasil AI"}
          </button>
        </div>

        <div className="border border-outline-variant rounded-xl p-4 bg-surface space-y-4">
          {/* Nama */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Nama Lengkap</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full rounded-lg border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Nama kandidat"
            />
          </div>

          {/* Kontak */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">Telepon</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full rounded-lg border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="+62 xxx xxxx xxxx"
              />
            </div>
          </div>

          {/* Skills */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Skill</label>
            <input
              type="text"
              value={skills.join(", ")}
              onChange={(e) => setSkills(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
              className="w-full rounded-lg border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Python, React, SQL (pisahkan koma)"
            />
          </div>

          {/* Pendidikan */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Pendidikan</label>
            <div className="space-y-2">
              {education.map((ed, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 text-sm">
                  <input
                    placeholder="Institusi"
                    value={ed.institution || ""}
                    onChange={(e) => {
                      const next = [...education];
                      next[i] = { ...next[i], institution: e.target.value };
                      setEducation(next);
                    }}
                    className="rounded-lg border border-outline bg-surface-container-lowest px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    placeholder="Jurusan"
                    value={ed.major || ""}
                    onChange={(e) => {
                      const next = [...education];
                      next[i] = { ...next[i], major: e.target.value };
                      setEducation(next);
                    }}
                    className="rounded-lg border border-outline bg-surface-container-lowest px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    placeholder="Tahun lulus"
                    type="number"
                    value={ed.graduation_year || ""}
                    onChange={(e) => {
                      const next = [...education];
                      next[i] = { ...next[i], graduation_year: e.target.value ? Number(e.target.value) : null };
                      setEducation(next);
                    }}
                    className="rounded-lg border border-outline bg-surface-container-lowest px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {i === 0 && (
                    <input
                      placeholder="IPK"
                      type="number"
                      step="0.01"
                      value={ed.gpa || ""}
                      onChange={(e) => {
                        const next = [...education];
                        next[i] = { ...next[i], gpa: e.target.value ? Number(e.target.value) : null };
                        setEducation(next);
                      }}
                      className="rounded-lg border border-outline bg-surface-container-lowest px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  )}
                </div>
              ))}
              <button
                onClick={() => setEducation([...education, { institution: "", major: "" }])}
                className="text-xs text-primary hover:text-primary-dark"
              >
                + Tambah pendidikan
              </button>
            </div>
          </div>

          {/* Pengalaman */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Pengalaman Kerja</label>
            <div className="space-y-2">
              {experience.map((exp, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 text-sm">
                  <input
                    placeholder="Perusahaan"
                    value={exp.company_name || ""}
                    onChange={(e) => {
                      const next = [...experience];
                      next[i] = { ...next[i], company_name: e.target.value };
                      setExperience(next);
                    }}
                    className="rounded-lg border border-outline bg-surface-container-lowest px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    placeholder="Jabatan"
                    value={exp.job_title || ""}
                    onChange={(e) => {
                      const next = [...experience];
                      next[i] = { ...next[i], job_title: e.target.value };
                      setExperience(next);
                    }}
                    className="rounded-lg border border-outline bg-surface-container-lowest px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    placeholder="Mulai"
                    type="date"
                    value={exp.start_date || ""}
                    onChange={(e) => {
                      const next = [...experience];
                      next[i] = { ...next[i], start_date: e.target.value || null };
                      setExperience(next);
                    }}
                    className="rounded-lg border border-outline bg-surface-container-lowest px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    placeholder="Selesai"
                    type="date"
                    value={exp.end_date || ""}
                    onChange={(e) => {
                      const next = [...experience];
                      next[i] = { ...next[i], end_date: e.target.value || null };
                      setExperience(next);
                    }}
                    className="rounded-lg border border-outline bg-surface-container-lowest px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="col-span-2">
                    <textarea
                      placeholder="Deskripsi"
                      value={exp.description || ""}
                      onChange={(e) => {
                        const next = [...experience];
                        next[i] = { ...next[i], description: e.target.value };
                        setExperience(next);
                      }}
                      rows={2}
                      className="w-full rounded-lg border border-outline bg-surface-container-lowest px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              ))}
              <button
                onClick={() => setExperience([...experience, { company_name: "", job_title: "" }])}
                className="text-xs text-primary hover:text-primary-dark"
              >
                + Tambah pengalaman
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Catatan HR</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Catatan tambahan untuk kandidat ini..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {actionError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{actionError}</p>
          )}
          {actionSuccess && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{actionSuccess}</p>
          )}

          {/* High score actions */}
          {screening.ai_score !== null && screening.ai_score! >= thresholds.high && (
            <button
              onClick={() => handleSubmit("accept")}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">thumb_up</span>
              Terima & Buat Lamaran
            </button>
          )}

          {/* Medium score action */}
          {screening.ai_score !== null && screening.ai_score! >= thresholds.low && screening.ai_score! < thresholds.high && (
            <button
              onClick={() => handleSubmit("review")}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">rate_review</span>
              Review & Buat Lamaran
            </button>
          )}

          {/* Low score actions */}
          {screening.ai_score !== null && screening.ai_score! < thresholds.low && (
            <>
              <button
                onClick={() => handleSubmit("save_only")}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container-lowest disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">save</span>
                Simpan Sebagai Kandidat
              </button>
              <button
                onClick={() => handleSubmit("force_process")}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
                Tetap Proses
              </button>
            </>
          )}

          {/* No score — show all actions */}
          {screening.ai_score === null && (
            <>
              <button
                onClick={() => handleSubmit("accept")}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">thumb_up</span>
                Terima & Buat Lamaran
              </button>
              <button
                onClick={() => handleSubmit("review")}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">rate_review</span>
                Review & Buat Lamaran
              </button>
              <button
                onClick={() => handleSubmit("save_only")}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container-lowest disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">save</span>
                Simpan Sebagai Kandidat
              </button>
              <button
                onClick={() => handleSubmit("force_process")}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
                Tetap Proses
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Cooldown Confirmation Modal ──────────────────────────────────── */}
      {cooldownPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-orange-200 p-6 space-y-4 mx-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 rounded-full bg-orange-100 p-2">
                <span className="material-symbols-outlined text-orange-600">schedule</span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Masa Tunggu (Cooldown) Belum Selesai</h3>
                <p className="mt-1 text-sm text-gray-600">{cooldownMessage}</p>
                <p className="mt-2 text-sm text-gray-700">
                  Apakah Anda yakin ingin tetap melanjutkan dan mengabaikan masa tunggu ini?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setCooldownPending(null); setCooldownMessage(""); }}
                disabled={submitting}
                className="rounded-lg border border-outline-variant bg-white px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-lowest disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleForceCooldown}
                disabled={submitting}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {submitting ? "Menyimpan..." : "Ya, Tetap Proses"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Blacklist Confirmation Modal ─────────────────────────────────── */}
      {blacklistPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-amber-200 p-6 space-y-4 mx-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 rounded-full bg-amber-100 p-2">
                <span className="material-symbols-outlined text-amber-600">warning</span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Kandidat Dalam Blacklist</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Kandidat ini terdaftar dalam daftar blacklist dan tidak dapat diproses secara normal.
                </p>
                <p className="mt-2 text-sm text-gray-700">
                  Apakah Anda yakin ingin tetap melanjutkan dan mengabaikan status blacklist ini?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBlacklistPending(null)}
                disabled={submitting}
                className="rounded-lg border border-outline-variant bg-white px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-lowest disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleForceBlacklist}
                disabled={submitting}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {submitting ? "Menyimpan..." : "Ya, Tetap Proses"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
