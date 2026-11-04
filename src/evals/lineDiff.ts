type Step = { kind: "same" | "removed" | "added"; text: string; line: number };

/** Lists the lines that differ between two texts, grouped where they change, each group headed by the line it starts at in the first text; unchanged lines are left out. */
export function lineDiff(before: string, after: string): string[] {
    const groups: Step[][] = [];
    let current: Step[] = [];
    for (const step of steps(before.split("\n"), after.split("\n"))) {
        if (step.kind !== "same") current.push(step);
        else if (current.length > 0) [groups[groups.length], current] = [current, []];
    }
    if (current.length > 0) groups.push(current);
    return groups.flatMap((group) => [`@@ line ${group[0]?.line ?? 1}`, ...group.filter((step) => step.kind === "removed").map((step) => `- ${step.text}`), ...group.filter((step) => step.kind === "added").map((step) => `+ ${step.text}`)]);
}

/** Walks two lists of lines along their longest common run of lines, saying for each line whether it stayed, went or came. */
function steps(a: string[], b: string[]): Step[] {
    const walk = new Walk(a, b);
    const walked: Step[] = [];
    let [i, j] = [0, 0];
    while (i < a.length || j < b.length) {
        const kind = walk.next(i, j);
        walked.push({ kind, text: (kind === "added" ? b[j] : a[i]) ?? "", line: i + 1 });
        if (kind !== "added") i += 1;
        if (kind !== "removed") j += 1;
    }
    return walked;
}

/** Two lists of lines and the table of their longest common runs, which says at each pair of positions how the walk goes on. */
class Walk {
    private readonly a: string[];
    private readonly b: string[];
    private readonly table: number[][];

    /** Keeps the two lists and builds their table. */
    constructor(a: string[], b: string[]) {
        this.a = a;
        this.b = b;
        this.table = commonLengths(a, b);
    }

    /** Picks the next step: keep a shared line, else drop from the first list or take from the second, whichever leaves the longer common run. */
    next(i: number, j: number): Step["kind"] {
        if (this.a[i] !== undefined && this.a[i] === this.b[j]) return "same";
        if (i === this.a.length) return "added";
        if (j === this.b.length) return "removed";
        return this.runAfter(i + 1, j) >= this.runAfter(i, j + 1) ? "removed" : "added";
    }

    /** Gives the longest common run left from a pair of positions. */
    private runAfter(i: number, j: number): number {
        return this.table[i]?.[j] ?? 0;
    }
}

/** Builds the table of longest common run lengths between every pair of suffixes of two lists of lines. */
function commonLengths(a: string[], b: string[]): number[][] {
    const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) {
        for (let j = b.length - 1; j >= 0; j--) {
            const row = table[i] as number[];
            row[j] = a[i] === b[j] ? (table[i + 1]?.[j + 1] ?? 0) + 1 : Math.max(table[i + 1]?.[j] ?? 0, row[j + 1] ?? 0);
        }
    }
    return table;
}
