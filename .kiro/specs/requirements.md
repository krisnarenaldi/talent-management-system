# Requirements — Talent Management System (TMS)
**Client:** Altek (Perusahaan Penyedia Jasa Rekrutmen / RPO)
**Versi:** 1.0
**Tanggal:** September 2026

---

## 1. Latar Belakang

Altek adalah perusahaan penyedia jasa rekrutmen yang menyalurkan talent ke perusahaan kliennya (mayoritas Bank). Seluruh proses rekrutmen — dari pencarian kandidat, screening CV, tracking pipeline interview, hingga monitoring karyawan outsource — saat ini dilakukan secara manual.

TMS dibangun untuk mendigitalkan seluruh alur tersebut: database kandidat terpusat, standarisasi CV, pipeline rekrutmen end-to-end, blacklist, serta AI screening (bertahap).

---

## 2. Roles & Akses

| Role | Deskripsi Akses |
|---|---|
| **HR** | CRUD kandidat, upload dokumen, update tahapan rekrutmen, input catatan, generate CV standar |
| **Manager** | Semua akses HR + approval blacklist, dashboard analytics, **Natural Language Search** (eksklusif) |
| **Admin** | Kelola user & hak akses, master data (Client, Position, Blacklist Status Type, Agreement Type, CV template), export data |

> Pihak klien Bank **tidak memiliki akses login** ke sistem — laporan dikirim manual oleh HR/Manager dalam bentuk Excel atau PDF.

---

## 3. Kebutuhan Fungsional

### FR-01: Autentikasi & Manajemen User
- `FR-01.1` Login dengan email & password
- `FR-01.2` Admin dapat CRUD user beserta role-nya
- `FR-01.3` Role-based access control (RBAC) diterapkan di level API, bukan hanya UI
- `FR-01.4` Session management dengan JWT (access token + refresh token)

### FR-02: Manajemen Master Data (Admin)
- `FR-02.1` CRUD data Client (nama, industri, PIC, kontak PIC)
- `FR-02.2` CRUD Position per Client (judul, requirement, tipe pekerjaan, durasi kontrak, status aktif)
- `FR-02.3` CRUD Blacklist Status Type (master data, bisa ditambah/dinonaktifkan, tidak hardcoded)
- `FR-02.4` CRUD Agreement Type / Jenis Perjanjian Altek-Klien (master data, bisa ditambah/dinonaktifkan)
- `FR-02.5` Kelola template CV standar

### FR-03: Manajemen Database Kandidat
- `FR-03.1` CRUD data kandidat: nama, email, telepon, NIK/KTP, domisili, foto, channel sumber (LinkedIn/Glints/Email/dll), gaji saat ini, gaji diharapkan, notice period
- `FR-03.2` Riwayat pendidikan: bisa lebih dari satu entri (institusi, jurusan, tahun lulus, IPK)
- `FR-03.3` Riwayat pengalaman kerja: bisa lebih dari satu entri (perusahaan, jabatan, periode, deskripsi)
- `FR-03.4` Upload dokumen kandidat: CV asli, foto, KTP, KK, Ijazah, Transkrip, Sertifikat, Surat BI Checking (opsional) — disimpan sebagai baris terpisah per tipe dokumen agar fleksibel
- `FR-03.5` Flag kelengkapan dokumen ("belum lengkap") dan flag kontak tidak dapat dihubungi
- `FR-03.6` **Deteksi duplikat**: saat input kandidat baru, sistem mengecek kecocokan email & no. HP; jika cocok satu (bukan keduanya), tandai sebagai kemungkinan duplikat untuk review manual
- `FR-03.7` Catatan bebas oleh recruiter per kandidat
- `FR-03.8` Cek otomatis blacklist saat input kandidat baru: cocokkan berdasarkan email / no. HP / NIK, tampilkan warning jika match

### FR-04: Tracking Pipeline Rekrutmen
- `FR-04.1` Satu kandidat dapat memiliki lebih dari satu Application (terhadap posisi/waktu berbeda) tanpa menimpa riwayat
- `FR-04.2` Setiap perubahan tahapan disimpan di Stage_History dengan timestamp & user yang mengupdate (audit trail)
- `FR-04.3` Tahapan pipeline yang di-track per Application:

