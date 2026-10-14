const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapes HTML-significant characters so untrusted text can be inserted into markup safely. */
export function escapeHtml(value: string | number | null): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

/** Renders a minimal HTML page for a plain message, with a link back to the recommended page. */
export function simplePage(message: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>myjobbot</title></head><body><p>${message}</p><p><a href="/recommended">Back to myjobbot</a></p></body></html>`;
}
