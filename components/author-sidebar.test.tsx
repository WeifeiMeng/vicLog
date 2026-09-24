import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { AuthorSidebar } from "./author-sidebar";

describe("AuthorSidebar", () => {
  test("renders the Vic Log identity, avatar fallback, and primary links", () => {
    const markup = renderToStaticMarkup(
      <AuthorSidebar
        site={{
          name: "Vic Log",
          author: "Meng Weifei",
          tagline: "",
          avatar: "/avatar.jpg",
          body: "",
        }}
      />,
    );

    expect(markup).toContain("VIC LOG");
    expect(markup).toContain("Meng Weifei");
    expect(markup).toContain(">MW<");
    expect(markup).toContain('href="/"');
    expect(markup).toContain('href="/about/"');
    expect(markup).toContain('href="/archive/"');
    expect(markup).toContain('href="/rss.xml"');
  });
});
