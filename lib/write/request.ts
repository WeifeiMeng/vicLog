import { WriteError } from "./errors";

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) {
    throw new WriteError("FORBIDDEN", "缺少 Origin 请求头");
  }
  const requestUrl = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? requestUrl.host;
  const protocol = request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");
  const expected = `${protocol}://${host}`;
  if (origin !== expected) {
    throw new WriteError("FORBIDDEN", "请求来源不合法");
  }
}
