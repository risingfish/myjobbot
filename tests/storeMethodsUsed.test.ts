import { expect, test } from "vitest";
import { read, sourceFiles } from "./helpers/sourceScan.js";

const GENERIC = new Set(["record", "spend", "lookup", "left", "replace", "make", "list", "save", "run"]);

function storeInterfaces(): Array<{ name: string; methods: string[] }> {
    const files = sourceFiles("src/db").filter((path) => /^src\/db\/[^/]+\.ts$/.test(path));
    return files.flatMap((path) =>
        [...read(path).matchAll(/export interface (\w+(?:Store|Log|Views)) (?:extends [^{]+)?\{([^}]*)\}/g)].map((match) => ({
            name: match[1] ?? "",
            methods: [...(match[2] ?? "").matchAll(/^\s+(\w+)[(<]/gm)].map((method) => method[1] ?? ""),
        })),
    );
}

function containerProperties(): string[] {
    const containers = [...read("src/db/store.ts").matchAll(/export interface SharedStores \{([^}]*)\}/g), ...read("src/db/userStores.ts").matchAll(/export interface UserStores extends SharedStores \{([^}]*)\}/g)];
    return containers.flatMap((match) => [...(match[1] ?? "").matchAll(/^\s+(\w+): /gm)].map((property) => property[1] ?? ""));
}

test("every method of every store, log and views interface is called from the app outside the stores", () => {
    const code = [...sourceFiles("src"), ...sourceFiles("web")]
        .filter((path) => !path.startsWith("src/db/"))
        .map(read)
        .join("\n");
    const properties = containerProperties().join("|");
    const called = (method: string) => (GENERIC.has(method) ? new RegExp(`\\b(?:${properties}|\\w*[sS]tore|\\w*[lL]og)\\.${method}\\(`) : new RegExp(`\\.${method}\\(`)).test(code);
    const unused = storeInterfaces().flatMap(({ name, methods }) => methods.filter((method) => !called(method)).map((method) => `${name}.${method}`));
    expect(unused).toEqual([]);
});
