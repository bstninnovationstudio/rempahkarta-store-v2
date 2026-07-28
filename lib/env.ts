import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_MODE: z.enum(["production", "development"]).default("development"),
  ENABLE_DEVTOOLS: z.enum(["true", "false"]).default("false"),
  APP_URL: z.string().url().optional(),
  APP_URL_DEV: z.string().url().optional(),
  APP_URL_LIVE: z.string().url().optional(),
  BSTN_BASE_URL: z.string().url().default("https://www.bstn-innovation-studio.web.id"),
  BSTN_PROJECT_API_KEY: z.string().min(1).optional(),
  BSTN_PROJECT_API_KEY_DEV: z.string().min(1).optional(),
  BSTN_PROJECT_API_KEY_LIVE: z.string().min(1).optional(),
  BSTN_RETURN_SIGNATURE_SECRET: z.string().min(1).optional(),
  BITESHIP_BASE_URL: z.string().url().default("https://api.biteship.com"),
  BITESHIP_API_KEY: z.string().min(1).optional(),
  BITESHIP_API_KEY_DEV: z.string().min(1).optional(),
  BITESHIP_API_KEY_LIVE: z.string().min(1).optional(),
  BITESHIP_WEBHOOK_SHARED_SECRET: z.string().min(1).optional(),
  ENABLED_COURIERS: z.string().min(1).default("jne,sicepat,anteraja,jnt"),
  WAREHOUSE_AREA_ID: z.string().min(1).optional(),
  WAREHOUSE_POSTAL_CODE: z.string().min(5),
  WAREHOUSE_NAME: z.string().min(2),
  WAREHOUSE_CONTACT_NAME: z.string().min(2),
  WAREHOUSE_CONTACT_PHONE: z.string().min(8),
  WAREHOUSE_ADDRESS: z.string().min(10),
  AUTH_SECRET: z.string().min(32),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD_SCRYPT: z.string().min(40).optional(),
  ADMIN_PASSWORD_HASH: z.string().length(64).optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  GOWA_BASE_URL_DEV: z.string().url().default("http://157.20.32.214:3000"),
  GOWA_BASE_URL_LIVE: z.string().url().default("http://localhost:3000"),
  GOWA_USER: z.string().min(1).optional(),
  GOWA_PASS: z.string().min(1).optional(),
  GOWA_DEVICE_ID: z.string().min(1).optional(),
  WHATSAPP_OTP_SECRET: z.string().min(32).optional(),
  CRON_SECRET: z.string().min(32).optional(),
});

export type AppEnv = z.infer<typeof schema>;

export function getEnv(): AppEnv {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) throw new Error(`Environment belum lengkap: ${parsed.error.issues.map(i => i.path.join(".")).join(", ")}`);
  return parsed.data;
}

/** Apakah aplikasi berjalan dalam mode production (APP_MODE=production) */
export function isProduction(): boolean {
  return process.env.APP_MODE === "production";
}

/** APP_URL aktif berdasarkan APP_MODE. Production menggunakan APP_URL_LIVE, development menggunakan APP_URL_DEV, dengan fallback ke APP_URL. */
export function getAppUrl(): string | undefined {
  return isProduction()
    ? (process.env.APP_URL_LIVE || process.env.APP_URL)
    : (process.env.APP_URL_DEV || process.env.APP_URL);
}

export function getPublicAppOrigin(): string {
  const configured = getAppUrl();
  try {
    return new URL(configured || "https://rempahkarta.com").origin;
  } catch {
    return "https://rempahkarta.com";
  }
}

/** Selalu mengembalikan URL publik production (APP_URL_LIVE) untuk webhook URL, agar server payment publik selalu dapat menjangkau webhook. Fallback ke APP_URL_DEV / APP_URL jika APP_URL_LIVE belum diisi. */
export function getWebhookBaseUrl(): string {
  const live = process.env.APP_URL_LIVE?.trim();
  if (live) {
    try {
      return new URL(live).origin;
    } catch {
      /* ignore invalid url */
    }
  }
  const fallback = getAppUrl();
  if (fallback) {
    try {
      return new URL(fallback).origin;
    } catch {
      /* ignore invalid url */
    }
  }
  return "http://localhost:3000";
}

/** BSTN API key aktif berdasarkan APP_MODE, dengan fallback ke BSTN_PROJECT_API_KEY */
export function getBstnApiKey(): string | undefined {
  return isProduction()
    ? (process.env.BSTN_PROJECT_API_KEY_LIVE || process.env.BSTN_PROJECT_API_KEY)
    : (process.env.BSTN_PROJECT_API_KEY_DEV || process.env.BSTN_PROJECT_API_KEY);
}

/** Biteship API key aktif berdasarkan APP_MODE, dengan fallback ke BITESHIP_API_KEY */
export function getBiteshipApiKey(): string | undefined {
  return isProduction()
    ? (process.env.BITESHIP_API_KEY_LIVE || process.env.BITESHIP_API_KEY)
    : (process.env.BITESHIP_API_KEY_DEV || process.env.BITESHIP_API_KEY);
}

/** GOWA base URL aktif berdasarkan APP_MODE. */
export function getGowaBaseUrl(): string {
  return isProduction()
    ? (process.env.GOWA_BASE_URL_LIVE || "http://localhost:3000")
    : (process.env.GOWA_BASE_URL_DEV || "http://157.20.32.214:3000");
}

export function isDevToolsEnabled(): boolean {
  return !isProduction()
    && process.env.APP_MODE === "development"
    && process.env.ENABLE_DEVTOOLS === "true";
}

export function warehouseAreaId() {
  const value = process.env.WAREHOUSE_AREA_ID?.trim();
  return value && !value.startsWith("replace_") ? value : undefined;
}

/** Biaya layanan toko tetap (default: 500 IDR) */
export function getDefaultServiceFee(): number {
  const raw = process.env.NEXT_PUBLIC_SERVICE_FEE || process.env.DEFAULT_SERVICE_FEE || process.env.SERVICE_FEE;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 500;
}

/** Rate fee QRIS BSTN (default: 0.007 / 0.7%) */
export function getBstnQrisFeeRate(): number {
  const raw = process.env.BSTN_QRIS_FEE_RATE;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 && parsed < 1 ? parsed : 0.007;
}
