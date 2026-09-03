// Halaman blacklist — TODO: TASK-06.2
export default function BlacklistPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Blacklist</h1>
        <a
          href="/blacklist/new"
          className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
        >
          + Tambah Blacklist
        </a>
      </div>
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <p className="text-gray-400 text-sm">TODO: DataTable blacklist (TASK-06.2)</p>
      </div>
    </div>
  );
}
