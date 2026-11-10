import {NextRequest,NextResponse} from "next/server";
import {getPool} from "@/lib/db";
import {requireUser,requireRepositoryAccess,AuthError} from "@/lib/auth";
import {signR2Object,isR2Configured} from "@/lib/r2";

export const runtime="nodejs";
export async function POST(request:NextRequest,context:{params:Promise<{id:string;assetId:string}>}){
 try{
  const origin=request.headers.get("origin");
  if(!process.env.APP_URL||!origin||new URL(origin).origin!==new URL(process.env.APP_URL).origin)return NextResponse.json({error:"Invalid request origin"},{status:403});
  const user=await requireUser();const {id,assetId}=await context.params;
  await requireRepositoryAccess(id,user.id,"write");
  if(!isR2Configured())return NextResponse.json({error:"Object storage is not configured"},{status:503});
  const pool=getPool();
  const found=await pool.query<{object_key:string;size_bytes:string;content_type:string}>("SELECT object_key,size_bytes,content_type FROM devora.repository_assets WHERE id=$1 AND repository_id=$2",[assetId,id]);
  if(!found.rowCount)throw new AuthError("Upload record not found",404);
  const asset=found.rows[0];
  const signed=signR2Object("HEAD",asset.object_key,undefined,120);
  const head=await fetch(signed.url,{method:"HEAD",cache:"no-store",signal:AbortSignal.timeout(10000)});
  if(!head.ok)return NextResponse.json({error:"Object upload has not completed"},{status:409});
  const actualSize=Number(head.headers.get("content-length")??-1);
  const actualType=head.headers.get("content-type")??"";
  if(actualSize!==Number(asset.size_bytes)||actualSize>25*1024*1024||(actualType&&actualType!==asset.content_type)){
   const remove=signR2Object("DELETE",asset.object_key,undefined,120);
   await fetch(remove.url,{method:"DELETE",cache:"no-store"});
   await pool.query("DELETE FROM devora.repository_assets WHERE id=$1",[assetId]);
   return NextResponse.json({error:"Uploaded object does not match the declared size or type. It was rejected."},{status:413});
  }
  await pool.query("UPDATE devora.repository_assets SET uploaded_at=COALESCE(uploaded_at,NOW()) WHERE id=$1",[assetId]);
  return NextResponse.json({ok:true});
 }catch(error){const status=error instanceof AuthError?error.status:500;return NextResponse.json({error:error instanceof Error?error.message:"Could not confirm upload"},{status});}
}
