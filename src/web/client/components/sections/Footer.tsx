import { useMeta } from "../../useMeta.js";

/** Renders the page footer naming the database shown and when the server answered, once that is known. */
export function Footer() {
  const meta = useMeta();
  return <footer>{meta && <small>{meta.dbPath} · rendered {meta.renderedAt}</small>}</footer>;
}
