import assert from "node:assert/strict";
import test from "node:test";
import {
  formatWhatsappPhone,
  sendWhatsappImage,
  WHATSAPP_AUTOMATED_FOOTER,
  withWhatsappFooter,
} from "../lib/gowa";
import {
  canonicalRefundSetting,
  refundSettingBindingHash,
} from "../lib/refund-setting";
import {
  formatCustomerShipmentEvent,
  formatWhatsappTimelineMessage,
} from "../lib/shipment-event";
import {
  buildOtpMessage,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_RESENDS,
  OTP_TTL_MS,
  otpCodeHash,
} from "../lib/whatsapp-otp";

test("nomor WhatsApp Indonesia dinormalisasi ke format internasional GOWA", () => {
  assert.equal(formatWhatsappPhone("0812 3456 7890"), "6281234567890");
  assert.equal(formatWhatsappPhone("+62 812-3456-7890"), "6281234567890");
  assert.equal(formatWhatsappPhone("6281234567890@s.whatsapp.net"), "6281234567890");
  assert.throws(() => formatWhatsappPhone("0812"));
});

test("footer pesan otomatis ditambahkan tepat satu kali", () => {
  const once = withWhatsappFooter("Halo");
  assert.equal(once, `Halo\n\n${WHATSAPP_AUTOMATED_FOOTER}`);
  assert.equal(withWhatsappFooter(once), once);
});

test("media promosi dikirim sebagai multipart dengan footer caption", async context => {
  const previousUser = process.env.GOWA_USER;
  const previousPass = process.env.GOWA_PASS;
  process.env.GOWA_USER = "gowa-test-user";
  process.env.GOWA_PASS = "gowa-test-password";
  const fetchMock = context.mock.method(globalThis, "fetch", async (
    _url: string | URL | Request,
    init?: RequestInit,
  ) => {
    const form = init?.body as FormData;
    assert.equal(form.get("phone"), "6281234567890");
    assert.match(String(form.get("caption")), /Pesan promosi[\s\S]*Pesan Otomatis/);
    assert.ok(form.get("image") instanceof File);
    return new Response(JSON.stringify({
      code: "SUCCESS",
      results: { message_id: "message-123", status: "sent" },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  try {
    const result = await sendWhatsappImage("081234567890", "Pesan promosi", {
      data: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
      contentType: "image/jpeg",
      fileName: "promo.jpg",
    });
    assert.equal(result.messageId, "message-123");
    assert.equal(fetchMock.mock.callCount(), 1);
  } finally {
    if (previousUser === undefined) delete process.env.GOWA_USER;
    else process.env.GOWA_USER = previousUser;
    if (previousPass === undefined) delete process.env.GOWA_PASS;
    else process.env.GOWA_PASS = previousPass;
  }
});

test("OTP memakai kebijakan lima menit, satu resend, dan peringatan keamanan", () => {
  assert.equal(OTP_TTL_MS, 5 * 60_000);
  assert.equal(OTP_MAX_RESENDS, 1);
  assert.equal(OTP_MAX_ATTEMPTS, 5);
  const message = buildOtpMessage("123456", "PHONE_VERIFICATION");
  assert.match(message, /berlaku 5 menit/i);
  assert.match(message, /jangan berikan/i);
});

test("hash OTP terikat ke challenge dan purpose", async () => {
  const previous = process.env.WHATSAPP_OTP_SECRET;
  process.env.WHATSAPP_OTP_SECRET = "secret-test-whatsapp-otp-minimal-32-karakter";
  try {
    const base = {
      challengeId: "challenge-a",
      userId: "user-a",
      purpose: "PHONE_VERIFICATION" as const,
      phone: "081234567890",
      code: "123456",
    };
    const hash = await otpCodeHash(base);
    const other = await otpCodeHash({ ...base, challengeId: "challenge-b" });
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.notEqual(hash, other);
  } finally {
    if (previous === undefined) delete process.env.WHATSAPP_OTP_SECRET;
    else process.env.WHATSAPP_OTP_SECRET = previous;
  }
});

test("binding rekening refund memakai payload kanonis", async () => {
  const first = {
    type: "bank" as const,
    bankName: " BCA ",
    bankOwnerName: " Sari ",
    bankNumber: "123 456",
  };
  const second = {
    type: "bank" as const,
    bankName: "BCA",
    bankOwnerName: "Sari",
    bankNumber: "123456",
  };
  assert.equal(canonicalRefundSetting(first), canonicalRefundSetting(second));
  assert.equal(await refundSettingBindingHash(first), await refundSettingBindingHash(second));
});

test("copy event shipment sama untuk timeline dan pesan WhatsApp", () => {
  const formatted = formatCustomerShipmentEvent({
    providerStatus: "delivered",
    note: null,
    payload: { status: "delivered" },
    courierCompany: "jne",
    courierType: "reg",
  });
  assert.deepEqual(formatted, {
    title: "Paket telah diterima",
    note: "Paket berhasil diserahkan kepada penerima",
  });
  const message = formatWhatsappTimelineMessage({
    occurredAt: new Date("2026-07-24T05:05:11.000Z"),
    ...formatted,
  });
  assert.equal(message, "[24 Jul 12:05:11]\nPaket telah diterima\nPaket berhasil diserahkan kepada penerima");
});
