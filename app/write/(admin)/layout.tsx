import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { SESSION_COOKIE, verifySession } from "@/lib/write/auth";
import { loadWriteConfig } from "@/lib/write/config";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  let authenticated = false;
  try {
    const config = loadWriteConfig();
    const cookieStore = await cookies();
    authenticated = verifySession(
      cookieStore.get(SESSION_COOKIE)?.value,
      config.sessionSecret,
    );
  } catch {
    authenticated = false;
  }
  if (!authenticated) redirect("/write/login");
  return children;
}
