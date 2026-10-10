# Vic Log Docker Deployment Design

## Goal

Build Vic Log as a `linux/amd64` image away from the 1.6 GB server, transfer the finished image over SSH, and run it on port `3001` without changing the existing services on ports 80, 8000, or 3306.

## Architecture

- A multi-stage Dockerfile installs locked dependencies and runs `next build` in a builder stage.
- Next.js standalone output is copied into a small Node 22 runtime image that also contains Git and CA certificates.
- The server checkout at `/opt/viclog` is bind-mounted at `/workspace`. Runtime configuration points `CONTENT_ROOT` at `/workspace/content` and `REPO_ROOT` at `/workspace`, so `/write` edits and Git commits survive container replacement.
- The container runs with the numeric UID and GID of the server's existing `viclog` account, matching ownership of the mounted checkout.
- Docker Compose publishes `3001:3000`, applies a 512 MB memory limit, uses one CPU, enables a health check, and restarts the container unless explicitly stopped.

## Image and Configuration Contract

- Target platform: `linux/amd64`.
- Build-time public URL: `http://123.56.122.63:3001`.
- Runtime secrets come from `/opt/viclog/.env.local`; no `.env*` file enters the Docker build context or image.
- The image tag is immutable for this deployment: `viclog:f581d8c`.
- The transferred archive is compressed before upload and removed after the server loads it.

## Deployment Flow

1. Verify the checked-out source is `origin/main` at `f581d8c` and run the test suite.
2. Build and smoke-test a `linux/amd64` image locally.
3. Save and compress the image.
4. Transfer the archive and Compose file to the server.
5. Confirm swap, Docker health, the `viclog` UID/GID, and port 3001 availability.
6. Load the image and start only the new `viclog` Compose service.
7. Verify container health, local server HTTP, and public HTTP for `/`, `/write/`, and `/rss.xml`.

## Failure and Rollback

- A failed build never changes the server.
- A failed upload or image load leaves existing Docker containers untouched.
- A failed Vic Log start is rolled back by stopping/removing only the `viclog` container; `/opt/viclog` remains intact.
- Existing services are checked before and after deployment to detect regressions.

## Verification

- Automated tests validate standalone output and the deployment contract.
- `npm test` and `npm run build` must pass locally.
- The image must report `linux/amd64` and pass a container-level HTTP health check.
- The final server must show the original three containers running plus a healthy `viclog` container on port 3001.
