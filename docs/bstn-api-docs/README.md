# BSTN Payment API Reference

> **STATUS: REFERENSI PROVIDER, BUKAN SPESIFIKASI INTERNAL APLIKASI.** REMPAHKARTA memakai subset create payment, detail/status, cancel, finish URL, dan outbound webhook melalui `lib/adapters/bstn.ts`. Cocokkan kembali contract ini dengan provider sebelum release karena isi folder adalah snapshot lokal. Bagian Messaging API ikut terbawa dari sumber upstream, tetapi tidak dipakai atau diaudit sebagai contract aplikasi ini; dokumentasi automation tidak dibundel.

Production contract version: **v1** (`/api/v1`).

Dokumen ini ditujukan untuk integrasi **workspace/project** dengan BSTN Payment API. Endpoint yang dibahas hanya endpoint yang relevan untuk workspace/integrator: create payment, membaca detail/status dari database BSTN, cancel payment, callback `finish_url`, dan outbound workspace webhook.

Endpoint internal Payment Page (`/api/v1/payment-page/...`) dan provider webhook Midtrans (`/api/v1/webhooks/midtrans`) tidak perlu dipanggil oleh workspace.

## Base URL

```text
https://www.bstn-innovation-studio.web.id
```

Untuk development lokal:

```text
http://localhost:3000
```

## Authentication

Workspace endpoint membutuhkan project API key.

```http
Authorization: Bearer <project_api_key>
Content-Type: application/json
```

API key tidak boleh diekspos di browser/client-side code. Panggil endpoint workspace dari backend/server milik workspace.

Environment Midtrans ditentukan dari prefix API key:

| Prefix API key | Provider environment |
| --- | --- |
| `bstn_test_*` | `sandbox` |
| `bstn_live_*` | `production` |

Jika project sedang maintenance, endpoint create payment menolak payment baru, tetapi endpoint baca status/cancel untuk payment yang sudah ada tetap dapat dipakai.

## Payment Method

`/api/v1` mendukung dua payment provider:

| Payment method | `payment_provider` | Default | Keterangan |
| --- | --- | --- | --- |
| Dynamic QRIS | `qris_dynamic` | Ya | Membuat QRIS dinamis dari konfigurasi `QRIS_DYNAMIC_RAW`, menambahkan unique code/admin fee jika aktif, lalu menampilkan QR di BSTN Payment Page. |
| SNAP Link Midtrans | `midtrans` | Tidak | Membuat Midtrans SNAP hosted payment URL dan menampilkannya di BSTN Payment Page. |

Nilai legacy `payment_mode` seperti `payment_link` dan `qris` masih diterima untuk Midtrans, tetapi dinormalisasi ke `snap`. Untuk integrasi baru, gunakan:

- Dynamic QRIS: `payment_provider: "qris_dynamic"`
- SNAP Link: `payment_provider: "midtrans"`, `payment_mode: "snap"`

## Messaging API

Endpoint messaging memakai project API key yang sama dengan Payment API.

Aturan environment:

- API key `bstn_live_*` mengirim ke target asli.
- API key `bstn_test_*` tetap mengirim pesan real, tetapi target dialihkan ke target test yang dikonfigurasi BSTN. Response menyertakan field `sandbox_redirected: true`.
- Jika project maintenance, request pesan baru ditolak dengan `503 PROJECT_MAINTENANCE`.
- Jika project/API key disabled/revoked/tidak valid, request ditolak sesuai error auth/project yang sama dengan endpoint payment.

### Send WhatsApp Message

```http
POST /api/v1/messages/whatsapp
```

Request:

```json
{
  "phone": "081234567890",
  "message": "Halo dari BSTN Innovation Studio"
}
```

| Field | Type | Required | Keterangan |
| --- | --- | --- | --- |
| `phone` | string | Ya | Nomor tujuan. Mendukung `0812...`, `62812...`, `+62812...`, atau JID WhatsApp. |
| `message` | string | Ya | Isi pesan teks. Maksimal 4096 karakter. |
| `metadata` | object | Tidak | Metadata bebas dari workspace. |

Response `200 OK`:

```json
{
  "success": true,
  "data": {
    "message_id": "msg_01J...",
    "channel": "whatsapp",
    "provider_env": "production",
    "status": "sent",
    "requested_phone": "6281234567890",
    "phone": "6281234567890",
    "target": "6281234567890@s.whatsapp.net",
    "sandbox_redirected": false,
    "upstream_status": 200,
    "upstream": {
      "code": "SUCCESS",
      "message": "Message sent"
    }
  }
}
```

### Send WhatsApp Media

```http
POST /api/v1/messages/whatsapp/media
Content-Type: multipart/form-data
```

