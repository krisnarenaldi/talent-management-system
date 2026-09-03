// Layout utama dengan sidebar — dipakai semua halaman dashboard
// TODO: implementasi sidebar navigasi responsif (TASK-01.3)
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar placeholder — akan diimplementasi di TASK-01.3 */}
      <aside className="w-64 bg-primary-900 text-white hidden md:block">
        <div className="p-4">
          <h2 className="text-lg font-bold">TMS Altek</h2>
        </div>
        <nav className="mt-4 px-2">
          {/* Navigasi akan diisi via komponen Sidebar */}
        </nav>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
