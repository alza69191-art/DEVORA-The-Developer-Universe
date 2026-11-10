import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireUser, requireRepositoryAccess, AuthError } from "@/lib/auth";
import { getForgejoRepository, getForgejoGitTree, listForgejoBranches } from "@/lib/forgejo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: {params: Promise<{id:string}>}) {
  try {
    const user = await requireUser();
    const {id} = await context.params;
    await requireRepositoryAccess(id,user.id,"read");
    const result = await getPool().query(
      `SELECT r.id,r.name,r.slug,r.description,r.visibility,r.default_branch,r.forgejo_owner,r.forgejo_name,r.clone_url,r.ssh_url,r.forgejo_html_url,r.created_at,u.username
       FROM devora.repositories r JOIN devora.users u ON u.id=r.owner_id WHERE r.id=$1`,[id]
    );
    if (!result.rowCount) throw new AuthError("Repository not found",404);
    const repo=result.rows[0] as {forgejo_owner:string;forgejo_name:string};
    const [remote,branches,tree] = await Promise.all([
      getForgejoRepository(repo.forgejo_owner,repo.forgejo_name),
      listForgejoBranches(repo.forgejo_owner,repo.forgejo_name),
      getForgejoGitTree(repo.forgejo_owner,repo.forgejo_name)
    ]);
    return NextResponse.json({repository:result.rows[0],git:{defaultBranch:remote.default_branch,branches,tree:tree.tree}});
  } catch(error) {
    const status=error instanceof AuthError?error.status:500;
    return NextResponse.json({error:error instanceof Error?error.message:"Could not load repository"},{status});
  }
}
