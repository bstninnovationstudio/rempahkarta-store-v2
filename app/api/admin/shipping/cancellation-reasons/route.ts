import { NextResponse } from "next/server";
import { BiteshipAdapter } from "@/lib/adapters/biteship";
import { adminFromRequest } from "@/lib/auth";
import { getBiteshipApiKey } from "@/lib/env";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(request: Request){
  const rate=checkRateLimit(request,{scope:"admin:shipping-cancellation-reasons",limit:30});
  if(!rate.allowed)return rateLimitResponse(rate);
  if(!await adminFromRequest())return NextResponse.json({error:"Unauthorized"},{status:401});
  const apiKey = getBiteshipApiKey();
  if(!apiKey) return NextResponse.json({error:"BITESHIP_API_KEY belum dikonfigurasi"},{status:503});
  const adapter=new BiteshipAdapter(process.env.BITESHIP_BASE_URL||"https://api.biteship.com",apiKey);
  return NextResponse.json(await adapter.cancellationReasons(),{headers:{"Cache-Control":"private, max-age=3600"}});
}
