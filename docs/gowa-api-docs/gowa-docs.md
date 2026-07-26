# GOWA Send API — Dokumentasi Internal

**Tujuan:** kontrak API internal untuk pengiriman pesan melalui GOWA.  
**Cakupan:** hanya endpoint pengiriman pesan; tidak mencakup login QR, penerimaan pesan, webhook, grup, dashboard, atau manajemen perangkat.  
**Acuan:** implementasi dan OpenAPI resmi GOWA v8.7.0. Rilis v9 menyatakan kontrak HTTP—route, payload, dan device scoping—tetap dipertahankan.

---

## 1. Base URL

Gunakan salah satu base URL berikut sesuai lokasi pemanggil.

| Penggunaan | Base URL |
|---|---|
| Dari luar VPS | `http://157.20.32.214:3000` |
| Dari aplikasi dalam VPS yang sama | `http://localhost:3000` |

Gabungkan base URL dengan path endpoint tanpa menambah slash ganda.

Contoh:

```text
http://localhost:3000/send/message
http://157.20.32.214:3000/send/image
```

Pada contoh cURL di dokumen ini:

```bash
BASE_URL="http://localhost:3000"
GOWA_USER="username"
GOWA_PASS="password"
```

---

## 2. Autentikasi

Semua endpoint memakai **HTTP Basic Authentication**.

### Bentuk header

```http
Authorization: Basic BASE64(username:password)
```

Dengan cURL, gunakan:

```bash
-u "$GOWA_USER:$GOWA_PASS"
```

Contoh:

```bash
curl -u "$GOWA_USER:$GOWA_PASS" \
  "$BASE_URL/devices"
```

Kredensial harus dikirim pada setiap request. Kegagalan Basic Auth dapat menghasilkan:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Basic realm=Restricted
```

Body pada kegagalan Basic Auth dapat berupa teks biasa, bukan JSON.

---

## 3. Pemilihan device

Endpoint pengiriman adalah endpoint yang terikat ke sebuah device WhatsApp.

### Satu device

Apabila server hanya memiliki satu device, GOWA dapat memilih device tersebut secara otomatis. Header device boleh tidak dikirim.

### Lebih dari satu device

Kirim salah satu dari dua bentuk berikut.

Header yang disarankan:

```http
X-Device-Id: DEVICE_ID
```

Atau query parameter:

```text
/send/message?device_id=DEVICE_ID
```

Contoh:

```bash
curl -u "$GOWA_USER:$GOWA_PASS" \
  -H "X-Device-Id: $GOWA_DEVICE_ID" \
  -H "Content-Type: application/json" \
  -d '{"phone":"6281234567890","message":"Tes"}' \
  "$BASE_URL/send/message"
