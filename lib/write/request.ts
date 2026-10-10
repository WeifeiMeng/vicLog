import { WriteError } from "./errors";

function requestProtocol(request: Request): string {
  return (
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase()
    ?? new URL(request.url).protocol.replace(":", "").toLowerCase()
  );
}

export function isRequestSecure(request: Request): boolean {
  return requestProtocol(request) === "https";
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) {
    throw new WriteError("FORBIDDEN", "缺少 Origin 请求头");
  }
  const requestUrl = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? requestUrl.host;
  const protocol = requestProtocol(request);
  const expected = `${protocol}://${host}`;
  if (origin !== expected) {
    throw new WriteError("FORBIDDEN", "请求来源不合法");
  }
}
