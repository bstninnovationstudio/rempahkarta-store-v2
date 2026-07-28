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
  name: z.string().trim().min(2, "Nama gudang minimal 2 karakter").max(160).refine(value => !/[\u0000-\u001f\u007f]/.test(value), "Nama gudang mengandung karakter tidak valid"),
  contactName: z.string().trim().min(2, "Nama kontak minimal 2 karakter").max(160).refine(value => !/[\u0000-\u001f\u007f]/.test(value), "Nama kontak mengandung karakter tidak valid"),
  contactPhone: z.string().trim().min(8, "Nomor telepon minimal 8 karakter").max(20).regex(/^[0-9+() -]+$/, "Format nomor telepon tidak valid"),
  address: z.string().trim().min(10, "Alamat gudang minimal 10 karakter").max(1000).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value), "Alamat mengandung karakter tidak valid"),
  postalCode: z.string().regex(/^\d{5}$/, "Kode pos harus 5 digit"),
  areaId: z.string().trim().min(1, "Area ID Biteship wajib dipilih").max(120).regex(/^[a-zA-Z0-9_-]+$/, "Area ID Biteship tidak valid"),
});

export type WarehousePayload = z.infer<typeof warehouseSchema>;

let envWriteQueue: Promise<void> = Promise.resolve();
let configMutationQueue: Promise<void> = Promise.resolve();

function encodedEnvValue(value: string) {
  return JSON.stringify(value);
}

async function writeEnvUpdatesNow(updates: Record<string, string>) {
  const envPath = path.join(process.cwd(), ".env");
  let content = "";
  try {
    content = await fs.readFile(envPath, "utf-8");
  } catch {
    content = "";
  }

  let lines = content.split(/\r?\n/);
  for (const [key, value] of Object.entries(updates)) {
    const reg = new RegExp(`^#?\\s*${key}=.*$`);
    let found = false;
    lines = lines.map((line) => {
      if (reg.test(line)) {
        found = true;
        return `${key}=${encodedEnvValue(value)}`;
      }
      return line;
    });

    if (!found) {
      lines.push(`${key}=${encodedEnvValue(value)}`);
    }
  }

  const tempPath = `${envPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(tempPath, lines.join("\n"), { encoding: "utf-8", mode: 0o600, flag: "wx" });
    await fs.rename(tempPath, envPath);
    for (const [key, value] of Object.entries(updates)) process.env[key] = value;
  } catch (error) {
    await fs.unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

async function writeEnvUpdates(updates: Record<string, string>) {
  const task = envWriteQueue.then(() => writeEnvUpdatesNow(updates));
  envWriteQueue = task.catch(() => undefined);
  return task;
}

async function serializeConfigMutation<T>(operation: () => Promise<T>) {
  const task = configMutationQueue.then(operation);
  configMutationQueue = task.then(() => undefined, () => undefined);
  return task;
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
  return serializeConfigMutation(async () => {
    const validCodes = ALL_COURIER_OPTIONS.map((c) => c.code);
    if (!validCodes.includes(code.toLowerCase())) {
      throw new Error(`Jasa kirim ${code} tidak didukung`);
    }

    const currentConfig = await getShippingConfig();
    const currentEnabled = new Set(currentConfig.enabledCouriers.map((c) => c.toLowerCase()));

    if (enabled) {
      currentEnabled.add(code.toLowerCase());
    } else {
      currentEnabled.delete(code.toLowerCase());
    }

    if (currentEnabled.size === 0) {
      throw new Error("Minimal satu jasa kirim harus diaktifkan");
    }

    const enabledCouriersStr = Array.from(currentEnabled).join(",");
    await writeEnvUpdates({ ENABLED_COURIERS: enabledCouriersStr });
    return getShippingConfig();
  });
}

export async function updateWarehouseConfig(payload: WarehousePayload) {
  return serializeConfigMutation(async () => {
    const parsed = warehouseSchema.parse(payload);

  const updates: Record<string, string> = {
    WAREHOUSE_NAME: parsed.name,
    WAREHOUSE_CONTACT_NAME: parsed.contactName,
    WAREHOUSE_CONTACT_PHONE: parsed.contactPhone,
    WAREHOUSE_ADDRESS: parsed.address,
    WAREHOUSE_POSTAL_CODE: parsed.postalCode,
    WAREHOUSE_AREA_ID: parsed.areaId,
  };

  const previousUpdates = Object.fromEntries(
    Object.keys(updates).map(key => [key, process.env[key] || ""]),
  );
  await writeEnvUpdates(updates);

  try {
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
  } catch (error) {
    await writeEnvUpdates(previousUpdates).catch(() => undefined);
    throw error;
  }

    return getShippingConfig();
  });
}
