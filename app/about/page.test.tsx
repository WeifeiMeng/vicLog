import { expect, test } from "vitest";

import * as aboutPage from "./page";

test("renders from the mounted content directory on every request", () => {
  expect(Reflect.get(aboutPage, "dynamic")).toBe("force-dynamic");
});
