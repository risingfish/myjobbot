const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const WEB_URL = /^https?:\/\//i;

export function escapeHtml(value: string | number | null): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

export function linkTo(url: string | null, label: string): string {
  if (!url || !WEB_URL.test(url)) return escapeHtml(label);
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

export function bulletList(items: string[]): string {
  if (items.length === 0) return "";
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

export function cells(values: string[]): string {
  return values.map((value) => `<td>${value}</td>`).join("");
}

export function dateOnly(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}
