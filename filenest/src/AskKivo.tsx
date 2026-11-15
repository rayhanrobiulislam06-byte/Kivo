import { useRef, useState } from 'react'
import { askKivo, hasKivo, KIVO_URL } from './kivo'

const L: Record<string, Record<string, string>> = {
  en: { ask: 'Ask Kivo', ph: 'Ask about this lesson…', send: 'Send', stop: 'Stop', get: 'Get Kivo, the offline AI', getd: 'Open this app inside Kivo to ask questions about lessons, offline and private.', nr: 'Kivo model is not ready yet', err: 'Kivo error' },
  bn: { ask: 'Kivo-কে জিজ্ঞাসা করুন', ph: 'এই পাঠ সম্পর্কে জিজ্ঞাসা করুন…', send: 'পাঠান', stop: 'থামান', get: 'Kivo নিন, অফলাইন AI', getd: 'পাঠ নিয়ে প্রশ্ন করতে এই অ্যাপ Kivo-র ভেতরে খুলুন। সবকিছু অফলাইন ও প্রাইভেট।', nr: 'Kivo মডেল এখনো প্রস্তুত নয়', err: 'Kivo ত্রুটি' },
}

export default function AskKivo({ lang, context }: { lang: 'en' | 'bn'; context: string }) {
  const l = (k: string) => L[lang][k]
  const [q, setQ] = useState('')
  const [out, setOut] = useState('')
  const [busy, setBusy] = useState(false)
  const cancel = useRef<() => void>(() => {})

  if (!hasKivo()) return <div className="card"><h3>🤖 {l('get')}</h3><p>{l('getd')}</p>
    <a className="btn" href={KIVO_URL} target="_blank" rel="noopener noreferrer">⬇ Kivo</a></div>

  const send = async () => {
    const text = q.trim(); if (!text || busy) return
    setBusy(true); setOut('')
    const prompt = (lang === 'bn' ? 'পাঠের বিষয়: ' : 'Lesson: ') + context + '\n\n' + text
    const r = askKivo(prompt, setOut); cancel.current = r.cancel
    try { setOut(await r.promise) }
    catch (e) { setOut('⚠ ' + ((e as Error).message === 'NOT_READY' ? l('nr') : l('err') + ': ' + (e as Error).message)) }
    setBusy(false)
  }

  return <div className="card"><h3>🤖 {l('ask')}</h3>
    <textarea className="in" rows={2} style={{ width: '100%' }} placeholder={l('ph')} value={q} onChange={(e) => setQ(e.target.value)} />
    <div className="bar">
      <button className="btn" disabled={busy || !q.trim()} onClick={send}>{l('send')}</button>
      {busy && <button className="btn" onClick={() => cancel.current()}>■ {l('stop')}</button>}
    </div>
    {out && <p style={{ whiteSpace: 'pre-wrap' }}>{out}</p>}
  </div>
}
