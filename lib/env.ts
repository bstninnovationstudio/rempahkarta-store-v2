import { z } from "zod";

const schema = z.object({
  DATABASE_URL:z.string().min(1),
  BSTN_BASE_URL:z.string().url().default("https://www.bstn-innovation-studio.web.id"),
  BSTN_PROJECT_API_KEY:z.string().min(1).optional(),
  BSTN_RETURN_SIGNATURE_SECRET:z.string().min(1).optional(),
  BITESHIP_BASE_URL:z.string().url().default("https://api.biteship.com"),
  BITESHIP_API_KEY:z.string().min(1).optional(),
  BITESHIP_WEBHOOK_SHARED_SECRET:z.string().min(1).optional(),
  ENABLED_COURIERS:z.string().min(1).default("jne,sicepat,anteraja,jnt"),
  WAREHOUSE_AREA_ID:z.string().min(1).optional(),
  WAREHOUSE_POSTAL_CODE:z.string().min(5), WAREHOUSE_NAME:z.string().min(2), WAREHOUSE_CONTACT_NAME:z.string().min(2), WAREHOUSE_CONTACT_PHONE:z.string().min(8), WAREHOUSE_ADDRESS:z.string().min(10),
  AUTH_SECRET:z.string().min(32), ADMIN_EMAIL:z.string().email(), ADMIN_PASSWORD_HASH:z.string().length(64), APP_URL:z.string().url(),
  PAYMENT_MOCK:z.enum(["true","false"]).default("false"),
  PAYMENT_MOCK_AUTO_PAID:z.enum(["true","false"]).default("false"),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY:z.string().min(1).optional(),
  TURNSTILE_SECRET_KEY:z.string().min(1).optional(),
  DEMO_MODE:z.enum(["true","false"]).default("false"),
});

export type AppEnv=z.infer<typeof schema>;
export function getEnv():AppEnv { const parsed=schema.safeParse(process.env); if(!parsed.success) throw new Error(`Environment belum lengkap: ${parsed.error.issues.map(i=>i.path.join(".")).join(", ")}`); return parsed.data; }
export function isDemo(){return process.env.DEMO_MODE==="true"||!process.env.DATABASE_URL}
export function isPaymentMock(){return process.env.PAYMENT_MOCK==="true"}
export function warehouseAreaId(){const value=process.env.WAREHOUSE_AREA_ID?.trim();return value&&!value.startsWith("replace_")?value:undefined}
