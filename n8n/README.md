# n8n Workflows — TMS (Talent Management System)

> ⚠️ **DEPRECATED — diarsipkan, bukan dihapus**
>
> Workflow n8n dalam folder ini **tidak lagi aktif** sejak migrasi ke arq + Redis
> (lihat [`docs/migrasi_n8n_python.txt`](../docs/migrasi_n8n_python.txt) dan
> [`.kiro/specs/design.md` Bagian 6](../.kiro/specs/design.md)).
>
> Pipeline CV parsing kini dijalankan oleh `app/worker.py` (arq worker) yang memanggil
> `services/cv_pipeline.py` secara in-process — tanpa HTTP round-trip ke n8n.
>
> **File historis tersimpan di [`n8n/archive/`](./archive/) sebagai referensi**
> sampai migrasi tervalidasi sepenuhnya di production. Setelah validasi selesai,
> folder ini akan dihapus bersama service n8n dari `docker-compose.yml`.
>
> Lihat arsip:
> - [`archive/cv-parser.json`](./archive/cv-parser.json) — workflow JSON lama (8 node)
> - [`archive/README.md`](./archive/README.md) — dokumentasi setup n8n lama