Endpoint ini hanya menerima upload file binary. Sistem tidak menerima base64, URL, `image_url`, `file_url`, atau field sejenis. Jika workspace mengirim media dalam bentuk selain file multipart, request ditolak sebelum diproses.

Field form-data:

| Field | Type | Required | Keterangan |
| --- | --- | --- | --- |
| `phone` | string | Ya | Nomor tujuan. Mendukung format yang sama dengan endpoint text. |
| `kind` | string | Ya | `image` atau `document`. |
| `file` | binary file | Ya | File yang diteruskan ke GOWA. |
| `caption` | string | Tidak | Caption media. |
| `metadata` | JSON string | Tidak | Metadata bebas dari workspace dalam bentuk string JSON object. |

MIME type yang diterima:

- Image: `image/jpeg`, `image/jpg`, `image/png`
- Document: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `text/plain`, `application/zip`, `application/octet-stream`

Contoh cURL:

```bash
curl -X POST "https://www.bstn-innovation-studio.web.id/api/v1/messages/whatsapp/media" \
  -H "Authorization: Bearer $PROJECT_API_KEY" \
  -F "phone=081234567890" \
  -F "kind=image" \
  -F "caption=Foto produk" \
  -F "file=@/path/to/photo.jpg"
```

Response `200 OK`:

```json
{
  "success": true,
  "data": {
    "message_id": "msg_01J...",
    "channel": "whatsapp",
    "provider_env": "production",
    "status": "sent",
    "requested_phone": "6281234567890",
    "phone": "6281234567890",
    "target": "6281234567890@s.whatsapp.net",
    "sandbox_redirected": false,
    "media": {
      "kind": "image",
      "filename": "photo.jpg",
      "mime": "image/jpeg",
      "size": 204800
    },
    "upstream_status": 200,
    "upstream": {
      "code": "SUCCESS",
      "message": "Message sent"
    }
  }
}
```

### Send Email

```http
POST /api/v1/messages/email
```

Endpoint email menerima dua format:

- `application/json` untuk integrasi server yang memakai attachment URL/base64.
- `multipart/form-data` untuk upload file binary langsung. Field file `attachments` bisa dikirim berulang, maksimal 5 file.
- Alamat pengirim tetap `help@bstn-innovation-studio.web.id`; request hanya dapat mengubah nama pengirim via `from_name`.

Request JSON:

```json
{
  "to": "customer@example.com",
  "subject": "Invoice BSTN",
  "from_name": "BSTN Innovation Studio",
  "text": "Halo, invoice Anda sudah tersedia.",
  "attachments": [
    {
      "filename": "invoice.pdf",
      "url": "https://workspace.example.com/files/invoice.pdf"
    }
  ]
}
```

| Field | Type | Required | Keterangan |
| --- | --- | --- | --- |
| `to` | string email | Ya | Email tujuan. Pada API key test dialihkan ke email test BSTN. |
| `subject` | string | Ya | Subject email. Maksimal 255 karakter. |
| `from_name` | string | Tidak | Nama pengirim yang ditampilkan. Alamat pengirim tetap `help@bstn-innovation-studio.web.id`. |
| `text` | string | Salah satu dari `text`/`html` | Body plain text. Jangan dikirim bersamaan dengan `html`. |
| `html` | string | Salah satu dari `text`/`html` | Body HTML. Jangan dikirim bersamaan dengan `text`. |
| `attachments` | array | Tidak | Maksimal 5 attachment. Setiap item memakai `filename` dan salah satu dari `url` atau `content_base64`. |
| `metadata` | object | Tidak | Metadata bebas dari workspace. |

Field multipart:

| Field | Type | Required | Keterangan |
| --- | --- | --- | --- |
| `to` | string email | Ya | Email tujuan. Pada API key test dialihkan ke email test BSTN. |
| `subject` | string | Ya | Subject email. |
| `from_name` | string | Tidak | Nama pengirim yang ditampilkan. |
| `body_mode` | string | Ya | `text` atau `html`. |
| `body` | string | Ya | Isi email sesuai `body_mode`. |
| `attachments` | binary file | Tidak | Bisa dikirim berulang, maksimal 5 file. |
| `metadata` | JSON string | Tidak | Metadata bebas dari workspace dalam bentuk string JSON object. |

Contoh multipart:

```bash
curl -X POST "https://www.bstn-innovation-studio.web.id/api/v1/messages/email" \
  -H "Authorization: Bearer $PROJECT_API_KEY" \
  -F "to=customer@example.com" \
  -F "subject=Invoice BSTN" \
  -F "from_name=BSTN Innovation Studio" \
  -F "body_mode=text" \
  -F "body=Halo, invoice Anda sudah tersedia." \
  -F "attachments=@/path/to/invoice.pdf" \
  -F "attachments=@/path/to/archive.zip"
```

