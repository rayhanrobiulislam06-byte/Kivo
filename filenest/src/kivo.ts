// Kivo bridge: works only inside the Kivo Android app's WebView (window.KivoNative).
// In a normal browser hasKivo() is false and nothing here is called.
type Bridge = { isReady(): boolean; sendMessage(text: string, id: string): void; stop?(): void; newChat?(): void; saveFile?(name: string, mime: string, base64: string): void }
declare global {
  interface Window {
    KivoNative?: Bridge
    kivoNativeChunk?: (id: string, text: string) => void
    kivoNativeResponse?: (id: string, response: string, error?: string) => void
  }
}
type Req = { acc: string; onText: (t: string) => void; resolve: (t: string) => void; reject: (e: Error) => void; timer: number }
const reqs: Record<string, Req> = {}
let installed = false

export const KIVO_URL = 'https://github.com/rayhanrobiulislam06-byte/Kivo/releases/latest'
export const hasKivo = () => typeof window !== 'undefined' && !!window.KivoNative && typeof window.KivoNative.sendMessage === 'function'
export const kivoReady = () => { try { return hasKivo() && !!window.KivoNative!.isReady() } catch { return false } }

function install() {
  if (installed) return
  installed = true
  window.kivoNativeChunk = (id, text) => {
    const r = reqs[id]; if (!r) return
    r.acc += text // Kivo sends deltas
    r.onText(r.acc)
  }
  window.kivoNativeResponse = (id, response, error) => {
    const r = reqs[id]; if (!r) return
    delete reqs[id]; clearTimeout(r.timer)
    if (error) r.reject(new Error(error)); else r.resolve(response || r.acc)
  }
}

export function askKivo(prompt: string, onText: (t: string) => void): { promise: Promise<string>; cancel: () => void } {
  install()
  const id = 'fn-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
  const promise = new Promise<string>((resolve, reject) => {
    if (!kivoReady()) { reject(new Error('NOT_READY')); return }
    const timer = window.setTimeout(() => { delete reqs[id]; reject(new Error('TIMEOUT')) }, 5 * 60 * 1000)
    reqs[id] = { acc: '', onText, resolve, reject, timer }
    try { window.KivoNative!.newChat?.(); window.KivoNative!.sendMessage(prompt, id) } catch (e) { clearTimeout(timer); delete reqs[id]; reject(e as Error) }
  })
  const cancel = () => { try { window.KivoNative?.stop?.() } catch { /* ignore */ } }
  return { promise, cancel }
}

/** Save a file from inside the Kivo app (the WebView cannot download blobs). Returns false outside Kivo. */
export async function saveBlob(name: string, blob: Blob): Promise<boolean> {
  const n = typeof window !== "undefined" ? window.KivoNative : undefined
  if (!n || typeof n.saveFile !== "function") return false
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let bin = ""
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  n.saveFile(name, blob.type || "application/octet-stream", btoa(bin))
  return true
}
