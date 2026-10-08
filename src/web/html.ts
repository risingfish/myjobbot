const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const WEB_URL = /^https?:\/\//i;

/** Escapes HTML-significant characters so untrusted text can be inserted into markup safely. */
export function escapeHtml(value: string | number | null): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

/** Renders an anchor to the URL only when it is http(s), otherwise the escaped label, avoiding unsafe link schemes. */
export function linkTo(url: string | null, label: string): string {
  if (!url || !WEB_URL.test(url)) return escapeHtml(label);
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

/** Renders a bullet list of escaped items, or an empty string when there are none. */
export function bulletList(items: string[]): string {
  if (items.length === 0) return "";
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

/** Wraps each already-rendered value in a table cell for a row. */
export function cells(values: string[]): string {
  return values.map((value) => `<td>${value}</td>`).join("");
}

/** Returns the date-only portion of an ISO timestamp, or an empty string when null. */
export function dateOnly(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}
