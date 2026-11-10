import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { sha256 } from "@/lib/security";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!token || token.length > 200) return NextResponse.redirect(new URL("/login?verified=invalid",request.url));
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query<{id:string;user_id:string}>(
      "SELECT id,user_id FROM devora.email_tokens WHERE token_hash=$1 AND purpose='verify_email' AND consumed_at IS NULL AND expires_at>NOW() FOR UPDATE",
      [sha256(token)]
    );
    if (!found.rowCount) { await client.query("ROLLBACK"); return NextResponse.redirect(new URL("/login?verified=invalid",request.url)); }
    await client.query("UPDATE devora.users SET email_verified_at=COALESCE(email_verified_at,NOW()) WHERE id=$1",[found.rows[0].user_id]);
    await client.query("UPDATE devora.email_tokens SET consumed_at=NOW() WHERE id=$1",[found.rows[0].id]);
    await client.query("DELETE FROM devora.sessions WHERE user_id=$1",[found.rows[0].user_id]);
    await client.query("COMMIT");
    return NextResponse.redirect(new URL("/login?verified=success",request.url));
  } catch { await client.query("ROLLBACK"); return NextResponse.redirect(new URL("/login?verified=error",request.url)); }
  finally { client.release(); }
}
