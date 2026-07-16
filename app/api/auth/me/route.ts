import { NextResponse } from "next/server";
import { customerFromRequest } from "@/lib/customer-auth";

export async function GET() {
  const customer = await customerFromRequest();
  if (!customer) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      avatarUrl: customer.avatarUrl,
    }
  });
}