```

Error terkait device:

| HTTP | `code` | Arti |
|---:|---|---|
| 400 | `DEVICE_ID_REQUIRED` | Server memiliki beberapa device, tetapi tidak ada device ID yang diberikan. |
| 404 | `DEVICE_NOT_FOUND` | Device ID tidak ditemukan. |
| 503 | `DEVICE_MANAGER_UNAVAILABLE` | Device manager server tidak tersedia. |

---

## 4. Format penerima

Field penerima bernama `phone`.

Format paling aman untuk nomor Indonesia:

```text
6281234567890
```

Jangan gunakan format lokal:

```text
081234567890
```

Awalan `+` dapat dinormalisasi oleh server, tetapi format tanpa `+` lebih aman:

```text
6281234567890
```

OpenAPI juga mencontohkan JID langsung:

```text
6281234567890@s.whatsapp.net
```

Aturan validasi utama:

- `phone` wajib diisi.
- Nomor harus memakai format internasional.
- Nomor tidak boleh dimulai dengan `0`.
- Untuk nomor Indonesia, gunakan `62...`, bukan `08...`.

---

## 5. Field umum

Sebagian besar request memakai field berikut.

| Field | Tipe | Wajib | Keterangan |
|---|---|---:|---|
| `phone` | string | Ya | Nomor/JID penerima. |
| `duration` | integer | Tidak | Durasi disappearing message. Hanya nilai tertentu yang valid. |
| `is_forwarded` | boolean | Tidak | Tandai pesan sebagai forwarded. Default praktis `false`. |

### Nilai `duration` yang valid

| Nilai | Arti |
|---:|---|
| `0` | Tidak kedaluwarsa / disabled |
| `86400` | 24 jam |
| `604800` | 7 hari |
| `7776000` | 90 hari |

Jangan mengirim nilai lain seperti `3600`; validasi server akan menolaknya.

Apabila tidak perlu mengatur disappearing message secara eksplisit, hilangkan field `duration`.

---

## 6. Daftar endpoint

| Method | Endpoint | Content-Type | Fungsi |
|---|---|---|---|
| POST | `/send/message` | `application/json` | Pesan teks |
| POST | `/send/image` | `multipart/form-data` | Gambar atau URL gambar |
| POST | `/send/video` | `multipart/form-data` | Video atau URL video |
| POST | `/send/audio` | `multipart/form-data` | Audio atau URL audio |
| POST | `/send/file` | `multipart/form-data` | Dokumen/file upload |
| POST | `/send/sticker` | `multipart/form-data` | Sticker atau URL media sticker |
| POST | `/send/contact` | `application/json` | Kontak |
| POST | `/send/link` | `application/json` | Tautan dengan caption |
| POST | `/send/location` | `application/json` | Lokasi |
| POST | `/send/poll` | `application/json` | Polling |

---

## 7. Respons sukses umum

Semua endpoint pengiriman menggunakan struktur sukses yang sama.

```json
{
  "code": "SUCCESS",
  "message": "status manusia-terbaca dari proses pengiriman",
  "results": {
    "message_id": "ID_PESAN_WHATSAPP",
    "status": "status manusia-terbaca"
  }
}
```

Catatan:

- HTTP status sukses adalah `200`.
- Field HTTP status **tidak** disertakan sebagai properti JSON.
- Simpan `results.message_id` untuk pencatatan dan untuk `reply_message_id`.
- Nilai teks `message` dan `results.status` dapat berubah sesuai tipe pesan dan penerima.
- Anggap request berhasil hanya apabila:
  1. HTTP status berada pada rentang `2xx`;
  2. `code` bernilai `SUCCESS`;
  3. `results.message_id` tersedia.

---

# Endpoint Detail

## 8. Kirim pesan teks

### Request

```http
POST /send/message
Content-Type: application/json
Authorization: Basic ...
X-Device-Id: ...     # opsional pada single-device
```

### Body

| Field | Tipe | Wajib | Keterangan |
|---|---|---:|---|
| `phone` | string | Ya | Nomor/JID penerima. |
| `message` | string | Ya | Isi pesan. Tidak boleh kosong. |
| `reply_message_id` | string | Tidak | ID pesan yang ingin dikutip/dibalas. |
| `mentions` | string[] | Tidak | Nomor/JID yang di-mention tanpa harus menulis `@` di teks. |
| `is_forwarded` | boolean | Tidak | Tandai sebagai forwarded. |
| `duration` | integer | Tidak | Salah satu nilai durasi valid. |

`mentions` juga menerima nilai khusus:

```text
@everyone
```

Nilai tersebut digunakan untuk mention seluruh peserta ketika konteks chat mendukungnya.

### Contoh body minimal

```json
{
  "phone": "6281234567890",
  "message": "Pesan percobaan"
}
```

### Contoh body lengkap

```json
{
  "phone": "6281234567890",
  "message": "Halo, ini pesan percobaan.",
  "reply_message_id": "3EB089B9D6ADD58153C561",
  "mentions": [
    "6281111111111"
  ],
  "is_forwarded": false,
  "duration": 0
}
```

### Contoh cURL

```bash
curl --silent --show-error \
  -u "$GOWA_USER:$GOWA_PASS" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: $GOWA_DEVICE_ID" \
  -d '{
    "phone": "6281234567890",
    "message": "Halo, ini pesan percobaan."
  }' \
  "$BASE_URL/send/message"
