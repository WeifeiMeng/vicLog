import { AdminShell } from "@/components/write/admin-shell";
import { PostEditor } from "@/components/write/post-editor";
import { getWriteRuntime } from "@/lib/write/server";

export default async function NewPostPage() {
  const posts = await getWriteRuntime().store.list();
  const today = new Date().toISOString().slice(0, 10);
  return (
    <AdminShell posts={posts}>
      <PostEditor
        initial={{
          slug: "",
          title: "",
          date: today,
          category: "",
          excerpt: "",
          published: false,
          body: "",
        }}
      />
    </AdminShell>
  );
}