Response `200 OK`:

```json
{
  "success": true,
  "data": {
    "message_id": "msg_01J...",
    "channel": "email",
    "provider_env": "production",
    "status": "sent",
    "requested_to": "customer@example.com",
    "to": "customer@example.com",
    "sandbox_redirected": false,
    "smtp": {
      "message_id": "<smtp-message-id>",
      "accepted": ["customer@example.com"],
      "rejected": [],
      "pending": [],
      "response": "250 OK"
    }
  }
}
```

Error provider umum:

| HTTP status | Code | Kapan terjadi |
| --- | --- | --- |
| `500` | `GOWA_NOT_CONFIGURED` | Konfigurasi GOWA belum lengkap. |
| `500` | `SMTP_NOT_CONFIGURED` | Konfigurasi SMTP belum lengkap. |
| `500` | `COMM_TEST_TARGET_NOT_CONFIGURED` | API key test dipakai tetapi target test belum dikonfigurasi. |
| `400` | `UNSUPPORTED_MEDIA_INPUT` | Endpoint WhatsApp media menerima base64/link, bukan file binary multipart. |
| `400` | `UNSUPPORTED_MEDIA_TYPE` | MIME type file WhatsApp media tidak didukung. |
| `413` | `MEDIA_TOO_LARGE` | File WhatsApp media melebihi limit `GOWA_MEDIA_MAX_BYTES`. |
| `502` | `GOWA_UPSTREAM_ERROR` | GOWA tidak merespons sukses. |
| `502` | `SMTP_DELIVERY_ERROR` | SMTP gagal mengirim email. |

## Status Payment

Nilai `status` yang dapat muncul:

```text
created, pending, paid, challenge, expired, canceled, denied, failed,
refunded, partially_refunded, chargeback, partial_chargeback, authorized, unknown
```

Status terminal yang umum dipakai untuk keputusan bisnis:

| Status | Makna umum |
| --- | --- |
| `paid` | Pembayaran berhasil/final. |
| `expired` | Pembayaran melewati masa berlaku. |
| `canceled` | Pembayaran dibatalkan. |
| `denied` / `failed` | Pembayaran gagal/ditolak. |
| `refunded` / `partially_refunded` | Dana dikembalikan penuh/sebagian. |
| `chargeback` / `partial_chargeback` | Chargeback penuh/sebagian. |

## Create Payment

```http
POST /api/v1/payments
```

Membuat payment untuk project dan mengembalikan URL BSTN Payment Page (`payment_page_url`). Customer diarahkan ke URL ini untuk menyelesaikan pembayaran.

### Headers

```http
Authorization: Bearer <project_api_key>
Content-Type: application/json
Idempotency-Key: <optional-client-idempotency-key>
```

`Idempotency-Key` opsional. Idempotency bisnis tetap menggunakan kombinasi `project_id` + `project_payment_ref`.

### Request Body

| Field | Type | Required | Keterangan |
| --- | --- | --- | --- |
| `project_payment_ref` | string | Ya | Referensi unik dari workspace. Maksimal 100 karakter. Digunakan sebagai business idempotency key. |
| `amount` | integer | Ya | Nominal invoice dalam IDR. Harus cocok dengan total `items[].price * items[].quantity`. |
| `currency` | string | Tidak | Saat ini hanya `IDR`. Default `IDR`. |
| `description` | string | Tidak | Deskripsi pembayaran. Maksimal 255 karakter. |
| `payment_provider` | string | Tidak | `qris_dynamic` atau `midtrans`. Default `qris_dynamic`. |
| `provider` | string | Tidak | Alias opsional untuk `payment_provider`. |
| `payment_mode` | string | Tidak | `qris`, `snap`, atau legacy `payment_link`. Default `qris`. Untuk Midtrans gunakan `snap`. |
| `image_qris` | boolean | Tidak | Jika `true`, Dynamic QRIS mengembalikan `qris.image_data_url` jika tersedia. Diabaikan oleh SNAP. |
| `customer` | object | Tidak | Data customer. Berisi `name`, `email`, `phone`. |
| `items` | array | Ya | Minimal 1 item, maksimal 100 item. |
| `redirect_url` | string URI | Ya | Legacy workspace return URL dan fallback jika `finish_url` kosong. Host harus ada di allowlist project. |
| `finish_url` | string URI | Tidak | URL tombol "Kembali ke workspace" setelah transaksi final. BSTN menambahkan query parameter bertanda tangan. Host harus ada di allowlist project. |
| `webhook_url` | string URI | Tidak | Legacy per-payment webhook URL. Delivery saat ini memakai project `default_webhook_url` lebih dulu, lalu fallback ke field ini. |
| `expiry_minutes` | integer | Tidak | Masa berlaku payment, 1-1440 menit. Default 15. |
| `metadata` | object | Tidak | Metadata bebas dari workspace. |

