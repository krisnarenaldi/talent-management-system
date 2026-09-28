# Skenario Pengujian Komprehensif: Fitur CV Screening & Bulk CV Upload

Dokumen ini berisi matriks pengujian (Test Matrix / Test Case) lengkap untuk fitur **CV Screening & Bulk CV Upload** pada Talent Management System (TMS / ATS). Skenario disusun berdasarkan format Google Sheet yang Anda gunakan (Task, User Role, Action, Params, Expected Result, Actual Result) dengan penambahan kategori pengujian.

---

## 📊 Matriks Pengujian CV Screening (Google Sheet Ready)

Anda dapat menyalin (*copy-paste*) tabel Markdown di bawah ini langsung ke Google Sheets (kolom akan otomatis terpisah).

| No | Task | User Role | Category | Action | Params / Condition | Expected Result | Actual Result |
|---|---|---|---|---|---|---|---|
| **A** | **Tipe & Format File (File Types & Constraints)** | | | | | | |
| A1 | CV Screening | Recruiter / HR | Format Normal | Upload Single CV PDF Text-based | File PDF 1-2 halaman, teks asli (dapat di-highlight), size < 5MB | Parsing minimum 80%, data kandidat terbuat/ter-update, data application terisi dengan score & ringkasan. | |
| A2 | CV Screening | Recruiter / HR | Format Normal | Upload Single CV Word (.docx / .doc) | File DOCX/DOC standar microsoft word | Parsing minimum 80%, data terpisahkan ke field Nama, Email, Phone, Skills, Experience, Education. | |
| A3 | CV Screening | Recruiter / HR | Format Gambar | Upload CV Format Gambar (JPG / PNG / WEBP) | File .jpg / .png berkualitas jernih | **Jika sistem support OCR:** Teks berhasil di-OCR & diparsing, skor dihitung.<br>**Jika TIDAK support gambar:** Ditolak sistem dengan error: *"Format file tidak didukung. Harap unggah PDF/DOCX"*. | |
| A4 | CV Screening | Recruiter / HR | Format Gambar | Upload CV Gambar Kualitas Buruk (Blur/Gelap) | File JPG/PNG tulisan tidak jelas / resolusi sangat rendah | Notifikasi warning: *"Gagal membaca teks dari gambar. Harap unggah file PDF atau gambar beresolusi lebih tinggi"*. Status: Gagal Parsing. | |
| A5 | CV Screening | Recruiter / HR | Scanned File | Upload PDF Hasil Scan (Image-inside-PDF) | PDF tanpa teks layer (hasil scanner/foto yang dijadikan PDF) | **Dengan OCR:** Teks terekstrak & diparsing.<br>**Tanpa OCR:** Parsing 0% / Notifikasi *"Teks tidak dapat dibaca dari PDF scan"*. Tag: *Need Manual Review*. | |
| A6 | CV Screening | Recruiter / HR | Corrupt File | Upload File PDF / DOCX Corrupt | File rusak / 0 KB / header corrupt | Gagal upload. System menampilkan validasi error: *"File tidak valid atau rusak"*. Proses batch lain tidak terganggu. | |
| A7 | CV Screening | Recruiter / HR | Security | Upload PDF Diproteksi Password | PDF ber-password (encrypted) | Gagal parsing. System menampilkan error: *"File dilindungi password, tidak dapat dibuka oleh sistem"*. | |
| A8 | CV Screening | Recruiter / HR | Limit Size | Upload CV Melebihi Limit Ukuran File | File PDF ukuran > 10MB (misal 25MB) | Ditolak sebelum upload/processing. Error: *"Ukuran file melebihi batas maksimum (Max 10MB)"*. | |
| A9 | CV Screening | Recruiter / HR | Security | Upload File Manipulasi Extension (Spoofing) | File `.exe` atau `.sh` yang di-rename menjadi `.pdf` | File validation (MIME check) menolak file. Error: *"Format file sesungguhnya tidak valid"*. | |
| **B** | **Bulk Upload Mechanics (Skenario Unggah Massal)** | | | | | | |
| B1 | CV Screening | Recruiter / HR | Bulk Normal | Bulk Upload Semua File Valid (10 PDF) | 10 file PDF valid untuk 1 Posisi Job | Ke-10 file berhasil di-upload, di-parse, dan menghasilkan score & record application masing-masing. Progress bar 100%. | |
| B2 | CV Screening | Recruiter / HR | Bulk Mixed | Bulk Upload Mixed File (Valid + Invalid) | Batch 10 file: 6 PDF Valid, 1 JPG, 1 Corrupt, 1 Password PDF, 1 Oversize | **Partial Success:** 6 CV valid berhasil di-process. 4 file gagal ditampilkan di ringkasan kesalahan (Error Summary Table) dengan alasan masing-masing. Sistem tidak crash. | |
| B3 | CV Screening | Recruiter / HR | Bulk Limit | Bulk Upload Melebihi Kuota Maksimal Batch | Upload 100 CV sekaligus (jika limit batch 50 CV) | Validasi UI: *"Maksimum upload adalah 50 file per batch. Silakan kurangi jumlah file."* | |
| B4 | CV Screening | Recruiter / HR | Bulk Duplicate | Bulk Upload terdapat file nama identik | 2 file bernama `CV_Budi.pdf` dalam 1 kali drop file | Sistem menangani dengan menambahkan UUID/Timestamp unik sehingga kedua file terproses tanpa menimpa (*overwrite*) satu sama lain. | |
| B5 | CV Screening | Recruiter / HR | Resiliency | Koneksi Putus / Timeout Saat Bulk Upload | Internet terputus saat file ke-5 dari 10 sedang diproses | File 1-4 tersimpan rapi. File 5-10 berstatus *Failed/Pending Retry*. User diberi tombol *"Retry Failed Files"*. | |
| B6 | CV Screening | Recruiter / HR | Archive File | Upload File ZIP / RAR berisi 20 CV | File `.zip` berisi 20 CV | **Jika support Zip:** Extract otomatis dan process 20 CV.<br>**Jika tidak support Zip:** Reject dengan pesan: *"Harap upload file CV langsung (PDF/DOCX), bukan file kompresi ZIP"*. | |
| **C** | **Hasil Parsing & Scoring AI/Rule-based** | | | | | | |
| C1 | CV Screening | Recruiter / HR | Scoring | Skor Tinggi (High Match Score > 85%) | Kandidat punya 100% skill utama & pengalaman sesuai kualifikasi job | Score misal 92%. Tag: *High Match / Recommended*. Status application: *Screened / Shortlisted*. | |
| C2 | CV Screening | Recruiter / HR | Scoring | Skor Menengah (Medium Match Score 50-84%) | Skill utama ada, namun pengalaman kurang 1 tahun dari syarat | Score misal 68%. Tag: *Medium Match*. Status application: *In Review*. | |
| C3 | CV Screening | Recruiter / HR | Scoring | Skor Rendah (Low Match Score < 50%) | CV melamar Backend Dev tapi isi CV penuh dengan bidang HR / Desain | Score misal 25%. Tag: *Low Match*. Status application: *Unsuitable / Disqualified* (atau masuk tab Low Score). | |
| C4 | CV Screening | Recruiter / HR | Parsing Quality | Teks Terbaca < 80% (Parsing Ditolak / Incomplete) | CV hanya berisi grafik/diagram tanpa teks terstruktur, atau teks terpotong | Status: *Parsing Failed / Partial Parsing (<80%)*. Data kandidat terbuat sebagian, diberi flag *"Perlu Verifikasi Manual"*. | |
| C5 | CV Screening | Recruiter / HR | Bahasa | CV Bahasa Inggris / Indonesia / Campuran | CV full Bahasa Inggris atau campur (Bahasa Gaul/Indo-English) | AI / Parser mampu mengekstrak entity (Nama, Skill, Pengalaman) dengan tepat tanpa terganggu bahasa. | |
| **D** | **Logika Bisnis, Duplikasi & Multi-Apply** | | | | | | |
| D1 | CV Screening | Recruiter / HR | Duplikasi | Same Person + Same Position (Duplikat Persis) | CV Budi (Email & No HP sama) di-upload ulang untuk posisi yang SAMA | System mengenali kandidat lama. Opsi/Handling: <br>1. Membuat versi CV baru di profile Budi.<br>2. Peringatan: *"Kandidat Budi sudah pernah melamar di posisi ini pada tanggal X"*. | |
| D2 | CV Screening | Recruiter / HR | Multi-Apply | Same Person + Different Position (1 CV, 2 Posisi) | CV Budi di-upload ke Job "Backend Dev" DAN di-upload ke Job "DevOps Engineer" | 1 Master Profile Candidate (Budi), tetapi memiliki **2 record Application terpisah**. Masing-masing application memiliki score & status yang berbeda sesuai job requirement. | |
| D3 | CV Screening | Recruiter / HR | Soft Match | Duplikasi Nama Sama, Email Beda | Nama "Ahmad Fauzi" sama, pendidikan sama, tapi email & no HP berbeda | System membuat profil kandidat baru, namun memberikan badge/alert: *"Potensi Duplikat dengan Kandidat ID #123"*. | |
| D4 | CV Screening | Recruiter / HR | Re-apply | Kandidat Pernah Ditolak (Historical Apply) | CV kandidat yang 6 bulan lalu statusnya *Rejected*, di-upload lagi | Application baru dibuat. Riwayat pelamaran terdahulu tetap bisa dilihat HR (History Log). | |
| **E** | **Variasi Desain & Tata Letak CV (Layout Edge Cases)** | | | | | | |
| E1 | CV Screening | Recruiter / HR | Layout | CV Two-Column / Canva Template | CV dengan 2 kolom (kiri: Skill/Kontak, kanan: Pengalaman) | Parser tidak menggabungkan baris kiri dan kanan secara acak. Pengalaman & skill terekstrak ke field yang benar. | |
| E2 | CV Screening | Recruiter / HR | Layout | CV Menggunakan Icon (Tanpa Label Teks "Email:") | Kontak hanya memakai icon amplop & telepon, tidak ada kata "Email:" / "Phone:" | System menggunakan Pattern Recognition / Regex untuk mengenali format email (`@.com`) dan nomor telepon (`+62...`). | |
| E3 | CV Screening | Recruiter / HR | Layout | CV Sangat Panjang (Multi-page > 5 Halaman) | CV akademisi/senior consultant berisi 10 halaman portofolio | Teks penting (Summary, Pengalaman Terakhir, Education) tetap terproses tanpa *token limit error* atau teks terpotong secara liar. | |
| E4 | CV Screening | Recruiter / HR | Layout | CV Tanpa Section Standar (Free-form) | CV berbentuk narasi/paragraf tanpa judul section "Work History" | Parser AI dapat mengidentifikasi tahun, nama perusahaan, dan role dari narasi kalimat. | |
| **F** | **Keamanan, Hak Akses & Auditing (RBAC & Security)** | | | | | | |
| F1 | CV Screening | Viewer / Manager | RBAC | User Role View-Only mencoba Upload CV | User dengan role "Hiring Manager (View Only)" mencoba melakukan bulk upload | Tombol Upload disembunyikan/disabled, atau API mengembalikan respon `403 Forbidden`. | |
| F2 | CV Screening | Recruiter | Multi-Tenant | Upload CV di Perusahaan A tidak terlihat di Perusahaan B | Recruiter meng-upload CV di workspace Company A | Data kandidat & file CV terisolasi penuh, tidak dapat diakses dari tenant/company lain. | |
| F3 | CV Screening | Recruiter | Audit Trail | Log Aktivitas Bulk Upload | Recruiter X meng-upload 20 CV pada jam 10:00 | System mencatat Audit Log: *"User X uploaded 20 CVs for Job Y at 10:00 AM"*. | |

