import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { WriteError } from "./errors";
import type { GitClient } from "./git";
import type { PostStore } from "./posts";
import type { EditablePost, PostInput } from "./types";

export interface WriteService {
  create(input: PostInput): Promise<EditablePost>;
  update(slug: string, input: PostInput, version: string): Promise<EditablePost>;
  remove(slug: string, version: string): Promise<void>;
}

type Invalidate = (oldSlug?: string, newSlug?: string) => void | Promise<void>;

interface Snapshot {
  file: string;
  contents?: Buffer;
}

export function createWriteService(
  store: PostStore,
  git: GitClient,
  invalidate: Invalidate = () => {},
): WriteService {
  let queue: Promise<void> = Promise.resolve();

  function serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation, operation);
    queue = result.then(() => undefined, () => undefined);
    return result;
  }

  async function snapshots(files: string[]): Promise<Snapshot[]> {
    return Promise.all(
      [...new Set(files)].map(async (file) => ({
        file,
        ...(existsSync(file) ? { contents: await readFile(file) } : {}),
      })),
    );
  }

  async function restore(state: Snapshot[]): Promise<void> {
    for (const item of state) {
      if (item.contents) {
        await mkdir(path.dirname(item.file), { recursive: true });
        await writeFile(item.file, item.contents);
      } else {
        await rm(item.file, { force: true });
      }
    }
  }

  async function commitOrRollback(
    state: Snapshot[],
    paths: string[],
    message: string,
  ): Promise<void> {
    try {
      await git.commit(paths, message);
    } catch (cause) {
      let rollbackCause: unknown;
      try {
        await restore(state);
        await git.reset(paths);
      } catch (error) {
        rollbackCause = error;
      }
      if (rollbackCause) {
        throw new WriteError("GIT_ERROR", "Git 提交失败，且文章回滚失败，请立即检查目标文件", {
          cause: rollbackCause,
        });
      }
      throw cause instanceof WriteError
        ? cause
        : new WriteError("GIT_ERROR", "Git 提交失败，文章内容已恢复", { cause });
    }
  }

  return {
    create(input) {
      return serial(async () => {
        const file = store.pathFor(input.slug);
        const state = await snapshots([file]);
        const created = await store.create(input);
        await commitOrRollback(state, [file], `content: create ${input.slug}`);
        await invalidate(undefined, input.slug);
        return created;
      });
    },
    update(slug, input, version) {
      return serial(async () => {
        const oldFile = store.pathFor(slug);
        const newFile = store.pathFor(input.slug);
        const paths = [...new Set([oldFile, newFile])];
        const state = await snapshots(paths);
        const updated = await store.update(slug, input, version);
        const message =
          slug === input.slug
            ? `content: update ${slug}`
            : `content: rename ${slug} to ${input.slug}`;
        await commitOrRollback(state, paths, message);
        await invalidate(slug, input.slug);
        return updated;
      });
    },
    remove(slug, version) {
      return serial(async () => {
        const file = store.pathFor(slug);
        const state = await snapshots([file]);
        await store.remove(slug, version);
        await commitOrRollback(state, [file], `content: delete ${slug}`);
        await invalidate(slug, undefined);
      });
    },
  };
}
