# PRD — Talent Management System (TMS)
**Client:** Perusahaan Penyedia Sumber Daya Manusia (Recruitment Agency)
**Disusun berdasarkan:** Kickoff 31 Agustus 2026
**Versi:** 1.0 (Draft)

---

## 1. Ringkasan Eksekutif

*Catatan istilah: "Altek" merujuk pada perusahaan penyedia jasa rekrutmen (pemilik sistem ini). "Client" merujuk pada perusahaan yang menerima talent dari Altek (mayoritas Bank) — dua pihak yang berbeda, dipakai konsisten sepanjang dokumen ini.*

Client adalah perusahaan penyedia jasa rekrutmen (outsourcing/RPO) yang menyalurkan talent ke perusahaan client-nya (mayoritas Bank). Saat ini proses pencarian kandidat, screening CV, tracking interview, dan monitoring karyawan outsource masih dilakukan secara manual. TMS dibangun untuk mendigitalkan seluruh alur ini: dari database kandidat, standardisasi CV, tracking pipeline rekrutmen, blacklist, hingga bantuan AI untuk membaca dan menyaring CV.

## 2. Tujuan Bisnis

- Membangun database kandidat terpusat dan mudah dicari
- Membuat standar format CV untuk dikirim ke client
- Mengurangi pekerjaan manual HR & mempercepat screening CV
- Meningkatkan kualitas kandidat yang dikirim ke client
- Tracking proses interview end-to-end
- Monitoring karyawan outsource yang sudah ditempatkan di client

## 3. Peran Pengguna (Roles)

Role dikonfirmasi oleh client: **Admin, HR, Manager**.

| Role | Akses Utama |
|---|---|
| **HR** | CRUD data kandidat, upload dokumen, update tahapan rekrutmen (interview, psikotest, offering, dll), input catatan recruiter, generate CV standar |
| **Manager** | Semua akses HR + approval blacklist, lihat dashboard analytic, kelola master data status blacklist, **akses eksklusif ke Natural Language Search** (lihat 5.9) |
| **Admin** | Kelola user & hak akses, kelola data Client & Position, kelola template CV, export data, konfigurasi sistem (termasuk master data status blacklist) |

*(Catatan: pertanyaan sebelumnya soal akses login untuk pihak PM/client Bank masih terbuka — lihat Bagian 10 Open Questions. Berdasarkan konfirmasi role di atas, saat ini diasumsikan pihak client Bank tidak memiliki login ke sistem; laporan/CV dikirim manual oleh HR/Manager.)*

## 4. Ruang Lingkup & Fasa Implementasi

Mengingat kompleksitas fitur AI (lihat bagian 8), disarankan pengerjaan bertahap:

| Fase | Fokus | Isi |
|---|---|---|
| **Fase 1 — MVP** | Database & pipeline inti | Modul kandidat, upload dokumen, tracking tahapan rekrutmen, blacklist, export Excel, dashboard dasar |
| **Fase 2 — Standarisasi CV** | Otomasi dokumen | Ekstraksi teks/foto dari CV PDF, generate CV standar (tanpa PII), template client |
| **Fase 3 — AI Screening** | Kecerdasan | Parsing struktur data ke kolom (nama, pendidikan, skill, dll), scoring/ranking, matching ke requirement posisi, draft "Project" oleh AI |
| **Fase 4 — Analytics** | Insight | Dashboard pola kandidat lolos/gagal User interview |

Fase 1 bisa langsung dipakai operasional sambil Fase 2–4 dikembangkan paralel/menyusul — ini juga mengurangi risiko karena fitur AI (paling tidak pasti) tidak memblokir go-live sistem inti.

## 5. Kebutuhan Fungsional

