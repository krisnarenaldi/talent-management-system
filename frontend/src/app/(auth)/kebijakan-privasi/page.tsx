import Link from "next/link";

export default function KebijakanPrivasiPage() {
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
            <span className="material-symbols-outlined text-sm">shield</span>
            Kebijakan Privasi
          </span>
          <h1 className="text-headline-lg font-bold tracking-tight text-on-surface">
            Kebijakan Privasi
          </h1>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Terakhir diperbarui: September 2024
          </p>
        </div>

        <div className="prose prose-sm text-on-surface-variant space-y-6 max-w-none">
          <section>
            <h2 className="text-label-md font-semibold text-on-surface uppercase tracking-wide mb-3">
              1. Pendahuluan
            </h2>
            <p className="text-body-sm leading-relaxed">
              TalentFlow adalah sistem manajemen talenta milik perusahaan. Kebijakan privasi ini menjelaskan bagaimana data pribadi pengguna dikumpulkan, digunakan, dan dilindungi selama mengakses platform ini.
            </p>
          </section>

          <section>
            <h2 className="text-label-md font-semibold text-on-surface uppercase tracking-wide mb-3">
              2. Data yang Dikumpulkan
            </h2>
            <p className="text-body-sm leading-relaxed mb-3">
              Kami mengumpulkan data berikut saat Anda menggunakan platform TalentFlow:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-body-sm">
              <li><span className="text-on-surface font-medium">Identitas:</span> nama, email perusahaan, jabatan, dan departemen</li>
              <li><span className="text-on-surface font-medium">Data Akun:</span> riwayat login, aktivitas, dan preferensi</li>
              <li><span className="text-on-surface font-medium">Data Kandidat:</span> informasi profIl, riwayat pekerjaan, dan dokumen lamaran (jika Anda adalah recruiter)</li>
              <li><span className="text-on-surface font-medium">Dokumen:</span> file yang diunggah melalui sistem</li>
            </ul>
          </section>

          <section>
            <h2 className="text-label-md font-semibold text-on-surface uppercase tracking-wide mb-3">
              3. Penggunaan Data
            </h2>
            <p className="text-body-sm leading-relaxed mb-3">
              Data Anda digunakan untuk tujuan berikut:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-body-sm">
              <li>Memproses dan mengelola akun serta autentikasi pengguna</li>
              <li>Menyediakan fitur pencarian, pemindaian, dan pencocokan kandidat</li>
              <li>Mengelola blacklist dan kebijakan perekrutan</li>
              <li>Mematuhi kewajiban hukum dan regulasi perusahaan</li>
              <li>Meningkatkan kualitas layanan dan keamanan sistem</li>
            </ul>
          </section>

          <section>
            <h2 className="text-label-md font-semibold text-on-surface uppercase tracking-wide mb-3">
              4. Keamanan Data
            </h2>
            <p className="text-body-sm leading-relaxed">
              Kami menerapkan langkah-langkah keamanan teknis dan organisasi untuk melindungi data Anda, termasuk enkripsi data dalam transit dan penyimpanan, kontrol akses berbasis peran, serta audit log secara berkala. Namun, tidak ada sistem yang 100% aman, dan pengguna bertanggung jawab untuk menjaga kerahasiaan kredensial akun masing-masing.
            </p>
          </section>

          <section>
            <h2 className="text-label-md font-semibold text-on-surface uppercase tracking-wide mb-3">
              5. Hak Pengguna
            </h2>
            <p className="text-body-sm leading-relaxed mb-3">
              Sebagai pengguna, Anda berhak:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-body-sm">
              <li>Mengakses data pribadi Anda yang tersimpan di sistem</li>
              <li>Memerintahkan koreksi atas data yang tidak akurat</li>
              <li>Mengajukan permintaan penghapusan data (apabila diizinkan kebijakan perusahaan)</li>
              <li>Mengajukan keluhan terkait pemrosesan data pribadi</li>
            </ul>
          </section>

          <section>
            <h2 className="text-label-md font-semibold text-on-surface uppercase tracking-wide mb-3">
              6. Kontak
            </h2>
            <p className="text-body-sm leading-relaxed">
              Untuk pertanyaan atau permintaan terkait kebijakan privasi ini, hubungi Tim Admin melalui email <span className="text-primary font-medium">support@talentflow.internal</span>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
