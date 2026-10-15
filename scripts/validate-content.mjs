import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSON_SCHEMA, load as loadYaml } from "js-yaml";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");

function parseArguments(argv) {
  let contentRoot = path.join(repositoryRoot, "content");

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== "--content-root" || argv[index + 1] === undefined) {
      throw new Error(`unknown or incomplete argument: ${argv[index]}`);
    }
    contentRoot = path.resolve(argv[index + 1]);
    index += 1;
  }

  return { contentRoot };
}

function displayPath(file, contentRoot) {
  return path
    .relative(path.dirname(contentRoot), file)
    .split(path.sep)
    .join("/");
}

function annotationValue(value) {
  return value
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

function reportError({ file, line = 1, column, message }) {
  const location = column === undefined ? `${file}:${line}` : `${file}:${line}:${column}`;
  console.error(`${location}: ${message}`);
  console.error(
    `::error file=${annotationValue(file)},line=${line}${
      column === undefined ? "" : `,col=${column}`
    },title=Invalid Markdown frontmatter::${annotationValue(message)}`,
  );
}

function parseFrontmatter(source, file) {
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    throw { file, line: 1, message: 'missing opening frontmatter delimiter "---"' };
  }

  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---",
  );
  if (closingIndex === -1) {
    throw { file, line: 1, message: 'missing closing frontmatter delimiter "---"' };
  }

  try {
    const parsed = loadYaml(lines.slice(1, closingIndex).join("\n"), {
      filename: file,
      schema: JSON_SCHEMA,
    });
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw { file, line: 1, message: "frontmatter must be a YAML object" };
    }
    return parsed;
  } catch (error) {
    if (error && typeof error === "object" && "file" in error) throw error;

    const mark = error && typeof error === "object" && "mark" in error ? error.mark : undefined;
    throw {
      file,
      line: typeof mark?.line === "number" ? mark.line + 2 : 1,
      column: typeof mark?.column === "number" ? mark.column + 1 : undefined,
      message:
        error && typeof error === "object" && "reason" in error
          ? `invalid YAML: ${error.reason}`
          : "invalid YAML frontmatter",
    };
  }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function validateRequiredStrings(data, fields, file, errors) {
  for (const field of fields) {
    if (!isNonEmptyString(data[field])) {
      errors.push({ file, line: 1, message: `missing or invalid "${field}" field` });
    }
  }
}

function validateSite(data, file, errors) {
  validateRequiredStrings(data, ["name", "author", "tagline"], file, errors);

  for (const field of ["avatar", "email", "github"]) {
    if (data[field] !== undefined && typeof data[field] !== "string") {
      errors.push({ file, line: 1, message: `invalid "${field}" field: expected text` });
    }
  }

  if (
    typeof data.email === "string" &&
    data.email !== "" &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
  ) {
    errors.push({
      file,
      line: 1,
      message: 'invalid "email" field: use a plain email address, not Markdown',
    });
  }

  if (typeof data.github === "string" && data.github !== "") {
    try {
      const url = new URL(data.github);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error("invalid protocol");
    } catch {
      errors.push({
        file,
        line: 1,
        message: 'invalid "github" field: use a plain http(s) URL, not Markdown',
      });
    }
  }
}

function isCalendarDate(value) {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validatePost(data, file, errors) {
  validateRequiredStrings(data, ["title", "author", "excerpt"], file, errors);
  if (!isCalendarDate(data.date)) {
    errors.push({ file, line: 1, message: 'missing or invalid "date" field (use YYYY-MM-DD)' });
  }
  if (typeof data.published !== "boolean") {
    errors.push({ file, line: 1, message: 'missing or invalid "published" field (use true or false)' });
  }
  if (data.category !== undefined && typeof data.category !== "string") {
    errors.push({ file, line: 1, message: 'invalid "category" field: expected text' });
  }
}

async function main() {
  const { contentRoot } = parseArguments(process.argv.slice(2));
  const siteFile = path.join(contentRoot, "site.md");
  const postsDirectory = path.join(contentRoot, "posts");
  const postFiles = (await readdir(postsDirectory))
    .filter((filename) => filename.endsWith(".md"))
    .sort()
    .map((filename) => path.join(postsDirectory, filename));
  const files = [siteFile, ...postFiles];
  const errors = [];

  for (const absoluteFile of files) {
    const file = displayPath(absoluteFile, contentRoot);
    try {
      const source = await readFile(absoluteFile, "utf8");
      const data = parseFrontmatter(source, file);
      if (absoluteFile === siteFile) {
        validateSite(data, file, errors);
      } else {
        const slug = path.basename(absoluteFile, ".md");
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
          errors.push({
            file,
            line: 1,
            message: `invalid post filename "${slug}.md" (use lowercase kebab-case)`,
          });
        }
        validatePost(data, file, errors);
      }
    } catch (error) {
      errors.push(
        error && typeof error === "object" && "message" in error
          ? error
          : { file, line: 1, message: "unable to validate file" },
      );
    }
  }

  if (errors.length > 0) {
    for (const error of errors) reportError(error);
    console.error(`Content validation failed with ${errors.length} error(s).`);
    process.exitCode = 1;
    return;
  }

  console.log(`Content validation passed: checked ${files.length} Markdown file(s).`);
}

main().catch((error) => {
  console.error(`Content validation could not run: ${error.message}`);
  process.exitCode = 1;
});