### 5.1 Manajemen Database Kandidat
- CRUD data kandidat: nama, no. telepon, email, posisi dilamar, sumber (LinkedIn/Glints/Email/dll), domisili, current & expected salary, notice period
- Riwayat pendidikan (bisa lebih dari satu entri): institusi, jurusan, tahun lulus, IPK
- Riwayat pengalaman kerja (bisa lebih dari satu entri)
- Upload dokumen: CV, foto, KTP, KK, Ijazah, Transkrip, Sertifikat, Surat Keterangan BI Checking (opsional)
- **Deduplikasi:** saat kandidat submit CV berulang kali, sistem cek berdasarkan email & no. HP. Jika no. HP berbeda tapi email sama (atau sebaliknya) → dibuat baris baru namun ditandai sebagai kemungkinan duplikat untuk direview manual (deteksi otomatis 100% akurat tidak realistis, lihat bagian 8)
- Indikator kelengkapan dokumen (flag "belum lengkap")
- Flag jika email/no. HP tidak dapat dihubungi
- Catatan bebas oleh recruiter per kandidat/tahapan

### 5.2 Tracking Pipeline Rekrutmen
Status/tahapan yang di-track per lamaran (Application), sesuai kickoff:

1. **Dijadwalkan Interview**
2. **Konfirmasi Kehadiran** → status OK / Reschedule (dengan form tanggal baru)
3. **Interview HR/Recruiter** → input gaji saat ini, gaji diharapkan, catatan bebas, radio button Lanjut / Not Recommended
4. **Psikotest** → tanggal psikotest, hasil radio button Lolos / Tidak Lolos
5. **Interview User (Client)**
6. **Offering** → radio button Lolos Kontrak / Negosiasi (jika Negosiasi → sub-status OK / Not OK)
7. **Tanda Tangan Kontrak** → tanggal
8. **Onboarding** → tanggal
9. **Existing** → status karyawan aktif di client (untuk monitoring outsource)

Setiap kandidat dapat melamar ke lebih dari satu posisi/waktu (`Application` terpisah dari `Candidate`) sehingga riwayat proses per posisi tetap terjaga dan tidak tertimpa.

### 5.3 Blacklist
- Field: status blacklist, alasan, catatan, tanggal, PIC yang menandai
- **Status blacklist dikonfirmasi client:**
  1. Menolak Offer Tanpa Alasan Jelas
  2. Tidak Hadir Interview Tanpa Konfirmasi (No-Show)
  3. Terbukti Manipulasi Data
  4. Bermasalah di Tempat Kerja Client
  5. Referensi Negatif
- **Field tambah status blacklist baru — bisa disediakan.** Daftar status ini dirancang sebagai *master data* (tabel `Blacklist_Status_Type`), bukan nilai tetap (hardcoded enum) di kode program. Dengan begitu, role **Admin** (atau Manager, sesuai kebijakan) bisa menambah/menonaktifkan jenis status blacklist langsung dari UI kapan pun dibutuhkan, tanpa perlu deployment ulang aplikasi. 5 status di atas jadi data awal (seed data), bukan batas akhir.
- Saat kandidat baru diinput/submit ulang, sistem otomatis mengecek kecocokan by email/no. HP/no. KTP dan menampilkan warning jika match dengan data blacklist

### 5.4 Export & Kelengkapan Data
- Export seluruh/sebagian database ke Excel (dengan filter: posisi, status, tanggal, dll)
- Laporan kandidat dengan data belum lengkap
- Upload dokumen manual di luar alur normal

### 5.5 Standarisasi CV (Layout & Foto)
- **Foto kandidat diupload manual oleh HR** (bukan diekstrak otomatis oleh AI dari PDF) — keputusan client karena mempertimbangkan biaya AI vision/multimodal bulanan. HR mengedit data kandidat dan mengunggah foto lewat field upload yang sudah ada di modul dokumen kandidat (lihat 5.1)
- Susun ulang ke template CV standar milik client (tanpa PII: email, no HP, dll dihilangkan)
- Jika foto belum diupload → layout otomatis menyesuaikan (tanpa slot foto kosong)
- Ringkasan/summary opsional yang bisa ditulis manual oleh HR atau digenerate AI, dengan pilihan bahasa (ID/EN)