| # | Tahapan | Field Input |
|---|---|---|
| 1 | Dijadwalkan Interview | Tanggal jadwal |
| 2 | Konfirmasi Kehadiran | Status: OK / Reschedule (+ form tanggal baru jika reschedule) |
| 3 | Interview HR/Recruiter | Gaji saat ini, gaji diharapkan, catatan bebas; radio: Lanjut / Not Recommended |
| 4 | Psikotest | Tanggal psikotest; radio: Lolos / Tidak Lolos |
| 5 | Interview User (Client) | Tanggal, catatan |
| 6 | Offering | Radio: Lolos Kontrak / Negosiasi (sub-status: OK / Not OK) |
| 7 | Tanda Tangan Kontrak | Tanggal TTD |
| 8 | Onboarding | Tanggal onboarding |
| 9 | Existing | Status karyawan aktif (trigger pembuatan Employee record) |

- `FR-04.4` Saat Application mencapai tahap **Existing**, sistem otomatis membuat **Employee record** baru dengan data awal dari Candidate

### FR-05: Blacklist
- `FR-05.1` HR/Manager dapat menambah kandidat ke daftar blacklist dengan memilih status type, mengisi alasan, catatan, dan tanggal
- `FR-05.2` Approval blacklist ada di tangan Manager
- `FR-05.3` Status blacklist default (seed data): Menolak Offer Tanpa Alasan Jelas, Tidak Hadir Interview Tanpa Konfirmasi, Terbukti Manipulasi Data, Bermasalah di Tempat Kerja Client, Referensi Negatif
- `FR-05.4` Admin dapat menambah/menonaktifkan jenis status blacklist kapan saja tanpa deployment ulang

### FR-06: Export & Laporan
- `FR-06.1` Export seluruh atau sebagian database kandidat ke Excel, dengan filter: posisi, status, periode, dll
- `FR-06.2` Laporan kandidat dengan data belum lengkap
- `FR-06.3` Export pipeline rekrutmen per posisi/periode

### FR-07: Standarisasi CV (Fase 2)
- `FR-07.1` Generate CV standar sesuai template Altek, tanpa PII (email/no. HP dihilangkan)
- `FR-07.2` Foto kandidat diupload **manual** oleh HR (bukan diekstrak otomatis dari PDF) — keputusan klien
- `FR-07.3` Jika foto belum diupload, layout CV menyesuaikan otomatis (tidak ada slot kosong)
- `FR-07.4` Summary/ringkasan kandidat: bisa ditulis manual oleh HR atau digenerate AI, dengan pilihan bahasa (ID/EN)

### FR-08: AI Screening & Ekstraksi CV (Fase 3)
- `FR-08.1` Ekstraksi teks dari PDF menggunakan PyMuPDF/pdfplumber (text-based PDF); untuk CV hasil scan, gunakan OCR biasa (Tesseract/PaddleOCR) terlebih dahulu — **bukan model vision LLM** (lebih murah, sesuai keputusan klien)
- `FR-08.2` AI (model text-only) mengekstrak field terstruktur: nama, kontak, pendidikan, pengalaman, skill → mengisi kolom database
- `FR-08.3` **Wajib ada UI review/edit** sebelum data hasil ekstraksi AI tersimpan final (human-in-the-loop)
- `FR-08.4` AI mencocokkan profil kandidat dengan requirement posisi dan memberi scoring/ranking
- `FR-08.5` AI menyusun draft daftar "Project" dari pengalaman kerja kandidat; recruiter edit/setujui sebelum masuk CV final
- `FR-08.6` Proses ekstraksi berjalan **asinkron** (antrian/queue) — tidak memblokir upload dan tidak membekukan UI
- `FR-08.7` Estimasi biaya operasional AI: ~Rp 400–900 ribu/bulan untuk 200 CV/hari (text-only, tergantung model yang dipilih)

