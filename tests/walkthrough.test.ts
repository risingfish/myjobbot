import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const CLIENT = "web";
const walkthrough = readFileSync("docs/react-walkthrough.md", "utf8");
const PLATFORM = new Set(["IntersectionObserver", "Link", "notFound", "redirect", "useCallback", "useEffect", "usePathname", "useRef", "useState"]);

function sourceFiles(): string[] {
  const entries = readdirSync(CLIENT).filter((entry) => !entry.startsWith(".next")).map((entry) => join(CLIENT, entry));
  const files = entries.flatMap((path) => (statSync(path).isDirectory() ? readdirSync(path, { recursive: true }).map((file) => join(path, String(file))) : [path]));
  return files.filter((file) => /\.tsx?$/.test(file));
}

function definedFunctions(): Set<string> {
  const sources = sourceFiles().map((file) => readFileSync(file, "utf8"));
  return new Set(sources.flatMap((source) => [...source.matchAll(/function (\w+)/g)].map((match) => match[1] ?? "")));
}

test("every source file the walkthrough names exists, apart from new files an exercise creates", () => {
  const named = [...walkthrough.matchAll(/(a new )?`((?:src|tests|web)\/[\w/.-]+\.(?:tsx?|css|html))`/g)];
  const paths = named.filter((match) => match[1] === undefined).map((match) => match[2] ?? "");
  expect(paths.length).toBeGreaterThan(15);
  expect(paths.filter((path) => !existsSync(path))).toEqual([]);
});

test("every component and hook a Where line names is defined in the client code", () => {
  const whereLines = [...walkthrough.matchAll(/\*\*Where:\*\*([\s\S]*?)(?:\n\n|$)/g)].map((match) => match[1] ?? "");
  const named = whereLines.flatMap((line) => [...line.matchAll(/`([A-Z]\w*|use[A-Z]\w*)`/g)].map((match) => match[1] ?? ""));
  expect(named.length).toBeGreaterThan(15);
  const defined = definedFunctions();
  expect(named.filter((name) => !defined.has(name) && !PLATFORM.has(name))).toEqual([]);
});

test("the walkthrough ends with at least three exercises", () => {
  expect([...walkthrough.matchAll(/^### Exercise \d+/gm)].length).toBeGreaterThanOrEqual(3);
});