---

## 💡 Ide Tambahan & Fitur Penyempurna (Enhancement Ideas)

Selain pengujian teknis dasar di atas, berikut ide-ide skenario & fitur pendukung yang biasa ditemui pada ATS / TMS kelas enterprise:

1. **Auto-Tagging & Missing Field Handling**:
   - Jika Email atau Phone Number tidak ditemukan di CV, sistem memberikan status **"Missing Contact Info"** agar HR dapat mengisi manual.
2. **Duplicate Resolution Modal (Dialog Penanganan Duplikat)**:
   - Saat bulk upload mendeteksi duplikat, tampilkan popup yang memberikan opsi kepada HR:
     - *Skip (Abaikan file baru)*
     - *Overwrite (Ganti CV lama dengan file baru)*
     - *Create New Application (Tetap buat sebagai lamaran baru)*
3. **Parsing Confidence Rating (Tingkat Kepercayaan AI)**:
   - Menampilkan indikator kepastian parsing (misal: *High Confidence 95%*, *Low Confidence 40%*). Jika confidence rendah, beri highlight kuning pada field yang mencurigakan.
4. **Keyword / Skill Extraction Accuracy**:
   - Pengujian synonym matching: Misal Job Butuh `React.js`, CV menulis `ReactJS`, `React`, atau `Frontend Framework`. Apakah scoring AI menganggap ini cocok?
5. **Privacy & Anonymized Screening (Blind Screening)**:
   - Pengujian fitur penyembunyian identitas (hapus foto, nama, umur, gender, alamat) saat pertama kali di-screening untuk menghindari bias rekrutmen.
6. **Export & Summary Download**:
   - Pengujian fitur unduh hasil bulk screening dalam format Excel / CSV (Export Ringkasan Kandidat + Score + Link File CV).

---

> [!TIP]
> **Cara Menggunakan di Google Sheets:**
> 1. Copy tabel di atas dari kolom `No` hingga baris terakhir.
> 2. Paste langsung di cell `A1` pada Google Sheets Anda.
> 3. Kolom `Actual Result` dapat diisi oleh tim QA / Tester saat eksekusi pengujian berlangsung (Pass / Fail / Blocked).
