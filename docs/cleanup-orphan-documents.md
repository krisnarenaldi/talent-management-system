# Panduan: Membersihkan Orphan Document Records

**Konteks:** Setelah `docker volume prune`, file fisik di volume `/uploads` hilang namun record di tabel `candidate_document` dan `employee_document` masih ada. Record ini disebut *orphan* — ada di DB tapi file tidak bisa diakses, sehingga tombol Download mengembalikan `{"detail": "File not found"}`.

---

## Opsi 1 — Hard Delete via SQL (Rekomendasi untuk data dummy)

Hapus langsung semua record yang file-nya sudah tidak ada. Karena ini data dummy, tidak perlu soft-delete.

```sql
-- Preview dulu: lihat orphan records kandidat
SELECT
    cd.id,
    cd.candidate_id,
    c.name AS candidate_name,
    cd.doc_type,
    cd.file_url,
    cd.uploaded_at
FROM candidate_document cd
JOIN candidate c ON c.id = cd.candidate_id
WHERE cd.is_deleted = FALSE
  AND cd.drive_item_id IS NULL   -- local storage saja (bukan OneDrive)
  AND cd.file_url IS NOT NULL
ORDER BY c.name, cd.uploaded_at;
```

Setelah review, jalankan delete:

```sql
-- Hapus orphan candidate_document (local storage, bukan OneDrive)
DELETE FROM candidate_document
WHERE is_deleted = FALSE
  AND drive_item_id IS NULL
  AND file_url IS NOT NULL;

-- Hapus orphan employee_document (local storage, bukan OneDrive)
DELETE FROM employee_document
WHERE is_deleted = FALSE
  AND drive_item_id IS NULL
  AND file_url IS NOT NULL;
```

> **Catatan:** Query di atas menghapus SEMUA dokumen local-storage, karena setelah volume prune tidak ada cara membedakan mana yang masih ada dan mana yang tidak dari SQL. Cocok untuk kondisi "semua file hilang" setelah prune.

---

## Opsi 2 — Soft Delete via SQL (Lebih aman, bisa di-recover)

Tandai sebagai deleted tanpa benar-benar menghapus record dari DB.

```sql
-- Soft delete candidate_document
UPDATE candidate_document
SET is_deleted = TRUE
WHERE is_deleted = FALSE
  AND drive_item_id IS NULL
  AND file_url IS NOT NULL;

-- Soft delete employee_document
UPDATE employee_document
SET is_deleted = TRUE
WHERE is_deleted = FALSE
  AND drive_item_id IS NULL
  AND file_url IS NOT NULL;
```

---

## Cara Eksekusi

### Masuk ke container database

```bash
# Cek nama container postgres / pgbouncer
docker ps

# Masuk ke container postgres langsung
docker exec -it <nama_container_postgres> psql -U talent26 -d db_talent
```

Atau dari host jika port ter-expose:

```bash
psql -h localhost -p 5432 -U talent26 -d db_talent
```

### Jalankan query

Paste query dari Opsi 1 atau Opsi 2 di atas ke prompt `psql`.

---

## Cara Cek Hasilnya

```sql
-- Setelah cleanup, pastikan tidak ada lagi orphan records
SELECT COUNT(*) FROM candidate_document
WHERE is_deleted = FALSE AND drive_item_id IS NULL AND file_url IS NOT NULL;
-- Harusnya: 0

SELECT COUNT(*) FROM employee_document
WHERE is_deleted = FALSE AND drive_item_id IS NULL AND file_url IS NOT NULL;
-- Harusnya: 0
```

---

## Mencegah Kejadian Serupa

Saat ini volume uploads menggunakan **named volume** Docker yang rentan terhadap `docker volume prune`. Ubah ke **bind mount** supaya file tersimpan di host:

**`docker-compose.yml`** — ganti bagian volumes backend dari:

```yaml
# Sebelum (named volume — hilang kalau di-prune)
volumes:
  - uploads_data:/uploads
```

Menjadi:

```yaml
# Sesudah (bind mount ke host — aman dari prune)
volumes:
  - ./uploads:/uploads
```

Dan hapus/comment entry `uploads_data` di bagian `volumes:` paling bawah docker-compose.yml.

Buat foldernya di host jika belum ada:

```bash
mkdir -p ./uploads
```

Setelah itu restart:

```bash
docker compose down && docker compose up -d
```

---

## Alur Setelah Cleanup

1. Jalankan SQL cleanup (Opsi 1 atau 2)
2. Refresh halaman `/candidates/[id]` — daftar dokumen seharusnya kosong atau tidak ada lagi item orphan
3. Upload ulang dokumen dummy lewat UI
4. (Opsional) Fix volume ke bind mount supaya tidak terulang

