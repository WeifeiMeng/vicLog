export interface SiteContent {
  name: string;
  author: string;
  tagline: string;
  avatar?: string;
  email?: string;
  github?: string;
  body: string;
}

export interface Post {
  slug: string;
  title: string;
  author: string;
  date: string;
  category?: string;
  excerpt: string;
  published: boolean;
  body: string;
}

export interface ContentCollection {
  site: SiteContent;
  posts: Post[];
}

export type SiteFrontmatter = Omit<SiteContent, "body">;
export type PostFrontmatter = Omit<Post, "slug" | "body">;
