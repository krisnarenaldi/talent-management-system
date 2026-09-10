import CandidateForm from "@/components/candidates/CandidateForm";

export default async function EditCandidatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CandidateForm mode="edit" candidateId={id} />;
}
