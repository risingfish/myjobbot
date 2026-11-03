import { appendFile, mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface FilePort {
    read(path: string): Promise<string | null>;
    write(path: string, text: string): Promise<void>;
    append(path: string, text: string): Promise<void>;
    rename(from: string, to: string): Promise<void>;
    list(dir: string): Promise<string[]>;
}

/** Gives the eval files a port onto the real file system under the data folder, a missing file or folder reading as absent. */
export function nodeFilePort(root: string): FilePort {
    const at = (path: string) => join(root, path);
    return {
        read: (path) => readFile(at(path), "utf8").catch(absentAs(null)),
        write: async (path, text) => {
            await mkdir(dirname(at(path)), { recursive: true });
            await writeFile(at(path), text, "utf8");
        },
        append: async (path, text) => {
            await mkdir(dirname(at(path)), { recursive: true });
            await appendFile(at(path), text, "utf8");
        },
        rename: (from, to) => rename(at(from), at(to)),
        list: async (dir) => (await readdir(at(dir)).catch(absentAs([]))).sort(),
    };
}

/** Turns "no such file or folder" into a fallback value, passing every other error on. */
function absentAs<T>(fallback: T): (error: unknown) => T {
    return (error) => {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") return fallback;
        throw error;
    };
}