`items[]`:

| Field | Type | Required | Keterangan |
| --- | --- | --- | --- |
| `id` | string | Tidak | ID item dari workspace. Maksimal 80 karakter. |
| `name` | string | Ya | Nama item. Maksimal 160 karakter. |
| `price` | integer | Ya | Harga per item. Minimal 0. |
| `quantity` | integer | Ya | Jumlah item. 1-999. |

`customer`:

| Field | Type | Required | Keterangan |
| --- | --- | --- | --- |
| `name` | string | Tidak | Nama customer. Maksimal 160 karakter. |
| `email` | string | Tidak | Email customer. Maksimal 200 karakter. |
| `phone` | string | Tidak | Nomor telepon. Maksimal 40 karakter. |

### Dynamic QRIS Request

```json
{
  "project_payment_ref": "INV-DYNQRIS-20260513-0001",
  "amount": 100000,
  "currency": "IDR",
  "description": "Pembayaran invoice INV-DYNQRIS-20260513-0001",
  "payment_provider": "qris_dynamic",
  "image_qris": true,
  "customer": {
    "name": "Budi Santoso",
    "email": "budi@example.com",
    "phone": "+6281234567890"
  },
  "items": [
    {
      "id": "DYNQRIS-001",
      "name": "Invoice INV-DYNQRIS-20260513-0001",
      "price": 100000,
      "quantity": 1
    }
  ],
  "redirect_url": "https://workspace.example.com/payment-return",
  "finish_url": "https://workspace.example.com/orders/INV-DYNQRIS-20260513-0001/payment-finished",
  "webhook_url": "https://workspace.example.com/api/bstn-payment-webhook",
  "expiry_minutes": 15,
  "metadata": {
    "source": "checkout"
  }
}
```

### Dynamic QRIS Response `201 Created`

```json
{
  "success": true,
  "data": {
    "payment_id": "pay_01HZX9T8NA2XABCDE12345",
    "project_payment_ref": "INV-DYNQRIS-20260513-0001",
    "api_version": "v1",
    "payment_provider": "qris_dynamic",
    "payment_type": "dynamic_qr_midtrans",
    "provider_env": "production",
    "status": "pending",
    "payment_mode": "qris",
    "amount": 100000,
    "fee_amount": 713,
    "payable_amount": 100713,
    "currency": "IDR",
    "description": "Pembayaran invoice INV-DYNQRIS-20260513-0001",
    "payment_page_url": "https://www.bstn-innovation-studio.web.id/pay/6zdDkLqMzW3vPzY9sXy1nB0aAeF2QpR7",
    "finish_url": "https://workspace.example.com/orders/INV-DYNQRIS-20260513-0001/payment-finished",
    "idempotent_replay": false,
    "midtrans": null,
    "qris": {
      "requested": true,
      "available": true,
      "image_data_url": "data:image/png;base64,...",
      "qris_string": "000201010212...",
      "dynamic_amount": 100713,
      "payable_amount": 100713,
      "unique_code": "08",
      "admin_fee": 705,
      "admin_rate_basis_points": 70,
      "acquirer": "gopay"
    },
    "provider": {
      "name": "qris_dynamic",
      "environment": "production",
      "payment_type": "dynamic_qr_midtrans",
      "transaction_id": null,
      "transaction_status": "pending",
      "method": "qris",
      "acquirer": "gopay"
    },
    "expires_at": "2026-05-13T09:15:00.000Z",
    "paid_at": null,
    "canceled_at": null,
    "created_at": "2026-05-13T09:00:00.000Z",
    "updated_at": "2026-05-13T09:00:00.000Z"
  }
}
```

Catatan Dynamic QRIS:

- Customer harus membayar `payable_amount`, bukan `amount`, karena `payable_amount` berisi `amount` + unique code + admin fee gross-up.
- Dynamic QRIS memakai gross-up fee: `target_amount = amount + unique_code`, `payable_amount = ceil(target_amount / (1 - admin_rate))`, lalu `qris.admin_fee = payable_amount - target_amount`.
- `qris.image_data_url` hanya dikembalikan jika `image_qris=true` dan QR image berhasil dibuat.
- `qris.qris_string` adalah payload QRIS yang dapat dirender sebagai QR jika workspace membutuhkannya.
- Sistem mengecek transaksi Dynamic QRIS aktif/pending dengan payable amount yang sama. Jika nominal sudah dipakai, sistem akan menghitung ulang unique code.
- Jika memakai API key `bstn_test_*`, Dynamic QRIS berada pada mode sandbox internal BSTN. QR yang dikembalikan bukan QRIS merchant production dan tidak akan dibayar melalui Midtrans sandbox. Untuk testing integrasi, status final `paid` dapat disimulasikan dari admin BSTN dan workspace akan menerima webhook final dengan payload yang sama bentuknya seperti transaksi live.

