## 🚀 STEP-BY-STEP DEPLOYMENT HOSTINGER VPS

---

### **STEP 0 — Prasyarat (Sebelum Mulai)**

Pastikan di Hostinger Panel Anda:
1. **OS**: Pilih **Ubuntu 22.04 LTS** atau **24.04 LTS** (fresh install)
2. **Ports yang terbuka** di Firewall Hostinger: `22 (SSH)`, `80 (HTTP)`, `443 (HTTPS)`
3. **Domain/Subdomain**: Sudah point A record ke IP VPS Anda (contoh: `tms.yourcompany.com` → `103.x.x.x`)
4. Akses SSH ke VPS (dapatkan username/password/key dari Hostinger Panel)

---

### **STEP 1 — Setup Awal VPS (SSH ke VPS)**

Login ke VPS via Terminal:
```bash
ssh root@IP_VPS_ANDA
```

Jalankan semua perintah berikut di VPS:

```bash
# 1. Update system
apt update && apt upgrade -y

# 2. Install tools dasar
apt install -y curl git ufw certbot python3-certbot-nginx

# 3. Setup Firewall UFW
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status  # Pastikan 22, 80, 443 ALLOW
```

---

### **STEP 2 — Install Docker & Docker Compose**

```bash
# Install Docker resmi
curl -fsSL https://get.docker.com | sh

# Enable Docker start on boot
systemctl enable docker
systemctl start docker

# Verifikasi
docker --version          # Harus keluar versi Docker 24+
docker compose version    # Harus keluar versi Docker Compose v2+
```

---

### **STEP 3 — Upload Project ke VPS**

**Cara A (via Git — disarankan):**
```bash
# Di VPS:
cd /opt
git clone <URL_REPO_GIT_ANDA> tms
cd tms
```

**Cara B (via SCP — jika tanpa Git):**
```bash
# Di MAC lokal Anda (bukan VPS!):
cd "/Users/krisnarenaldi/Documents/Projects/freelance/Talent Management System"
scp -r ./frontend ./backend ./docker-compose.yml ./nginx.conf ./.env.example root@IP_VPS_ANDA:/opt/tms/
```

Setelah upload, di VPS pastikan struktur seperti ini:
```
/opt/tms/
├── frontend/
├── backend/
├── docker-compose.yml
├── nginx.conf
└── .env.example
```

---

### **STEP 4 — Konfigurasi .env (Penting!)**

Di VPS, copy template dan generate secret key:
```bash
cd /opt/tms
cp .env.example .env

# Generate 3 random keys (copy outputnya masing-masing)
openssl rand -hex 32   # untuk SECRET_KEY
openssl rand -hex 32   # untuk INTERNAL_API_SECRET
openssl rand -hex 32   # untuk N8N_ENCRYPTION_KEY
```

Sekarang edit `.env` dengan `nano .env`, **ganti nilai berikut**:

```env
# === APP ===
ENVIRONMENT=production
FRONTEND_URL=https://tms.yourdomain.com        # ← ganti domain kamu

# === POSTGRESQL ===
POSTGRES_DB=tms_db
POSTGRES_USER=tms_user
POSTGRES_PASSWORD=PASSWORD_DB_YANG_SANGAT_KUAT  # ← GANTI!

# === AUTH ===
SECRET_KEY=OUTPUT_DARI_OPENSSL_RAND_HEX_32_NOMOR_1  # ← Paste
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
INTERNAL_API_SECRET=OUTPUT_DARI_OPENSSL_RAND_HEX_32_NOMOR_2  # ← Paste

# === NEXT.JS ===
NEXT_PUBLIC_API_URL=https://tms.yourdomain.com/api/v1  # ← domain kamu

# === MICROSOFT ONEDRIVE (opsional, bisa diisi belakangan) ===
MICROSOFT_TENANT_ID=...
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
ONEDRIVE_DRIVE_ID=...

# === n8n ===
N8N_BASIC_AUTH_USER=admin_n8n                      # ← username UI n8n
N8N_BASIC_AUTH_PASSWORD=PASSWORD_N8N_YANG_KUAT     # ← GANTI!
N8N_ENCRYPTION_KEY=OUTPUT_DARI_OPENSSL_RAND_HEX_32_NOMOR_3  # ← Paste
N8N_WEBHOOK_BASE_URL=https://tms.yourdomain.com/n8n  # ← domain kamu/n8n

# === LLM (Fase 3, opsional) ===
ANTHROPIC_API_KEY=...
LLM_MODEL=claude-haiku-4-5

# === DOMAIN ===
APP_DOMAIN=tms.yourdomain.com                      # ← domain kamu
```

Simpan: `Ctrl+O`, lalu `Enter`, lalu `Ctrl+X`.

---

### **STEP 5 — Update nginx.conf (Ganti Domain)**

```bash
nano /opt/tms/nginx.conf
```

Ganti line **35** dari:
```nginx
server_name srv1946081.hstgr.cloud;
```

