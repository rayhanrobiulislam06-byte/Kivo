import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
const T = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }
function png(s) {
  const raw = Buffer.alloc((s * 3 + 1) * s)
  for (let y = 0; y < s; y++) {
    raw[y * (s * 3 + 1)] = 0
    for (let x = 0; x < s; x++) {
      const inner = x > s * 0.28 && x < s * 0.72 && y > s * 0.3 && y < s * 0.7
      const o = y * (s * 3 + 1) + 1 + x * 3
      const col = inner ? [230, 245, 242] : [19, 83, 75]
      raw[o] = col[0]; raw[o + 1] = col[1]; raw[o + 2] = col[2]
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(s, 0); ihdr.writeUInt32BE(s, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
writeFileSync('public/icon-192.png', png(192))
writeFileSync('public/icon-512.png', png(512))
console.log('icons ok')
