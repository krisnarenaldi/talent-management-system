// Halaman daftar kandidat — TODO: TASK-04.3
export default function CandidatesPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Kandidat</h1>
        <a
          href="/candidates/new"
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          + Tambah Kandidat
        </a>
      </div>
      {/* DataTable — TODO: fetch dari /api/v1/candidates/ */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <p className="text-gray-400 text-sm">TODO: DataTable kandidat (TASK-04.3)</p>
      </div>
    </div>
  );
}
