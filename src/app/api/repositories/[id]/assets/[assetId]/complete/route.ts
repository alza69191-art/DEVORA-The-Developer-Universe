import { NextRequest,NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireUser,requireRepositoryAccess,AuthError } from "@/lib/auth";
import { signR2Object,isR2Configured } from "@/lib/r2";

export const runtime="nodejs";
export async function POST(request:NextRequest,context:{params:Promise<{id:string;assetId:string}>}) {
 try{
  const origin=request.headers.get("origin");\n  if(!process.env.APP_URL||!origin||new URL(origin).origin!==new URL(process.env.APP_URL).origin)return NextResponse.json({error:"Invalid request origin"},{status:403});\n  const user=await requireUser();const {id,assetId}=await context.params;
  await requireRepositoryAccess(id,user.id,"write");
  if(!isR2Configured())return NextResponse.json({error:"Object storage is not configured"},{status:503});
  const pool=getPool();
  const found=await pool.query<{object_key:string}>("SELECT object_key FROM devora.repository_assets WHERE id=$1 AND repository_id=$2",[assetId,id]);
  if(!found.rowCount)throw new AuthError("Upload record not found",404);
  const signed=signR2Object("HEAD",found.rows[0].object_key,undefined,120);
  const head=await fetch(signed.url,{method:"HEAD",cache:"no-store",signal:AbortSignal.timeout(10000)});
  if(!head.ok)return NextResponse.json({error:"Object upload has not completed"},{status:409});
  await pool.query("UPDATE devora.repository_assets SET uploaded_at=COALESCE(uploaded_at,NOW()) WHERE id=$1",[assetId]);
  return NextResponse.json({ok:true});
 }catch(error){const status=error instanceof AuthError?error.status:500;return NextResponse.json({error:error instanceof Error?error.message:"Could not confirm upload"},{status});}
}
