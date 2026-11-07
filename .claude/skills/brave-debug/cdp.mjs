// Minimal Chrome DevTools Protocol client for the Brave debug window (brave-debug.sh start).
// Lets Claude drive and inspect the page the owner is watching when the `brave` MCP server isn't
// loaded. Node 22+ (global WebSocket and fetch). Screenshots go to ~/.cache/brave-debug-profile/shots.
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const PORT = process.env.BRAVE_DEBUG_PORT ?? '9222'
export const SHOTS = join(process.env.BRAVE_DEBUG_PROFILE ?? join(homedir(), '.cache/brave-debug-profile'), 'shots')
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function connect() {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
  const page = targets.find((target) => target.type === 'page')
  if (!page) throw new Error('No page open in the Brave debug window')

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  const pending = new Map()
  const listeners = new Map()
  let nextId = 0
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data)
    if (pending.has(message.id)) {
      pending.get(message.id)(message)
      pending.delete(message.id)
    }
    for (const handler of listeners.get(message.method) ?? []) handler(message.params)
  }
  const on = (method, handler) => {
    listeners.set(method, [...(listeners.get(method) ?? []), handler])
    return () => listeners.set(method, (listeners.get(method) ?? []).filter((h) => h !== handler))
  }
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId
      pending.set(id, (message) => (message.error ? reject(new Error(`${method}: ${message.error.message}`)) : resolve(message.result)))
      ws.send(JSON.stringify({ id, method, params }))
    })

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
    return result.value
  }

  return {
    send,
    evaluate,
    on,
    async goto(url) {
      await send('Page.enable')
      const loaded = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          off()
          reject(new Error(`Timed out loading ${url}`))
        }, 15000)
        const off = on('Page.loadEventFired', () => {
          clearTimeout(timer)
          off()
          resolve()
        })
      })
      await send('Page.navigate', { url })
      await loaded
    },
    async screenshot(name) {
      mkdirSync(SHOTS, { recursive: true })
      const { data } = await send('Page.captureScreenshot', { format: 'png' })
      const path = join(SHOTS, `${name}.png`)
      writeFileSync(path, Buffer.from(data, 'base64'))
      return path
    },
    mouse: (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, pointerType: 'mouse' }),
    async click(x, y) {
      await this.mouse('mousePressed', x, y)
      await this.mouse('mouseReleased', x, y)
    },
    async key(key, code, keyCode) {
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: keyCode })
      await send('Input.dispatchKeyEvent', { type: 'char', key, text: key === 'Enter' ? '\r' : key === ' ' ? ' ' : '' })
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode })
    },
    close: () => ws.close(),
  }
}
