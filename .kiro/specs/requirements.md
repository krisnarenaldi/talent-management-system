# Requirements — Talent Management System (TMS)
**Client:** Altek (Perusahaan Penyedia Jasa Rekrutmen / RPO)  
**Versi:** 2.0 (Pasca-UAT Flow Revision)  
**Tanggal:** Oktober 2026  

---

## 1. Latar Belakang & Revisi Alur v2.0

Altek adalah perusahaan penyedia jasa rekrutmen yang menyalurkan talent ke perusahaan kliennya (mayoritas Bank dan institusi keuangan). Seluruh proses rekrutmen — dari pencarian kandidat, screening CV, tracking pipeline interview, hingga monitoring karyawan outsource — didigitalkan melalui TMS.

### Konteks Perubahan Alur v2.0 (Hasil UAT Klien):
Berdasarkan evaluasi UAT bersama klien, alur kerja rekrutmen di lapangan memiliki karakteristik penting:
1. **Sourcing Multikanal Massal:** HR memasang lowongan kerja di berbagai job portal eksternal (Glints, LinkedIn, Jobstreet, Indeed, dsb.) dan mengunduh CV pelamar secara massal (*bulk download*).
2. **Database Ingestion Pertama Kali:** HR membutuhkan tempat penampungan terpusat (CV Bank / Database Kandidat) untuk mengunggah puluhan hingga ratusan CV sekaligus tanpa harus langsung mengikat CV tersebut ke satu lowongan tertentu. Ekstraksi data (nama, kontak, pendidikan, pengalaman, skill) harus dilakukan otomatis oleh AI saat ingestion tanpa memicu penilaian kecocokan (*scoring*) posisi.
3. **Penyortiran Talent Pool Pasca-Evaluasi HR:**
   - Kandidat yang dinilai potensial dan cocok secara kualifikasi namun tidak sepakat di ekspektasi gaji dikelompokkan ke dalam **"Talent Pool"** agar dapat dihubungi kembali ketika ada lowongan dengan budget sesuai.
   - Kandidat yang belum cocok dari segi skill atau pengalaman disimpan di dalam Database umum sebagai **"Kebutuhan Masa Depan" (Future Leads)**.
4. **Sourcing Fleksibel ke Lowongan:** Ketika ada posisi baru, HR dapat menarik kandidat dari Talent Pool maupun Database umum ke dalam pipeline lamaran, baik melalui pencarian manual (*bulk assign*) maupun melalui asisten rekomendasi AI (*AI Sourcing & Matching*).

---

## 2. Roles & Hak Akses (RBAC)

| Role | Deskripsi Hak Akses Utama | Hak Akses Spesifik Fitur AI & Sourcing |
|---|---|---|
| **HR** | • CRUD kandidat & upload dokumen<br>• Bulk upload CV ke Database umum<br>• Set/Unset status Talent Pool<br>• Assign kandidat ke lowongan kerja<br>• Update tahapan interview & pipeline lamaran<br>• Generate CV standar Altek | • Menjalankan AI Sourcing di `/applications/new`<br>• **TIDAK DAPAT** melihat atau mengakses Toggle "Jalankan AI Screening" saat Assign manual (otomatis 0 token)<br>• Tidak memiliki akses Natural Language Search |
| **Manager** | • Seluruh akses HR<br>• Approval pengajuan blacklist<br>• Dashboard analytics lengkap<br>• Natural Language Search (eksklusif) | • **DAPAT melihat dan mengatur Toggle "Jalankan AI Screening"** saat bulk assign kandidat ke lowongan<br>• Konfigurasi bobot penilaian AI per posisi |
| **Admin** | • Kelola akun user & hak akses<br>• Master data (Client, Position, Blacklist Status, Agreement Type, Template CV)<br>• Export data sistem | • **DAPAT melihat dan mengatur Toggle "Jalankan AI Screening"** saat bulk assign kandidat ke lowongan<br>• Akses penuh audit log dan monitoring penggunaan token API |

