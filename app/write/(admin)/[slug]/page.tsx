import { notFound } from "next/navigation";

import { AdminShell } from "@/components/write/admin-shell";
import { PostEditor } from "@/components/write/post-editor";
import { WriteError } from "@/lib/write/errors";
import { getWriteRuntime } from "@/lib/write/server";

export default async function EditPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const runtime = getWriteRuntime();
  try {
    const [posts, post] = await Promise.all([runtime.store.list(), runtime.store.read(slug)]);
    return (
      <AdminShell posts={posts}>
        <PostEditor initial={post} />
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof WriteError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}
