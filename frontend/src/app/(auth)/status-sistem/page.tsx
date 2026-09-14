import Link from "next/link";

export default function StatusSistemPage() {
  return (
    <main className="bg-background min-h-screen text-on-surface antialiased">
      {/* Header */}
      <header className="w-full px-8 lg:px-16 py-6 flex items-center justify-between border-b border-surface-container">
        <Link href="/login" className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md text-white">
            <span className="material-symbols-outlined text-2xl">dataset</span>
          </div>
          <span className="text-headline-md font-bold tracking-tight text-on-surface">
            TalentFlow
          </span>
        </Link>
        <Link
          href="/login"
          className="text-body-sm font-medium text-primary hover:text-primary-container transition-colors"
        >
          ← Kembali ke Login
        </Link>
      </header>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-8 lg:px-16 py-12">
        <div className="mb-8">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-low text-primary text-xs font-medium mb-4 border border-surface-container">
            <span className="material-symbols-outlined text-sm">hub</span>
            Status Sistem
          </span>
          <h1 className="text-headline-lg font-bold tracking-tight text-on-surface">
            Status Sistem
          </h1>
          <p className="text-body-md text-on-surface-variant mt-2">
            Pemantauan ketersediaan dan kinerja platform TalentFlow secara real-time.
          </p>
        </div>

        {/* Uptime summary */}
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          {[
            { label: "Uptime 30 Hari", value: "99.9%", status: "up" },
            { label: "Waktu Respon Rata-rata", value: "142ms", status: "up" },
            { label: "Insiden Aktif", value: "0", status: "up" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-surface-container-lowest rounded-xl border border-surface-container-high p-5"
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    stat.status === "up"
                      ? "bg-success"
                      : "bg-error"
                  }`}
                />
                <span className="text-label-sm text-on-surface-variant">
                  {stat.label}
                </span>
              </div>
              <p className="text-headline-sm font-bold text-on-surface">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Service status */}
        <section>
          <h2 className="text-headline-sm font-semibold text-on-surface mb-4">
            Status Layanan
          </h2>
          <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high divide-y divide-surface-container">
            {[
              { name: "API Backend", status: "up", label: "Beroperasi Normal" },
              { name: "Autentikasi", status: "up", label: "Beroperasi Normal" },
              { name: "AI Matching Engine", status: "up", label: "Beroperasi Normal" },
              { name: "Penyimpanan Dokumen", status: "up", label: "Beroperasi Normal" },
              { name: "Notifikasi Email", status: "up", label: "Beroperasi Normal" },
            ].map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      service.status === "up" ? "bg-success" : "bg-error"
                    }`}
                  />
                  <span className="text-body-md font-medium text-on-surface">
                    {service.name}
                  </span>
                </div>
                <span className="text-body-sm text-success font-medium">
                  {service.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Recent incidents */}
        <section className="mt-8">
          <h2 className="text-headline-sm font-semibold text-on-surface mb-4">
            Riwayat Insiden
          </h2>
          <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high p-6 text-center">
            <span className="material-symbols-outlined text-success text-3xl mb-2">
              check_circle
            </span>
            <p className="text-body-md text-on-surface">
              Tidak ada insiden aktif
            </p>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Semua sistem beroperasi normal.
            </p>
          </div>
        </section>

        {/* Last updated */}
        <p className="text-label-sm text-on-surface-variant mt-6 text-center">
          Terakhir diperbarui: {new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>
    </main>
  );
}