### 5.6 AI Screening & Ekstraksi Data CV
- AI membaca isi CV **berbasis teks saja** (bukan gambar/vision — sejalan dengan keputusan di 5.5, sehingga tidak perlu model multimodal untuk fitur ini, biaya lebih murah — lihat 8.5) dan mengekstrak: nama, kontak, pendidikan, pengalaman kerja, skill → mengisi kolom-kolom database (lihat batasan realistis di bagian 8)
- Teks diambil dari PDF menggunakan PyMuPDF/pdfplumber; untuk CV hasil scan/gambar tetap perlu OCR terlebih dahulu (bukan model vision LLM, cukup OCR biasa seperti Tesseract) sebelum masuk ke tahap ekstraksi AI
- AI mencocokkan profil kandidat dengan requirement posisi
- AI memberi scoring/ranking kandidat per posisi
- **Wajib ada tahap review manual** — recruiter memverifikasi/mengedit hasil ekstraksi & scoring AI sebelum data difinalisasi (bukan full-automatic)

### 5.7 AI Drafting "Project" pada CV
- AI membaca pengalaman kerja kandidat, menyusun draft daftar project yang relevan
- Recruiter mengedit/menyetujui draft sebelum masuk ke CV final (human-in-the-loop, sesuai request client)

### 5.8 Natural Language Search (Khusus Role Manager)
Contoh: *"Cari Backend Developer Laravel minimal 3 tahun yang pernah memimpin tim kecil."*

**Cara kerja:**
1. Manager mengetik query bahasa natural di kolom pencarian
2. AI menerjemahkan query menjadi filter terstruktur (JSON) berdasarkan skema field yang **sudah diketahui sistem** (posisi, skill, lama pengalaman, level/leadership, pendidikan, dll) — **bukan** AI membuat query SQL mentah langsung ke database. Ini penting untuk keamanan: AI hanya boleh memilih dari daftar field & operator yang sudah didefinisikan, sehingga tidak ada risiko SQL injection atau AI "mengarang" query yang salah
3. Filter terstruktur itu dijalankan oleh backend (FastAPI) sebagai query database biasa terhadap tabel `Candidate`, `Candidate_Experience`, `Application`, dll
4. Hasil ditampilkan sebagai daftar kandidat, dengan opsi bagi Manager untuk melihat filter apa yang ternyata dipakai (transparansi — supaya Manager bisa koreksi kalau AI salah menafsirkan)

**Kompleksitas yang perlu diantisipasi:**
- Kualitas hasil sangat bergantung pada seberapa terstruktur data pengalaman kerja & skill kandidat sudah tersimpan (field bebas teks seperti "pernah memimpin tim kecil" sulit dicocokkan tanpa data leadership/level jabatan yang jelas di `Candidate_Experience`) — di sinilah manfaat AI ekstraksi CV di Fase 3 saling terhubung dengan fitur ini: makin terstruktur data hasil ekstraksi, makin akurat NL Search-nya
- Ini fitur Fase 3+ (bergantung pada data terstruktur dari fitur AI ekstraksi), bukan Fase 1
- Akses dibatasi ke role **Manager** saja di level API (bukan cuma disembunyikan di UI) — penting karena hasil pencarian bisa membuka data lintas seluruh database kandidat

### 5.9 Dashboard Analytics
- Jumlah kandidat per tahapan, per posisi, per periode
- Rasio lolos vs ditolak di tahap User interview
- Pola sederhana: posisi apa, sumber kandidat apa, atau karakteristik CV apa yang punya rasio lolos lebih tinggi (analisis deskriptif dulu di Fase 4; model prediktif adalah pengembangan lanjutan, bukan Fase 4 awal)

### 5.10 Modul Data Karyawan (Monitoring Outsource di Client)

Begitu status lamaran kandidat mencapai **Existing** (resmi jadi karyawan, ditempatkan sebagai outsource di client/Bank), sistem otomatis membuat satu **Employee record** baru, membawa data yang sudah ada dari Candidate (nama, NIK, no. HP → jadi kandidat data awal), lalu HR melengkapi sisanya. Field-field yang perlu disimpan:

**Data pribadi & identitas**
Nama Karyawan, NIP, tanggal lahir *(usia dihitung otomatis dari tanggal lahir, tidak disimpan sebagai kolom statis supaya selalu akurat)*, tempat lahir, gender, golongan darah, email pribadi, email kantor, no. HP, NIK *(diambil dari data Candidate, tidak diinput ulang)*