```

Hilangkan header `X-Device-Id` apabila server hanya menggunakan satu device dan pemilihan otomatis sudah bekerja.

---

## 9. Kirim gambar

### Request

```http
POST /send/image
Content-Type: multipart/form-data
```

### Field form-data

| Field | Tipe | Wajib | Keterangan |
|---|---|---:|---|
| `phone` | string | Ya | Nomor/JID penerima. |
| `image` | file | Kondisional | File gambar lokal. |
| `image_url` | string URL | Kondisional | URL gambar yang dapat diunduh server. |
| `caption` | string | Tidak | Caption gambar. |
| `reply_message_id` | string | Tidak | ID pesan yang dikutip. |
| `view_once` | boolean | Tidak | Kirim sebagai view once. |
| `compress` | boolean | Tidak | Kompres gambar; handler v8.7 menginisialisasi nilai default `true`. |
| `is_forwarded` | boolean | Tidak | Tandai sebagai forwarded. |
| `duration` | integer | Tidak | Durasi disappearing message. |

Wajib menyediakan setidaknya salah satu:

- `image`; atau
- `image_url`.

Untuk kontrak yang tidak ambigu, kirim salah satu saja.

### MIME upload yang diterima

```text
image/jpeg
image/jpg
image/png
```

### Contoh upload file

```bash
curl --silent --show-error \
  -u "$GOWA_USER:$GOWA_PASS" \
  -H "X-Device-Id: $GOWA_DEVICE_ID" \
  -F "phone=6281234567890" \
  -F "caption=Contoh gambar" \
  -F "compress=true" \
  -F "view_once=false" \
  -F "image=@/path/gambar.jpg" \
  "$BASE_URL/send/image"
```

### Contoh dari URL

```bash
curl --silent --show-error \
  -u "$GOWA_USER:$GOWA_PASS" \
  -H "X-Device-Id: $GOWA_DEVICE_ID" \
  -F "phone=6281234567890" \
  -F "caption=Contoh gambar dari URL" \
  -F "image_url=https://example.com/gambar.jpg" \
  "$BASE_URL/send/image"
```

Jangan mengatur header `Content-Type: multipart/form-data` secara manual pada cURL atau `FormData`; client harus membuat boundary secara otomatis.

---

## 10. Kirim video

### Request

```http
POST /send/video
Content-Type: multipart/form-data
```

### Field form-data

| Field | Tipe | Wajib | Keterangan |
|---|---|---:|---|
| `phone` | string | Ya | Nomor/JID penerima. |
| `video` | file | Kondisional | File video lokal. |
| `video_url` | string URL | Kondisional | URL video yang dapat diunduh server. |
| `caption` | string | Tidak | Caption video. |
| `reply_message_id` | string | Tidak | ID pesan yang dikutip. |
| `view_once` | boolean | Tidak | Kirim sebagai view once. |
| `compress` | boolean | Tidak | Aktifkan kompresi. |
| `gif_playback` | boolean | Tidak | Perlakukan video sebagai GIF playback. |
| `is_forwarded` | boolean | Tidak | Tandai sebagai forwarded. |
| `duration` | integer | Tidak | Durasi disappearing message. |

Wajib menyediakan setidaknya salah satu `video` atau `video_url`.

### MIME upload yang diterima

```text
video/mp4
video/x-matroska
video/avi
video/x-msvideo
```

### Batas upload

```text
30 MB
```

Batas tersebut berlaku untuk file upload. URL harus merupakan URL valid dan harus dapat diakses oleh server GOWA.

### Contoh upload file

```bash
curl --silent --show-error \
  -u "$GOWA_USER:$GOWA_PASS" \
  -H "X-Device-Id: $GOWA_DEVICE_ID" \
  -F "phone=6281234567890" \
  -F "caption=Contoh video" \
  -F "compress=true" \
  -F "view_once=false" \
  -F "gif_playback=false" \
  -F "video=@/path/video.mp4" \
  "$BASE_URL/send/video"
