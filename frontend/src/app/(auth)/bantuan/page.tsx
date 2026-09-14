import Link from "next/link";

export default function BantuanPage() {
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
            <span className="material-symbols-outlined text-sm">support_agent</span>
            Pusat Bantuan
          </span>
          <h1 className="text-headline-lg font-bold tracking-tight text-on-surface">
            Pusat Bantuan
          </h1>
          <p className="text-body-md text-on-surface-variant mt-2">
            Butuh bantuan? Temukan jawaban atau hubungi tim dukungan kami.
          </p>
        </div>

        <div className="space-y-8">
          {/* Cara Menghubungi */}
          <section>
            <h2 className="text-headline-sm font-semibold text-on-surface mb-4">
              Cara Menghubungi Kami
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high p-5">
                <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-primary">mail</span>
                </div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Email</h3>
                <p className="text-body-sm text-on-surface-variant">
                  support@talentflow.internal
                </p>
              </div>
              <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high p-5">
                <div className="w-10 h-10 rounded-lg bg-secondary-container flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-secondary">chat</span>
                </div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Chat Internal</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Hubungi admin melalui platform internal perusahaan.
                </p>
              </div>
            </div>
          </section>

          {/* Topik Bantuan */}
          <section>
            <h2 className="text-headline-sm font-semibold text-on-surface mb-4">
              Topik Bantuan Umum
            </h2>
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high divide-y divide-surface-container">
              {[
                {
                  icon: "lock_reset",
                  q: "Bagaimana cara mereset kata sandi?",
                  a: "Klik 'Lupa kata sandi' di halaman login. Masukkan email kerja Anda dan ikuti instruksi yang dikirimkan via email.",
                },
                {
                  icon: "person_add",
                  q: "Bagaimana cara mendaftarkan akun baru?",
                  a: "Pengguna baru perlu didaftarkan oleh administrator. Hubungi Tim Admin untuk membuatkan akun.",
                },
                {
                  icon: "block",
                  q: "Akun saya diblokir, apa yang harus dilakukan?",
                  a: "Hubungi administrator segera. Account dapat diblokir karena kebijakan keamanan atau masa kontrak yang berakhir.",
                },
                {
                  icon: "bug_report",
                  q: "Saya menemukan bug atau masalah teknis",
                  a: "Deskripsikan masalah beserta langkah reproduksinya, lalu kirim ke Tim Admin melalui email atau chat internal.",
                },
              ].map((item, i) => (
                <div key={i} className="p-5">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary mt-0.5 shrink-0">
                      {item.icon}
                    </span>
                    <div>
                      <h3 className="text-label-md font-semibold text-on-surface mb-1">
                        {item.q}
                      </h3>
                      <p className="text-body-sm text-on-surface-variant">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Jam Operasional */}
          <section>
            <h2 className="text-headline-sm font-semibold text-on-surface mb-4">
              Jam Operasional Dukungan
            </h2>
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="material-symbols-outlined text-primary">schedule</span>
                <span className="text-label-md font-semibold text-on-surface">
                  Senin – Jumat, 08:00 – 17:00 WIB
                </span>
              </div>
              <p className="text-body-sm text-on-surface-variant pl-8">
                Untuk kasus darurat di luar jam kerja, silakan kirim email dan tim akan menindaklanjuti pada hari kerja berikutnya.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
