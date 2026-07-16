import { NextResponse } from "next/server";
import { BiteshipAdapter } from "@/lib/adapters/biteship";
import { adminFromRequest } from "@/lib/auth";

export async function GET(){
  if(!await adminFromRequest())return NextResponse.json({error:"Unauthorized"},{status:401});
  const adapter=new BiteshipAdapter(process.env.BITESHIP_BASE_URL||"https://api.biteship.com",process.env.BITESHIP_API_KEY!);
  return NextResponse.json(await adapter.cancellationReasons(),{headers:{"Cache-Control":"private, max-age=3600"}});
}