**Status & penempatan**
Status karyawan (aktif/cuti/resign), penempatan (site/divisi di client), role & level, status cuti (sudah bisa/belum), tanggal resign & alasan resign (diisi saat karyawan keluar), catatan HR/PM

**Kontrak**
Jenis perjanjian antara Altek dengan client (mis. PKWT, PKWTT, Perjanjian Pemborongan Pekerjaan/PPJP — dirancang sebagai **master data** yang bisa ditambah Admin, sama seperti pola status blacklist di 5.3, karena jenis perjanjian outsourcing bisa bertambah/berubah sesuai kebutuhan legal), nomor kontrak, durasi kontrak, join date, end date, status kontrak (aktif/berakhir/diperpanjang). **Masa kontrak yang sudah berjalan dihitung otomatis** dari join date ke tanggal hari ini/end date — bukan kolom manual yang harus diupdate orang, supaya tidak pernah basi. Riwayat kontrak disimpan per periode (bukan menimpa data lama), sehingga jika kontrak diperpanjang atau karyawan resign-lalu-rehire, riwayatnya tetap lengkap.

**Payroll (data sensitif — akses dibatasi)**
THP, tunjangan yang digunakan/pinjaman, bank untuk payroll, nomor rekening, status & nomor BPJS TK, status & nomor BPJS Kesehatan, NPWP. Karena ini data finansial & identitas sensitif (apalagi konteksnya karyawan ditempatkan di Bank client), **disimpan di tabel terpisah dengan akses lebih ketat** dari data karyawan umum — disarankan hanya role **Manager** dan **Admin** yang bisa melihat kolom-kolom ini secara penuh, bukan semua HR (didiskusikan lebih lanjut dengan client soal siapa saja yang perlu akses payroll).

**Dokumen karyawan**
CV asli terupdate, CV template Altek (hasil standarisasi), offering/payslip dari Altek, application form, KK, KTP, Ijazah, transkrip, kartu digital BPJS TK, kartu digital BPJS Kesehatan, NPWP — disimpan sebagai baris dokumen per jenis (pola sama seperti dokumen kandidat di 5.1), sehingga bisa ditambah jenis dokumen baru ke depannya tanpa ubah skema.

**Catatan desain:** modul ini secara langsung menjawab tujuan bisnis awal "membantu monitoring karyawan outsource di tempat client" dari kickoff. Karena field-nya banyak dan sebagian sensitif, disarankan form input-nya dipecah jadi beberapa tab (Data Pribadi / Kontrak / Payroll / Dokumen) di UI, bukan satu form panjang.

## 6. Kebutuhan Data (ringkas, detail di ERD terpisah)

Lihat file `ERD-TMS.mermaid` untuk skema lengkap. Entitas utama: `Candidate`, `Candidate_Education`, `Candidate_Experience`, `Candidate_Document`, `Generated_CV`, `Client`, `Position`, `Application`, `Stage_History`, `AI_Screening_Result`, `Blacklist`, `Blacklist_Status_Type`, `User`, dan modul karyawan: `Employee`, `Employee_Contract`, `Agreement_Type`, `Employee_Payroll`, `Employee_Document`.

Desain kunci:
- **Candidate** dipisah dari **Application** — satu kandidat bisa punya banyak lamaran ke posisi/waktu berbeda tanpa duplikasi data pribadi
- **Stage_History** menyimpan setiap event tahapan (bukan hanya status terakhir) sehingga riwayat proses lengkap dan bisa diaudit
- Dokumen (CV, foto, KTP, dll) disimpan sebagai baris terpisah di **Candidate_Document** (bukan kolom tetap), supaya fleksibel menambah jenis dokumen baru tanpa migrasi skema
- **Employee** terpisah dari **Candidate/Application** — merepresentasikan status "sudah jadi karyawan", dengan `Employee_Contract` terpisah supaya riwayat perpanjangan kontrak tidak menimpa data lama, dan `Employee_Payroll` dipisah dari data karyawan umum untuk kontrol akses data sensitif
- Field turunan seperti **usia** dan **masa kontrak berjalan** sengaja tidak disimpan sebagai kolom statis — dihitung otomatis dari tanggal lahir/join date di layer aplikasi, supaya selalu akurat tanpa perlu job update berkala
- **Blacklist_Status_Type** dan **Agreement_Type** dirancang sebagai master data (bukan enum hardcode), sehingga Admin bisa menambah opsi baru tanpa deployment ulang