```

### Contoh dari URL

```bash
curl --silent --show-error \
  -u "$GOWA_USER:$GOWA_PASS" \
  -H "X-Device-Id: $GOWA_DEVICE_ID" \
  -F "phone=6281234567890" \
  -F "caption=Video dari URL" \
  -F "video_url=https://example.com/video.mp4" \
  "$BASE_URL/send/video"
```

---

## 11. Kirim audio

### Request

```http
POST /send/audio
Content-Type: multipart/form-data
```

### Field form-data

| Field | Tipe | Wajib | Keterangan |
|---|---|---:|---|
| `phone` | string | Ya | Nomor/JID penerima. |
| `audio` | file | Kondisional | File audio lokal. |
| `audio_url` | string URL | Kondisional | URL audio yang dapat diunduh server. |
| `reply_message_id` | string | Tidak | ID pesan yang dikutip. |
| `ptt` | boolean | Tidak | Kirim sebagai push-to-talk/voice note. |
| `is_forwarded` | boolean | Tidak | Tandai sebagai forwarded. |
| `duration` | integer | Tidak | Durasi disappearing message. |

Wajib menyediakan setidaknya salah satu `audio` atau `audio_url`.

### MIME upload yang diterima

```text
audio/aac
audio/amr
audio/flac
audio/m4a
audio/m4r
audio/mp3
audio/mpeg
audio/ogg
audio/wma
audio/x-ms-wma
audio/wav
audio/vnd.wav
audio/vnd.wave
audio/wave
audio/x-pn-wav
audio/x-wav
```

### Contoh upload sebagai voice note

```bash
curl --silent --show-error \
  -u "$GOWA_USER:$GOWA_PASS" \
  -H "X-Device-Id: $GOWA_DEVICE_ID" \
  -F "phone=6281234567890" \
  -F "ptt=true" \
  -F "audio=@/path/audio.ogg" \
  "$BASE_URL/send/audio"
```

### Contoh dari URL

```bash
curl --silent --show-error \
  -u "$GOWA_USER:$GOWA_PASS" \
  -H "X-Device-Id: $GOWA_DEVICE_ID" \
  -F "phone=6281234567890" \
  -F "ptt=false" \
  -F "audio_url=https://example.com/audio.mp3" \
  "$BASE_URL/send/audio"
```

---

## 12. Kirim file/dokumen

### Request

```http
POST /send/file
Content-Type: multipart/form-data
```

### Field form-data

| Field | Tipe | Wajib | Keterangan |
|---|---|---:|---|
| `phone` | string | Ya | Nomor/JID penerima. |
| `file` | file | Ya | File yang diunggah. |
| `caption` | string | Tidak | Caption file. |
| `reply_message_id` | string | Tidak | ID pesan yang dikutip. |
| `is_forwarded` | boolean | Tidak | Tandai sebagai forwarded. |
| `duration` | integer | Tidak | Durasi disappearing message. |

### Batas upload

```text
10 MB
```

### Catatan kontrak v8.7

Model internal memiliki field `file_url`, tetapi REST handler v8.7 secara langsung mewajibkan `FormFile("file")`. Karena itu, untuk server ini perlakukan `/send/file` sebagai **upload file wajib** dan jangan mengandalkan `file_url`.

### Contoh

```bash
curl --silent --show-error \
  -u "$GOWA_USER:$GOWA_PASS" \
  -H "X-Device-Id: $GOWA_DEVICE_ID" \
  -F "phone=6281234567890" \
  -F "caption=Dokumen contoh" \
  -F "file=@/path/dokumen.pdf" \
  "$BASE_URL/send/file"
