export class LinkRegistry {
    private readonly urls: string[] = [];

    /** Returns the number a link is offered under, giving a new address the next number. */
    number(url: string): number {
        const known = this.urls.indexOf(url);
        if (known >= 0) return known + 1;
        this.urls.push(url);
        return this.urls.length;
    }

    /** Returns the address offered under a number, or undefined when no such link was offered. */
    get(number: number): string | undefined {
        return this.urls[number - 1];
    }

    /** Returns how many links have been offered so far. */
    get size(): number {
        return this.urls.length;
    }
}
