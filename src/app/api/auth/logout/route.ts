import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPool } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { sha256 } from "@/lib/security";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!process.env.APP_URL || !origin || new URL(origin).origin !== new URL(process.env.APP_URL).origin) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await getPool().query("DELETE FROM devora.sessions WHERE token_hash=$1",[sha256(token)]);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE,"",{...sessionCookieOptions(),maxAge:0});
  return response;
}
