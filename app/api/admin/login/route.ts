import { NextResponse } from "next/server";
import { z } from "zod";
import { adminCookie, createAdminToken, verifyAdminPassword } from "@/lib/auth";
const schema=z.object({email:z.string().email(),password:z.string().min(8)});
export async function POST(request:Request){try{const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"Payload tidak valid"},{status:400});if(!await verifyAdminPassword(parsed.data.email,parsed.data.password))return NextResponse.json({error:"Email atau password salah"},{status:401});const response=NextResponse.json({success:true});response.cookies.set(adminCookie.name,await createAdminToken(parsed.data.email),adminCookie.options);return response}catch{return NextResponse.json({error:"Permintaan login tidak valid"},{status:400})}}