```

---

## 13. Kirim sticker

### Request

```http
POST /send/sticker
Content-Type: multipart/form-data
```

### Field form-data

| Field | Tipe | Wajib | Keterangan |
|---|---|---:|---|
| `phone` | string | Ya | Nomor/JID penerima. |
| `sticker` | file | Kondisional | File media yang akan dijadikan/dikirim sebagai sticker. |
| `sticker_url` | string URL | Kondisional | URL media sticker. |
| `is_forwarded` | boolean | Tidak | Tandai sebagai forwarded. |
| `duration` | integer | Tidak | Durasi disappearing message. |

Aturan:

- Salah satu dari `sticker` atau `sticker_url` wajib diberikan.
- Keduanya **tidak boleh** diberikan bersamaan.

### MIME upload yang diterima

```text
image/jpeg
image/jpg
image/png
image/webp
image/gif
```

### Contoh upload file

```bash
curl --silent --show-error \
  -u "$GOWA_USER:$GOWA_PASS" \
  -H "X-Device-Id: $GOWA_DEVICE_ID" \
  -F "phone=6281234567890" \
  -F "sticker=@/path/sticker.webp" \
  "$BASE_URL/send/sticker"
```

### Contoh dari URL

```bash
curl --silent --show-error \
  -u "$GOWA_USER:$GOWA_PASS" \
  -H "X-Device-Id: $GOWA_DEVICE_ID" \
  -F "phone=6281234567890" \
  -F "sticker_url=https://example.com/sticker.webp" \
  "$BASE_URL/send/sticker"
```

---

## 14. Kirim kontak

### Request

```http
POST /send/contact
Content-Type: application/json
```

### Body

| Field | Tipe | Wajib | Keterangan |
|---|---|---:|---|
| `phone` | string | Ya | Penerima pesan kontak. |
| `contact_name` | string | Ya | Nama kontak yang dikirim. |
| `contact_phone` | string | Ya | Nomor kontak dalam format internasional. |
| `is_forwarded` | boolean | Tidak | Tandai sebagai forwarded. |
| `duration` | integer | Tidak | Durasi disappearing message. |

### Contoh

```bash
curl --silent --show-error \
  -u "$GOWA_USER:$GOWA_PASS" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: $GOWA_DEVICE_ID" \
  -d '{
    "phone": "6281234567890",
    "contact_name": "Nama Kontak",
    "contact_phone": "6281111111111"
  }' \
  "$BASE_URL/send/contact"
```

---

## 15. Kirim link

### Request

```http
POST /send/link
Content-Type: application/json
```

### Body

| Field | Tipe | Wajib | Keterangan |
|---|---|---:|---|
| `phone` | string | Ya | Nomor/JID penerima. |
| `link` | string URL | Ya | URL valid. |
| `caption` | string | Ya | Caption; tidak boleh kosong. |
| `is_forwarded` | boolean | Tidak | Tandai sebagai forwarded. |
| `duration` | integer | Tidak | Durasi disappearing message. |

### Contoh

```bash
curl --silent --show-error \
  -u "$GOWA_USER:$GOWA_PASS" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: $GOWA_DEVICE_ID" \
  -d '{
    "phone": "6281234567890",
    "link": "https://example.com",
    "caption": "Silakan buka tautan berikut."
  }' \
  "$BASE_URL/send/link"
```

---

## 16. Kirim lokasi

### Request

```http
POST /send/location
Content-Type: application/json
```

### Body

| Field | Tipe | Wajib | Keterangan |
|---|---|---:|---|
| `phone` | string | Ya | Nomor/JID penerima. |
| `latitude` | string | Ya | Latitude valid. |
| `longitude` | string | Ya | Longitude valid. |
| `is_forwarded` | boolean | Tidak | Tandai sebagai forwarded. |
| `duration` | integer | Tidak | Durasi disappearing message. |

Latitude dan longitude dikirim sebagai string.

### Contoh

```bash
curl --silent --show-error \
  -u "$GOWA_USER:$GOWA_PASS" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: $GOWA_DEVICE_ID" \
  -d '{
    "phone": "6281234567890",
    "latitude": "-6.200000",
    "longitude": "106.816666"
  }' \
  "$BASE_URL/send/location"
