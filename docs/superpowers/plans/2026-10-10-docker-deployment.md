# Vic Log Docker Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reproducible `linux/amd64` Vic Log image locally, transfer it to the server, and run it safely on port 3001 with persistent `/write` content.

**Architecture:** A multi-stage Dockerfile creates Next.js standalone output and a Git-capable runtime image. Docker Compose runs the image as the server's `viclog` UID/GID while bind-mounting `/opt/viclog` as the persistent content and Git repository.

**Tech Stack:** Docker, Docker Compose v2, Node.js 22, Next.js 16 standalone output, Git, Vitest.

---

### Task 1: Define the deployment contract with failing tests

**Files:**
- Create: `deploy/docker-config.test.ts`
- Modify: `vitest.config.ts`

- [ ] Add tests that require standalone output, secret exclusions, a multi-stage runtime with Git, port 3001, the `/opt/viclog` bind mount, runtime content/repository paths, resource limits, restart policy, and health check.
- [ ] Run `npm test -- deploy/docker-config.test.ts` and verify it fails because the Docker files and standalone setting do not exist.

### Task 2: Implement the Docker build and runtime configuration

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `deploy/compose.yml`
- Modify: `next.config.ts`

- [ ] Add `output: "standalone"` to Next.js configuration.
- [ ] Add a multi-stage Node 22 Dockerfile that installs locked dependencies, builds with `NEXT_PUBLIC_SITE_URL`, and copies standalone output into a runtime containing Git.
- [ ] Exclude Git metadata, dependencies, builds, archives, and all environment files from the build context.
- [ ] Add a Compose service that runs as `${VICLOG_UID}:${VICLOG_GID}`, loads `/opt/viclog/.env.local`, mounts `/opt/viclog:/workspace`, publishes 3001, limits resources, restarts automatically, and health-checks HTTP.
- [ ] Run `npm test -- deploy/docker-config.test.ts` and verify the contract passes.

### Task 3: Verify the project and image locally

**Files:**
- No source changes.

- [ ] Run `npm test` and verify all tests pass.
- [ ] Run `npm run build` and verify standalone output is created.
- [ ] Build `viclog:f581d8c` for `linux/amd64` with `NEXT_PUBLIC_SITE_URL=http://123.56.122.63:3001`.
- [ ] Inspect the image architecture and run a temporary container with a temporary Git repository to verify `/`, `/write/`, and `/rss.xml` return successful HTTP responses.

### Task 4: Transfer and launch on the server

**Files:**
- Transfer: `deploy/compose.yml`
- Transfer: compressed Docker image archive.

- [ ] Save and compress the verified image.
- [ ] Confirm the server's original containers are healthy, swap is active, port 3001 is unused, and `/opt/viclog` is owned by `viclog`.
- [ ] Upload and load the image, write only non-secret Compose substitution values, and start the `viclog` service.
- [ ] Verify the new container is healthy and the original containers remain running.

### Task 5: Verify public behavior and hand off operations

**Files:**
- No source changes.

- [ ] Verify `http://123.56.122.63:3001/`, `/write/`, and `/rss.xml` from both the server and the client.
- [ ] Verify the deployed Git revision, container restart policy, resource limits, mounted paths, and absence of secrets in the image history.
- [ ] Report the URL, write page, image tag, service controls, verification evidence, and the recommendation to rotate the exposed root password.
