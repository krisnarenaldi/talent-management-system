"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { naturalLanguageSearch } from "@/lib/api/ai_search";
import type { Candidate, NLSearchFilters, NLSearchResponse } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type MessageRole = "user" | "assistant" | "error";

interface ChatMessage {
  id: number;
  role: MessageRole;
  text: string;
  response?: NLSearchResponse;
}

// ── LocalStorage persistence (#13) ───────────────────────────────────────────

const LS_KEY = "ai_search_chat_history";

function loadHistory(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(messages: ChatMessage[]): void {
  try {
    // cap at last 50 messages to avoid bloated localStorage
    const trimmed = messages.slice(-50);
    window.localStorage.setItem(LS_KEY, JSON.stringify(trimmed));
  } catch {
    // quota exceeded — ignore
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(n?: number) {
  if (n == null) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function FilterBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
      <span className="text-blue-400">{label}:</span> {value}
    </span>
  );
}

function FiltersDisplay({ filters }: { filters: NLSearchFilters }) {
  const badges: { label: string; value: string }[] = [];

  if (filters.skills?.length) badges.push({ label: "Skill", value: filters.skills.join(", ") });
  if (filters.domicile) badges.push({ label: "Domisili", value: filters.domicile });
  if (filters.gender) badges.push({ label: "Gender", value: filters.gender });
  if (filters.source_channel) badges.push({ label: "Sumber", value: filters.source_channel });
  if (filters.completeness_status) badges.push({ label: "Kelengkapan", value: filters.completeness_status });
  if (filters.contact_status) badges.push({ label: "Kontak", value: filters.contact_status });
  // #4: current salary badges (was missing)
  if (filters.min_current_salary) badges.push({ label: "Gaji saat ini min", value: formatCurrency(filters.min_current_salary) });
  if (filters.max_current_salary) badges.push({ label: "Gaji saat ini maks", value: formatCurrency(filters.max_current_salary) });
  if (filters.min_expected_salary) badges.push({ label: "Gaji ekspektasi min", value: formatCurrency(filters.min_expected_salary) });
  if (filters.max_expected_salary) badges.push({ label: "Gaji ekspektasi maks", value: formatCurrency(filters.max_expected_salary) });
  if (filters.max_notice_period_days) badges.push({ label: "Notice period maks", value: `${filters.max_notice_period_days} hari` });
  if (filters.education_major) badges.push({ label: "Jurusan", value: filters.education_major });
  if (filters.education_institution) badges.push({ label: "Institusi", value: filters.education_institution });
  if (filters.min_gpa) badges.push({ label: "Min GPA", value: String(filters.min_gpa) });
  if (filters.experience_job_title) badges.push({ label: "Jabatan", value: filters.experience_job_title });
  if (filters.experience_company) badges.push({ label: "Perusahaan", value: filters.experience_company });
  if (filters.keyword) badges.push({ label: "Kata kunci", value: filters.keyword });

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {badges.map((b) => (
        <FilterBadge key={b.label} label={b.label} value={b.value} />
      ))}
    </div>
  );
}

function ResultsTable({ candidates }: { candidates: Candidate[] }) {
  if (candidates.length === 0) {
    return (
      <p className="mt-3 text-sm text-gray-500 italic">
        Tidak ada kandidat yang sesuai dengan kriteria pencarian.
      </p>
    );
  }

  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full text-left text-xs text-gray-700">
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2">Nama</th>
            <th className="px-3 py-2">Kontak</th>
            <th className="px-3 py-2">Domisili</th>
            <th className="px-3 py-2">Skill</th>
            <th className="px-3 py-2">Sumber</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => (
            <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
              <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{c.full_name}</td>
              <td className="px-3 py-2 text-gray-600">
                <div>{c.email || "-"}</div>
                <div className="text-gray-400">{c.phone || "-"}</div>
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{c.domicile || "-"}</td>
              <td className="px-3 py-2">
                {c.skills && c.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {c.skills.slice(0, 4).map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700"
                      >
                        {s}
                      </span>
                    ))}
                    {c.skills.length > 4 && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                        +{c.skills.length - 4}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{c.source_channel || "-"}</td>
              <td className="px-3 py-2">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                    c.contact_status === "aktif"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {c.contact_status === "aktif" ? "Aktif" : "Tidak bisa dihubungi"}
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                <Link
                  href={`/candidates/${c.id}`}
                  className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Lihat
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Bubble renderers ──────────────────────────────────────────────────────────

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2.5 text-sm text-white shadow-sm">
        {text}
      </div>
    </div>
  );
}

function AssistantBubble({ message }: { message: ChatMessage }) {
  const res = message.response;
  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-4 py-3 shadow-sm text-sm text-gray-800">
        {/* Description */}
        <p className="font-medium text-gray-700">{message.text}</p>

        {/* Filter badges */}
        {res && Object.keys(res.filters_applied).length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Filter yang diterapkan</p>
            <FiltersDisplay filters={res.filters_applied} />
          </div>
        )}

        {/* Result count */}
        {res && (
          <p className="mt-3 text-xs text-gray-400">
            Ditemukan{" "}
            <span className="font-semibold text-gray-600">{res.results_count}</span>{" "}
            kandidat
            {res.has_more && (
              <span className="ml-1 text-amber-600 font-medium">
                · lebih dari 100 hasil, tampilkan yang terbaru — perjelas query untuk mempersempit
              </span>
            )}
          </p>
        )}

        {/* Table */}
        {res && <ResultsTable candidates={res.results} />}
      </div>
    </div>
  );
}

function ErrorBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
        <span className="mr-1.5">⚠️</span>
        {text}
      </div>
    </div>
  );
}

// ── Placeholder suggestions ───────────────────────────────────────────────────

const SUGGESTIONS = [
  "Cari kandidat yang bisa PHP dan Python",
  "Kandidat dari Jakarta dengan skill React.js",
  "Kandidat perempuan lulusan Teknik Informatika dengan GPA minimal 3.2",
  "Kandidat yang pernah bekerja sebagai Backend Developer",
  "Talent pool dengan notice period maksimal 14 hari",
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const isManager = useAuthStore((s) => s.isRole("manager"));

  // #13: initialise from localStorage
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const msgIdRef = useRef(
    // start id counter above any persisted ids to avoid collisions
    messages.length > 0 ? Math.max(...messages.map((m) => m.id)) + 1 : 0
  );

  // #13: persist every time messages change
  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  // ── Guard: tidak ada akses untuk non-manager ─────────────────────────────
  if (!isManager) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <span className="text-4xl">🔒</span>
        <h2 className="text-lg font-semibold text-gray-800">Akses Terbatas</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          Fitur pencarian AI hanya tersedia untuk role <strong>Manager</strong>.
        </p>
      </div>
    );
  }

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const addMessage = (msg: Omit<ChatMessage, "id">) => {
    msgIdRef.current += 1;
    const full = { ...msg, id: msgIdRef.current };
    setMessages((prev) => [...prev, full]);
    return full;
  };

  // #10: clear chat
  const handleClearChat = () => {
    setMessages([]);
    window.localStorage.removeItem(LS_KEY);
    inputRef.current?.focus();
  };

  const handleSubmit = async (queryText?: string) => {
    const query = (queryText ?? input).trim();
    if (!query || loading) return;

    setInput("");
    setLoading(true);

    addMessage({ role: "user", text: query });
    scrollToBottom();

    try {
      const res = await naturalLanguageSearch(query);
      addMessage({
        role: "assistant",
        text: res.description || `Menampilkan ${res.results_count} kandidat yang cocok.`,
        response: res,
      });
    } catch (err: unknown) {
      let detail = "Terjadi kesalahan. Silakan coba lagi.";
      if (
        err &&
        typeof err === "object" &&
        "response" in err &&
        err.response &&
        typeof err.response === "object" &&
        "data" in err.response
      ) {
        const data = (err as { response: { data?: { detail?: string } } }).response.data;
        if (data?.detail) detail = data.detail;
      }
      addMessage({ role: "error", text: detail });
    } finally {
      setLoading(false);
      scrollToBottom();
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // #11: auto-grow textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col">
      {/* Header */}
      <div className="flex-none border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">AI Talent Search</h1>
            <p className="text-sm text-gray-500">
              Cari kandidat menggunakan bahasa alami — hanya untuk Manager
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* #10: Clear chat button */}
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-gray-400">
                  <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                </svg>
                Hapus riwayat
              </button>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              OpenAI GPT
            </span>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-6 space-y-4">
        {messages.length === 0 ? (
          /* Empty state — suggestions */
          <div className="flex flex-col items-center justify-center h-full gap-6 pb-16">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-2xl">
                🔍
              </div>
              <h2 className="text-base font-semibold text-gray-800">Cari kandidat dengan bahasa alami</h2>
              <p className="mt-1 text-sm text-gray-500 max-w-md">
                Tulis pertanyaan seperti Anda berbicara kepada rekan kerja.
                AI akan menerjemahkan ke filter pencarian kandidat.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full max-w-lg">
              {/* #9: disable suggestion buttons while loading */}
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSubmit(s)}
                  disabled={loading}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.role === "user") return <UserBubble key={msg.id} text={msg.text} />;
            if (msg.role === "error") return <ErrorBubble key={msg.id} text={msg.text} />;
            return <AssistantBubble key={msg.id} message={msg} />;
          })
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex gap-1.5 items-center text-gray-400 text-sm">
                <span className="animate-bounce" style={{ animationDelay: "0ms" }}>●</span>
                <span className="animate-bounce" style={{ animationDelay: "150ms" }}>●</span>
                <span className="animate-bounce" style={{ animationDelay: "300ms" }}>●</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex-none border-t border-gray-200 bg-white px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-3 rounded-2xl border border-gray-300 bg-white px-4 py-3 shadow-sm focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-200 transition">
            {/* #11: auto-grow textarea */}
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder='Contoh: "Cari kandidat PHP dari Bandung dengan ekspektasi gaji di bawah 10 juta"'
              className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none overflow-y-auto"
              style={{ maxHeight: "120px" }}
              disabled={loading}
            />
            <button
              onClick={() => handleSubmit()}
              disabled={loading || !input.trim()}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400"
              aria-label="Kirim"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-gray-400">
            AI hanya membantu pencarian kandidat · Tekan Enter untuk kirim · Shift+Enter untuk baris baru
          </p>
        </div>
      </div>
    </div>
  );
}
