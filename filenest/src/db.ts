import { openDB } from 'idb'
export type Node = { id: string; parentId: string; name: string; kind: 'file' | 'folder'; size: number; type: string; modified: number; blob?: Blob }
export const ROOT = 'root'
const dbp = openDB('filenest', 1, {
  upgrade(d) { const s = d.createObjectStore('nodes', { keyPath: 'id' }); s.createIndex('parent', 'parentId') },
})
dbp.catch((e) => console.error('[FileNest] IndexedDB could not be opened:', e))
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10)

const EXT: Record<string, string[]> = {
  images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'avif'],
  videos: ['mp4', 'mkv', 'webm', 'mov', 'avi', '3gp'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'],
  documents: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv', 'rtf', 'odt', 'json', 'html'],
  archives: ['zip', 'rar', '7z', 'tar', 'gz'],
  apk: ['apk'],
}
const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
  pdf: 'application/pdf', txt: 'text/plain', md: 'text/plain', csv: 'text/plain', json: 'text/plain', html: 'text/plain', zip: 'application/zip',
}
export const TEXT_EXT = ['txt', 'md', 'csv', 'json', 'html']
export const ext = (n: string) => (n.includes('.') ? n.split('.').pop()!.toLowerCase() : '')
export const mimeOf = (n: string) => MIME[ext(n)] || 'application/octet-stream'
export function category(n: { name: string; kind: string }) {
  if (n.kind === 'folder') return 'folder'
  const e = ext(n.name)
  for (const k in EXT) if (EXT[k].includes(e)) return k
  return 'other'
}
export function cleanName(n: string) {
  const s = n.replace(/[\\/\u0000]/g, '_').trim()
  if (!s || s === '.' || s === '..') throw new Error('Invalid name')
  return s
}
export async function all(): Promise<Node[]> { return (await dbp).getAll('nodes') }
export async function children(pid: string): Promise<Node[]> { return (await dbp).getAllFromIndex('nodes', 'parent', pid) }
export async function get(id: string): Promise<Node | undefined> { return (await dbp).get('nodes', id) }

export async function uniqueName(pid: string, name: string, exclude?: string) {
  const names = new Set((await children(pid)).filter((n) => n.id !== exclude).map((n) => n.name))
  if (!names.has(name)) return name
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const e = dot > 0 ? name.slice(dot) : ''
  let i = 1
  while (names.has(`${base} (${i})${e}`)) i++
  return `${base} (${i})${e}`
}
export async function addFile(pid: string, name: string, blob: Blob) {
  const nm = await uniqueName(pid, cleanName(name))
  const type = blob.type || mimeOf(nm)
  const b = blob.type ? blob : new Blob([blob], { type })
  const n: Node = { id: uid(), parentId: pid, name: nm, kind: 'file', size: blob.size, type, modified: (blob as File).lastModified || Date.now(), blob: b }
  await (await dbp).put('nodes', n)
  return n
}
export async function mkdir(pid: string, name: string) {
  const n: Node = { id: uid(), parentId: pid, name: await uniqueName(pid, cleanName(name)), kind: 'folder', size: 0, type: 'folder', modified: Date.now() }
  await (await dbp).put('nodes', n)
  return n
}
export async function ensurePath(pid: string, parts: string[]) {
  let cur = pid
  for (const raw of parts) {
    const p = cleanName(raw)
    const found = (await children(cur)).find((c) => c.kind === 'folder' && c.name === p)
    cur = found ? found.id : (await mkdir(cur, p)).id
  }
  return cur
}
export async function rename(id: string, name: string) {
  const n = await get(id); if (!n) return
  n.name = await uniqueName(n.parentId, cleanName(name), id)
  n.modified = Date.now()
  await (await dbp).put('nodes', n)
}
export async function remove(id: string): Promise<void> {
  for (const c of await children(id)) await remove(c.id)
  await (await dbp).delete('nodes', id)
}
export async function isDescendant(target: string, id: string) {
  let cur = target
  while (cur && cur !== ROOT) { if (cur === id) return true; cur = (await get(cur))?.parentId ?? ROOT }
  return false
}
export async function copy(id: string, pid: string): Promise<void> {
  const n = await get(id); if (!n) return
  if (await isDescendant(pid, id)) throw new Error('Cannot copy a folder into itself')
  const nn: Node = { ...n, id: uid(), parentId: pid, name: await uniqueName(pid, n.name), modified: Date.now() }
  await (await dbp).put('nodes', nn)
  if (n.kind === 'folder') for (const c of await children(id)) await copy(c.id, nn.id)
}
export async function move(id: string, pid: string) {
  const n = await get(id); if (!n || n.parentId === pid) return
  if (await isDescendant(pid, id)) throw new Error('Cannot move a folder into itself')
  n.name = await uniqueName(pid, n.name)
  n.parentId = pid
  await (await dbp).put('nodes', n)
}
export async function sizeOf(id: string): Promise<number> {
  const n = await get(id); if (!n) return 0
  if (n.kind === 'file') return n.size
  let s = 0
  for (const c of await children(id)) s += await sizeOf(c.id)
  return s
}
