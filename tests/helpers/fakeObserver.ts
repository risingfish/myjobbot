import { act } from "@testing-library/react";
import { vi } from "vitest";

interface Watcher {
  callback: IntersectionObserverCallback;
  disconnected: boolean;
}

class FakeIntersectionObserver {
  static readonly watchers: Watcher[] = [];
  private readonly watcher: Watcher;

  constructor(callback: IntersectionObserverCallback) {
    this.watcher = { callback, disconnected: false };
    FakeIntersectionObserver.watchers.push(this.watcher);
  }

  observe() {}

  disconnect() {
    this.watcher.disconnected = true;
  }
}

export function installFakeIntersectionObserver() {
  FakeIntersectionObserver.watchers.length = 0;
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
}

export function scrollIntoView() {
  const live = FakeIntersectionObserver.watchers.filter((watcher) => !watcher.disconnected);
  const entry = { isIntersecting: true } as IntersectionObserverEntry;
  act(() => {
    for (const watcher of live) watcher.callback([entry], {} as IntersectionObserver);
  });
}
