// Detail kandidat dengan tab — TODO: TASK-04.3
export default function CandidateDetailPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Detail Kandidat</h1>
      {/* Tabs: Profil / Dokumen / Lamaran / Catatan */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <p className="text-gray-400 text-sm">TODO: Tab view kandidat ID: {params.id} (TASK-04.3)</p>
      </div>
    </div>
  );
}