```

---

## 17. Kirim polling

### Request

```http
POST /send/poll
Content-Type: application/json
```

### Body

| Field | Tipe | Wajib | Keterangan |
|---|---|---:|---|
| `phone` | string | Ya | Nomor/JID penerima. |
| `question` | string | Ya | Pertanyaan polling. |
| `options` | string[] | Ya | Daftar jawaban; tidak boleh kosong dan harus unik. |
| `max_answer` | integer | Ya | Jumlah jawaban maksimal yang boleh dipilih. |
| `duration` | integer | Tidak | Durasi disappearing message. |
| `is_forwarded` | boolean | Tidak | Tersedia dari base request. |

Aturan `max_answer`:

```text
1 <= max_answer <= jumlah options
```

### Contoh single-choice

```bash
curl --silent --show-error \
  -u "$GOWA_USER:$GOWA_PASS" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: $GOWA_DEVICE_ID" \
  -d '{
    "phone": "6281234567890",
    "question": "Pilih jadwal:",
    "options": [
      "Pagi",
      "Siang",
      "Malam"
    ],
    "max_answer": 1
  }' \
  "$BASE_URL/send/poll"
```

---

# Error dan Penanganannya

## 18. Bentuk respons error

Error aplikasi umumnya berbentuk:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "penjelasan error"
}
```

Pada error tertentu, `results` dapat ikut disertakan:

```json
{
  "code": "DEVICE_NOT_FOUND",
  "message": "device not found; create a device first from /api/devices or provide a valid X-Device-Id",
  "results": {
    "device_id": "device-yang-diminta"
  }
}
```

Field HTTP status tidak muncul dalam JSON; baca status dari `response.status`.

Basic Auth yang gagal dapat menghasilkan teks biasa:

```text
Unauthorized
```

Karena itu, parser error tidak boleh selalu mengasumsikan body JSON.

---

## 19. Kode error penting

| HTTP | `code` / bentuk | Penyebab umum | Tindakan |
|---:|---|---|---|
| 400 | `VALIDATION_ERROR` | Field wajib kosong, format nomor salah, URL tidak valid, MIME ditolak, ukuran terlalu besar, nilai duration salah, opsi poll tidak valid. | Jangan retry. Perbaiki payload. |
| 400 | `INVALID_JID` | JID salah atau penerima tidak terdaftar. | Jangan retry dengan payload sama. Koreksi/verifikasi penerima. |
| 400 | `DEVICE_ID_REQUIRED` | Beberapa device tersedia tetapi request tidak memilih device. | Tambahkan `X-Device-Id` atau `device_id`. |
| 401 | `AUTHENTICATION_ERROR` | Device WhatsApp belum terhubung atau belum login. | Jangan retry berulang. Pulihkan koneksi/login device. |
| 401 | teks `Unauthorized` | Username/password Basic Auth salah atau tidak dikirim. | Perbaiki kredensial. |
| 404 | `DEVICE_NOT_FOUND` | Device ID tidak ada. | Gunakan device ID valid. |
| 408 | `CONTEXT_ERROR` | Operasi dibatalkan/konteks request berakhir pada jalur yang mengembalikan context error. | Retry terbatas hanya bila aman dari duplikasi. |
| 429 | `WA_REACHOUT_TIMELOCK` | WhatsApp menolak pengiriman dengan error 463, lazim pada cold contact, pembatasan akun, atau token privasi. | Jangan retry cepat/berulang. Minta penerima memulai percakapan, kirim sekali dari aplikasi resmi, atau tunggu sebelum mencoba lagi. |
| 500 | `INVALID_WA_CLI` | Client WhatsApp internal tidak valid/kosong. | Pulihkan device/server sebelum retry. |
| 500 | `UPLOAD_MEDIA_ERROR` | Upload media ke WhatsApp gagal. | Cek media, koneksi, dan kondisi device; retry terbatas. |
| 500 | `INTERNAL_SERVER_ERROR` | Error internal atau panic yang tidak diklasifikasikan. | Catat body; retry terbatas hanya untuk error yang tampak sementara. |
| 503 | `DEVICE_MANAGER_UNAVAILABLE` | Device manager tidak tersedia. | Tunggu layanan pulih; retry terbatas. |
| 504 | `GATEWAY_TIMEOUT` | Request melewati timeout server saat menunggu WhatsApp. Timeout default v8.7 adalah 45 detik. | Perlakukan hasil sebagai ambigu; jangan otomatis mengirim ulang tanpa kontrol duplikasi. |

