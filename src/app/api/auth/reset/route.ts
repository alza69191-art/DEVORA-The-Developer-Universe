import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { AuthError, enforceRateLimit } from "@/lib/auth";
import { hashPassword, sha256 } from "@/lib/security";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (!process.env.APP_URL || !origin || new URL(origin).origin !== new URL(process.env.APP_URL).origin) return NextResponse.json({error:"Invalid request origin"},{status:403});
    const body = await request.json();
    const token = String(body.token ?? "");
    const password = String(body.password ?? "");
    await enforceRateLimit(`reset:${request.headers.get("x-forwarded-for") ?? "unknown"}`,5,30);
    if (password.length < 12 || password.length > 128) throw new AuthError("Password must be 12–128 characters.");
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const found = await client.query<{id:string;user_id:string}>("SELECT id,user_id FROM devora.email_tokens WHERE token_hash=$1 AND purpose='reset_password' AND consumed_at IS NULL AND expires_at>NOW() FOR UPDATE",[sha256(token)]);
      if (!found.rowCount) throw new AuthError("Reset link is invalid or expired.",400);
      const hash = await hashPassword(password);
      await client.query("UPDATE devora.users SET password_hash=$1 WHERE id=$2",[hash,found.rows[0].user_id]);
      await client.query("UPDATE devora.email_tokens SET consumed_at=NOW() WHERE user_id=$1 AND purpose='reset_password' AND consumed_at IS NULL",[found.rows[0].user_id]);
      await client.query("DELETE FROM devora.sessions WHERE user_id=$1",[found.rows[0].user_id]);
      await client.query("COMMIT");
      return NextResponse.json({ok:true});
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    return NextResponse.json({error:error instanceof Error ? error.message:"Password reset failed"},{status});
  }
}
