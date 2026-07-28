# Panduan Deployment VPS - REMPAHKARTA Store

Dokumen ini berisi panduan resmi deployment baru (*fresh deployment*) maupun pembaruan (*update deployment*) aplikasi **REMPAHKARTA Store (v1.3.4)** ke VPS HestiaCP.

---

## A0. Aturan Environment Produksi & Versioning Wajib

Sebelum membuat arsip deploy, **WAJIB** memastikan file `.env` diisi dengan parameter produksi berikut:

- `APP_MODE=production`
- `ENABLE_DEVTOOLS=false`
- `APP_URL_LIVE=https://www.rempahkarta.com` (atau domain produksi aktif)

> [!CAUTION]
> Jangan pernah membuat arsip deployment bila `APP_MODE=development` atau `ENABLE_DEVTOOLS=true`. Selalu pastikan `APP_MODE=production` dan `ENABLE_DEVTOOLS=false` di `.env` sebelum mengemas aplikasi!

### Versioning
Setiap deployment wajib menaikkan/memeriksa versi aplikasi di `package.json` pada field `"version"` (saat ini `1.3.4`) sesuai perubahan yang terjadi:
- Patch kecil/bugfix/cache/UI minor: naikkan patch, contoh `1.3.0` -> `1.3.1`.
- Perubahan fitur yang terlihat pengguna: naikkan minor, contoh `1.3.0` -> `1.4.0`.
- Perubahan besar/tidak kompatibel: naikkan major, contoh `1.3.0` -> `2.0.0`.

---

## A00. GitHub Wajib Sebelum Deploy

Setiap deployment wajib di-commit dan di-push ke GitHub terlebih dahulu. VPS tetap memakai arsip deploy, tetapi GitHub menjadi sumber histori perubahan dan titik rollback kode.

Jalankan dari root proyek:

```powershell
git status --short --branch
git add .
git commit -m "Deploy Rempahkarta Store v<VERSION>"
git push origin main
```

Pastikan `git status --short --branch` bersih sebelum membuat arsip deploy.

---

## A000. Mode Deploy Dibantu Agent / AI Assistant

Jika deployment dilakukan dibantu agent/assistant, alurnya adalah:

1. Agent & User memastikan `.env` lokal sudah `APP_MODE=production` dan `ENABLE_DEVTOOLS=false`.
2. Agent membuat arsip `.tar.gz` dari lokal.
3. Agent memberikan command PowerShell `scp` untuk upload arsip ke VPS.
4. User menjalankan command upload tersebut dan memasukkan password SSH secara manual.
5. Agent memberikan command update cepat final untuk dijalankan di shell VPS (`ubuntu` -> `bstn-innovation-studio`), berisi nama arsip, tanggal, hash SHA256, dan langkah eksekusi VPS.

Jangan mencantumkan kredensial SSH atau database di file yang di-commit ke Git.

### Parameter Operasional Server:
- **IP VPS**: `157.20.32.214`
- **SSH User Upload**: `ubuntu`
- **Upload Destination**: `/home/ubuntu/`
- **App Service User**: `bstn-innovation-studio`
- **App Root Path**: `/home/bstn-innovation-studio/apps/rempahkarta`
- **PM2 Process Name**: `rempahkarta`
- **Internal Production Port**: `3030`
- **Internal Smoke Test Port**: `3031`
- **Domain Publik**: `rempahkarta.com` / `www.rempahkarta.com`

---

## A. Di Lokal - Build Check dan Pengarsipan

Jalankan perintah berikut dari root proyek `rempahkarta-store-main`.

### A1. Verifikasi Lokal

```powershell
npx tsc --noEmit
npm run lint
npm run build
```

### A2. Membuat Arsip Deploy

Arsip deploy wajib membawa file `.env` produksi terbaru agar setiap deployment otomatis memperbarui shared env production di server. Arsip sengaja mengecualikan `node_modules`, `.next`, `docs`, cache, dan arsip lama.

```powershell
$DATE = Get-Date -Format "yyyyMMdd"
$VERSION = (Get-Content package.json | ConvertFrom-Json).version
$ARCHIVE = "..\rempahkarta-store-vps-v$VERSION-$DATE.tar.gz"

if (Test-Path -LiteralPath $ARCHIVE) { Remove-Item -LiteralPath $ARCHIVE -Force }

tar -czf $ARCHIVE `
  --exclude='.git' `
  --exclude='node_modules' `
  --exclude='.next' `
  --exclude='docs' `
  --exclude='*DOCS*' `
  --exclude='*.zip' `
  --exclude='*.tar.gz' `
  --exclude='*.tsbuildinfo' `
  --exclude='next-env.d.ts' `
  -C . .

Get-Item -LiteralPath $ARCHIVE | Select-Object FullName,@{Name='SizeMB';Expression={[Math]::Round($_.Length/1MB,2)}}
Get-FileHash -Algorithm SHA256 $ARCHIVE
```

### A3. Cek Isi Arsip

```powershell
$entries = tar -tzf $ARCHIVE
$entries | Measure-Object | Select-Object Count
$entries | Where-Object { $_ -eq './.env' }
```

Pastikan `./.env` tercantum dan tidak ada `node_modules` atau `.next`.

### A4. Perintah Upload Arsip ke VPS

Gunakan `scp` dari PowerShell lokal:

```powershell
$DATE = Get-Date -Format "yyyyMMdd"
$VERSION = (Get-Content package.json | ConvertFrom-Json).version
$ARCHIVE = "..\rempahkarta-store-vps-v$VERSION-$DATE.tar.gz"

scp $ARCHIVE ubuntu@157.20.32.214:/home/ubuntu/
```

