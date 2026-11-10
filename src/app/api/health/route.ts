import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, string> = { app: "ok", database: "not_configured" };
  try {
    const pool = getPool();
    await pool.query("SELECT 1");
    checks.database = "ok";
    return NextResponse.json({ status: "ok", service: "devora", checks }, { status: 200 });
  } catch (error) {
    checks.database = process.env.DATABASE_URL ? "error" : "not_configured";
    return NextResponse.json({ status: "degraded", service: "devora", checks }, { status: 503 });
  }
}
