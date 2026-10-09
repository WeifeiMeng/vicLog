export interface PostInput {
  slug: string;
  title: string;
  author: string;
  date: string;
  category: string;
  excerpt: string;
  published: boolean;
  body: string;
}

export interface EditablePost extends PostInput {
  version: string;
}

export type PostSummary = Omit<EditablePost, "body">;