## 7. Kebutuhan Non-Fungsional

- **Volume:** ±200 CV masuk/hari → perlu proses ekstraksi/parsing berjalan asinkron (queue), tidak memblokir upload
- **Keamanan data:** CV berisi PII sensitif (KTP, KK) — enkripsi at-rest untuk storage dokumen, akses berbasis role, audit log akses dokumen sensitif
- **Retensi data:** perlu kebijakan berapa lama data kandidat yang tidak lolos disimpan (terkait UU PDP)
- **Ketersediaan:** target uptime wajar untuk tool internal (bukan 99.99%), tapi backup harian wajib
- **Auditability:** semua perubahan status tahapan tercatat dengan siapa & kapan (`updated_by`, timestamp)

## 8. Analisis Kelayakan Fitur AI (menjawab pertanyaan 2)

### 8.1 Ekstraksi teks dari berbagai format CV — **Layak**
PDF berbasis teks (bukan hasil scan) dapat diekstrak dengan baik menggunakan PyMuPDF/pdfplumber. Untuk CV hasil scan/foto, dibutuhkan tambahan OCR (Tesseract/PaddleOCR). Ini teknologi matang dan sudah umum dipakai di produk ATS/CV parser komersial.

### 8.2 Foto kandidat dari dalam PDF — Layak secara teknis, **tapi didescope oleh client → manual**
PyMuPDF bisa mengekstrak semua gambar tertanam di halaman PDF (`page.get_images()`), tapi PDF sering berisi banyak gambar bukan foto kandidat (logo perusahaan, ikon, garis dekoratif), sehingga perlu heuristik tambahan (rasio potret, ukuran, posisi, opsional face detection) untuk akurasi tinggi. Ini tetap tidak akan 100% akurat.

**Update per konfirmasi client:** fitur ekstraksi foto otomatis ini **tidak dipakai** karena pertimbangan biaya AI vision/multimodal bulanan. Sebagai gantinya, HR mengunggah foto kandidat secara manual saat edit data (lihat 5.5). Ini keputusan yang wajar — foto adalah satu-satunya bagian dari kebutuhan ekstraksi CV yang benar-benar mengharuskan model vision (bagian 8.3 field teks lain tetap bisa pakai model text-only yang jauh lebih murah, lihat 8.5), jadi men-descope bagian ini menghilangkan biaya multimodal tanpa mengorbankan fitur inti AI screening.

### 8.3 Ekstraksi field terstruktur (nama, email, skill, pendidikan, dll) dari format CV yang bervariasi — **Layak dengan catatan**
Ini adalah masalah klasik "resume parsing". Pendekatan berbasis LLM (bukan regex/rule-based lama) saat ini jauh lebih tangguh menghadapi variasi layout, termasuk CV dua kolom, tabel, atau campuran Bahasa Indonesia/Inggris. Pendekatan yang disarankan (dan sudah diselaraskan dengan keputusan client untuk tidak pakai vision — lihat 8.2):
1. Ekstrak teks (dengan info posisi/blok, bukan teks polos saja) dari PDF menggunakan PyMuPDF/pdfplumber
2. Untuk CV hasil scan, gunakan OCR biasa (Tesseract/PaddleOCR) terlebih dahulu — bukan model vision LLM, supaya tetap murah
3. Kirim teks hasil ekstraksi ke model **text-only** dan minta output terstruktur (JSON) sesuai skema kolom database
4. **Selalu sediakan UI review/edit** sebelum data final tersimpan — sama seperti fitur "draft Project" yang sudah direncanakan client, pola human-in-the-loop ini diterapkan ke semua field hasil ekstraksi AI

