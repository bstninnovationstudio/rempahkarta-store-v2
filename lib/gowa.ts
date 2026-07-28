import { getGowaBaseUrl, isProduction } from "@/lib/env";

export const WHATSAPP_AUTOMATED_FOOTER =
  "`[Pesan Otomatis!] - Ini adalah pesan yang dikirimkan otomatis oleh sistem, mohon jangan membalas apapun di Chat Whatsapp ini`";

type GowaBody = {
  code?: string;
  message?: string;
  results?: {
    message_id?: string;
    status?: string;
  };
};

export type GowaSendResult = {
  messageId: string;
  code: string;
  status?: string;
  httpStatus: number;
};

export class GowaError extends Error {
  constructor(
    message: string,
    readonly details: {
      httpStatus?: number;
      code?: string;
      ambiguous: boolean;
    },
  ) {
    super(message);
    this.name = "GowaError";
  }
}

export function formatWhatsappPhone(value: string) {
  const raw = value.trim().replace(/@s\.whatsapp\.net$/i, "");
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  if (!/^[1-9]\d{7,14}$/.test(digits)) {
    throw new Error("Nomor WhatsApp harus memakai format nomor yang valid");
  }
  return digits;
}

export function withWhatsappFooter(message: string) {
  const clean = message.trim();
  return clean.endsWith(WHATSAPP_AUTOMATED_FOOTER)
    ? clean
    : `${clean}\n\n${WHATSAPP_AUTOMATED_FOOTER}`;
}

function safeErrorText(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 500);
}

function gowaHeaders(json = false) {
  const username = process.env.GOWA_USER?.trim();
  const password = process.env.GOWA_PASS;
  if (!username || !password) {
    throw new GowaError("Kredensial GOWA belum dikonfigurasi", { ambiguous: false });
  }
  if (
    isProduction()
    && /(replace|change.?me|example|test)/i.test(`${username}:${password}`)
  ) {
    throw new GowaError("Kredensial GOWA production belum aman", { ambiguous: false });
  }

  const baseUrl = getGowaBaseUrl().replace(/\/+$/, "");
  const headers: Record<string, string> = {
    Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
  const deviceId = process.env.GOWA_DEVICE_ID?.trim();
  if (deviceId) headers["X-Device-Id"] = deviceId;
  return { baseUrl, headers };
}

async function parseGowaSendResponse(response: Response): Promise<GowaSendResult> {
  const rawBody = await response.text();
  let body: GowaBody | null = null;
  try {
    body = rawBody ? JSON.parse(rawBody) as GowaBody : null;
  } catch {
    // Basic Auth dan beberapa error GOWA dapat berupa teks biasa.
  }
  if (!response.ok) {
    throw new GowaError(
      safeErrorText(body?.message || rawBody || `GOWA HTTP ${response.status}`),
      { httpStatus: response.status, code: body?.code, ambiguous: false },
    );
  }
  const messageId = body?.results?.message_id?.trim();
  if (body?.code !== "SUCCESS" || !messageId) {
    throw new GowaError("Respons sukses GOWA tidak lengkap", {
      httpStatus: response.status,
      code: body?.code,
      ambiguous: false,
    });
  }
  return {
    messageId,
    code: body.code,
    status: body.results?.status,
    httpStatus: response.status,
  };
}

export async function sendWhatsappMessage(phone: string, message: string): Promise<GowaSendResult> {
  const { baseUrl, headers } = gowaHeaders(true);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/send/message`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        phone: formatWhatsappPhone(phone),
        message: withWhatsappFooter(message),
      }),
      signal: AbortSignal.timeout(50_000),
      cache: "no-store",
    });
  } catch {
    throw new GowaError(
      "Status pengiriman WhatsApp tidak dapat dipastikan karena koneksi terputus atau timeout",
      { ambiguous: true },
    );
  }
  return parseGowaSendResponse(response);
}

export async function sendWhatsappImage(
  phone: string,
  caption: string,
  image: { data: Uint8Array; contentType: "image/jpeg" | "image/png"; fileName: string },
): Promise<GowaSendResult> {
  const { baseUrl, headers } = gowaHeaders();
  const form = new FormData();
  form.set("phone", formatWhatsappPhone(phone));
  form.set("caption", withWhatsappFooter(caption));
  form.set("compress", "true");
  form.set("view_once", "false");
  form.set(
    "image",
    new Blob([new Uint8Array(image.data)], { type: image.contentType }),
    image.fileName,
  );
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/send/image`, {
      method: "POST",
      headers,
      body: form,
      signal: AbortSignal.timeout(50_000),
      cache: "no-store",
    });
  } catch {
    throw new GowaError(
      "Status pengiriman media WhatsApp tidak dapat dipastikan karena koneksi terputus atau timeout",
      { ambiguous: true },
    );
  }
  return parseGowaSendResponse(response);
}