### FR-09: Natural Language Search (Fase 3, Eksklusif Manager)
- `FR-09.1` Hanya role **Manager** yang dapat mengakses fitur ini, dibatasi di level API (bukan hanya UI)
- `FR-09.2` Manager mengetik query bahasa natural, AI menerjemahkan ke filter terstruktur (JSON) — **bukan** AI membuat SQL mentah langsung ke database (mencegah SQL injection & query tidak valid)
- `FR-09.3` Filter terstruktur dieksekusi oleh backend sebagai query database normal
- `FR-09.4` Manager dapat melihat filter yang dipakai AI (transparansi) untuk koreksi jika salah tafsir

### FR-10: Dashboard Analytics (Fase 4)
- `FR-10.1` Jumlah kandidat per tahapan, per posisi, per periode
- `FR-10.2` Rasio lolos vs ditolak di tahap User Interview
- `FR-10.3` Pola sederhana: posisi/sumber/karakteristik CV dengan rasio lolos tertinggi (analisis deskriptif)

### FR-11: Modul Karyawan / Monitoring Outsource
- `FR-11.1` Employee record dibuat otomatis saat Application mencapai tahap Existing, membawa data dari Candidate
- `FR-11.2` Data karyawan mencakup: data pribadi & identitas, status & penempatan, riwayat kontrak, payroll, dokumen
- `FR-11.3` **Usia dan masa kontrak berjalan dihitung otomatis** dari tanggal lahir & join date — tidak disimpan sebagai kolom statis
- `FR-11.4` Riwayat kontrak disimpan per periode (Employee_Contract terpisah) — tidak menimpa data lama saat perpanjangan
- `FR-11.5` Data payroll (THP, rekening, BPJS, NPWP) disimpan di tabel terpisah (Employee_Payroll) dengan akses dibatasi ke **Manager & Admin** saja
- `FR-11.6` Dokumen karyawan disimpan sebagai baris per tipe (fleksibel, sama pola dengan dokumen kandidat)
- `FR-11.7` Form input karyawan dibagi menjadi tab: **Data Pribadi / Kontrak / Payroll / Dokumen**

---

## 4. Kebutuhan Non-Fungsional

| ID | Kebutuhan | Detail |
|---|---|---|
| NFR-01 | **Asinkron** | Proses PDF parsing & AI ekstraksi harus masuk antrian (queue via n8n/Redis), tidak boleh memblokir HTTP request |
| NFR-02 | **Keamanan data** | Enkripsi at-rest untuk dokumen (via OneDrive Business); akses berbasis role; audit log akses dokumen sensitif |
| NFR-03 | **Audit trail** | Setiap perubahan status tahapan dicatat dengan `updated_by` (user ID) dan timestamp |
| NFR-04 | **Volume** | ±200 CV/hari (~6.000/bulan); sistem dirancang menampung pertumbuhan moderat |
| NFR-05 | **File storage** | OneDrive for Business (1TB, sudah dibayar klien) via Microsoft Graph API — server hanya simpan referensi `file_url`, bukan file fisik |
| NFR-06 | **Backup** | `pg_dump` terjadwal harian, hasil disimpan ke OneDrive |
| NFR-07 | **Connection pooling** | PgBouncer untuk mengelola koneksi dari Next.js + FastAPI + n8n ke PostgreSQL |
| NFR-08 | **Monitoring** | Pantau disk, RAM, CPU, kuota OneDrive sejak awal |
| NFR-09 | **UU PDP** | Perlu kebijakan retensi data kandidat yang tidak lolos (open question, perlu konfirmasi klien) |

---

## 5. Infrastruktur & Arsitektur

### Stack
| Layer | Teknologi |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS |
| Backend | FastAPI (Python) |
| Database | PostgreSQL |
| Automation / Queue | n8n (self-hosted) |
| File Storage | OneDrive for Business via Microsoft Graph API |
| Containerisasi | Docker Compose |
| Server | Hostinger VPS (lihat opsi di bawah) |

### Rekomendasi VPS Hostinger