> **Kebijakan Pihak Klien:** PIC/User dari perusahaan klien Bank **tidak memiliki akses login** langsung ke aplikasi. User klien dicatat sebagai master data referensi agar setiap lamaran terasosiasi dengan PIC spesifik dari sisi klien. Laporan progres rekrutmen dikirimkan oleh HR/Manager Altek dalam format Excel/PDF.

---

## 3. Kebutuhan Fungsional (Functional Requirements)

### FR-01: Autentikasi & Manajemen User
- `FR-01.1` Login dengan email & password terenkripsi.
- `FR-01.2` Admin dapat melakukan CRUD user beserta penetapan rolenya (`admin`, `manager`, `hr`).
- `FR-01.3` Role-Based Access Control (RBAC) ditegakkan secara ketat di level API FastAPI dependency (`require_role`), bukan hanya penyembunyian komponen di antarmuka frontend.
- `FR-01.4` Manajemen sesi menggunakan JWT (Access Token 15 menit + Refresh Token 7 hari) disimpan dalam httpOnly secure cookie.

### FR-02: Manajemen Master Data (Admin)
- `FR-02.1` CRUD data Client (nama perusahaan, industri, PIC utama, kontak).
- `FR-02.2` CRUD Position per Client (judul, requirement, job description, budget gaji, batas pengalaman, status aktif).
- `FR-02.3` CRUD User Klien (PIC User spesifik dari pihak klien, misalnya "Joni", "Ahmad", yang bertindak sebagai pewawancara teknis/user di perusahaan klien).
- `FR-02.4` CRUD Blacklist Status Type (master data dinamis untuk kategori pelanggaran kandidat).
- `FR-02.5` CRUD Agreement Type / Jenis Perjanjian Altek-Klien (PKWT, PKWTT, Freelance, dll).
- `FR-02.6` Kelola template CV standar Altek.

### FR-03: Manajemen Database Kandidat & Talent Pool (Diperbarui v2.0)
- `FR-03.1` CRUD data profil kandidat: nama lengkap, email, telepon, NIK KTP, tanggal lahir, tempat lahir, jenis kelamin, status pernikahan, domisili, foto, channel sumber (LinkedIn, Glints, Jobstreet, dll), gaji saat ini, gaji yang diharapkan, notice period, dan catatan bebas recruiter.
- `FR-03.2` Riwayat pendidikan multi-entri (institusi, jurusan, tahun kelulusan, IPK).
- `FR-03.3` Riwayat pengalaman kerja multi-entri (perusahaan, jabatan, periode kerja, deskripsi pekerjaan).
- `FR-03.4` Upload dokumen kandidat per baris tipe: CV Asli, Foto, KTP, KK, Ijazah, Transkrip, Sertifikat, dan Hasil BI Checking.
- `FR-03.5` Deteksi duplikasi otomatis berdasarkan kecocokan email, nomor HP, atau NIK KTP.
- `FR-03.6` Cek otomatis status blacklist saat input atau assign kandidat.
- `FR-03.7` **Bulk Upload CV Mandiri ke Database (CV Ingestion di `/candidates/new`):**
  - HR/Manager/Admin dapat mengunggah file CV (PDF/DOCX) secara massal (hingga 20 file per batch) langsung ke Database Kandidat tanpa harus memilih posisi pekerjaan dan tanpa memilih sumber lamaran.
  - Sistem melakukan validasi format dan ukuran file (maksimal 5 MB per file).
  - Sistem mengekstrak teks PDF/DOCX dan memanggil model LLM ekstraksi untuk mengidentifikasi field entitas: Nama, Email, Telepon, NIK KTP, Skill, Riwayat Pendidikan, dan Riwayat Pengalaman Kerja.
  - **Deteksi duplikasi otomatis:** Setelah ekstraksi, sistem memeriksa kecocokan email, nomor HP, atau NIK KTP dengan kandidat yang sudah ada di database. Jika ditemukan duplikat, record `ai_screening_result` diberi status `duplikat` dan ditautkan ke kandidat existing.
  - **Cek blacklist otomatis:** Sistem memeriksa status blacklist aktif berdasarkan email, nomor HP, atau NIK KTP. Jika kandidat terblacklist, record diberi status `blacklisted` dengan catatan alasan pelanggaran.
  - Data hasil ekstraksi (jika lolos duplikat dan blacklist) otomatis diinput ke tabel `candidate`, `candidate_education`, `candidate_experience`, dan menyimpan file fisik CV asli ke storage OneDrive.
  - Jika terjadi kegagalan pembacaan teks (misal: PDF/DOCX hasil scan tanpa OCR atau dokumen rusak), sistem memberikan peringatan kesalahan status (status: `error`) dan menyediakan tautan langsung untuk input/koreksi data manual kandidat.
