import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/auth";
import { saveLocalImage } from "@/lib/local-media";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";

export async function POST(request:Request){
  const rate=checkRateLimit(request,{scope:"admin:media-upload",limit:20});
  if(!rate.allowed)return rateLimitResponse(rate);
  if(!await adminFromRequest())return NextResponse.json({error:"Unauthorized"},{status:401});
  try{const data=await request.formData();
    const file=data.get("file");
    const rawScope=String(data.get("scope")||"products");
    const scope=rawScope==="refunds"?"refunds":rawScope==="returns"?"returns":"products";
    if(!(file instanceof File))return NextResponse.json({error:"File wajib dipilih"},{status:400});
    if(scope==="products")return NextResponse.json({path:await saveLocalImage(file,scope)},{status:201});
    const entityId=String(data.get("entityId")||"");
    if(scope!=="refunds"||!entityId)return NextResponse.json({error:"Tujuan media privat tidak valid"},{status:400});
    const target=await prisma.returnRequest.findUnique({where:{id:entityId},select:{id:true}});
    if(!target)return NextResponse.json({error:"Data retur tidak ditemukan"},{status:404});
    const fileName=await saveLocalImage(file,"refunds",target.id,5);
    return NextResponse.json({path:`/api/returns/${encodeURIComponent(target.id)}/media/${encodeURIComponent(fileName)}`},{status:201})}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Upload gagal"},{status:400})}
}
