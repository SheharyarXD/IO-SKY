/**
 * Which build is serving traffic (I07). The Dockerfile declares
 * GIT_COMMIT_SHA with the default "unknown", so that literal is a placeholder,
 * not a commit. Railway also injects RAILWAY_GIT_COMMIT_SHA at runtime. The
 * first real value wins; an unset or placeholder value gives null, so the
 * caller can say "unknown" honestly instead of inventing a commit.
 */
const COMMIT_VARIABLES = ["GIT_COMMIT_SHA", "RAILWAY_GIT_COMMIT_SHA", "GIT_COMMIT", "SOURCE_COMMIT"] as const;

function real(value: string | undefined): string | null {
  const v = (value ?? "").trim();
  return v === "" || v.toLowerCase() === "unknown" ? null : v;
}

export function resolveReleaseCommit(env: Record<string, string | undefined> = process.env): string | null {
  for (const name of COMMIT_VARIABLES) {
    const v = real(env[name]);
    if (v) return v;
  }
  return null;
}

export function resolveBuildTimestamp(env: Record<string, string | undefined> = process.env): string | null {
  return real(env.BUILD_TIMESTAMP);
}
