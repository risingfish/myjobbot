import { useEffect, useState } from "react";
import type { Meta } from "../api.js";
import { fetchJson } from "./fetchJson.js";

/** Loads the footer's database path and answer time, staying empty while loading or if the request fails. */
export function useMeta(): Meta | null {
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetchJson<Meta>("/api/meta", controller.signal).then(setMeta, () => setMeta(null));
    return () => controller.abort();
  }, []);
  return meta;
}
