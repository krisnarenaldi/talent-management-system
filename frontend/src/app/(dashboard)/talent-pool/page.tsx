"use client";

import CandidatesTable from "@/components/candidates/CandidatesTable";

export default function TalentPoolPage() {
  return (
    <CandidatesTable
      poolStatus="talent_pool"
      eyebrow="Talent Pool"
      title="Kandidat"
      showExport={false}
    />
  );
}
