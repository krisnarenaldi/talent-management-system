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
            Panduan lengkap penggunaan platform TalentFlow untuk tim HR, Manager, dan Admin — termasuk fitur v2.0 Talent Pool & Sourcing terbaru.
          </p>
        </div>

        {/* Version badge */}
        <div className="mb-8 p-4 rounded-xl bg-surface-container-low border border-surface-container-high flex items-start gap-3">
          <span className="material-symbols-outlined text-primary mt-0.5">new_releases</span>
          <div>
            <p className="text-label-md font-semibold text-on-surface">Versi 2.0 — Pasca-UAT (Oktober 2026)</p>
            <p className="text-body-sm text-on-surface-variant mt-0.5">
              Pembaruan alur rekrutmen: ingestion CV massal mandiri, manajemen Talent Pool, halaman Database baru, dan Sourcing Center berbasis AI.
            </p>
          </div>
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
                  Gunakan email perusahaan beserta kata sandi yang diberikan oleh administrator. Sistem mendukung tiga role: <strong>Admin</strong>, <strong>Manager</strong>, dan <strong>HR</strong> — masing-masing dengan hak akses berbeda.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Dashboard</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Halaman utama menampilkan ringkasan total kandidat aktif, kandidat di pipeline, total karyawan, kontrak yang hampir berakhir, 5 lamaran terbaru, dan 5 kontrak yang perlu perhatian segera.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Navigasi Utama</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Sidebar memuat menu: <strong>Dashboard</strong>, <strong>Database</strong>, <strong>Talent Pool</strong>, <strong>Applications</strong>, <strong>Employees</strong>, <strong>Blacklist</strong>, serta menu khusus role (Reports, AI Search, Admin).
                </p>
              </div>
            </div>
          </section>

          {/* Database */}
          <section>
            <h2 className="text-headline-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-base">group</span>
              </span>
              Database Kandidat (<code className="text-xs">/candidates</code>)
            </h2>
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high p-6 space-y-4">
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Apa itu Database?</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Database adalah penampung terpusat seluruh kandidat yang pernah masuk ke sistem, terlepas dari lowongan mana pun. Semua CV yang diunggah secara massal akan tersimpan di sini terlebih dahulu.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Mengunggah CV Massal (Bulk Upload)</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Buka <strong>Database → Tambah Kandidat</strong>. Seret dan lepas hingga 20 file PDF/DOCX sekaligus ke area upload. Pilih channel asal (LinkedIn, Glints, Jobstreet, dll) secara opsional, lalu klik <em>"Upload &amp; Ekstrak CV"</em>. Sistem akan mengekstrak data kandidat secara otomatis di latar belakang menggunakan AI.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Multi-Select &amp; Aksi Massal</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Centang satu atau beberapa kandidat di tabel menggunakan checkbox baris. Action bar akan muncul dengan pilihan: <em>"Pindahkan ke Talent Pool"</em> atau <em>"Assign ke Lowongan"</em>.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Detail Kandidat</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Klik nama kandidat untuk membuka halaman detail. Tab yang tersedia: <strong>Profil</strong> (data pribadi, pendidikan, pengalaman), <strong>Dokumen</strong> (upload &amp; download CV, KTP, ijazah), <strong>Lamaran</strong> (riwayat semua pipeline), dan <strong>Catatan</strong>.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Deteksi Duplikat &amp; Blacklist Otomatis</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Saat menambah atau mengupload CV, sistem otomatis memeriksa duplikasi berdasarkan email, nomor HP, atau NIK KTP, serta mengecek status blacklist aktif. Banner peringatan muncul jika ada kecocokan.
                </p>
              </div>
            </div>
          </section>

          {/* Talent Pool */}
          <section>
            <h2 className="text-headline-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-secondary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary text-base">groups</span>
              </span>
              Talent Pool (<code className="text-xs">/talent-pool</code>)
            </h2>
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high p-6 space-y-4">
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Apa itu Talent Pool?</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Talent Pool adalah kumpulan kandidat potensial yang disimpan untuk dipertimbangkan kembali di masa depan — misalnya kandidat kompeten namun ekspektasi gajinya belum sesuai budget saat ini.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Memindahkan Kandidat ke Talent Pool</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Di tabel Database, centang kandidat yang diinginkan lalu klik <em>"Pindahkan ke Talent Pool"</em> dari action bar. Sistem akan meminta alasan: <strong>Gaji Tidak Sesuai</strong>, <strong>Kebutuhan Masa Depan</strong>, atau <strong>Lainnya</strong> (dengan catatan bebas).
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Fitur Pencarian &amp; Filter di Talent Pool</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Halaman Talent Pool menyediakan filter lengkap yang sama dengan Database: pencarian nama, filter domisili/kota, filter pendidikan, filter tahun pengalaman, dan filter rentang gaji.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Assign ke Lowongan dari Talent Pool</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Pilih kandidat di halaman Talent Pool, klik <em>"Assign ke Lowongan"</em>, pilih posisi aktif dan PIC User Klien. Manager/Admin dapat mengaktifkan toggle <em>"Jalankan AI Screening"</em> untuk menghitung skor kecocokan secara otomatis di latar belakang. Kandidat yang di-assign akan langsung masuk ke tahap "Dijadwalkan Interview" di pipeline.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Status Pool Kandidat</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Setiap kandidat memiliki flag status: <strong>Database</strong> (default), <strong>Talent Pool</strong> (disimpan untuk masa depan), atau <strong>Future Lead</strong>. Status ini dapat diubah kapan saja oleh HR, Manager, atau Admin.
                </p>
              </div>
            </div>
          </section>

          {/* Applications & Pipeline */}
          <section>
            <h2 className="text-headline-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-base">work</span>
              </span>
              Pipeline Lamaran (<code className="text-xs">/applications</code>)
            </h2>
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high p-6 space-y-4">
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Pusat Sourcing &amp; Rekomendasi AI</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Buka <strong>Applications → Tambah Lamaran</strong>. Pilih posisi, User Klien (PIC pewawancara), dan sumber kandidat (<em>Talent Pool</em>, <em>Database</em>, atau <em>Semua</em>). Klik <em>"Cari &amp; Rekomendasikan Kandidat"</em> untuk menjalankan AI Sourcing dua tahap.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Cara Kerja Two-Stage AI Matching</h3>
                <p className="text-body-sm text-on-surface-variant">
                  <strong>Tahap 1</strong>: Sistem melakukan penyaringan SQL cepat berdasarkan status pool, budget gaji, lokasi, dan mengecualikan kandidat blacklist/cooldown — tanpa biaya token. <strong>Tahap 2</strong>: Dari 20–40 kandidat hasil filter, AI menilai 10–15 kandidat terbaik dan menghasilkan skor kecocokan 0–100 beserta ringkasan alasan.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Memasukkan Kandidat ke Pipeline</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Centang kandidat dari tabel rekomendasi AI (badge skor: hijau ≥ 80%, kuning 60–79%, merah &lt; 60%), lalu klik <em>"Masukkan Kandidat Terpilih ke Pipeline Lamaran"</em>. Semua kandidat terpilih otomatis masuk ke tahap "Dijadwalkan Interview".
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Tahapan Pipeline</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Pipeline mengikuti urutan: <strong>Dijadwalkan Interview → Konfirmasi Kehadiran → Interview HR → Psikotest (opsional) → Interview User → Offering → Tanda Tangan Kontrak → Onboarding → Existing</strong>. Ketika kandidat mencapai tahap <em>Existing</em>, sistem otomatis membuat record karyawan baru.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Bulk Upload CV untuk Posisi (Pending Review)</h3>
                <p className="text-body-sm text-on-surface-variant">
                  HR dapat mengunggah CV langsung ke posisi tertentu via <strong>Applications → Pending Review</strong>. Hasil ekstraksi AI ditampilkan untuk divalidasi sebelum kandidat dibuat. Notifikasi muncul di navbar saat hasil AI siap ditinjau.
                </p>
              </div>
            </div>
          </section>

          {/* Employees */}
          <section>
            <h2 className="text-headline-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-base">badge</span>
              </span>
              Karyawan (<code className="text-xs">/employees</code>)
            </h2>
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high p-6 space-y-4">
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Monitoring Karyawan Outsource</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Halaman Employees menampilkan seluruh karyawan aktif beserta status kontrak. Badge peringatan muncul untuk kontrak yang berakhir dalam 30 hari. Filter tersedia berdasarkan status, penempatan, dan masa berlaku kontrak.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Tab Detail Karyawan</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Halaman detail karyawan memiliki tab: <strong>Data Pribadi</strong>, <strong>Kontrak</strong> (riwayat dan tambah kontrak baru), <strong>Payroll</strong> (hanya Manager/Admin), dan <strong>Dokumen</strong>.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Payroll</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Data payroll (THP, rekening bank, BPJS, NPWP) hanya dapat diakses dan diubah oleh role <strong>Manager</strong> dan <strong>Admin</strong>.
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
              Daftar Hitam (<code className="text-xs">/blacklist</code>)
            </h2>
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high p-6 space-y-4">
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Menambahkan ke Blacklist</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Buka menu Blacklist → Tambah Baru. Pilih kandidat (autocomplete), pilih jenis pelanggaran, isi alasan, dan tanggal kejadian. Pengajuan blacklist oleh HR memerlukan persetujuan Manager.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Approval Blacklist (Manager)</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Manager dapat menyetujui (<em>Approve</em>) atau mencabut (<em>Revoke</em>) status blacklist dari tabel daftar hitam. Status blacklist yang disetujui akan otomatis memunculkan peringatan keras saat kandidat hendak di-assign ke lowongan.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Cooldown Otomatis</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Kandidat yang pernah ditolak pada posisi yang sama dalam 6 bulan terakhir akan memiliki masa cooldown. Sistem menampilkan dialog konfirmasi override saat HR/Manager mencoba meng-assign kandidat tersebut.
                </p>
              </div>
            </div>
          </section>

          {/* AI Features */}
          <section>
            <h2 className="text-headline-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-secondary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary text-base">auto_awesome</span>
              </span>
              Fitur AI
            </h2>
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high p-6 space-y-4">
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">AI Sourcing (Two-Stage Matching)</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Tersedia di <strong>Applications → Tambah Lamaran</strong> untuk semua role. Sistem menyaring kandidat secara efisien: SQL filter di tahap pertama (gratis/0 token), diikuti penilaian LLM terfokus pada 10–15 kandidat teratas (~10.000–15.000 token per pencarian).
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">AI Natural Language Search (Manager only)</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Menu <strong>AI Search</strong> di sidebar memungkinkan Manager mencari kandidat menggunakan bahasa alami, misalnya <em>"Cari programmer Java senior minimal 4 tahun pengalaman di perbankan"</em>. AI menerjemahkan query ke filter database yang aman.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Toggle AI Screening saat Assign</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Saat melakukan bulk assign kandidat ke lowongan, <strong>hanya role Admin dan Manager</strong> yang dapat melihat dan mengaktifkan toggle <em>"Jalankan AI Screening"</em>. Role HR tidak dapat melihat toggle ini untuk menjaga efisiensi biaya token.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Notifikasi AI Selesai</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Ikon lonceng di navbar menampilkan notifikasi saat hasil ekstraksi AI selesai diproses. Klik notifikasi untuk langsung menuju halaman Pending Review.
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
                  Hanya Admin yang dapat mengelola akun pengguna, menetapkan role (<em>admin</em>, <em>manager</em>, <em>hr</em>), dan menonaktifkan akun.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Konfigurasi Posisi</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Kelola posisi aktif per client melalui <strong>Admin → Positions</strong>. Setiap posisi dapat dikonfigurasi dengan budget gaji maksimal, kota penempatan, daftar PIC User Klien, dan konfigurasi AI Screening (threshold skor, bobot penilaian, skill wajib).
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Konfigurasi Client</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Tambah dan kelola data perusahaan klien melalui <strong>Admin → Clients</strong>. Data klien digunakan sebagai referensi untuk setiap posisi dan laporan.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Template CV Standar</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Konfigurasi dan pratinjau template CV standar Altek melalui <strong>Admin → CV Templates</strong>. CV yang digenerate otomatis menyembunyikan informasi kontak pribadi kandidat.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Export Data</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Tombol export tersedia di halaman Database dan Applications. File Excel dapat dihasilkan dengan filter dinamis: posisi, domisili, rentang gaji, status talent pool, dan periode waktu.
                </p>
              </div>
            </div>
          </section>

          {/* RBAC Summary */}
          <section>
            <h2 className="text-headline-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-base">shield</span>
              </span>
              Hak Akses per Role
            </h2>
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high p-6 overflow-x-auto">
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="border-b border-surface-container-high">
                    <th className="text-left pb-2 text-label-sm font-semibold text-on-surface">Fitur</th>
                    <th className="text-center pb-2 text-label-sm font-semibold text-on-surface px-3">HR</th>
                    <th className="text-center pb-2 text-label-sm font-semibold text-on-surface px-3">Manager</th>
                    <th className="text-center pb-2 text-label-sm font-semibold text-on-surface px-3">Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high text-on-surface-variant">
                  <tr>
                    <td className="py-2">CRUD Kandidat &amp; Upload Dokumen</td>
                    <td className="text-center py-2 px-3">✓</td>
                    <td className="text-center py-2 px-3">✓</td>
                    <td className="text-center py-2 px-3">✓</td>
                  </tr>
                  <tr>
                    <td className="py-2">Bulk Upload CV ke Database</td>
                    <td className="text-center py-2 px-3">✓</td>
                    <td className="text-center py-2 px-3">✓</td>
                    <td className="text-center py-2 px-3">✓</td>
                  </tr>
                  <tr>
                    <td className="py-2">Set / Unset Status Talent Pool</td>
                    <td className="text-center py-2 px-3">✓</td>
                    <td className="text-center py-2 px-3">✓</td>
                    <td className="text-center py-2 px-3">✓</td>
                  </tr>
                  <tr>
                    <td className="py-2">Assign Kandidat ke Lowongan</td>
                    <td className="text-center py-2 px-3">✓</td>
                    <td className="text-center py-2 px-3">✓</td>
                    <td className="text-center py-2 px-3">✓</td>
                  </tr>
                  <tr>
                    <td className="py-2">Toggle AI Screening saat Assign</td>
                    <td className="text-center py-2 px-3 text-error">✗</td>
                    <td className="text-center py-2 px-3">✓</td>
                    <td className="text-center py-2 px-3">✓</td>
                  </tr>
                  <tr>
                    <td className="py-2">Approve / Revoke Blacklist</td>
                    <td className="text-center py-2 px-3 text-error">✗</td>
                    <td className="text-center py-2 px-3">✓</td>
                    <td className="text-center py-2 px-3">✓</td>
                  </tr>
                  <tr>
                    <td className="py-2">Natural Language Search (AI)</td>
                    <td className="text-center py-2 px-3 text-error">✗</td>
                    <td className="text-center py-2 px-3">✓</td>
                    <td className="text-center py-2 px-3 text-error">✗</td>
                  </tr>
                  <tr>
                    <td className="py-2">Dashboard Analytics &amp; Reports</td>
                    <td className="text-center py-2 px-3 text-error">✗</td>
                    <td className="text-center py-2 px-3">✓</td>
                    <td className="text-center py-2 px-3">✓</td>
                  </tr>
                  <tr>
                    <td className="py-2">Akses Payroll Karyawan</td>
                    <td className="text-center py-2 px-3 text-error">✗</td>
                    <td className="text-center py-2 px-3">✓</td>
                    <td className="text-center py-2 px-3">✓</td>
                  </tr>
                  <tr>
                    <td className="py-2">Manajemen User &amp; Master Data</td>
                    <td className="text-center py-2 px-3 text-error">✗</td>
                    <td className="text-center py-2 px-3 text-error">✗</td>
                    <td className="text-center py-2 px-3">✓</td>
                  </tr>
                </tbody>
              </table>
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
                  Klik <em>"Lupa kata sandi"</em> di halaman login dan masukkan email kerja Anda. Instruksi reset akan dikirimkan melalui email.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Apa perbedaan Database dan Talent Pool?</h3>
                <p className="text-body-sm text-on-surface-variant">
                  <strong>Database</strong> menampilkan semua kandidat di sistem (status <em>database</em>). <strong>Talent Pool</strong> hanya menampilkan kandidat yang sengaja disimpan untuk pertimbangan di masa depan (status <em>talent_pool</em>). Kandidat dapat dipindahkan antar status kapan saja.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Mengapa toggle AI Screening tidak muncul saat Assign?</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Toggle AI Screening hanya ditampilkan untuk role <strong>Manager</strong> dan <strong>Admin</strong> untuk mengendalikan biaya token AI. Role HR akan langsung mengassign kandidat tanpa scoring AI.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Berapa lama proses ekstraksi CV massal?</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Proses berjalan di latar belakang secara asinkron. Upload 20 CV biasanya selesai dalam beberapa menit tergantung ukuran file. Notifikasi lonceng di navbar akan muncul ketika semua hasil siap ditinjau.
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Siapa yang dapat mengakses panel Admin?</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Hanya pengguna dengan role <strong>Admin</strong> yang memiliki akses penuh ke panel pengaturan (Users, Clients, Positions, Blacklist Statuses, Agreement Types).
                </p>
              </div>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface mb-1">Bagaimana cara menghubungi administrator?</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Hubungi tim Admin melalui halaman bantuan atau kirim email ke support perusahaan Anda.
                </p>
              </div>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}
