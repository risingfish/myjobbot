import type { FilePort } from "../../src/evals/filePort.js";

export function memoryFilePort(seed: Record<string, string> = {}) {
    const files = new Map(Object.entries(seed));
    const writes: string[] = [];
    const port: FilePort = {
        read: async (path) => files.get(path) ?? null,
        write: async (path, text) => void (writes.push(`write ${path}`), files.set(path, text)),
        append: async (path, text) => void (writes.push(`append ${path}`), files.set(path, (files.get(path) ?? "") + text)),
        rename: async (from, to) => {
            writes.push(`rename ${from} ${to}`);
            files.set(to, files.get(from) ?? "");
            files.delete(from);
        },
        list: async (dir) => [...new Set([...files.keys()].filter((path) => path.startsWith(`${dir}/`)).map((path) => path.slice(dir.length + 1).split("/")[0] ?? ""))].sort(),
    };
    return { port, files, writes };
}