- `FR-03.8` **Manajemen Status Talent Pool:**
  - Setiap kandidat memiliki flag status pool: `pool_status` (`database`, `talent_pool`, `future_lead`).
  - Di tabel halaman `/candidates`, pada kolom "Aksi" tersedia kontrol cepat (toggle/checkbox/modal) untuk mengubah flag kandidat menjadi **"Talent Pool"**.
  - Saat kandidat dimasukkan ke Talent Pool, sistem menyediakan opsi input alasan:
    1. *Gaji Tidak Sesuai* (kandidat kompeten namun ekspektasi gaji di atas budget).
    2. *Kebutuhan Masa Depan* (skill/pengalaman belum sesuai dengan lowongan yang dibuka saat ini).
    3. *Lainnya* (+ catatan bebas recruiter).
- `FR-03.9` **Halaman Dedicated "Talent Pool":**
  - Menu navigasi baru di sidebar bernama **"Talent Pool"**.
  - Halaman ini menampilkan tabel kandidat yang memiliki status `pool_status = 'talent_pool'`.
  - Fitur pencarian, filter kota/domisili, filter pendidikan, filter pengalaman, dan filter rentang gaji berfungsi sama persis dengan tabel database utama `/candidates`.
- `FR-03.10` **Bulk Assign Kandidat ke Lowongan (Manual Push):**
  - Di halaman `/candidates` dan `/talent-pool`, HR dapat memilih satu atau beberapa kandidat menggunakan checkbox baris tabel.
  - Tombol aksi massal: **"Assign ke Lowongan"**.
  - Modal konfirmasi menampilkan: daftar nama kandidat terpilih, dropdown pencarian posisi aktif, peringatan blacklist/cooldown, dan **Toggle "Jalankan AI Screening"**:
    - **Pembatasan Hak Akses:** Toggle ini **HANYA muncul dan dapat diatur oleh role Admin dan Manager**. Role **HR tidak dapat melihat keberadaan toggle ini** (disembunyikan dari UI dan dijamin non-aktif di backend).
    - **Jika Toggle Non-Aktif (atau user HR):** Sistem langsung membuat relasi `Application` di tahap "Dijadwalkan Interview" dengan **0 konsumsi token API**.
    - **Jika Toggle Aktif (Admin/Manager):** Sistem membuat `Application` dan mendaftarkan task asinkron ke worker untuk menghitung skor kecocokan CV terhadap posisi terkait.

### FR-04: Tracking Pipeline Rekrutmen
- `FR-04.1` Satu kandidat dapat memiliki beberapa record `Application` terhadap posisi/waktu berbeda tanpa menimpa riwayat masa lalu.
- `FR-04.2` Setiap perubahan tahapan pipeline dicatat ke `Stage_History` lengkap dengan timestamp, catatan hasil (*pass, fail, negosiasi, reschedule*), dan user yang melakukan update (audit trail).
- `FR-04.3` Tahapan pipeline berurutan:
  1. *Dijadwalkan Interview*
  2. *Konfirmasi Kehadiran* (OK / Reschedule)
  3. *Interview HR* (Input gaji saat ini, gaji diharapkan, catatan; Lolos ke User / Simpan ke Talent Pool / Tolak)
  4. *Psikotest* (Opsional sesuai posisi; Lolos / Tidak Lolos)
  5. *Interview User (Client)* (Tanggal, catatan evaluasi user klien)
  6. *Offering* (Lolos Kontrak / Negosiasi)
  7. *Tanda Tangan Kontrak*
  8. *Onboarding*
  9. *Existing* (Karyawan aktif)