Menjadi domain Anda:
```nginx
server_name tms.yourdomain.com;
```

Opsional (keamanan n8n): Di line **68-75**, uncomment dan ganti IP untuk restrict akses n8n:
```nginx
location /n8n/ {
    proxy_pass         http://n8n/;
    proxy_set_header   Host $host;
    proxy_set_header   X-Real-IP $remote_addr;
    allow IP_KANTOR_ANDA;   # ← contoh: 203.123.45.67
    deny all;
}
```

Simpan dan keluar.

---

### **STEP 6 — Request SSL Certificate Let's Encrypt**

```bash
# Buat folder SSL terlebih dahulu (mount point untuk container nginx)
mkdir -p /opt/tms/nginx/ssl
mkdir -p /opt/tms/nginx/logs

# Request SSL via certbot (webroot plugin)
certbot certonly --standalone -d tms.yourdomain.com \
  --non-interactive --agree-tos -m email-admin@yourcompany.com

# Copy certificate ke folder nginx/ssl
cp /etc/letsencrypt/live/tms.yourdomain.com/fullchain.pem /opt/tms/nginx/ssl/
cp /etc/letsencrypt/live/tms.yourdomain.com/privkey.pem /opt/tms/nginx/ssl/

# Set permission
chmod 644 /opt/tms/nginx/ssl/fullchain.pem
chmod 600 /opt/tms/nginx/ssl/privkey.pem
```

**Auto-renew SSL setup**: Buat cron job supaya certbot auto renew:
```bash
crontab -e
# Tambahkan line di paling bawah:
0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/tms.yourdomain.com/fullchain.pem /opt/tms/nginx/ssl/ && cp /etc/letsencrypt/live/tms.yourdomain.com/privkey.pem /opt/tms/nginx/ssl/ && cd /opt/tms && docker compose restart nginx
```
Simpan keluar. Ini akan cek renewal setiap jam 3 pagi.

---

### **STEP 7 — Build & Start Semua Container**

```bash
cd /opt/tms

# Build images (first time akan lama ~10-15 menit tergantung koneksi)
docker compose build

# Start semua service dalam background
docker compose up -d
```

Tunggu 30-60 detik, lalu cek status:
```bash
docker compose ps
```

Expected output — **semua STATE = Running (healthy)**:
```
NAME            IMAGE                     STATUS
tms_postgres    postgres:17-alpine        Up (healthy)
tms_pgbouncer   edoburu/pgbouncer:latest  Up
tms_backend     tms-backend               Up
tms_frontend    tms-frontend              Up
tms_n8n         n8nio/n8n:latest          Up
tms_nginx       nginx:alpine              Up
```

Jika ada yang error, cek logs:
```bash
docker compose logs backend    # cek error backend
docker compose logs frontend   # cek error frontend
docker compose logs postgres   # cek error DB
```

---

### **STEP 8 — Jalankan Database Migration & Seed Data**

Jalankan Alembic migration di dalam container backend:
```bash
# Masuk ke container backend
docker exec -it tms_backend bash

# Di dalam container:
alembic upgrade head

# Jalankan seed data (jika ada) — cek dulu file seed.py:
python -m app.db.seed

# Keluar container
exit
```

---

### **STEP 9 — Verifikasi & Testing**

Buka browser:

| URL | Akses |
|---|---|
| `https://tms.yourdomain.com` | 🏠 **Login Page TMS** (cek halaman login muncul) |
| `https://tms.yourdomain.com/api/v1/docs` | 📚 **Swagger UI FastAPI** (dokumentasi API) |
| `https://tms.yourdomain.com/n8n/` | ⚡ **n8n UI** (login dengan `N8N_BASIC_AUTH_USER/PASSWORD` dari .env) |

#### Cek Security Endpoint Internal:
Akses `https://tms.yourdomain.com/api/v1/internal/` di browser — **harus dapat HTTP 403 Forbidden**. Ini penting agar endpoint internal tidak terbuka publik.

---

### **STEP 10 (Opsional tapi Disarankan) — Setup Auto Backup DB**

Buat script backup harian:
```bash
mkdir -p /opt/tms/backups
nano /opt/tms/backup.sh
```

Isi:
```bash
#!/bin/bash
BACKUP_DIR="/opt/tms/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="tms_db_backup_$DATE.sql.gz"

docker exec tms_postgres pg_dump -U tms_user tms_db | gzip > "$BACKUP_DIR/$FILENAME"

# Hanya simpan 7 backup terakhir
find $BACKUP_DIR -name "tms_db_backup_*.sql.gz" -mtime +7 -delete

echo "Backup selesai: $FILENAME"
```

Jadikan executable dan tambah cron:
```bash
chmod +x /opt/tms/backup.sh

crontab -e
# Tambah line:
0 2 * * * /opt/tms/backup.sh
```
Backup akan jalan tiap jam 2 pagi.