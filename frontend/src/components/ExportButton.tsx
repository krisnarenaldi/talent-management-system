"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import api from "@/lib/api";

interface ExportButtonProps {
  onExport: () => Promise<void>;
  filters?: React.ReactNode;
  className?: string;
}

export default function ExportButton({
  onExport,
  filters,
  className = "",
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport();
      setIsOpen(false);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className={`inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-green-700 hover:shadow-md disabled:opacity-50 ${className}`}
      >
        <Download className="h-4 w-4" />
        {isExporting ? "Exporting..." : "Export"}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="p-3">
            {filters}
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="mt-3 w-full rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              {isExporting ? "Exporting..." : "Download Excel"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}