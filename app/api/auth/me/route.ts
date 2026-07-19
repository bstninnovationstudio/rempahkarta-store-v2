import { NextResponse } from "next/server";
import { customerFromRequest } from "@/lib/customer-auth";
import { getProfileCompleteness } from "@/lib/user-profile";

export async function GET() {
  const customer = await customerFromRequest();
  if (!customer) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  const completion = await getProfileCompleteness(customer.id);
  return NextResponse.json({
    authenticated: true,
    user: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      avatarUrl: customer.avatarUrl,
      phone: customer.phone,
    },
    completion,
  });
}
