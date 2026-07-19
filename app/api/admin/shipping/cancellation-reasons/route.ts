import { NextResponse } from "next/server";
import { BiteshipAdapter } from "@/lib/adapters/biteship";
import { adminFromRequest } from "@/lib/auth";
import { getBiteshipApiKey } from "@/lib/env";

export async function GET(){
  if(!await adminFromRequest())return NextResponse.json({error:"Unauthorized"},{status:401});
  const apiKey = getBiteshipApiKey();
  if(!apiKey) return NextResponse.json({error:"BITESHIP_API_KEY belum dikonfigurasi"},{status:503});
  const adapter=new BiteshipAdapter(process.env.BITESHIP_BASE_URL||"https://api.biteship.com",apiKey);
  return NextResponse.json(await adapter.cancellationReasons(),{headers:{"Cache-Control":"private, max-age=3600"}});
}