### SNAP Link Midtrans Request

```json
{
  "project_payment_ref": "INV-SNAP-20260513-0002",
  "amount": 150000,
  "currency": "IDR",
  "description": "Pembayaran invoice INV-SNAP-20260513-0002",
  "payment_provider": "midtrans",
  "payment_mode": "snap",
  "image_qris": false,
  "customer": {
    "name": "Budi Santoso",
    "email": "budi@example.com",
    "phone": "+6281234567890"
  },
  "items": [
    {
      "id": "SNAP-001",
      "name": "Invoice INV-SNAP-20260513-0002",
      "price": 150000,
      "quantity": 1
    }
  ],
  "redirect_url": "https://workspace.example.com/payment-return",
  "finish_url": "https://workspace.example.com/orders/INV-SNAP-20260513-0002/payment-finished",
  "expiry_minutes": 15,
  "metadata": {
    "user_id": "user_123",
    "module": "subscription"
  }
}
```

### SNAP Link Midtrans Response `201 Created`

```json
{
  "success": true,
  "data": {
    "payment_id": "pay_01HZX9T8NA2XABCDE67890",
    "project_payment_ref": "INV-SNAP-20260513-0002",
    "api_version": "v1",
    "payment_provider": "midtrans",
    "payment_type": "snap_link_midtrans",
    "provider_env": "production",
    "status": "pending",
    "payment_mode": "snap",
    "amount": 150000,
    "fee_amount": 1058,
    "payable_amount": 151058,
    "currency": "IDR",
    "description": "Pembayaran invoice INV-SNAP-20260513-0002",
    "payment_page_url": "https://www.bstn-innovation-studio.web.id/pay/6zdDkLqMzW3vPzY9sXy1nB0aAeF2QpR8",
    "finish_url": "https://workspace.example.com/orders/INV-SNAP-20260513-0002/payment-finished",
    "idempotent_replay": false,
    "midtrans": {
      "order_id": "BSTN-DEMO-20260513-01HZX9T8NA2X",
      "transaction_id": null,
      "transaction_status": "pending",
      "payment_type": null,
      "fraud_status": null,
      "snap_token": "snap-token-example",
      "payment_url": "https://app.midtrans.com/snap/v4/redirection/snap-token-example"
    },
    "qris": null,
    "provider": {
      "name": "midtrans",
      "environment": "production",
      "payment_type": "snap_link_midtrans",
      "transaction_id": null,
      "transaction_status": "pending",
      "method": "snap",
      "acquirer": null
    },
    "expires_at": "2026-05-13T09:15:00.000Z",
    "paid_at": null,
    "canceled_at": null,
    "created_at": "2026-05-13T09:00:00.000Z",
    "updated_at": "2026-05-13T09:00:00.000Z"
  }
}
```

Catatan SNAP Link:

- Arahkan customer ke `payment_page_url`, bukan langsung ke `midtrans.payment_url`, agar flow tetap melalui BSTN Payment Page.
- `qris` bernilai `null` untuk SNAP Link.
- `fee_amount` dan `payable_amount` dapat berisi estimasi biaya customer QRIS untuk tampilan. Nominal transaksi yang dikirim ke Midtrans tetap `amount`.
- Midtrans QRIS image creation tidak didukung pada flow SNAP ini.

### Idempotent Create Response `200 OK`

Jika request dengan `project_payment_ref` yang sama dikirim ulang, API mengembalikan payment yang sudah ada.

```json
{
  "success": true,
  "data": {
    "payment_id": "pay_01HZX9T8NA2XABCDE12345",
    "project_payment_ref": "INV-DYNQRIS-20260513-0001",
    "api_version": "v1",
    "payment_provider": "qris_dynamic",
    "payment_type": "dynamic_qr_midtrans",
    "provider_env": "production",
    "status": "pending",
    "payment_mode": "qris",
    "amount": 100000,
    "fee_amount": 713,
    "payable_amount": 100713,
    "currency": "IDR",
    "description": "Pembayaran invoice INV-DYNQRIS-20260513-0001",
    "payment_page_url": "https://www.bstn-innovation-studio.web.id/pay/6zdDkLqMzW3vPzY9sXy1nB0aAeF2QpR7",
    "finish_url": "https://workspace.example.com/orders/INV-DYNQRIS-20260513-0001/payment-finished",
    "idempotent_replay": true,
    "midtrans": null,
    "qris": {
      "requested": true,
      "available": true,
      "image_data_url": "data:image/png;base64,...",
      "qris_string": "000201010212...",
      "dynamic_amount": 100713,
      "payable_amount": 100713,
      "unique_code": "08",
      "admin_fee": 705,
      "admin_rate_basis_points": 70,
      "acquirer": "gopay"
    },
    "provider": {
      "name": "qris_dynamic",
      "environment": "production",
      "payment_type": "dynamic_qr_midtrans",
      "transaction_id": null,
      "transaction_status": "pending",
      "method": "qris",
      "acquirer": "gopay"
    },
    "expires_at": "2026-05-13T09:15:00.000Z",
    "paid_at": null,
    "canceled_at": null,
    "created_at": "2026-05-13T09:00:00.000Z",
    "updated_at": "2026-05-13T09:00:00.000Z"
  }
}
```