Atau perintah literal direct:

```powershell
scp "..\rempahkarta-store-vps-v<VERSION>-<YYYYMMDD>.tar.gz" ubuntu@157.20.32.214:/home/ubuntu/
```

---

## A5. Template Perintah Eksekusi di VPS

Setelah arsip berhasil diunggah ke `/home/ubuntu/`, masuk ke VPS via SSH:

```bash
ssh ubuntu@157.20.32.214
```

Lalu jalankan script otomatis berikut sebagai user `ubuntu`:

```bash
set -e
DATE=<YYYYMMDD>
ARCHIVE=~/<NAMA_ARSIP>

sha256sum "$ARCHIVE"
cp "$ARCHIVE" /tmp/
chmod 644 /tmp/$(basename "$ARCHIVE")

sudo -u bstn-innovation-studio bash -lc "
set -e
DATE=$DATE
APP_ROOT=/home/bstn-innovation-studio/apps/rempahkarta
NEW_REL=\$APP_ROOT/releases/\${DATE}-web
SHARED_ENV=\$APP_ROOT/shared/.env
ARCHIVE=/tmp/$(basename "$ARCHIVE")

mkdir -p \"\$NEW_REL\" \"\$APP_ROOT/shared\"
tar -xzf \"\$ARCHIVE\" -C \"\$NEW_REL\"
cd \"\$NEW_REL\"

test -f \"\$NEW_REL/.env\"
cp \"\$NEW_REL/.env\" \"\$SHARED_ENV\"
chmod 600 \"\$SHARED_ENV\"
ln -sfn \"\$SHARED_ENV\" \"\$NEW_REL/.env\"

npm install
npm run setup
npm run build
PORT=3031 timeout 10 node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3031 2>&1 | head -15

ln -sfn \"\$NEW_REL\" \"\$APP_ROOT/current\"
cd \"\$APP_ROOT/current\"
pm2 delete rempahkarta || true
PORT=3030 pm2 start node_modules/next/dist/bin/next --name rempahkarta -- start -H 127.0.0.1 -p 3030
pm2 save
"

ss -ltnp 2>/dev/null | grep 3030
curl -sI http://127.0.0.1:3030/ | head
curl -sI https://www.rempahkarta.com/ | head
pm2 logs rempahkarta --lines 20 --nostream

rm -f /tmp/rempahkarta-store-vps-v*.tar.gz
rm -f "$ARCHIVE"
```

---

## B. Konfigurasi Nginx / HestiaCP (Deployment Pertama Kali)

Jika ini adalah deployment pertama untuk domain `rempahkarta.com`:

### B1. Buat Web Template Nginx Custom `rempahkarta-next`

Di VPS sebagai user root/sudo:

```bash
sudo cp /usr/local/hestia/data/templates/web/nginx/php-fpm/n8n_proxy.tpl \
  /usr/local/hestia/data/templates/web/nginx/php-fpm/rempahkarta-next.tpl

sudo cp /usr/local/hestia/data/templates/web/nginx/php-fpm/n8n_proxy.stpl \
  /usr/local/hestia/data/templates/web/nginx/php-fpm/rempahkarta-next.stpl

sudo cp /usr/local/hestia/data/templates/web/nginx/php-fpm/n8n_proxy.sh \
  /usr/local/hestia/data/templates/web/nginx/php-fpm/rempahkarta-next.sh

sudo sed -i 's/localhost:5679/127.0.0.1:3030/g' \
  /usr/local/hestia/data/templates/web/nginx/php-fpm/rempahkarta-next.tpl \
  /usr/local/hestia/data/templates/web/nginx/php-fpm/rempahkarta-next.stpl
```

### B2. Terapkan Template ke Domain di HestiaCP

```bash
sudo /usr/local/hestia/bin/v-change-web-domain-tpl bstn-innovation-studio rempahkarta.com rempahkarta-next yes
sudo /usr/local/hestia/bin/v-rebuild-web-domain bstn-innovation-studio rempahkarta.com yes
sudo nginx -t
sudo systemctl reload nginx
```

---

## C. Rollback Ke Release Sebelumnya

Jika terjadi masalah kritis pada release baru:

```bash
sudo -u bstn-innovation-studio bash -l
APP_ROOT=/home/bstn-innovation-studio/apps/rempahkarta
OLD_REL=$APP_ROOT/releases/<YYYYMMDD>-web

ln -sfn "$OLD_REL" "$APP_ROOT/current"
cd "$APP_ROOT/current"
pm2 delete rempahkarta || true
PORT=3030 pm2 start node_modules/next/dist/bin/next --name rempahkarta -- start -H 127.0.0.1 -p 3030
pm2 save
```

---

## D. Troubleshooting Cepat

| Kendala | Penyebab | Solusi |
|---|---|---|
| `APP_MODE=development` aktif di server | `.env` belum diubah sebelum diarsip | Pastikan `.env` memiliki `APP_MODE=production` dan `ENABLE_DEVTOOLS=false`, buat arsip baru dan upload ulang. |
| `MYSQL_HOST` / `DATABASE_URL` error | `.env` tidak terbaca | Pastikan `$APP_ROOT/shared/.env` ada dan symlinked ke `current/.env`. |
| public static Hestia "We're working on it" | Proxy template Hestia belum aktif | Jalankan `v-change-web-domain-tpl bstn-innovation-studio rempahkarta.com rempahkarta-next yes` & `v-rebuild-web-domain`. |
| Port `3030` in use | Proses lain memakai port 3030 | Cek `ss -ltnp \| grep 3030` dan hentikan/sesuaikan service PM2. |
