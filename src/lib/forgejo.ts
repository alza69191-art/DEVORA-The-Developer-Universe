/**
 * Server-side Forgejo adapter.
 * Keep FORGEJO_API_TOKEN in server environment variables only.
 * Git clone/push/pull use Forgejo's native HTTPS/SSH endpoints directly;
 * this adapter provisions repositories and reads Git metadata through REST.
 */
export type ForgejoRepository = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  default_branch: string;
  private: boolean;
};

export type ForgejoBranch = {
  name: string;
  commit: { id: string; url: string };
  protected: boolean;
};

type ForgejoConfig = { baseUrl: string; token: string };

function config(): ForgejoConfig {
  const baseUrl = process.env.FORGEJO_BASE_URL?.replace(/\/+$/, "");
  const token = process.env.FORGEJO_API_TOKEN;
  if (!baseUrl || !token) throw new Error("Forgejo is not configured");
  const parsed = new URL(baseUrl);
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("FORGEJO_BASE_URL must use HTTPS in production");
  }
  return { baseUrl, token };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { baseUrl, token } = config();
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
    headers: {
      Accept: "application/json",
      Authorization: `token ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers
    }
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Forgejo API ${response.status}: ${detail}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function isForgejoConfigured(): boolean {
  return Boolean(process.env.FORGEJO_BASE_URL && process.env.FORGEJO_API_TOKEN);
}

export async function forgejoHealth(): Promise<{ configured: boolean; reachable: boolean; version?: string }> {
  if (!isForgejoConfigured()) return { configured: false, reachable: false };
  const { baseUrl } = config();
  const response = await fetch(`${baseUrl}/api/v1/version`, {
    cache: "no-store",
    signal: AbortSignal.timeout(5_000)
  });
  if (!response.ok) return { configured: true, reachable: false };
  const data = await response.json() as { version?: string };
  return { configured: true, reachable: true, version: data.version };
}

export async function createForgejoRepository(input: {
  name: string;
  description?: string;
  isPrivate?: boolean;
  autoInit?: boolean;
}): Promise<ForgejoRepository> {
  if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(input.name)) {
    throw new Error("Repository name contains unsupported characters");
  }
  return request<ForgejoRepository>("/user/repos", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      description: input.description ?? "",
      private: input.isPrivate ?? true,
      auto_init: input.autoInit ?? true,
      default_branch: "main",
      trust_model: "collaborator"
    })
  });
}

export async function getForgejoRepository(owner: string, repo: string): Promise<ForgejoRepository> {
  return request<ForgejoRepository>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
}

export async function listForgejoBranches(owner: string, repo: string): Promise<ForgejoBranch[]> {
  return request<ForgejoBranch[]>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?limit=100`
  );
}

export async function getForgejoGitTree(owner: string, repo: string, sha = "HEAD") {
  return request<{ sha: string; truncated: boolean; tree: Array<{
    path: string; mode: string; type: "blob" | "tree" | "commit"; sha: string; size?: number; url: string
  }> }>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(sha)}?recursive=true`
  );
}

export async function getForgejoFile(owner: string, repo: string, path: string, ref = "main") {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return request<{ name: string; path: string; sha: string; size: number; type: string; content?: string; encoding?: string }>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`
  );
}

export async function listForgejoCommits(owner: string, repo: string, branch = "main") {
  return request<Array<{ sha: string; commit: { message: string; author: { name: string; date: string } } }>>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?sha=${encodeURIComponent(branch)}&limit=30`
  );
}

export async function deleteForgejoRepository(owner: string, repo: string): Promise<void> {
  await request<void>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { method: "DELETE" });
}

export async function updateForgejoRepository(owner: string, repo: string, input: { private?: boolean; description?: string }) {
  return request<ForgejoRepository>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}