## Get Payment Detail / Cek Status dari Database

```http
GET /api/v1/payments/{payment_id}
```

Gunakan endpoint ini untuk membaca record payment yang tersimpan di database BSTN. Endpoint ini **tidak memanggil Midtrans** dan **tidak mengubah status payment**. Cocok untuk integrasi workspace yang hanya perlu melihat status/URL terakhir yang sudah tersimpan.

> Untuk dokumentasi integrasi workspace ini, gunakan endpoint DB-only ini sebagai endpoint cek status. Endpoint sync/status operasional yang melakukan refresh ke Midtrans tidak dibahas di sini.

### Path Parameter

| Parameter | Type | Required | Keterangan |
| --- | --- | --- | --- |
| `payment_id` | string | Ya | ID payment dari response create. Format contoh: `pay_01HZX9T8NA2XABCDE12345`. |

### Request

```bash
curl -X GET "https://www.bstn-innovation-studio.web.id/api/v1/payments/pay_01HZX9T8NA2XABCDE12345" \
  -H "Authorization: Bearer $PROJECT_API_KEY"
```

### Response `200 OK`

Response memakai format yang sama dengan create payment.

```json
{
  "success": true,
  "data": {
    "payment_id": "pay_01HZX9T8NA2XABCDE12345",
    "project_payment_ref": "INV-DYNQRIS-20260513-0001",
    "api_version": "v1",
    "payment_provider": "qris_dynamic",
    "payment_type": "dynamic_qr_midtrans",
    "provider_env": "production",
    "status": "paid",
    "payment_mode": "qris",
    "amount": 100000,
    "fee_amount": 713,
    "payable_amount": 100713,
    "currency": "IDR",
    "description": "Pembayaran invoice INV-DYNQRIS-20260513-0001",
    "payment_page_url": "https://www.bstn-innovation-studio.web.id/pay/6zdDkLqMzW3vPzY9sXy1nB0aAeF2QpR7",
    "finish_url": "https://workspace.example.com/orders/INV-DYNQRIS-20260513-0001/payment-finished",
    "idempotent_replay": false,
    "midtrans": null,
    "qris": {
      "requested": true,
      "available": true,
      "image_data_url": "data:image/png;base64,...",
      "qris_string": "000201010212...",
      "dynamic_amount": 100713,
      "payable_amount": 100713,
      "unique_code": "08",
      "admin_fee": 705,
      "admin_rate_basis_points": 70,
      "acquirer": "gopay"
    },
    "provider": {
      "name": "qris_dynamic",
      "environment": "production",
      "payment_type": "dynamic_qr_midtrans",
      "transaction_id": "6f3c-example",
      "transaction_status": "settlement",
      "method": "qris",
      "acquirer": "gopay"
    },
    "expires_at": "2026-05-13T09:15:00.000Z",
    "paid_at": "2026-05-13T09:03:20.000Z",
    "canceled_at": null,
    "created_at": "2026-05-13T09:00:00.000Z",
    "updated_at": "2026-05-13T09:03:20.000Z"
  }
}
```

## Cancel Payment

```http
POST /api/v1/payments/{payment_id}/cancel
```

Membatalkan payment yang masih dapat dibatalkan. Untuk provider yang membutuhkan proses provider-side, BSTN akan memproses pembatalan melalui backend dan Midtrans jika berlaku.

### Path Parameter

| Parameter | Type | Required | Keterangan |
| --- | --- | --- | --- |
| `payment_id` | string | Ya | ID payment dari response create. |

### Request Body

Request body opsional.

```json
{
  "reason": "customer_requested"
}
```

| Field | Type | Required | Keterangan |
| --- | --- | --- | --- |
| `reason` | string | Tidak | Alasan cancel. 1-160 karakter. |

### Request

