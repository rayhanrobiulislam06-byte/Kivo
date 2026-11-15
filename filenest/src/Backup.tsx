import { useRef } from 'react'
import { saveBlob } from './kivo'

const KEYS = ['fn_done', 'fn_bm', 'fn_days']
const L: Record<string, Record<string, string>> = {
  en: { title: 'Backup progress', desc: 'Save your learning progress, streak and saved lessons to a file, or restore them on another device.', exp: 'Export progress', imp: 'Import progress', ok: 'Progress restored', bad: 'Invalid backup file', done: 'Backup file created' },
  bn: { title: 'অগ্রগতি ব্যাকআপ', desc: 'শেখার অগ্রগতি, দিনের ধারা ও সংরক্ষিত পাঠ ফাইলে রাখুন বা অন্য ডিভাইসে ফিরিয়ে আনুন।', exp: 'অগ্রগতি এক্সপোর্ট', imp: 'অগ্রগতি ইমপোর্ট', ok: 'অগ্রগতি ফিরিয়ে আনা হয়েছে', bad: 'ব্যাকআপ ফাইল সঠিক নয়', done: 'ব্যাকআপ ফাইল তৈরি হয়েছে' },
}
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

export default function Backup({ lang, toast }: { lang: 'en' | 'bn'; toast: (m: string) => void }) {
  const l = (k: string) => L[lang][k]
  const ref = useRef<HTMLInputElement>(null)

  const exportIt = async () => {
    const data: Record<string, unknown> = { app: 'filenest', v: 1, at: new Date().toISOString() }
    for (const k of KEYS) { try { data[k] = JSON.parse(localStorage.getItem(k) || '[]') } catch { data[k] = [] } }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    if (await saveBlob('filenest-progress.json', blob)) { toast('✓ ' + l('done')); return }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'filenest-progress.json'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    toast('✓ ' + l('done'))
  }

  const importIt = async (f: File | undefined) => {
    if (!f) return
    try {
      const d = JSON.parse(await f.text())
      if (d?.app !== 'filenest' || !KEYS.every((k) => isStrArr(d[k]))) throw new Error('bad')
      for (const k of KEYS) localStorage.setItem(k, JSON.stringify(d[k]))
      toast('✓ ' + l('ok'))
      setTimeout(() => location.reload(), 900)
    } catch { toast('⚠ ' + l('bad')) }
    if (ref.current) ref.current.value = ''
  }

  return <div className="card">
    <h3>{l('title')}</h3><p>{l('desc')}</p>
    <div className="bar">
      <button className="btn" onClick={exportIt}>⬇ {l('exp')}</button>
      <button className="btn" onClick={() => ref.current?.click()}>⬆ {l('imp')}</button>
      <input ref={ref} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={(e) => importIt(e.target.files?.[0])} />
    </div>
  </div>
}
