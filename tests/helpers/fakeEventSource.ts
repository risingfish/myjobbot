import { act } from "@testing-library/react";

export class FakeSource {
    static CLOSED = 2;
    static opened: FakeSource[] = [];
    readyState = 1;
    onerror: (() => void) | null = null;
    private listeners = new Map<string, (event: { data: string }) => void>();
    constructor(readonly url: string) {
        FakeSource.opened.push(this);
    }
    addEventListener(name: string, listener: (event: { data: string }) => void) {
        this.listeners.set(name, listener);
    }
    close() {
        this.readyState = FakeSource.CLOSED;
    }
    emit(name: string, data: unknown) {
        act(() => this.listeners.get(name)?.({ data: JSON.stringify(data) }));
    }
}
