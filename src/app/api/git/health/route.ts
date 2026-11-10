import { NextResponse } from "next/server";
import { forgejoHealth } from "@/lib/forgejo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const git = await forgejoHealth();
    return NextResponse.json(
      { service: "devora-git", ...git },
      { status: git.reachable ? 200 : git.configured ? 503 : 200 }
    );
  } catch {
    return NextResponse.json(
      { service: "devora-git", configured: true, reachable: false },
      { status: 503 }
    );
  }
}
