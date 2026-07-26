import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/auth";
import { updateWarehouseConfig } from "@/lib/admin-shipping-config";

export async function PUT(request: Request) {
  const admin = await adminFromRequest();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload JSON tidak valid" }, { status: 400 });
  }

  try {
    const updated = await updateWarehouseConfig(body as Parameters<typeof updateWarehouseConfig>[0]);
    return NextResponse.json({ success: true, config: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menyimpan informasi gudang";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
