"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CandidateForm, { type CreateCandidateResult } from "@/components/candidates/CandidateForm";
import DuplicateWarningBanner from "@/components/candidates/DuplicateWarningBanner";
import BlacklistWarningModal from "@/components/candidates/BlacklistWarningModal";

export default function ManualNewCandidatePage() {
  const router = useRouter();
  const [createResult, setCreateResult] = useState<CreateCandidateResult | null>(null);

  const handleCreateResult = (result: CreateCandidateResult) => {
    setCreateResult(result);
    // If no warnings, navigate directly to candidate detail
    if (!result.isBlacklisted && !result.isDuplicate) {
      router.push(`/candidates/${result.candidateId}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Duplicate warning banner — shown above form after submit */}
      {createResult?.isDuplicate && !createResult.isBlacklisted && (
        <DuplicateWarningBanner
          candidateId={createResult.candidateId}
          onDismiss={() => router.push(`/candidates/${createResult.candidateId}`)}
        />
      )}

      <CandidateForm
        mode="create"
        onCreateResult={handleCreateResult}
        preventNavigationOnCreate
      />

      {/* Blacklist modal — blocking, shown when candidate is blacklisted */}
      {createResult && (
        <BlacklistWarningModal
          isOpen={createResult.isBlacklisted}
          candidateId={createResult.candidateId}
          onConfirm={() => router.push(`/candidates/${createResult.candidateId}`)}
          onClose={() => setCreateResult(null)}
        />
      )}
    </div>
  );
}
