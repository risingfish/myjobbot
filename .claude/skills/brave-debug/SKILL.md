---
name: brave-debug
description: Open a page of the myjobbot web UI in a visible Brave window that both the owner and Claude can see, and drive it (navigate, click, screenshot, read styles). Use it whenever a UI change needs to be seen rather than only tested, for example header or layout changes, Pico styling, the sign-in and account pages, the content policy (console errors), phone width, or when the owner asks to look at a page together. It launches Brave in remote-debugging mode and uses the project's `brave` MCP server, which is Playwright attached to that window over CDP. The default Playwright plugin can't be used: it needs Google Chrome, which isn't installed.
---

# Seeing the web UI in Brave

The owner watches the same Brave window that Claude drives. Nothing runs headless or hidden.

## 1. Open the debug window

```bash
.claude/skills/brave-debug/brave-debug.sh start http://localhost:8080/recommended
```

- The window opens on the owner's desktop. It uses a separate profile
  (`~/.cache/brave-debug-profile`), so their everyday Brave, tabs and logins are untouched.
- Remote debugging listens on `127.0.0.1:9222` only. It is still full control of that window for
  any local process, so close it when you're done (step 4).
- Running `start` again reuses the window if it's already open.
- The UI has to be running first: `docker compose ps` shows `web` running (`npm run docker:watch`),
  or `npm run web` is up. Open it at `http://localhost:8080`, the address `MYJOBBOT_BASE_URL`
  names: sign-in cookies only work on that address.

## 2. Sign in (the owner does it)

Every page but `/sign-in`, `/create-account` and `/link` needs a sign-in (feature 024). **Claude
never types, asks for or stores the owner's password.** When the window lands on the sign-in page,
ask the owner to sign in there themselves, then carry on. The sign-in lasts 30 days in the debug
profile, so this is rarely needed. Five wrong passwords lock that email for 15 minutes.

## 3. Drive it with the `brave` MCP tools

Use the `mcp__brave__browser_*` tools, not `mcp__plugin_playwright_playwright__*`:

- `browser_navigate`, `browser_snapshot` (for finding elements to act on), `browser_click`,
  `browser_type` and `browser_press_key`
- `browser_take_screenshot`, to see the result yourself
- `browser_console_messages` with level `error`, to catch content-policy blocks
  (`Refused to … because it violates the following Content Security Policy directive`)
- `browser_resize` to 360 × 780 for phone-width checks
- `browser_evaluate` for things a screenshot can't show, e.g. `getComputedStyle(el).paddingTop`
  or which Pico variable a value came from

Say what you're about to do before acting, so the owner can follow along in the window. Don't
press buttons that change data (Hide, Applied, Re-score, saves, Sign out) unless the owner asked.

**If the `brave` tools aren't available:** the server is defined in the project's `.mcp.json` and
loads only at session start. Ask the owner to approve the `brave` server and restart Claude Code.
If the tools exist but fail to connect, the window isn't open, so run step 1.

**Without the MCP tools** (e.g. before that restart), drive the same window with the CDP helper
`cdp.mjs`, from a Node ES module:

```bash
node --input-type=module -e '
import { connect, wait } from "./.claude/skills/brave-debug/cdp.mjs";
const b = await connect();
await b.goto("http://localhost:8080/recommended"); await wait(1000);
console.log(await b.evaluate(`getComputedStyle(document.querySelector(".site-header")).height`));
console.log(await b.screenshot("header"));   // → ~/.cache/brave-debug-profile/shots/header.png; Read it
b.close();'
```

- It has `goto`, `evaluate`, `screenshot`, `mouse`, `click` and `key`, plus the raw `send` for any
  CDP method:
  - `Emulation.setDeviceMetricsOverride` for phone width
  - `Emulation.setEmulatedMedia` with `prefers-color-scheme` to check light and dark themes
- **Reset emulation** (metrics, media) when you're done, so the owner's window is back to normal.

## 4. Close it

```bash
.claude/skills/brave-debug/brave-debug.sh stop
```

`status` reports whether it's running. The profile folder persists between runs (keeping the
sign-in). Delete `~/.cache/brave-debug-profile` to reset it.