Ekspektasi realistis: akurasi field-level yang baik (kisaran tinggi, bukan 100%) tercapai dengan kombinasi teknik di atas + review manual. **Tidak disarankan** merancang sistem yang berasumsi ekstraksi AI selalu benar tanpa verifikasi — ini bukan soal AI-nya lemah, tapi karena format CV di dunia nyata memang sangat beragam dan sebagian tidak terstruktur sama sekali.

*Catatan untuk masa depan (opsional, bukan kebutuhan sekarang): kalau nanti ditemukan CV dengan layout sangat kompleks (tabel rumit, multi-kolom) yang hasil ekstraksi teksnya berantakan, bisa dipertimbangkan fallback ke model vision **khusus untuk CV bermasalah itu saja** (bukan semua CV) — ini menjaga biaya tetap rendah karena vision hanya dipakai untuk kasus minoritas, bukan default.*

### 8.4 Biaya operasional AI
200 CV/hari (~6.000/bulan) berarti setiap CV akan memicu setidaknya satu panggilan ke API AI (ekstraksi) + mungkin satu panggilan tambahan (matching/scoring). Dengan pendekatan text-only (sesuai keputusan client di 8.2), ini bukan biaya besar dibanding tenaga kerja manual — lihat estimasi di 8.5. Tetap perlu dianggarkan sebagai biaya operasional bulanan berjalan (bukan biaya sekali bangun), dan sebaiknya diuji dulu dengan sampel CV asli dari client untuk mengukur akurasi & biaya nyata sebelum commit ke Fase 3.

### 8.5 Contoh LLM & Estimasi Biaya (Pendekatan Text-Only, sesuai keputusan client)

Karena foto ditangani manual (8.2) dan ekstraksi field CV cukup pakai teks (8.3), **sistem tidak butuh model vision/multimodal untuk kebutuhan CV parsing** — cukup model text-only, yang juga jauh lebih murah. Contoh model yang bisa dipakai (semua model modern sebenarnya multimodal secara native, tapi kita cukup pakai jalur teksnya saja sehingga tidak dikenai biaya token gambar):

| Provider | Model (contoh) | Harga per 1 juta token (input / output) |
|---|---|---|
| Anthropic | Claude Haiku 4.5 | $1 / $5 |
| Anthropic | Claude Sonnet 5 | $2 / $10 |
| OpenAI | GPT-5.x (mid-tier) | kisaran sebanding Sonnet, cek harga terkini |
| Google | Gemini 3.x Flash | biasanya paling murah di kelasnya, cek harga terkini |

*(Harga OpenAI & Google tidak saya pastikan presisi di sini — cek halaman pricing resmi masing-masing, karena berubah cukup sering. Untuk Anthropic, harga di atas sudah dicek langsung ke dokumentasi resmi per tanggal jawaban ini dibuat.)*

**Estimasi biaya per CV (teks saja, ~1-2 halaman ≈ 2.500 token input + ~500 token output JSON):**

| Model | Estimasi biaya/CV | Estimasi biaya/bulan (200 CV/hari ≈ 6.000/bulan) |
|---|---|---|
| Claude Haiku 4.5 | ~$0,004 | ~Rp 400 ribuan |
| Claude Sonnet 5 | ~$0,009 | ~Rp 900 ribuan |

*(Estimasi kasar, di luar batch discount/prompt caching yang bisa menurunkan lagi hingga 50-90%. Kurs asumsi ~Rp 16.000/USD, sesuaikan dengan kurs berjalan. Untuk perbandingan: kalau dulu pakai pendekatan gambar/vision, estimasinya sekitar 1,3-2x lebih mahal — jadi keputusan client di 8.2 memang menghemat biaya bulanan, bukan cuma menyederhanakan scope.)*


**Kesimpulan:** pendekatan gambar (multimodal) memang lebih mahal dari teks-saja, tapi selisihnya tetap sangat kecil dibanding biaya operasional lain (hosting, gaji recruiter) — untuk skala 200 CV/hari, biaya AI-nya realistis di kisaran **ratusan ribu hingga sekitar satu jutaan rupiah per bulan**, bukan pos biaya yang perlu terlalu dikhawatirkan. Yang lebih menentukan biaya sebenarnya adalah *berapa kali* CV diproses ulang (retry, re-run karena hasil kurang bagus) — bukan pilihan model itu sendiri.

