import {NextRequest,NextResponse} from "next/server";
import {getPool} from "@/lib/db";
import {requireUser,AuthError} from "@/lib/auth";

export const runtime="nodejs";
export async function DELETE(request:NextRequest,context:{params:Promise<{id:string}>}){
 try{
  const user=await requireUser();const origin=request.headers.get("origin");
  if(!process.env.APP_URL||!origin||new URL(origin).origin!==new URL(process.env.APP_URL).origin)return NextResponse.json({error:"Invalid request origin"},{status:403});
  const {id}=await context.params;
  const result=await getPool().query("UPDATE devora.api_tokens SET revoked_at=NOW() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL RETURNING id",[id,user.id]);
  if(!result.rowCount)throw new AuthError("Token not found",404);
  return NextResponse.json({ok:true});
 }catch(e){const status=e instanceof AuthError?e.status:500;return NextResponse.json({error:e instanceof Error?e.message:"Could not revoke token"},{status});}
}
