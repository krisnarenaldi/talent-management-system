"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/lib/api/settings";
import { getAIUsage } from "@/lib/api/ai_search";
import { useToastStore } from "@/stores/toast.store";
import { getErrorMessage } from "@/lib/errors";
import { useAuthStore } from "@/stores/auth.store";

export function SettingsAI() {
  const isAdmin = useAuthStore((s) => s.isRole("admin"));
  const showToast = useToastStore((s) => s.showToast);
  const queryClient = useQueryClient();

  const [input, setInput] = useState("");
  const [editing, setEditing] = useState(false);

  const { data: budget, isLoading: budgetLoading } = useQuery({
    queryKey: ["ai-budget"],
    queryFn: () => settingsApi.getAIBudget(),
  });

  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ["ai-usage"],
    queryFn: () => getAIUsage(),
  });

  const updateMutation = useMutation({
    mutationFn: (value: number) => settingsApi.updateAIBudget(value),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ai-budget"] });
      queryClient.invalidateQueries({ queryKey: ["ai-usage"] });
      showToast("success", `Budget diperbarui: $${data.budget_usd.toFixed(2)}`);
      setEditing(false);
      setInput("");
    },
    onError: (err) => {
      showToast("error", getErrorMessage(err, "Gagal menyimpan budget."));
    },
  });

  const handleSave = () => {
    const val = parseFloat(input);
    if (isNaN(val) || val <= 0) {
      showToast("error", "Masukkan nominal yang valid (lebih dari $0).");
      return;
    }
    updateMutation.mutate(val);
  };

  const handleEdit = () => {
    setInput(budget ? String(budget.budget_usd) : "");
    setEditing(true);
  };

  const currentBudget = budget?.budget_usd ?? 0;
  const totalCost = usage?.total_cost_usd ?? 0;
  const remaining = usage?.remaining_usd ?? currentBudget;
  const monthCost = usage?.month_cost_usd ?? 0;
  const pct = usage?.budget_used_pct ?? 0;

  const isWarning = pct >= 75 && pct < 90;
  const isDanger = pct >= 90;
  const barColor = isDanger ? "bg-red-500" : isWarning ? "bg-amber-400" : "bg-emerald-500";
  const remainingColor = isDanger
    ? "text-red-600"
    : isWarning
    ? "text-amber-600"
    : "text-emerald-600";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-body-md text-on-surface font-medium">AI & Budget OpenAI</h2>
        <p className="text-body-sm text-on-surface-variant mt-0.5">
          Pantau pemakaian token AI dan atur nominal kredit OpenAI sesuai top-up terakhir.
        </p>
      </div>

      {/* Kartu saldo */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sisa Saldo</p>
            <p className={`mt-1 text-3xl font-bold tabular-nums ${usageLoading ? "text-gray-300" : remainingColor}`}>
              ${usageLoading ? "—" : remaining.toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              dari total top-up{" "}
              <span className="font-medium text-gray-600">
                ${budgetLoading ? "…" : currentBudget.toFixed(2)}
              </span>
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={handleEdit}
              className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              ✏️ Ubah Top-up
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Terpakai {pct.toFixed(1)}%</span>
            <span>${totalCost.toFixed(4)}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${barColor}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>

        {/* Statistik baris */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-500">Pemakaian bulan ini</p>
            <p className="text-sm font-semibold text-gray-800 tabular-nums mt-0.5">
              ${usageLoading ? "…" : monthCost.toFixed(4)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total pemakaian</p>
            <p className="text-sm font-semibold text-gray-800 tabular-nums mt-0.5">
              ${usageLoading ? "…" : totalCost.toFixed(4)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Token bulan ini</p>
            <p className="text-sm font-semibold text-gray-800 tabular-nums mt-0.5">
              {usageLoading ? "…" : (usage?.month_total_tokens ?? 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total token</p>
            <p className="text-sm font-semibold text-gray-800 tabular-nums mt-0.5">
              {usageLoading ? "…" : (usage?.total_total_tokens ?? 0).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Form ubah top-up — hanya admin */}
      {isAdmin && editing && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-medium text-gray-800 mb-1">
            Masukkan nominal top-up terbaru (USD)
          </p>
          <p className="text-xs text-gray-500 mb-3">
            Contoh: jika Anda baru top-up $50 di OpenAI, isi <strong>50</strong>.
            Sistem akan otomatis menghitung sisa saldo dari nominal ini.
          </p>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="Contoh: 50"
                className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm outline-none focus:border-primary-500"
                autoFocus
              />
            </div>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending || !input.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {updateMutation.isPending ? "Menyimpan…" : "Simpan"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Info harga */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 px-5 py-4">
        <p className="text-xs font-medium text-gray-500 mb-2">Referensi harga token (GPT-4o mini)</p>
        <div className="flex gap-6 text-xs text-gray-600">
          <span>Input: <strong>$0.150</strong> / 1 juta token</span>
          <span>Output: <strong>$0.600</strong> / 1 juta token</span>
        </div>
      </div>
    </div>
  );
}
