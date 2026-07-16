import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/auth";
import { saveLocalImage } from "@/lib/local-media";

export async function POST(request:Request){
  if(!await adminFromRequest())return NextResponse.json({error:"Unauthorized"},{status:401});
  try{const data=await request.formData();
    const file=data.get("file");
    const rawScope=String(data.get("scope")||"products");
    const scope=rawScope==="refunds"?"refunds":rawScope==="returns"?"returns":"products";
    if(!(file instanceof File))return NextResponse.json({error:"File wajib dipilih"},{status:400});
    return NextResponse.json({path:await saveLocalImage(file,scope)},{status:201})}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Upload gagal"},{status:400})}
}
