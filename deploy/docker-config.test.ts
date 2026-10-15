import { readFile } from "node:fs/promises";

import { describe, expect, test } from "vitest";

import nextConfig from "../next.config";

async function readDeploymentFile(path: string): Promise<string> {
  try {
    return await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  } catch {
    return "";
  }
}

describe("Docker deployment contract", () => {
  test("builds Next.js standalone output", () => {
    expect(nextConfig.output).toBe("standalone");
  });

  test("keeps secrets and local artifacts out of the image context", async () => {
    const dockerignore = await readDeploymentFile(".dockerignore");

    expect(dockerignore).toMatch(/^\.env\*$/m);
    expect(dockerignore).toMatch(/^\.git$/m);
    expect(dockerignore).toMatch(/^node_modules$/m);
    expect(dockerignore).toMatch(/^\.next$/m);
  });

  test("uses a locked multi-stage Node runtime with Git", async () => {
    const dockerfile = await readDeploymentFile("Dockerfile");

    expect(dockerfile).toMatch(/FROM node:22\.23\.3-bookworm-slim AS deps/);
    expect(dockerfile).toMatch(/npm ci --no-audit --no-fund/);
    expect(dockerfile).toMatch(/FROM node:22\.23\.3-bookworm-slim AS runner/);
    expect(dockerfile).toMatch(/apt-get install[^\n]*git[^\n]*ca-certificates/);
    expect(dockerfile).toMatch(/COPY --from=builder \/app\/\.next\/standalone/);
    expect(dockerfile).toMatch(/CMD \["node", "server\.js"\]/);
  });

  test("runs persistently on port 3001 with bounded resources", async () => {
    const compose = await readDeploymentFile("deploy/compose.yml");

    expect(compose).toContain('image: "viclog:about-dynamic-5f40d33"');
    expect(compose).toContain('user: "${VICLOG_UID}:${VICLOG_GID}"');
    expect(compose).toContain('env_file:');
    expect(compose).toContain('/opt/viclog/.env.local');
    expect(compose).toContain('CONTENT_ROOT: "/workspace/content"');
    expect(compose).toContain('REPO_ROOT: "/workspace"');
    expect(compose).toContain('"3001:3000"');
    expect(compose).toContain('"/opt/viclog:/workspace"');
    expect(compose).toContain('restart: unless-stopped');
    expect(compose).toContain('mem_limit: 512m');
    expect(compose).toContain('cpus: 1.0');
    expect(compose).toContain('healthcheck:');
  });
});
