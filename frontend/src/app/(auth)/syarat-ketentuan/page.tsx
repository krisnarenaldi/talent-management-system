import Link from "next/link";

export default function SyaratKetentuanPage() {
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
            <span className="material-symbols-outlined text-sm">gavel</span>
            Syarat & Ketentuan
          </span>
          <h1 className="text-headline-lg font-bold tracking-tight text-on-surface">
            Syarat & Ketentuan Penggunaan
          </h1>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Terakhir diperbarui: September 2024
          </p>
        </div>

        <div className="prose prose-sm text-on-surface-variant space-y-6 max-w-none">
          <section>
            <h2 className="text-label-md font-semibold text-on-surface uppercase tracking-wide mb-3">
              1. Penerimaan Ketentuan
            </h2>
            <p className="text-body-sm leading-relaxed">
              Dengan mengakses dan menggunakan platform TalentFlow, Anda menyetujui untuk terikat oleh syarat dan ketentuan ini. Jika Anda tidak setuju dengan sebagian atau seluruh ketentuan, mohon segera berhenti menggunakan platform ini dan hubungi administrator.
            </p>
          </section>

          <section>
            <h2 className="text-label-md font-semibold text-on-surface uppercase tracking-wide mb-3">
              2. Akun dan Akses
            </h2>
            <p className="text-body-sm leading-relaxed mb-3">
              Setiap pengguna wajib:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-body-sm">
              <li>Menyediakan data yang benar dan terkini saat pendaftaran</li>
              <li>M Menjaga kerahasiaan kredensial akun masing-masing</li>
              <li>Tidak membagikan akun kepada pihak lain</li>
              <li>Menghubungi administrator segera jika terdapat dugaan penyalahgunaan akun</li>
            </ul>
            <p className="text-body-sm leading-relaxed mt-3">
              Administrator berhak menangguhkan atau menghapus akun yang melanggar ketentuan tanpa pemberitahuan sebelumnya.
            </p>
          </section>

          <section>
            <h2 className="text-label-md font-semibold text-on-surface uppercase tracking-wide mb-3">
              3. Perilaku Pengguna
            </h2>
            <p className="text-body-sm leading-relaxed mb-3">
              Pengguna dilarang keras untuk:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-body-sm">
              <li>Mengakses data atau sistem di luar wewenang role-nya</li>
              <li>Mengeksploitasi, membalik mesin (reverse engineering), atau mencoba merusak sistem</li>
              <li>Mengunggah konten ilegal, merugikan, atau melanggar hak pihak ketiga</li>
              <li>Menggunakan platform untuk kegiatan yang bertentangan dengan kebijakan perusahaan</li>
              <li>Membuat akun palsu atau identitas ganda</li>
            </ul>
          </section>

          <section>
            <h2 className="text-label-md font-semibold text-on-surface uppercase tracking-wide mb-3">
              3. Hak Kekayaan Intelektual
            </h2>
            <p className="text-body-sm leading-relaxed">
              Seluruh konten, desain, logo, dan teknologi yang terdapat di platform TalentFlow merupakan milik perusahaan dan dilindungi oleh hukum hak cipta. Pengguna tidak diperkenankan menyalin, mendistribusikan, atau membuat karya turunan tanpa izin tertulis.
            </p>
          </section>

          <section>
            <h2 className="text-label-md font-semibold text-on-surface uppercase tracking-wide mb-3">
              5. Tanggung Jawab dan Batasan
            </h2>
            <p className="text-body-sm leading-relaxed">
              TalentFlow disediakan "sebagaimana adanya" tanpa jaminan apapun. Perusahaan tidak bertanggung jawab atas kerugian langsung maupun tidak langsung yang timbul dari penggunaan platform ini, termasuk keterlambatan atau kegagalan layanan akibat force majeure.
            </p>
          </section>

          <section>
            <h2 className="text-label-md font-semibold text-on-surface uppercase tracking-wide mb-3">
              6. Perubahan Ketentuan
            </h2>
            <p className="text-body-sm leading-relaxed">
              Perusahaan berhak mengubah syarat dan ketentuan ini sewaktu-waktu. Perubahan akan diinformasikan melalui notifikasi internal. Penggunaan platform setelah perubahan berlaku dianggap sebagai penerimaan terhadap ketentuan terbaru.
            </p>
          </section>

          <section>
            <h2 className="text-label-md font-semibold text-on-surface uppercase tracking-wide mb-3">
              7. Kontak
            </h2>
            <p className="text-body-sm leading-relaxed">
              Untuk pertanyaan terkait syarat dan ketentuan ini, hubungi Tim Admin melalui email <span className="text-primary font-medium">support@talentflow.internal</span>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
