// Detail lamaran + update tahapan — TODO: TASK-05.3
export default function ApplicationDetailPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Detail Lamaran</h1>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 bg-white rounded-xl shadow-sm border p-4">
          <p className="text-gray-400 text-sm">TODO: Ringkasan kandidat & posisi</p>
        </div>
        <div className="col-span-2 bg-white rounded-xl shadow-sm border p-4">
          <p className="text-gray-400 text-sm">TODO: StageUpdateForm + timeline (ID: {params.id})</p>
        </div>
      </div>
    </div>
  );
}