```bash
curl -X POST "https://www.bstn-innovation-studio.web.id/api/v1/payments/pay_01HZX9T8NA2XABCDE12345/cancel" \
  -H "Authorization: Bearer $PROJECT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "reason": "customer_requested" }'
```

### Response `200 OK`

```json
{
  "success": true,
  "data": {
    "payment_id": "pay_01HZX9T8NA2XABCDE12345",
    "payment_provider": "qris_dynamic",
    "order_id": "BSTN-DEMO-20260513-01HZX9T8NA2X",
    "status": "canceled",
    "midtrans_status": "cancel",
    "status_before": "pending",
    "status_after": "canceled",
    "internal_only": false,
    "idempotent": false,
    "canceled_at": "2026-05-13T09:05:00.000Z"
  }
}
```

Jika cancel dipanggil ulang untuk payment yang sudah berada pada hasil cancel yang sama, response dapat bersifat idempotent:

```json
{
  "success": true,
  "data": {
    "payment_id": "pay_01HZX9T8NA2XABCDE12345",
    "payment_provider": "qris_dynamic",
    "order_id": "BSTN-DEMO-20260513-01HZX9T8NA2X",
    "status": "canceled",
    "midtrans_status": "cancel",
    "status_before": "canceled",
    "status_after": "canceled",
    "internal_only": false,
    "idempotent": true,
    "canceled_at": "2026-05-13T09:05:00.000Z"
  }
}
```

### Cancel Conflict `409 Conflict`

Jika payment tidak bisa dibatalkan pada status saat ini, API mengembalikan error envelope.

```json
{
  "error": {
    "code": "PAYMENT_CANNOT_BE_CANCELED",
    "message": "Payment cannot be canceled in current state",
    "details": {
      "status": "paid"
    },
    "request_id": "req_01HZX9T8NA2XABCDE12345"
  }
}
```

## Workspace Webhook: Payment Finalized

Ketika payment mencapai status terminal (`paid`, `expired`, `canceled`, `denied`, `failed`, `refunded`, dan sejenisnya), BSTN mengirim webhook ke workspace.

Target webhook dipilih dengan urutan:

1. Project `default_webhook_url` saat ini.
2. Fallback ke `webhook_url` pada payment lama/legacy jika project default kosong.

### Request dari BSTN ke Workspace

```http
POST <workspace_webhook_url>
Content-Type: application/json
User-Agent: BSTN-Payment-Webhook/1.0
X-BSTN-Event: payment.finalized
X-BSTN-Delivery-Id: wh_...
X-BSTN-Attempt-Id: wha_...
X-BSTN-Signature: <hmac_sha256_raw_body>
```

`X-BSTN-Signature` adalah HMAC-SHA256 dari raw JSON body menggunakan `RETURN_SIGNATURE_SECRET`. Verifikasi signature dari raw body sebelum memproses payload.

### Webhook Payload

```json
{
  "event": "payment.finalized",
  "sent_at": "2026-05-13T09:03:25.000Z",
  "payment": {
    "payment_id": "pay_01HZX9T8NA2XABCDE12345",
    "project_id": "proj_01HZX9T8NA2X",
    "project_payment_ref": "INV-DYNQRIS-20260513-0001",
    "api_version": "v1",
    "order_id": "BSTN-DEMO-20260513-01HZX9T8NA2X",
    "payment_provider": "qris_dynamic",
    "payment_type": "dynamic_qr_midtrans",
    "provider_env": "production",
    "status": "paid",
    "amount": 100000,
    "net_amount": 100000,
    "payable_amount": 100713,
    "currency": "IDR",
    "qris_unique_code": "08",
    "qris_admin_fee": 705,
    "payment_mode": "qris",
    "payment_page_url": "https://www.bstn-innovation-studio.web.id/pay/6zdDkLqMzW3vPzY9sXy1nB0aAeF2QpR7",
    "description": "Pembayaran invoice INV-DYNQRIS-20260513-0001",
    "occurred_at": "2026-05-13T09:03:20.000Z",
    "paid_at": "2026-05-13T09:03:20.000Z",
    "expired_at": null,
    "canceled_at": null,
    "failed_at": null,
    "created_at": "2026-05-13T09:00:00.000Z",
    "updated_at": "2026-05-13T09:03:20.000Z"
  },
  "midtrans": {
    "transaction_id": "6f3c-example",
    "transaction_status": "settlement",
    "payment_type": "qris",
    "fraud_status": "accept",
    "status_code": "200",
    "status_message": "midtrans payment notification"
  },
  "provider": {
    "name": "qris_dynamic",
    "environment": "production",
    "payment_type": "dynamic_qr_midtrans",
    "transaction_id": "6f3c-example",
    "transaction_status": "settlement",
    "method": "qris",
    "acquirer": "gopay"
  },
  "qris": {
    "requested": true,
    "available": true,
    "image_data_url": null,
    "qris_string": "000201010212...",
    "dynamic_amount": 100713,
    "payable_amount": 100713,
    "unique_code": "08",
    "admin_fee": 705,
    "admin_rate_basis_points": 70,
    "acquirer": "gopay"
  }
}
```

