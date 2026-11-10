import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return entry.name.startsWith(".next") || entry.name === "node_modules" ? [] : sourceFiles(path);
        return /\.tsx?$/.test(entry.name) ? [path] : [];
    });
}

export function matchingLines(paths: string[], pattern: RegExp): string[] {
    return paths.flatMap((path) =>
        readFileSync(path, "utf8")
            .split("\n")
            .flatMap((line, index) => (pattern.test(line) ? [`${path}:${index + 1}`] : [])),
    );
}

export function read(path: string): string {
    return readFileSync(path, "utf8");
}
