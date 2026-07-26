import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { prisma } from "@/lib/db";

export type CourierOption = {
  code: string;
  name: string;
  description: string;
  enabled: boolean;
};

// Strictly JNE, AnterAja, and POS as requested
export const ALL_COURIER_OPTIONS: Omit<CourierOption, "enabled">[] = [
  { code: "jne", name: "JNE Express", description: "Jalur Nugraha Ekakurir (Reguler, YES, OKE)" },
  { code: "anteraja", name: "AnterAja", description: "AnterAja Express (Regular, Next Day)" },
  { code: "pos", name: "Pos Indonesia", description: "Pos Indonesia (Pos Reguler, Pos Nextday)" },
];

export const warehouseSchema = z.object({
  name: z.string().min(2, "Nama gudang minimal 2 karakter"),
  contactName: z.string().min(2, "Nama kontak minimal 2 karakter"),
  contactPhone: z.string().min(8, "Nomor telepon minimal 8 karakter"),
  address: z.string().min(10, "Alamat gudang minimal 10 karakter"),
  postalCode: z.string().min(5, "Kode pos minimal 5 digit"),
  areaId: z.string().min(1, "Area ID Biteship wajib dipilih"),
});

export type WarehousePayload = z.infer<typeof warehouseSchema>;

async function writeEnvUpdates(updates: Record<string, string>) {
  const envPath = path.join(process.cwd(), ".env");
  let content = "";
  try {
    content = await fs.readFile(envPath, "utf-8");
  } catch {
    content = "";
  }

  let lines = content.split(/\r?\n/);
  for (const [key, value] of Object.entries(updates)) {
    process.env[key] = value;

    const reg = new RegExp(`^#?\\s*${key}=.*$`);
    let found = false;
    lines = lines.map((line) => {
      if (reg.test(line)) {
        found = true;
        return `${key}=${value}`;
      }
      return line;
    });

    if (!found) {
      lines.push(`${key}=${value}`);
    }
  }

  await fs.writeFile(envPath, lines.join("\n"), "utf-8");
}

export async function getShippingConfig(): Promise<{
  enabledCouriers: string[];
  couriers: CourierOption[];
  warehouse: WarehousePayload;
}> {
  const rawCouriers = process.env.ENABLED_COURIERS || "jne,anteraja,pos";
  const enabledList = rawCouriers
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

  const couriers: CourierOption[] = ALL_COURIER_OPTIONS.map((opt) => ({
    ...opt,
    enabled: enabledList.includes(opt.code),
  }));

  const dbWh = await prisma.warehouse.findFirst({
    where: { isDefault: true },
  });

  const warehouse = {
    name: dbWh?.name || process.env.WAREHOUSE_NAME || "Gudang Utama REMPAHKARTA",
    contactName: dbWh?.contactName || process.env.WAREHOUSE_CONTACT_NAME || "REMPAHKARTA",
    contactPhone: dbWh?.contactPhone || process.env.WAREHOUSE_CONTACT_PHONE || "08562524627",
    address: dbWh?.address || process.env.WAREHOUSE_ADDRESS || "Sentolo Lor, RT 18/RW 09, Sentolo, Kulon Progo, DIY",
    postalCode: dbWh?.postalCode || process.env.WAREHOUSE_POSTAL_CODE || "55664",
    areaId: dbWh?.areaId || process.env.WAREHOUSE_AREA_ID || "IDNP5IDNC206IDND1764IDZ55664",
  };

  return {
    enabledCouriers: enabledList,
    couriers,
    warehouse,
  };
}

export async function toggleCourierConfig(code: string, enabled: boolean) {
  const validCodes = ALL_COURIER_OPTIONS.map((c) => c.code);
  if (!validCodes.includes(code.toLowerCase())) {
    throw new Error(`Jasa kirim ${code} tidak didukung`);
  }

  const currentConfig = await getShippingConfig();
  let currentEnabled = new Set(currentConfig.enabledCouriers.map((c) => c.toLowerCase()));

  if (enabled) {
    currentEnabled.add(code.toLowerCase());
  } else {
    currentEnabled.delete(code.toLowerCase());
  }

  // Ensure at least 1 courier remains enabled
  if (currentEnabled.size === 0) {
    throw new Error("Minimal satu jasa kirim harus diaktifkan");
  }

  const enabledCouriersStr = Array.from(currentEnabled).join(",");
  await writeEnvUpdates({ ENABLED_COURIERS: enabledCouriersStr });

  return getShippingConfig();
}

export async function updateWarehouseConfig(payload: WarehousePayload) {
  const parsed = warehouseSchema.parse(payload);

  const updates: Record<string, string> = {
    WAREHOUSE_NAME: parsed.name,
    WAREHOUSE_CONTACT_NAME: parsed.contactName,
    WAREHOUSE_CONTACT_PHONE: parsed.contactPhone,
    WAREHOUSE_ADDRESS: parsed.address,
    WAREHOUSE_POSTAL_CODE: parsed.postalCode,
    WAREHOUSE_AREA_ID: parsed.areaId,
  };

  // Update ENV
  await writeEnvUpdates(updates);

  // Sync Prisma Warehouse
  await prisma.warehouse.upsert({
    where: { id: "wh_main" },
    update: {
      name: parsed.name,
      contactName: parsed.contactName,
      contactPhone: parsed.contactPhone,
      address: parsed.address,
      postalCode: parsed.postalCode,
      areaId: parsed.areaId,
      isDefault: true,
    },
    create: {
      id: "wh_main",
      name: parsed.name,
      contactName: parsed.contactName,
      contactPhone: parsed.contactPhone,
      address: parsed.address,
      postalCode: parsed.postalCode,
      areaId: parsed.areaId,
      isDefault: true,
    },
  });

  return getShippingConfig();
}