- `FR-04.4` Ketika Application mencapai status *Existing*, sistem otomatis membuat record baru di tabel `Employee`.

### FR-05: Blacklist & Cooldown Management
- `FR-05.1` HR/Manager dapat mengajukan kandidat ke daftar blacklist dengan memilih jenis pelanggaran, alasan detail, dan tanggal.
- `FR-05.2` Persetujuan (*approval*) blacklist berada di tangan Manager.
- `FR-05.3` **Cooldown Enforcement:** Kandidat yang pernah ditolak (*rejected*) pada posisi yang sama dalam jangka waktu 6 bulan memiliki masa cooldown. Sistem memunculkan dialog konfirmasi override manual bagi HR/Manager.
- `FR-05.4` Kandidat blacklist aktif yang disetujui akan memunculkan modal peringatan keras saat akan dimasukkan ke suatu lowongan.

### FR-06: Export & Laporan
- `FR-06.1` Export data kandidat ke Excel dengan filter dinamis (posisi, domisili, rentang gaji, status talent pool, periode).
- `FR-06.2` Export data pipeline lamaran per posisi/periode untuk pelaporan berkala ke pihak klien Bank.

### FR-07: Standarisasi CV Altek
- `FR-07.1` Otomatisasi generate format CV Altek tanpa informasi kontak privat (PII redaction: no HP dan email disembunyikan untuk keperluan submission ke klien).
- `FR-07.2` Foto kandidat diunggah secara manual oleh HR (tidak dipotong paksa dari PDF).
- `FR-07.3` Ringkasan kualifikasi profesional dapat digenerate secara otomatis via AI atau ditulis manual oleh recruiter.

### FR-08: AI Screening & Sourcing Terintegrasi di `/applications/new` (Diperbarui v2.0)
- `FR-08.1` **Pusat Sourcing & Input Lamaran di `/applications/new`:**
  - Halaman `/applications/new` memuat form input pemilihan:
    1. **Posisi yang Dilamar:** Dropdown pencarian lowongan aktif.
    2. **User Klien:** Dropdown PIC User dari sisi perusahaan klien (misal: "Joni", "Ahmad") sesuai master data posisi/klien.
    3. **Sumber Kandidat:** Dropdown pilihan sumber:
       - *Talent Pool:* Saring hanya kandidat yang berstatus `talent_pool`.
       - *Database:* Saring kandidat reguler di database.
       - *Semua:* Menggabungkan kandidat Talent Pool dan Database umum.
- `FR-08.2` **Arsitektur Two-Stage Matching (Pencegahan Pemborosan Token):**
  - Sistem dilarang keras mengirimkan seluruh baris database kandidat secara mentah (*brute-force*) ke model LLM.
  - **Tahap 1 — SQL Hard Filter di Database (0 Token, Latensi < 10 ms):**
    - Saring berdasarkan status pool yang dipilih di dropdown Sumber.
    - Saring batas toleransi gaji: `expected_salary <= position.salary_budget` (atau kandidat yang belum menginput ekspektasi gaji).
    - Filter domisili/lokasi sesuai kriteria lowongan jika disyaratkan.
    - Otomatis mengecualikan kandidat yang berstatus Blacklist aktif dan kandidat yang sedang dalam masa Cooldown pada posisi tersebut.
    - Dari 1.000+ kandidat, hasil saringan SQL mengerucutkan kandidat menjadi $\sim$20–50 kandidat potensial.
  - **Tahap 2 — AI Scoring LLM Terfokus (Hemat Biaya Token):**
    - Sistem mengambil maksimal Top 10–15 profil kandidat paling relevan dari Tahap 1.
    - Model LLM hanya menilai 10–15 kandidat tersebut terhadap requirement posisi, menghasilkan skor kecocokan (0–100) dan ringkasan justifikasi singkat.
    - Konsumsi token terkendali ketat ($\sim$10.000–15.000 token per pencarian, biaya $\approx$ Rp 50 – Rp 100).
