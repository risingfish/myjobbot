export interface CappedBody {
    body: string;
    cut: boolean;
}

/** Reads a response body as UTF-8 text, stopping once it reaches a byte limit so a huge page can't exhaust memory. */
export async function readCapped(response: Response, maxBytes: number): Promise<CappedBody> {
    const reader = response.body?.getReader();
    if (reader === undefined) return { body: "", cut: false };
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (let next = await reader.read(); !next.done; next = await reader.read()) {
        chunks.push(next.value);
        total += next.value.byteLength;
        if (total >= maxBytes) {
            await reader.cancel();
            return { body: decode(chunks, maxBytes), cut: total > maxBytes };
        }
    }
    return { body: decode(chunks, total), cut: false };
}

/** Joins the chunks read so far into text, keeping at most the given number of bytes. */
function decode(chunks: Uint8Array[], bytes: number): string {
    const joined = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
    let offset = 0;
    for (const chunk of chunks) {
        joined.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return new TextDecoder().decode(joined.subarray(0, bytes));
}