| Paket | Spek | Harga | Cocok untuk |
|---|---|---|---|
| **KVM 1** | 1 vCPU, 4 GB RAM, 50 GB NVMe | $6.49/mo | Terlalu kecil untuk semua komponen bersamaan — **tidak disarankan** |
| **KVM 2** ✅ | 2 vCPU, 8 GB RAM, 100 GB NVMe | $8.99/mo | **Cukup untuk MVP/pilot** dengan Docker Compose |
| **KVM 4** | 4 vCPU, 16 GB RAM, 200 GB NVMe | $12.99/mo | Disarankan jika volume naik atau tim HR >5 orang aktif bersamaan |

**Kesimpulan: Ya, semua komponen bisa dalam satu server KVM 2**, dengan syarat:
1. Proses PDF parsing/OCR berjalan asinkron (tidak sinkron di HTTP request)
2. File dokumen tidak disimpan di disk VPS — semua ke OneDrive via Graph API
3. Connection pooling dengan PgBouncer aktif
4. Monitoring disk & RAM sejak awal
5. Siapkan rencana upgrade ke KVM 4 jika tim berkembang

### Deployment Architecture (Single Server, Docker Compose)
```
┌─────────────────────────────── Hostinger VPS KVM 2 ────────────────────────────────┐
│                                                                                      │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────────────────┐ │
│  │  Next.js    │   │   FastAPI   │   │ PostgreSQL  │   │   n8n (automation)      │ │
│  │  (port 3000)│──▶│  (port 8000)│──▶│  (port 5432)│   │   (port 5678)           │ │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────────────────┘ │
│         │                │                  │                      │                 │
│  ┌──────┴────────────────┴──────────────────┘                      │                 │
│  │              PgBouncer (connection pooling)                      │                 │
│  └─────────────────────────────────────────────────────────────────┘                 │
│                                                                                      │
│  Reverse Proxy: Nginx (port 80/443, SSL via Let's Encrypt)                          │
└─────────────────────────────────────────────────────────────────────────────────────┘
                    │                          │
          Microsoft Graph API          LLM API (Anthropic/
          (OneDrive for Business)      OpenAI/Gemini — eksternal)
```

### Alur Integrasi File (OneDrive for Business)
- **Upload**: Next.js → FastAPI → Microsoft Graph API → OneDrive
- **Referensi**: `file_url` / `drive_item_id` disimpan di PostgreSQL
- **Download**: FastAPI menghasilkan pre-authenticated URL (`@microsoft.graph.downloadUrl`) → browser langsung download dari OneDrive
- File >4MB menggunakan *upload session* Graph API
- Disk lokal VPS hanya dipakai sementara saat parsing PDF, kemudian file dihapus

---

## 6. Fasa Implementasi

| Fase | Fokus | Modul |
|---|---|---|
| **Fase 1 — MVP** | Database & pipeline inti | FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, FR-11 (sebagian) |
| **Fase 2 — Standarisasi CV** | Otomasi dokumen | FR-07 |
| **Fase 3 — AI** | Ekstraksi & scoring | FR-08, FR-09 |
| **Fase 4 — Analytics** | Insight & pola | FR-10 |

Fase 1 bisa langsung dipakai operasional; Fase 2–4 dikembangkan menyusul tanpa memblokir go-live.

---

## 7. Open Questions (Perlu Konfirmasi Klien)

1. Apakah PM/klien Bank butuh akses login, atau laporan dikirim manual (Excel/PDF)?
2. Kebijakan retensi data kandidat tidak lolos (terkait UU PDP)
3. Target akurasi minimum AI ekstraksi sebelum dianggap siap produksi
4. Contoh template CV standar Altek (disebutkan akan dilampirkan saat kickoff)
5. Sample CV asli berbagai format untuk uji akurasi parsing (dibutuhkan sebelum Fase 3)
6. Siapa admin M365 dari sisi Altek yang bisa mendaftarkan aplikasi di Microsoft Entra?
7. Role mana yang boleh akses data payroll penuh (selain Manager & Admin)?
8. Daftar baku jenis perjanjian (PKWT/PKWTT/PPJP dll) sebagai seed data Agreement Type