- `FR-08.3` **Antarmuka Rekomendasi & Pemilihan Kandidat:**
  - Hasil screening AI ditampilkan tepat di bawah form dalam bentuk tabel interaktif:
    - Kolom Checkbox pilihan.
    - Nama Kandidat & Kontak.
    - Skor AI (%) dengan badge visual (Hijau $\ge$ 80%, Kuning 60–79%, Merah < 60%).
    - Ringkasan Alasan Kecocokan AI.
  - HR dapat memilih beberapa kandidat sekaligus menggunakan checkbox, lalu menekan tombol **"Masukkan Kandidat ke Pipeline Lamaran"**.
  - Seluruh kandidat terpilih otomatis dibuatkan entri `Application` dengan tahapan awal "Dijadwalkan Interview".

### FR-09: Natural Language Search (Eksklusif Manager)
- `FR-09.1` Akses khusus role Manager untuk mencari kandidat di seluruh database menggunakan bahasa alami (contoh: *"Cari programmer Java senior minimal 4 tahun pengalaman di perbankan"*).
- `FR-09.2` LLM menerjemahkan query bahasa alami ke parameter JSON terstruktur yang aman, kemudian dieksekusi sebagai query database terparameterisasi (mencegah SQL Injection).

### FR-10: Modul Karyawan & Monitoring Outsource
- `FR-10.1` Terintegrasi otomatis dari kandidat yang lolos tahap *Existing*.
- `FR-10.2` Manajemen data karyawan outsource: data identitas, penempatan di klien Bank, masa berlaku kontrak PKWT, dan payroll terenkripsi (hanya Manager/Admin).

---

## 4. Kebutuhan Non-Fungsional (Non-Functional Requirements)

| ID | Kategori | Spesifikasi & Batasan |
|---|---|---|
| **NFR-01** | **Asinkron & Queue** | Semua pemrosesan file CV massal dan AI scoring berjalan asinkron melalui antrean Arq worker + Redis. Request HTTP upload harus return dalam waktu $< 2$ detik. |
| **NFR-02** | **Efisiensi Token AI** | Sistem menjamin konsumsi token untuk pencarian kandidat tidak melebihi batas 20.000 token per request melalui arsitektur penyaringan bertingkat (*Two-Stage Matching*). |
| **NFR-03** | **Role Enforced Security** | Fitur yang dibatasi role (Toggle AI score, approval blacklist, akses payroll) harus divalidasi ganda: di level komponen UI Next.js dan di level middleware dependency FastAPI. |
| **NFR-04** | **Penyimpanan Dokumen** | Seluruh dokumen fisik disimpan di Microsoft OneDrive for Business via Microsoft Graph API (atau storage lokal di environment staging). Database hanya menyimpan metadata dan URL referensi. |
| **NFR-05** | **Audit Trail** | Setiap perubahan tahapan lamaran, pengubahan status talent pool, dan assigning posisi mencatat `updated_by` dan `created_at`. |

---

## 5. Ringkasan Perubahan v2.0 vs v1.0

```
┌─────────────────────────────────┬────────────────────────────────────────────────────────┐
│ Fitur / Alur                    │ Perubahan di Versi 2.0                                 │
├─────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Ingestion CV Massal             │ Dipindah ke /candidates/new (Database Umum), tanpa      │
│                                 │ mewajibkan pilih posisi dan tanpa scoring posisi.      │
├─────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Konsep Talent Pool              │ Bukan tabel terpisah. Menggunakan flag `pool_status`   │
│                                 │ di tabel `candidate` + halaman dedicated /talent-pool. │
├─────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Assign Kandidat ke Posisi       │ Disediakan Bulk Action Checkbox di tabel kandidat      │
│                                 │ (bukan dropdown per baris yang sempit dan rawan).     │
├─────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Toggle AI Screening saat Assign │ Dibatasi hanya untuk Admin & Manager. Tersembunyi      │
│                                 │ bagi role HR untuk menjaga efisiensi biaya token.      │
├─────────────────────────────────┼────────────────────────────────────────────────────────┤
│ Form /applications/new          │ Berfungsi sebagai Pusat Sourcing: pilih Posisi, User   │
│                                 │ Klien, Sumber (Pool/DB) + Two-Stage AI Matching.       │
└─────────────────────────────────┴────────────────────────────────────────────────────────┘
```
