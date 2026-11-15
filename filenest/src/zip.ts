import { zipSync, unzipSync } from 'fflate'
import * as db from './db'

async function collect(id: string, prefix: string, out: Record<string, Uint8Array>) {
  const n = await db.get(id); if (!n) return
  if (n.kind === 'file') {
    let k = prefix + n.name
    if (out[k]) k = prefix + id.slice(0, 4) + '_' + n.name
    out[k] = new Uint8Array(await n.blob!.arrayBuffer())
    return
  }
  for (const c of await db.children(id)) await collect(c.id, prefix + n.name + '/', out)
}
export async function makeZip(ids: string[]) {
  const out: Record<string, Uint8Array> = {}
  for (const id of ids) await collect(id, '', out)
  if (!Object.keys(out).length) throw new Error('Nothing to compress')
  return new Blob([zipSync(out, { level: 6 }) as BlobPart], { type: 'application/zip' })
}
const MAX_ENTRIES = 5000
const MAX_TOTAL = 500 * 1024 * 1024
const MAX_ENTRY = 300 * 1024 * 1024
// refuses zip bombs before anything is decompressed into memory
function unzipLimited(data: Uint8Array) {
  let n = 0, total = 0
  return unzipSync(data, {
    filter: (f) => {
      n++; total += f.originalSize
      if (n > MAX_ENTRIES || total > MAX_TOTAL || f.originalSize > MAX_ENTRY) throw new Error('ZIP is too large or has too many files')
      return true
    },
  })
}
export async function listZip(blob: Blob) {
  const files = unzipLimited(new Uint8Array(await blob.arrayBuffer()))
  return Object.entries(files).filter(([p]) => !p.endsWith('/')).map(([name, d]) => ({ name, size: d.length }))
}
function safePath(p: string): string | null {
  if (p.startsWith('/') || p.startsWith('\\')) return null
  const parts = p.replace(/\\/g, '/').split('/').filter((s) => s && s !== '.')
  if (!parts.length || parts.some((s) => s === '..' || /^[a-zA-Z]:$/.test(s))) return null
  return parts.join('/')
}
export async function extractZip(node: db.Node, pid: string) {
  const files = unzipLimited(new Uint8Array(await node.blob!.arrayBuffer()))
  const base = node.name.replace(/\.zip$/i, '') || 'extracted'
  const dest = (await db.mkdir(pid, base)).id
  let extracted = 0, skipped = 0
  for (const [path, bytes] of Object.entries(files)) {
    if (path.endsWith('/')) continue
    const s = safePath(path)
    if (!s) { skipped++; continue }
    const parts = s.split('/')
    const name = parts.pop()!
    const dir = await db.ensurePath(dest, parts)
    await db.addFile(dir, name, new Blob([bytes as BlobPart]))
    extracted++
  }
  return { extracted, skipped }
}