---

## 20. Aturan error handling

### 20.1 Parse respons secara defensif

Urutan yang disarankan:

1. Baca HTTP status.
2. Baca `Content-Type`.
3. Coba parse JSON apabila body valid JSON.
4. Jika bukan JSON, simpan body sebagai teks.
5. Jangan mengandalkan `message` sebagai identifier; gunakan `code`.

Representasi hasil internal yang aman:

```text
httpStatus
code | null
message
results | null
rawBody
```

### 20.2 Jangan retry error permanen

Tidak boleh otomatis retry untuk:

```text
400 VALIDATION_ERROR
400 INVALID_JID
400 DEVICE_ID_REQUIRED
401 Unauthorized
401 AUTHENTICATION_ERROR
404 DEVICE_NOT_FOUND
```

Request baru hanya dilakukan setelah penyebabnya diperbaiki.

### 20.3 Retry error sementara secara terbatas

Kandidat retry terbatas:

```text
408 CONTEXT_ERROR
500 INTERNAL_SERVER_ERROR
500 UPLOAD_MEDIA_ERROR
503 DEVICE_MANAGER_UNAVAILABLE
504 GATEWAY_TIMEOUT
network connection error
```

Batas yang konservatif:

```text
maksimal 1–2 retry
jeda meningkat, misalnya 1 detik lalu 3 detik
```

Namun endpoint kirim pesan **tidak memiliki idempotency key**. Timeout atau putus koneksi setelah server menerima request dapat membuat status pengiriman ambigu. Pengiriman ulang dapat menghasilkan pesan ganda.

Karena itu:

- Retry otomatis hanya ketika dapat dipastikan request belum diterima server.
- Untuk timeout setelah request terkirim, tandai sebagai `unknown/ambiguous`.
- Jangan membuat loop retry tanpa batas.
- Simpan `results.message_id` segera setelah sukses.

### 20.4 Penanganan HTTP 429

Untuk:

```text
WA_REACHOUT_TIMELOCK
```

Jangan memperlakukan sebagai rate limit biasa dengan retry cepat. Pada v8.7, server sudah mencoba pre-warm dan satu kali retry internal sebelum mengembalikan error tersebut. Setelah error diterima:

- hentikan retry otomatis;
- tunggu sebelum percobaan manual berikutnya;
- pastikan penerima pernah berinteraksi dengan akun;
- penerima dapat diminta mengirim pesan terlebih dahulu.

### 20.5 Penanganan `reply_message_id`

`reply_message_id` tersedia untuk:

- pesan teks;
- gambar;
- video;
- audio;
- file.

Pada implementasi v8.7, apabila pesan referensi tidak ditemukan, pengiriman dapat dilanjutkan tanpa quoted/reply context. Karena itu:

- keberhasilan pengiriman tidak menjamin kutipan berhasil diterapkan;
- jangan menganggap `reply_message_id` invalid selalu menghasilkan error;
- validasi keberadaan message ID di sisi aplikasi apabila quoted reply wajib.

### 20.6 Validasi sukses

Pseudocode:

```text
if HTTP 2xx
and body.code == "SUCCESS"
and body.results.message_id is not empty
then success
else failure_or_ambiguous
```

---

## 21. Contoh parser respons JavaScript

Contoh ini hanya menunjukkan cara membaca kontrak HTTP GOWA secara defensif.

