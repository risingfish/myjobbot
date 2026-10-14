import { useEffect, type RefObject } from "react";

/** Calls back whenever the element comes within 400 pixels of being scrolled into view. */
export function useWhenVisible(ref: RefObject<Element | null>, onVisible: () => void): void {
  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && onVisible(), { rootMargin: "400px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [ref, onVisible]);
}