**Kesimpulan Bagian 8:** Seluruh fitur AI yang diminta **memungkinkan secara teknis**, tapi tidak akan 100% otomatis tanpa kesalahan — sistem harus dirancang dengan alur review/koreksi manusia di setiap titik ekstraksi/keputusan AI, bukan sebagai "black box" penuh. Disarankan mulai dengan pilot menggunakan sampel nyata CV dari client (berbagai format) sebelum memastikan target akurasi ke stakeholder.

## 9. Arsitektur Sistem & Infrastruktur (menjawab pertanyaan 3)

Stack yang direncanakan: **Next.js** (frontend) + **FastAPI** (backend) + **PostgreSQL** (database) + **n8n** (automation), di atas Hostinger VPS n8n hosting.

### 9.1 Bisakah semua dalam satu server?
**Bisa untuk tahap MVP/awal, dengan syarat dan catatan berikut** — bukan "ya tanpa syarat":

**Yang mendukung ini layak:**
- 200 CV/hari bukan beban trafik web yang berat (jumlah user internal, bukan trafik publik masif). Beban sebenarnya datang dari proses *parsing* PDF/OCR yang CPU-intensive dan bersifat *bursty*, bukan dari koneksi web itu sendiri
- Panggilan AI (LLM) diproses di server API eksternal (Anthropic/OpenAI dll), jadi tidak membebani CPU server sendiri — server hanya mengirim request & menerima hasil
- Paket Hostinger KVM 2 (spesifikasi umum: **2 vCPU, 8 GB RAM, 100 GB NVMe SSD**) cukup untuk menjalankan Next.js + FastAPI + PostgreSQL + n8n sekaligus via Docker Compose untuk skala pilot/MVP satu perusahaan RPO

**Yang wajib diantisipasi supaya tidak jadi masalah nanti:**
1. **Pemrosesan CV harus asinkron/antrian**, jangan diproses langsung saat upload di request HTTP. n8n workflow (trigger via webhook dari FastAPI) cocok berperan sebagai "worker" antrian ini, atau tambahkan Redis + queue sederhana kalau volume naik. Ini penting agar lonjakan upload CV (mis. banyak masuk bersamaan) tidak membuat server macet untuk pengguna lain
2. **File storage: OneDrive for Business** *(dikonfirmasi client — akun 1TB adalah akun business/organisasi)*. Ini pilihan yang layak karena tidak menambah biaya (sudah dibayar client) dan mendukung app-only authentication. Implementasinya:
   - Client (via IT/M365 admin) mendaftarkan aplikasi di **Microsoft Entra admin center**, dapat `client_id` + `client_secret`, dengan permission `Files.ReadWrite.All` — idealnya discope ke satu **SharePoint document library** khusus (bukan folder OneDrive pribadi satu karyawan), supaya tidak jadi single-point-of-failure kalau karyawan itu resign
   - **FastAPI (bukan Next.js)** yang berkomunikasi ke **Microsoft Graph API** untuk upload/download file, karena client secret tidak boleh berada di sisi frontend/browser. Next.js cukup kirim file ke FastAPI seperti alur upload biasa
   - Hasil upload (Graph `driveItem id`) disimpan sebagai referensi di kolom `file_url` tabel dokumen (`Candidate_Document`/`Employee_Document`) di Postgres — bukan file-nya sendiri
   - Untuk download, pakai `@microsoft.graph.downloadUrl` (temporary pre-authenticated URL, mirip presigned URL S3) supaya UI tidak perlu proxy file lewat backend tiap kali dibuka
   - File besar (>4MB) pakai *upload session* Graph API, bukan single PUT request
   - Disk lokal VPS tetap **tidak dipakai untuk menyimpan dokumen** — hanya untuk file sementara selagi diproses (mis. saat parsing PDF) sebelum dikirim ke OneDrive
