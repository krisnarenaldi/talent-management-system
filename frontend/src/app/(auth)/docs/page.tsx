import Link from "next/link";

export default function DocsPage() {
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
            <span className="material-symbols-outlined text-sm">menu_book</span>
            Dokumentasi
          </span>
          <h1 className="text-headline-lg font-bold tracking-tight text-on-surface">
            Dokumentasi TalentFlow
          </h1>
          <p className="text-body-md text-on-surface-variant mt-2">
            Panduan lengkap penggunaan platform TalentFlow untuk tim HR dan admin.
          </p>
        </div>

        <div className="space-y-8">
          {/* Getting Started */}
          <section>
            <h2 className="text-headline-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-base">play_arrow</span>
              </span>
              Memulai
            </h2>
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high p-6 space-y-4">
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Login ke Sistem</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Gunakan email perusahaan Anda beserta kata sandi yang telah diberikan oleh administrator.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Dashboard</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Halaman utama menampilkan ringkasan kandidat terbaru, status pelamaran, dan statistik perekrutan.
                </p>
              </div>
            </div>
          </section>

          {/* Candidates */}
          <section>
            <h2 className="text-headline-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-base">people</span>
              </span>
              Manajemen Kandidat
            </h2>
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high p-6 space-y-4">
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Menambah Kandidat</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Buka menu Kandidat → Tambah Baru. Isi data diri, upload dokumen persyaratan, dan tentukan posisi yang dilamar.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Pencarian Kandidat</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Gunakan fitur pencarian untuk menemukan kandidat berdasarkan nama, posisi, atau status. Hasil pencarian dapat diurutkan berdasarkan tanggal atau skor kecocokan.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Detail Kandidat</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Halaman detail menampilkan profil lengkap, riwayat pelamaran, dokumen, dan catatan dari proses seleksi.
                </p>
              </div>
            </div>
          </section>

          {/* Blacklist */}
          <section>
            <h2 className="text-headline-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-error-container flex items-center justify-center">
                <span className="material-symbols-outlined text-error text-base">block</span>
              </span>
              Daftar Hitam (Blacklist)
            </h2>
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high p-6 space-y-4">
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Menambahkan Blacklist</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Buka menu Daftar Hitam → Tambah Baru. Pilih kandidat, tentukan jenis blokir, dan isi alasan pemblokirannya.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Jenis Blokir</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Administrator dapat mengatur jenis-jenis blokir yang tersedia melalui menu Admin → Jenis Blokir.
                </p>
              </div>
            </div>
          </section>

          {/* Admin */}
          <section>
            <h2 className="text-headline-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-secondary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary text-base">settings</span>
              </span>
              Pengaturan Admin
            </h2>
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high p-6 space-y-4">
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Manajemen User</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Hanya admin yang dapat mengelola akun pengguna, menetapkan role, dan menambahkan user baru.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Konfigurasi Posisi</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Kelola daftar posisi kosong yang tersedia melalui menu Admin → Posisi.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Konfigurasi Client</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Tambah dan kelola data client/perusahaan yang menggunakan layanan TalentFlow.
                </p>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section>
            <h2 className="text-headline-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-base">help</span>
              </span>
              Pertanyaan Umum (FAQ)
            </h2>
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high p-6 space-y-4">
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Bagaimana cara mereset kata sandi?</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Klik "Lupa kata sandi" di halaman login dan masukkan email kerja Anda. Instruksi reset akan dikirimkan melalui email.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Siapa yang dapat mengakses halaman admin?</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Hanya pengguna dengan role Admin yang memiliki akses ke panel pengaturan admin.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Bagaimana cara menghubungi administrator?</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Hubungi Tim Admin melalui halaman bantuan atau kirim email ke support perusahaan Anda.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
