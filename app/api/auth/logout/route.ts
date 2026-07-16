import { NextResponse } from "next/server";
import { customerCookie } from "@/lib/customer-auth";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(customerCookie.name, "", { ...customerCookie.options, maxAge: 0 });
  return response;
}