3. **Backup database otomatis** (`pg_dump` terjadwal, disimpan juga ke OneDrive/SharePoint yang sama atau lokasi terpisah) — karena ini satu server tunggal, tidak ada redundansi bawaan
4. **Koneksi database dari 3 komponen (Next.js/FastAPI/n8n) sekaligus** — pertimbangkan connection pooling (PgBouncer) supaya tidak kehabisan koneksi saat load naik
5. **Pisahkan proses berat (OCR/parsing) dari proses web-facing** jika nanti mulai terasa lambat — bisa jadi container terpisah di server yang sama dulu, baru pindah ke server terpisah kalau memang perlu
6. **Pantau kuota 1TB seiring pertumbuhan data.** Kasar-kasarnya: ~200 CV/hari × dokumen pendukung (KTP/KK/ijazah/dll) ≈ ~1GB/hari ≈ ~365GB/tahun — realistis cukup untuk 2-3 tahun ke depan, tapi worth dimonitor karena dokumen karyawan (modul 5.10) juga akan menambah volume seiring kandidat jadi karyawan tetap

### 9.2 Rekomendasi
- Untuk **mulai (MVP/pilot)**: satu server Hostinger KVM 2 (2 vCPU/8GB RAM) + OneDrive for Business (via Microsoft Graph API) sebagai file storage — realistis dan hemat biaya karena storage-nya sudah dibayar client, sesuai keterbatasan dana
- **Bukan untuk selamanya**: begini biasanya cukup sampai skala database & concurrent user tertentu. Rencanakan titik migrasi ke depan: database bisa dipindah ke managed Postgres, dan proses AI/OCR berat dipisah ke instance sendiri, ketika volume kandidat atau jumlah recruiter aktif sudah jauh lebih besar dari kondisi sekarang
- Pastikan setup **monitoring dasar** (disk usage, RAM, CPU, dan kuota OneDrive) sejak awal supaya tahu kapan harus upgrade, bukan menunggu penuh/down dulu

## 10. Open Questions / Perlu Konfirmasi ke Client

- Apakah PM/client (pihak Bank) butuh akses login ke sistem, atau laporan dikirim manual (Excel/PDF) oleh agency?
- Kebijakan retensi data kandidat yang tidak lolos (berapa lama disimpan, terkait UU PDP)
- Target akurasi minimum yang dianggap "cukup baik" untuk ekstraksi AI sebelum fitur ini dianggap siap produksi
- Contoh template CV standar client (disebutkan "akan dilampirkan" di kickoff) — dibutuhkan untuk desain fitur generate CV
- Sample CV asli (berbagai format) dari client untuk uji coba akurasi parsing sebelum Fase 3 dimulai
- Siapa yang berwenang registrasi aplikasi di Microsoft Entra admin center untuk akses OneDrive Business (butuh admin M365 dari sisi client/Altek)
- Role mana saja yang boleh melihat data payroll karyawan (5.10) secara penuh — apakah HR biasa juga, atau hanya Manager/Admin
- Untuk field "Perjanjian Altek-Client" dan status karyawan — apakah ada daftar baku dari HR Altek yang bisa dijadikan seed data awal (mis. jenis-jenis PKWT/PKWTT/PPJP yang biasa dipakai)?

## 11. Metrik Keberhasilan (usulan)

- Waktu rata-rata screening CV per kandidat (manual vs setelah AI)
- % kandidat dengan data lengkap tanpa perlu follow-up manual
- Waktu proses dari CV masuk → dikirim ke PM client
- Tingkat akurasi ekstraksi data AI (diukur dari sample yang dikoreksi manual)
- Rasio kandidat submit ke client vs lolos ke tahap User interview

## 12. Ringkasan Roadmap

```
Fase 1 (MVP)        : Database kandidat + pipeline tracking + blacklist + export   → go-live tercepat
Fase 2              : Otomasi ekstraksi foto & generate CV standar (tanpa AI dulu, rule-based/manual-assisted)
Fase 3              : AI ekstraksi field CV + scoring/matching + draft "Project"   → pilot dengan sample CV nyata dulu
Fase 4              : Dashboard analytics pola kandidat lolos User interview
```

---
*Dokumen ini adalah draft awal berdasarkan hasil kickoff 31 Agustus 2026. Beberapa poin di Bagian 10 perlu dikonfirmasi ke client sebelum estimasi effort & timeline final disusun.*
