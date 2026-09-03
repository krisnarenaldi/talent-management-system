// Dashboard utama — TODO: TASK-09
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric cards — TODO: fetch dari /api/v1/analytics/summary */}
        {[
          { label: "Total Kandidat", value: "-" },
          { label: "Kandidat di Pipeline", value: "-" },
          { label: "Karyawan Aktif", value: "-" },
          { label: "Kontrak Hampir Habis", value: "-" },
        ].map((metric) => (
          <div key={metric.label} className="bg-white rounded-xl shadow-sm border p-4">
            <p className="text-sm text-gray-500">{metric.label}</p>
            <p className="text-3xl font-bold text-primary-700 mt-1">{metric.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
