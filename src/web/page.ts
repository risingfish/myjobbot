import type { Page } from "../db/jobViews.js";
import { escapeHtml } from "./html.js";
import { TABS, type Tab, type TabData } from "./tabs.js";

interface PageFooter {
  dbPath: string;
  renderedAt: Date;
}

const STYLE = `
:root { --bg: #f6f7f5; --fg: #1b211e; --muted: #5b655f; --rule: #d5dbd6; --accent: #2b4fb0; --card: #fff; --warn: #a3561a; }
@media (prefers-color-scheme: dark) { :root { --bg: #121614; --fg: #e3e8e4; --muted: #98a29c; --rule: #2c3430; --accent: #93a8ff; --card: #1a1f1c; --warn: #e6a467; } }
body { margin: 0; padding: 24px 16px; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, sans-serif; }
nav { display: flex; gap: 16px; margin: 12px 0; flex-wrap: wrap; }
nav a { color: var(--muted); text-decoration: none; padding-bottom: 2px; }
nav a.current { color: var(--fg); border-bottom: 2px solid var(--accent); }
.table { overflow-x: auto; background: var(--card); border: 1px solid var(--rule); border-radius: 8px; }
table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; vertical-align: top; padding: 8px 10px; border-top: 1px solid var(--rule); }
th { border-top: 0; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
a { color: var(--accent); } small, .note, footer { color: var(--muted); } .ghost { color: var(--warn); }
.score { font-weight: 700; font-variant-numeric: tabular-nums; } ul { margin: 4px 0; padding-left: 18px; }
form.hide { margin: 0; } form.hide button { font: inherit; font-size: 13px; color: var(--muted); background: none; border: 1px solid var(--rule); border-radius: 6px; padding: 2px 8px; cursor: pointer; }
tr[data-hidden="0"] .hidden-note { display: none; } tr[data-hidden="1"] { opacity: .6; }`;

const SCRIPT = `
const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) if (entry.isIntersecting) loadMore(entry.target);
}, { rootMargin: "400px" });
function watch() { document.querySelectorAll("tr.more").forEach((row) => observer.observe(row)); }
async function loadMore(row) {
  observer.unobserve(row);
  const response = await fetch(row.querySelector("a").dataset.rows);
  if (!response.ok) return;
  row.insertAdjacentHTML("afterend", await response.text());
  row.remove();
  watch();
}
watch();
document.addEventListener("submit", async (event) => {
  const form = event.target.closest("form.hide");
  if (!form) return;
  event.preventDefault();
  const body = new URLSearchParams(new FormData(form));
  const response = await fetch(form.action, { method: "POST", body, headers: { "x-myjobbot-fetch": "1" } });
  if (!response.ok) return form.submit();
  const row = form.closest("tr");
  if (location.pathname === "/recommended") return row.remove();
  const hidden = form.elements.hidden.value === "1";
  row.dataset.hidden = hidden ? "1" : "0";
  form.elements.hidden.value = hidden ? "0" : "1";
  form.querySelector("button").textContent = hidden ? "Unhide" : "Hide";
});`;

export function renderPage(tab: Tab, data: TabData, view: { page: Page; footer: PageFooter }): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>myjobbot · ${escapeHtml(tab.label)}</title><style>${STYLE}</style></head><body>
<h1>myjobbot</h1>${navigation(tab)}<p>${escapeHtml(data.summary)}</p>${content(tab, data, view.page)}
${footerText(view.footer)}<script>${SCRIPT}</script></body></html>`;
}

export function renderFragment(tab: Tab, data: TabData, page: Page): string {
  return data.rows.join("") + loadMoreRow(tab, nextOffset(page, data.total));
}

export function simplePage(message: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>myjobbot</title></head><body><p>${message}</p><p><a href="/recommended">Back to myjobbot</a></p></body></html>`;
}

function navigation(current: Tab): string {
  const links = TABS.map((tab) => `<a href="${tab.path}"${tab === current ? ' class="current"' : ""}>${tab.label}</a>`);
  return `<nav>${links.join("")}</nav>`;
}

function content(tab: Tab, data: TabData, page: Page): string {
  if (data.total === 0) return `<p>${escapeHtml(data.empty)}</p>`;
  const headers = tab.headers.map((header) => `<th>${header}</th>`).join("");
  return `<div class="table"><table><thead><tr>${headers}</tr></thead><tbody>${renderFragment(tab, data, page)}</tbody></table></div>`;
}

function loadMoreRow(tab: Tab, offset: number | null): string {
  if (offset === null) return "";
  const link = `<a href="${tab.path}?offset=${offset}" data-rows="${tab.path}/rows?offset=${offset}">Load more</a>`;
  return `<tr class="more"><td colspan="${tab.headers.length}">${link}</td></tr>`;
}

function nextOffset(page: Page, total: number): number | null {
  const next = page.offset + page.limit;
  return next < total ? next : null;
}

function footerText(footer: PageFooter): string {
  return `<footer><small>${escapeHtml(footer.dbPath)} · rendered ${escapeHtml(footer.renderedAt.toISOString())}</small></footer>`;
}
