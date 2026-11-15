import { useState } from 'react'
import { ALL } from './softskills'
import type { P, Lesson } from './softskills'
import * as db from './db'
import AskKivo from './AskKivo'

type T = (k: string) => string
type Item = { ci: number; i: number; le: Lesson; id: string }
const L: Record<string, Record<string, string>> = {
  en: { cont: 'Continue learning', streak: 'day streak', overall: 'Overall progress', bm: 'Saved lessons', note: 'My notes', saveNote: 'Save note to Files', saved: 'Saved in Files > Skill Notes', next: 'Next lesson', find: 'Search lessons', none: 'No lessons found', mark: 'Save', unmark: 'Saved', allDone: 'All lessons completed 🎉', notePh: 'Write what you learned or how you will practice…', courses: 'Courses', start: 'Start', retry: 'Try again' },
  bn: { cont: 'শেখা চালিয়ে যান', streak: 'দিনের ধারা', overall: 'সামগ্রিক অগ্রগতি', bm: 'সংরক্ষিত পাঠ', note: 'আমার নোট', saveNote: 'নোট ফাইলে সংরক্ষণ করুন', saved: 'ফাইল > Skill Notes-এ সংরক্ষিত', next: 'পরের পাঠ', find: 'পাঠ খুঁজুন', none: 'কোনো পাঠ পাওয়া যায়নি', mark: 'সংরক্ষণ', unmark: 'সংরক্ষিত', allDone: 'সব পাঠ সম্পন্ন 🎉', notePh: 'যা শিখলেন বা কীভাবে চর্চা করবেন লিখুন…', courses: 'কোর্সসমূহ', start: 'শুরু করুন', retry: 'আবার চেষ্টা করুন' },
}
const load = (k: string): string[] => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] } }
const save = (k: string, v: string[]) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ } }
const iso = (x: Date) => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0')
const streakOf = (days: string[]) => {
  const set = new Set(days)
  const d = new Date()
  if (!set.has(iso(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (set.has(iso(d))) { n++; d.setDate(d.getDate() - 1) }
  return n
}

export default function Skills({ lang, t, onSaved, toast }: { lang: 'en' | 'bn'; t: T; onSaved: () => void; toast: (m: string) => void }) {
  const l = (k: string) => L[lang][k]
  const g = (p: P) => (lang === 'bn' ? p[1] : p[0])
  const [done, setDone] = useState<string[]>(() => load('fn_done'))
  const [bm, setBm] = useState<string[]>(() => load('fn_bm'))
  const [days, setDays] = useState<string[]>(() => load('fn_days'))
  const [c, setC] = useState<number | null>(null)
  const [li, setLi] = useState<number | null>(null)
  const [ans, setAns] = useState<number | null>(null)
  const [q, setQ] = useState('')
  const [note, setNote] = useState('')

  const touch = () => { const d = iso(new Date()); if (!days.includes(d)) { const n = [...days, d].slice(-400); setDays(n); save('fn_days', n) } }
  const open = (ci: number, i: number) => { setC(ci); setLi(i); setAns(null); setNote(''); touch() }
  const mark = (id: string) => { if (!done.includes(id)) { const n = [...done, id]; setDone(n); save('fn_done', n) } }
  const toggleBm = (id: string) => { const n = bm.includes(id) ? bm.filter((x) => x !== id) : [...bm, id]; setBm(n); save('fn_bm', n) }

  const all: Item[] = ALL.flatMap((co, ci) => co.l.map((le, i) => ({ ci, i, le, id: ci + '-' + i })))
  const total = all.length
  const doneCount = all.filter((x) => done.includes(x.id)).length
  const nextItem = all.find((x) => !done.includes(x.id))
  const tip = all[Math.floor(Date.now() / 86400000) % all.length]
  const found = q.trim() ? all.filter((x) => (g(x.le.t) + ' ' + x.le.p.map(g).join(' ')).toLowerCase().includes(q.trim().toLowerCase())) : []

  const Row = (x: Item) => (
    <div className="row" key={x.id} onClick={() => open(x.ci, x.i)} style={{ cursor: 'pointer' }}>
      <span className="ic">{done.includes(x.id) ? '✅' : '📘'}</span>
      <div className="nm"><div>{g(x.le.t)}</div><div className="meta">{g(ALL[x.ci].t)}</div></div>
    </div>
  )

  const saveNote = async () => {
    if (!note.trim() || c === null || li === null) return
    try {
      const dir = await db.ensurePath(db.ROOT, ['Skill Notes'])
      const title = g(ALL[c].l[li].t).replace(/[\\/:*?"<>|]/g, '')
      await db.addFile(dir, title + '.txt', new Blob([note], { type: 'text/plain' }))
      onSaved(); toast('✓ ' + l('saved'))
    } catch (e: any) { toast('⚠ ' + (e?.message || e)) }
  }

  if (c !== null && li !== null) {
    const co = ALL[c], le = co.l[li], id = c + '-' + li
    const nxt = li + 1 < co.l.length ? li + 1 : null
    return <div>
      <button className="btn" onClick={() => { setLi(null); setAns(null) }}>← {t('back')}</button>
      <div className="card">
        <div className="meta">{co.i} {g(co.t)} · {li + 1}/{co.l.length}</div>
        <h2>{g(le.t)}</h2>
        <h3>{t('points')}</h3><ul>{le.p.map((x, i) => <li key={i}>{g(x)}</li>)}</ul>
        <div className="card" style={{ background: 'var(--pc)' }}><b>{t('tip')}:</b> {g(le.x)}</div>
        <AskKivo lang={lang} context={g(le.t) + ': ' + le.p.map((x) => g(x)).join('; ')} />
        <h3>{t('quiz')}</h3><p>{g(le.q.q)}</p>
        {le.q.o.map((o, i) => <button key={i} className={'btn opt ' + (ans !== null ? (i === le.q.a ? 'ok' : i === ans ? 'bad' : '') : '')} disabled={ans !== null} onClick={() => { setAns(i); if (i === le.q.a) mark(id) }}>{g(o)}</button>)}
        {ans !== null && <p><b>{ans === le.q.a ? '✅ ' + t('correct') : '❌ ' + t('wrong')}</b></p>}
        {ans !== null && ans !== le.q.a && <button className="btn" onClick={() => setAns(null)}>↻ {l('retry')}</button>}
        <h3>{l('note')}</h3>
        <textarea className="in" rows={4} style={{ width: '100%' }} placeholder={l('notePh')} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="bar" style={{ marginTop: 8 }}>
          <button className="btn" onClick={saveNote}>💾 {l('saveNote')}</button>
          <button className="btn" onClick={() => toggleBm(id)}>🔖 {bm.includes(id) ? l('unmark') : l('mark')}</button>
          {nxt !== null && <button className="btn p" onClick={() => open(c, nxt)}>{l('next')} →</button>}
        </div>
      </div>
    </div>
  }

  if (c !== null) {
    const co = ALL[c]
    return <div>
      <button className="btn" onClick={() => setC(null)}>← {t('back')}</button>
      <h2>{co.i} {g(co.t)}</h2>
      <div className="card" style={{ padding: 0 }}>{all.filter((x) => x.ci === c).map(Row)}</div>
    </div>
  }

  const saved = all.filter((x) => bm.includes(x.id))
  return <div>
    <div className="card" style={{ background: 'var(--pc)' }}>
      <div className="bar" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <b>🔥 {streakOf(days)} {l('streak')}</b>
        <span className="meta">{doneCount}/{total}</span>
      </div>
      <div className="meta">{l('overall')}</div>
      <div className="bar2" style={{ marginTop: 6 }}><i style={{ width: (doneCount / total) * 100 + '%' }} /></div>
    </div>
    <input className="in" placeholder={'🔍 ' + l('find')} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
    {q.trim() ? (found.length ? <div className="card" style={{ padding: 0 }}>{found.map(Row)}</div> : <div className="card meta">{l('none')}</div>) : <>
      {nextItem
        ? <div className="card"><b>▶ {l('cont')}</b><p>{g(nextItem.le.t)} <span className="meta">· {g(ALL[nextItem.ci].t)}</span></p><button className="btn p" onClick={() => open(nextItem.ci, nextItem.i)}>{l('start')} →</button></div>
        : <div className="card">{l('allDone')}</div>}
      <div className="card"><b>💡 {t('dailyTip')}</b><p>{g(tip.le.x)}</p><button className="btn" onClick={() => open(tip.ci, tip.i)}>{g(tip.le.t)} →</button></div>
      {saved.length > 0 && <><h2>🔖 {l('bm')}</h2><div className="card" style={{ padding: 0 }}>{saved.map(Row)}</div></>}
      <h2>{l('courses')}</h2>
      {ALL.map((co, ci) => {
        const d = co.l.filter((_, i) => done.includes(ci + '-' + i)).length
        return <div className="card" key={ci} onClick={() => setC(ci)} style={{ cursor: 'pointer' }}>
          <h3>{co.i} {g(co.t)}</h3>
          <div className="meta">{co.l.length} {t('lessons')} · {t('progress')}: {d}/{co.l.length}</div>
          <div className="bar2" style={{ marginTop: 6 }}><i style={{ width: (d / co.l.length) * 100 + '%' }} /></div>
        </div>
      })}
    </>}
  </div>
}
