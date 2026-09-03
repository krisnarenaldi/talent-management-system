// Detail karyawan dengan tab — TODO: TASK-08.2
export default function EmployeeDetailPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Detail Karyawan</h1>
      {/* Tabs: Data Pribadi / Kontrak / Payroll / Dokumen */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <p className="text-gray-400 text-sm">TODO: EmployeeTabView (ID: {params.id}) (TASK-08.2)</p>
      </div>
    </div>
  );
}
