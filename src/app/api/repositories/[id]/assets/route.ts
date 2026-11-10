import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireUser, requireRepositoryAccess, AuthError } from "@/lib/auth";
import { signR2Object, isR2Configured } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: {params:Promise<{id:string}>}) {
  try {
    const user=await requireUser();
    const {id}=await context.params;
    await requireRepositoryAccess(id,user.id,"read");
    if (!isR2Configured()) return NextResponse.json({error:"Object storage is not configured"},{status:503});
    const result=await getPool().query("SELECT id,file_name,content_type,size_bytes,object_key,created_at FROM devora.repository_assets WHERE repository_id=$1 AND uploaded_at IS NOT NULL ORDER BY created_at DESC LIMIT 100",[id]);
    return NextResponse.json({assets:result.rows.map((asset:{object_key:string;[key:string]:unknown})=>({...asset,download:signR2Object("GET",asset.object_key).url}))});
  } catch(error) {
    const status=error instanceof AuthError?error.status:500;
    return NextResponse.json({error:error instanceof Error?error.message:"Could not list files"},{status});
  }
}

export async function POST(request:NextRequest,context:{params:Promise<{id:string}>}) {
  try {
    const user=await requireUser();
    const {id}=await context.params;
    await requireRepositoryAccess(id,user.id,"write");
    if (!isR2Configured()) return NextResponse.json({error:"Object storage is not configured"},{status:503});
    const body=await request.json();
    const fileName=String(body.fileName??"").slice(0,255);
    const contentType=String(body.contentType??"application/octet-stream");
    const size=Number(body.size);
    const allowed=new Set(["image/png","image/jpeg","image/webp","application/pdf","text/plain","application/zip","application/octet-stream"]);
    if (!fileName || !allowed.has(contentType) || !Number.isSafeInteger(size) || size<1 || size>25*1024*1024) throw new AuthError("Invalid file. Allowed maximum size is 25 MB.");
    const objectKey=`repos/${id}/${crypto.randomUUID()}/${fileName.replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,120)}`;
    const signed=signR2Object("PUT",objectKey,contentType,300);
    const saved=await getPool().query(
      "INSERT INTO devora.repository_assets(repository_id,uploader_id,object_key,file_name,content_type,size_bytes) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
      [id,user.id,objectKey,fileName,contentType,size]
    );
    return NextResponse.json({assetId:saved.rows[0].id,uploadUrl:signed.url,method:"PUT",headers:signed.headers,expiresIn:300},{status:201});
  } catch(error) {
    const status=error instanceof AuthError?error.status:500;
    return NextResponse.json({error:error instanceof Error?error.message:"Could not prepare upload"},{status});
  }
}