Untuk SNAP Link Midtrans, `payment.payment_provider` bernilai `midtrans`, `payment.payment_type` bernilai `snap_link_midtrans`, dan objek `midtrans`/`provider` berisi status transaksi Midtrans. Objek `qris` dapat berisi nilai yang tidak relevan sebagai `null` sesuai kontrak.

### Response yang Harus Dikembalikan Workspace

BSTN menganggap delivery berhasil jika workspace mengembalikan HTTP 2xx dengan JSON berikut:

```json
{
  "success": true
}
```

## Finish URL Parameters

Saat customer menekan tombol kembali ke workspace dari BSTN Payment Page setelah transaksi final, BSTN membuka `finish_url` dan menambahkan query parameter berikut:

```text
payment_id=pay_...
project_payment_ref=INV-...
status=paid
signature=<hmac_sha256(payment_id.project_payment_ref.status)>
```

Contoh URL akhir:

```text
https://workspace.example.com/orders/INV-DYNQRIS-20260513-0001/payment-finished?payment_id=pay_01HZX9T8NA2XABCDE12345&project_payment_ref=INV-DYNQRIS-20260513-0001&status=paid&signature=...
```

Workspace harus memverifikasi `signature` sebelum mempercayai query string. Setelah valid, workspace dapat memanggil `GET /api/v1/payments/{payment_id}` untuk membaca status terbaru yang tersimpan di database BSTN.

## Error Response Format

Semua error JSON memakai envelope berikut:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation error",
    "details": [
      {
        "path": "amount",
        "message": "Expected number to be greater than or equal to 1"
      }
    ],
    "request_id": "req_01HZX9T8NA2XABCDE12345"
  }
}
```

`details` dapat berupa array, object, string, atau `null`.

Status HTTP yang umum:

| HTTP status | Kapan terjadi |
| --- | --- |
| `400` | Payload tidak valid. |
| `401` | API key tidak ada/tidak valid. |
| `403` | Akses ditolak, misalnya host URL tidak diizinkan. |
| `404` | Payment tidak ditemukan. |
| `409` | Operasi tidak bisa dilakukan pada state saat ini, misalnya cancel payment yang sudah paid. |
| `429` | Rate limited. |
| `500` | Internal error. |
| `502` | Error dari provider Midtrans/upstream. |
| `503` | Project sedang maintenance sehingga create payment baru ditolak. |

Contoh unauthorized:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Unauthorized",
    "details": null,
    "request_id": "req_01HZX9T8NA2XABCDE12345"
  }
}
```

Contoh project maintenance saat create payment:

```json
{
  "error": {
    "code": "PROJECT_MAINTENANCE",
    "message": "Project is in maintenance mode. Existing payments can still be checked, but new payments are temporarily disabled.",
    "details": {
      "project_id": "prj_1234567890"
    },
    "request_id": "req_01HZX9T8NA2XABCDE12345"
  }
}
```

Contoh operational mode project disabled:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Project is disabled.",
    "details": {
      "project_id": "prj_1234567890"
    },
    "request_id": "req_01HZX9T8NA2XABCDE12345"
  }
}
```

Jika API key hilang/tidak valid/revoked, atau project status utama `disabled`, endpoint workspace mengembalikan `401 UNAUTHORIZED` dengan envelope unauthorized.

Contoh payment not found:

```json
{
  "error": {
    "code": "PAYMENT_NOT_FOUND",
    "message": "Payment not found",
    "details": null,
    "request_id": "req_01HZX9T8NA2XABCDE12345"
  }
}
```

## Recommended Integration Flow

1. Workspace backend membuat payment dengan `POST /api/v1/payments`.
2. Simpan `payment_id`, `project_payment_ref`, `payment_page_url`, `status`, `amount`, dan `payable_amount`.
3. Redirect customer ke `payment_page_url`.
4. Tunggu salah satu sinyal final:
   - Workspace webhook `payment.finalized` dari BSTN, atau
   - Customer kembali ke `finish_url` dengan signature valid.
5. Verifikasi signature webhook atau `finish_url`.
6. Panggil `GET /api/v1/payments/{payment_id}` untuk membaca record/status dari database BSTN.
7. Update order/invoice di workspace berdasarkan `status` final.

## OpenAPI Document

Kontrak lengkap tersedia di:

```http
GET /api/v1/openapi
```

Format response: `application/yaml`.