```js
async function parseGowaResponse(response) {
  const rawBody = await response.text();

  let body = null;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    // Basic Auth failure dan error tertentu dapat berupa teks biasa.
  }

  if (!response.ok) {
    const error = new Error(
      body?.message || rawBody || `GOWA HTTP ${response.status}`
    );

    error.httpStatus = response.status;
    error.code = body?.code ?? null;
    error.results = body?.results ?? null;
    error.rawBody = rawBody;

    throw error;
  }

  if (
    body?.code !== "SUCCESS" ||
    !body?.results?.message_id
  ) {
    const error = new Error("Respons sukses GOWA tidak lengkap");
    error.httpStatus = response.status;
    error.code = body?.code ?? null;
    error.results = body?.results ?? null;
    error.rawBody = rawBody;
    throw error;
  }

  return body;
}
```

---

## 22. Contoh request JavaScript — teks

```js
const baseUrl = "http://localhost:3000";
const username = process.env.GOWA_USER;
const password = process.env.GOWA_PASS;
const deviceId = process.env.GOWA_DEVICE_ID;

const authorization = Buffer
  .from(`${username}:${password}`)
  .toString("base64");

const headers = {
  Authorization: `Basic ${authorization}`,
  "Content-Type": "application/json",
};

if (deviceId) {
  headers["X-Device-Id"] = deviceId;
}

const response = await fetch(`${baseUrl}/send/message`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    phone: "6281234567890",
    message: "Halo, ini pesan percobaan.",
  }),
  signal: AbortSignal.timeout(50000),
});

const result = await parseGowaResponse(response);
```

Timeout client pada contoh dibuat sedikit lebih panjang daripada timeout server v8.7 yang bernilai 45 detik.

---

## 23. Contoh request JavaScript — multipart media

```js
const form = new FormData();

form.set("phone", "6281234567890");
form.set("caption", "Contoh gambar");
form.set("compress", "true");
form.set("image", imageFile);

const headers = {
  Authorization: `Basic ${authorization}`,
};

if (deviceId) {
  headers["X-Device-Id"] = deviceId;
}

const response = await fetch(`${baseUrl}/send/image`, {
  method: "POST",
  headers,
  body: form,
  signal: AbortSignal.timeout(50000),
});

const result = await parseGowaResponse(response);
```

Jangan menambahkan `Content-Type` secara manual saat mengirim `FormData`; runtime akan membuat nilai boundary yang benar.

---

## 24. Checklist request

Sebelum mengirim:

- [ ] Base URL sesuai lokasi pemanggil.
- [ ] Basic Auth dikirim.
- [ ] `X-Device-Id` dikirim bila ada lebih dari satu device.
- [ ] Nomor memakai format internasional `62...`, bukan `08...`.
- [ ] Endpoint dan `Content-Type` sesuai.
- [ ] Untuk media, nama field file tepat: `image`, `video`, `audio`, `file`, atau `sticker`.
- [ ] URL media merupakan URL valid dan dapat diakses server.
- [ ] MIME upload termasuk daftar yang diterima.
- [ ] File biasa maksimal 10 MB.
- [ ] Video upload maksimal 30 MB.
- [ ] `duration` hanya memakai nilai yang didukung.
- [ ] Poll memiliki opsi unik dan `max_answer` valid.
- [ ] Error parser mendukung JSON dan teks biasa.
- [ ] Retry tidak berpotensi membuat pesan ganda.

---

## 25. Sumber resmi

- Repository: <https://github.com/aldinokemal/go-whatsapp-web-multidevice>
- OpenAPI v8.7.0: <https://github.com/aldinokemal/go-whatsapp-web-multidevice/blob/v8.7.0/docs/openapi.yaml>
- REST send controller v8.7.0: <https://github.com/aldinokemal/go-whatsapp-web-multidevice/blob/v8.7.0/src/ui/rest/send.go>
- Send validation v8.7.0: <https://github.com/aldinokemal/go-whatsapp-web-multidevice/blob/v8.7.0/src/validations/send_validation.go>
- Error definitions v8.7.0: <https://github.com/aldinokemal/go-whatsapp-web-multidevice/tree/v8.7.0/src/pkg/error>
- REST middleware v8.7.0: <https://github.com/aldinokemal/go-whatsapp-web-multidevice/tree/v8.7.0/src/ui/rest/middleware>
- Releases: <https://github.com/aldinokemal/go-whatsapp-web-multidevice/releases>
