import Install from './Install'
import Backup from './Backup'
import { hasKivo, saveBlob } from './kivo'
import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import * as QRCode from 'qrcode'
import * as db from './db'
import { makeZip, listZip, extractZip } from './zip'
import { dict } from './i18n'
import { DONATION } from './donation'
import Skills from './Skills'
import type { P } from './softskills'

type T = (k: string) => string
type Lang = 'en' | 'bn'
type Tab = 'home' | 'files' | 'skills' | 'donate' | 'settings'
const ICON: Record<string, string> = { folder: '📁', images: '🖼️', videos: '🎬', audio: '🎵', documents: '📄', archives: '🗜️', apk: '📦', other: '📎' }
const CATS = ['images', 'videos', 'audio', 'documents', 'archives', 'apk']
const fmtSize = (b: number) => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : b < 1073741824 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1073741824).toFixed(2) + ' GB'
const fmtDate = (n: number) => new Date(n).toLocaleDateString()

class ErrorBoundary extends Component<{ children: ReactNode }, { err: string }> {
  state = { err: '' }
  static getDerivedStateFromError(e: any) { return { err: String(e?.message || e) } }
  render() { return this.state.err ? <div className="app"><div className="card"><h3>⚠ Error</h3><pre>{this.state.err}</pre><button className="btn p" onClick={() => location.reload()}>Reload</button></div></div> : this.props.children }
}

export default function App() { return <ErrorBoundary><Main /></ErrorBoundary> }

function Main() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('fn_lang') as Lang) || (navigator.language.startsWith('bn') ? 'bn' : 'en'))
  const [dark, setDark] = useState(() => { const s = localStorage.getItem('fn_dark'); return s === null ? matchMedia('(prefers-color-scheme: dark)').matches : s === '1' })
  const t: T = (k) => dict[lang][k] ?? dict.en[k] ?? k
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('fn_dark', dark ? '1' : '0') }, [dark])
  useEffect(() => { localStorage.setItem('fn_lang', lang); document.documentElement.lang = lang }, [lang])

  const [tab, setTab] = useState<Tab>('skills')
  const [folder, setFolder] = useState(db.ROOT)
  const [nodes, setNodes] = useState<db.Node[]>([])
  const [sel, setSel] = useState<string[]>([])
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [sort, setSort] = useState('name')
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [preview, setPreview] = useState<db.Node | null>(null)
  const [pick, setPick] = useState<'copy' | 'move' | null>(null)
  const [est, setEst] = useState<{ usage?: number; quota?: number }>({})

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }
  const refresh = useCallback(async () => setNodes(await db.all()), [])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { if (tab === 'home') navigator.storage?.estimate?.().then(setEst).catch(() => {}) }, [tab, nodes])

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  useEffect(() => { if (folder !== db.ROOT && nodes.length && !byId.has(folder)) setFolder(db.ROOT) }, [byId, folder, nodes.length])
  const pathStr = (id: string) => { const a: string[] = []; let c = byId.get(id); while (c) { a.unshift(c.name); c = byId.get(c.parentId) } return '/' + a.join('/') }
  const crumbs = useMemo(() => { const a: db.Node[] = []; let c = byId.get(folder); while (c) { a.unshift(c); c = byId.get(c.parentId) } return a }, [byId, folder])

  const flat = q.trim() !== '' || filter !== 'all'
  const items = useMemo(() => {
    let l = flat ? nodes : nodes.filter((n) => n.parentId === folder)
    if (q.trim()) l = l.filter((n) => n.name.toLowerCase().includes(q.trim().toLowerCase()))
    if (filter !== 'all') l = l.filter((n) => db.category(n) === filter)
    const cmp = (a: db.Node, b: db.Node) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
      switch (sort) {
        case 'size': return b.size - a.size
        case 'date': return b.modified - a.modified
        case 'type': return db.ext(a.name).localeCompare(db.ext(b.name)) || a.name.localeCompare(b.name)
        default: return a.name.localeCompare(b.name, undefined, { numeric: true })
      }
    }
    return [...l].sort(cmp)
  }, [nodes, folder, q, filter, sort, flat])

  const selNodes = sel.map((id) => byId.get(id)).filter(Boolean) as db.Node[]
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label)
    try { await fn() } catch (e: any) { toast('⚠ ' + (e?.message || e)) } finally { setBusy(''); await refresh() }
  }
  const openNode = (n: db.Node) => { if (n.kind === 'folder') { setFolder(n.id); setQ(''); setFilter('all'); setSel([]) } else setPreview(n) }
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const doImport = (arr: File[], isDir: boolean) => {
    if (!arr.length) return
    run(t('working'), async () => {
      navigator.storage?.persist?.()
      let i = 0
      for (const f of arr) {
        setBusy(`${t('working')} ${++i}/${arr.length}`)
        let pid = folder
        const rel = (f as any).webkitRelativePath as string
        if (isDir && rel) pid = await db.ensurePath(folder, rel.split('/').slice(0, -1))
        await db.addFile(pid, f.name, f)
      }
      toast(`${t('imported')}: ${arr.length}`)
    })
  }
  const newFolder = () => { const n = prompt(t('newFolder')); if (n) run(t('working'), async () => { await db.mkdir(folder, n) }) }
  const renameSel = () => { const n = selNodes[0]; const nn = n && prompt(t('rename'), n.name); if (n && nn) run(t('working'), async () => { await db.rename(n.id, nn); setSel([]) }) }
  const delSel = () => { if (confirm(t('confirmDelete'))) run(t('working'), async () => { for (const n of selNodes) await db.remove(n.id); setSel([]) }) }
  const doPick = (dest: string) => {
    const act = pick; setPick(null)
    run(t('working'), async () => { for (const n of selNodes) { act === 'copy' ? await db.copy(n.id, dest) : await db.move(n.id, dest) } setSel([]) })
  }
  const zipSel = () => run(t('working'), async () => { const b = await makeZip(selNodes.map((n) => n.id)); await db.addFile(folder, 'archive.zip', b); setSel([]) })
  const download = async (n: db.Node) => { if (!n.blob) return; if (await saveBlob(n.name, n.blob)) return; const u = URL.createObjectURL(n.blob); const a = document.createElement('a'); a.href = u; a.download = n.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 10000) }
  const share = async (n: db.Node) => {
    try { const f = new File([n.blob!], n.name, { type: n.type }); const nv = navigator as any; if (nv.canShare?.({ files: [f] })) await nv.share({ files: [f], title: n.name }); else toast(t('noShare')) }
    catch (e: any) { if (e?.name !== 'AbortError') toast('⚠ ' + e.message) }
  }
  const extract = (n: db.Node) => { setPreview(null); run(t('working'), async () => { const r = await extractZip(n, n.parentId); toast(`${t('extracted')}: ${r.extracted}` + (r.skipped ? ` (${r.skipped} ${t('skipped')})` : '')) }) }

  const files = nodes.filter((n) => n.kind === 'file')
  const measured = files.reduce((s, n) => s + n.size, 0)
  const recent = [...files].sort((a, b) => b.modified - a.modified).slice(0, 5)
  const largest = [...files].sort((a, b) => b.size - a.size).slice(0, 5)
  const topFolders = nodes.filter((n) => n.kind === 'folder' && n.parentId === db.ROOT).slice(0, 6)

  const Row = (n: db.Node) => (
    <div className="row" key={n.id}>
      <input type="checkbox" checked={sel.includes(n.id)} onChange={() => toggle(n.id)} style={{ width: 22, height: 22 }} />
      <span className="ic">{ICON[db.category(n)]}</span>
      <div className="nm" onClick={() => openNode(n)}>
        <div>{n.name}</div>
        <div className="meta">{n.kind === 'file' ? fmtSize(n.size) + ' · ' : ''}{fmtDate(n.modified)}{flat ? ' · ' + pathStr(n.parentId) : ''}</div>
      </div>
    </div>
  )

  return (
    <div className="app">
      {hasKivo() && <a className="btn" href="../index.html" style={{ marginBottom: 8, display: 'inline-block' }}>← Kivo</a>}
      <h1>🗂️ FileNest</h1>

      {tab === 'home' && <>
        <input className="in" placeholder={'🔍 ' + t('search')} value={q} onChange={(e) => { setQ(e.target.value); setTab('files') }} style={{ width: '100%', marginBottom: 12 }} />
        <div className="card">
          <h3>{t('storage')}</h3>
          <div>{t('measured')}: <b>{fmtSize(measured)}</b> · {files.length} {t('files')}</div>
          {est.usage !== undefined && <>
            <div className="bar2" style={{ margin: '8px 0' }}><i style={{ width: Math.min(100, ((est.usage || 0) / (est.quota || 1)) * 100) + '%' }} /></div>
            <div className="meta">{t('estimate')}: {fmtSize(est.usage || 0)} / {fmtSize(est.quota || 0)}</div>
            <div className="meta">{t('storageNote')}</div>
          </>}
        </div>
        <h2>{t('categories')}</h2>
        <div className="chips">{CATS.map((c) => <button key={c} className="chip" onClick={() => { setFilter(c); setQ(''); setTab('files') }}>{ICON[c]} {t(c)} ({files.filter((n) => db.category(n) === c).length})</button>)}</div>
        <h2>{t('folders')}</h2>
        <div className="chips"><button className="chip" onClick={() => { setFolder(db.ROOT); setFilter('all'); setQ(''); setTab('files') }}>📁 {t('root')}</button>
          {topFolders.map((f) => <button key={f.id} className="chip" onClick={() => { setFolder(f.id); setFilter('all'); setQ(''); setTab('files') }}>📁 {f.name}</button>)}</div>
        <h2>{t('recent')}</h2>
        <div className="card">{recent.length ? recent.map((n) => <div className="row" key={n.id}><span className="ic">{ICON[db.category(n)]}</span><div className="nm" onClick={() => setPreview(n)}>{n.name}<div className="meta">{fmtSize(n.size)} · {fmtDate(n.modified)}</div></div></div>) : <div className="meta">{t('empty')}</div>}</div>
        <h2>{t('largest')}</h2>
        <div className="card">{largest.length ? largest.map((n) => <div className="row" key={n.id}><span className="ic">{ICON[db.category(n)]}</span><div className="nm" onClick={() => setPreview(n)}>{n.name}<div className="meta">{fmtSize(n.size)}</div></div></div>) : <div className="meta">{t('empty')}</div>}</div>
      </>}

      {tab === 'files' && <>
        <div className="bar"><input className="in" placeholder={'🔍 ' + t('search')} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="bar">
          <select value={sort} onChange={(e) => setSort(e.target.value)}>{['name', 'size', 'date', 'type'].map((s) => <option key={s} value={s}>{t(s)}</option>)}</select>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>{['all', ...CATS].map((s) => <option key={s} value={s}>{t(s)}</option>)}</select>
          <button className="btn" onClick={() => setView(view === 'list' ? 'grid' : 'list')}>{view === 'list' ? '▦' : '☰'}</button>
        </div>
        <div className="bar">
          <label className="btn p">⬆ {t('importFiles')}<input hidden type="file" multiple onChange={(e) => { const a = Array.from(e.target.files || []); e.target.value = ''; doImport(a, false) }} /></label>
          <label className="btn">📂 {t('importFolder')}<input hidden type="file" multiple {...({ webkitdirectory: '' } as any)} onChange={(e) => { const a = Array.from(e.target.files || []); e.target.value = ''; doImport(a, true) }} /></label>
          <button className="btn" onClick={newFolder}>➕ {t('newFolder')}</button>
        </div>
        {!flat && <div className="crumbs"><button onClick={() => setFolder(db.ROOT)}>🏠 {t('root')}</button>{crumbs.map((c) => <span key={c.id}>/<button onClick={() => setFolder(c.id)}>{c.name}</button></span>)}</div>}
        {sel.length > 0 && <div className="bar sticky">
          <span className="meta">{sel.length} ✓</span>
          <button className="btn" onClick={() => setSel(items.map((n) => n.id))}>{t('selectAll')}</button>
          <button className="btn" onClick={() => setSel([])}>{t('selectNone')}</button>
          {sel.length === 1 && <button className="btn" onClick={renameSel}>✏️ {t('rename')}</button>}
          <button className="btn" onClick={() => setPick('copy')}>📋 {t('copy')}</button>
          <button className="btn" onClick={() => setPick('move')}>✂️ {t('move')}</button>
          <button className="btn" onClick={zipSel}>🗜️ {t('zip')}</button>
          {sel.length === 1 && selNodes[0]?.kind === 'file' && <button className="btn" onClick={() => download(selNodes[0])}>⬇ {t('download')}</button>}
          {sel.length === 1 && selNodes[0]?.kind === 'file' && <button className="btn" onClick={() => share(selNodes[0])}>📤 {t('share')}</button>}
          <button className="btn d" onClick={delSel}>🗑 {t('delete')}</button>
        </div>}
        {items.length === 0 ? <div className="card meta">{flat ? t('noResults') : t('empty')}</div> : <div className={'card ' + (view === 'grid' ? 'grid' : '')} style={{ padding: view === 'grid' ? 8 : 0 }}>{items.map(Row)}</div>}
      </>}

      {tab === 'skills' && <Skills lang={lang} t={t} onSaved={refresh} toast={toast} />}
      {tab === 'donate' && <Donate t={t} toast={toast} />}

      {tab === 'settings' && <>
        <div className="card"><h3>{t('language')}</h3><div className="chips">
          <button className={'chip ' + (lang === 'en' ? 'on' : '')} onClick={() => setLang('en')}>English</button>
          <button className={'chip ' + (lang === 'bn' ? 'on' : '')} onClick={() => setLang('bn')}>বাংলা</button></div></div>
        <div className="card"><label className="bar"><input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} style={{ width: 22, height: 22 }} /> {t('theme')}</label></div>
        <Install lang={lang} /><Backup lang={lang} toast={toast} /><div className="card"><h3>{t('privacy')}</h3><p>{t('privacyText')}</p><a className="btn" href="/privacy.html" target="_blank" rel="noreferrer">📄 {t('privacy')}</a></div>
        <div className="card"><h3>{t('about')}</h3><p>{t('aboutText')}</p><button className="btn" onClick={() => setTab('donate')}>💚 {t('donate')}</button></div>
      </>}

      <nav className="nav">{([['skills', '🎓'], ['files', '📁'], ['home', '🏠'], ['donate', '💚'], ['settings', '⚙️']] as [Tab, string][]).map(([k, i]) =>
        <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><span>{i}</span>{t(k)}</button>)}</nav>

      {preview && <Preview node={preview} t={t} path={pathStr(preview.parentId)} onClose={() => setPreview(null)} onExtract={extract} onDownload={download} onShare={share} />}
      {pick && <div className="ov" onClick={() => setPick(null)}><div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>{t('chooseDest')}</h3>
        <button className="btn opt" onClick={() => doPick(db.ROOT)}>🏠 {t('root')}</button>
        {nodes.filter((n) => n.kind === 'folder').map((f) => <button key={f.id} className="btn opt" onClick={() => doPick(f.id)}>📁 {pathStr(f.id)}</button>)}
        <button className="btn" onClick={() => setPick(null)}>{t('cancel')}</button></div></div>}
      {busy && <div className="busy">{busy}</div>}
      {msg && <div className="toast">{msg}</div>}
    </div>
  )
}

function Preview({ node, t, path, onClose, onExtract, onDownload, onShare }: { node: db.Node; t: T; path: string; onClose: () => void; onExtract: (n: db.Node) => void; onDownload: (n: db.Node) => void; onShare: (n: db.Node) => void }) {
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [entries, setEntries] = useState<{ name: string; size: number }[] | null>(null)
  const [err, setErr] = useState('')
  const cat = db.category(node), e = db.ext(node.name)
  useEffect(() => {
    if (!node.blob) return
    const u = URL.createObjectURL(node.blob); setUrl(u)
    if (db.TEXT_EXT.includes(e)) node.blob.text().then((s) => setText(s.slice(0, 100000)))
    if (e === 'zip') listZip(node.blob).then(setEntries).catch(() => setErr(t('badZip')))
    return () => URL.revokeObjectURL(u)
  }, [node.id])
  return <div className="ov" onClick={onClose}><div className="sheet" onClick={(ev) => ev.stopPropagation()}>
    <h3>{ICON[cat]} {node.name}</h3>
    <div className="meta">{t('size')}: {fmtSize(node.size)} · {t('type')}: {node.type || e} · {t('modified')}: {fmtDate(node.modified)} · {t('path')}: {path}</div>
    <div style={{ margin: '12px 0' }}>
      {cat === 'images' && url && <img src={url} alt={node.name} />}
      {cat === 'videos' && url && <video src={url} controls playsInline />}
      {cat === 'audio' && url && <audio src={url} controls style={{ width: '100%' }} />}
      {e === 'pdf' && url && <iframe src={url} title={node.name} />}
      {db.TEXT_EXT.includes(e) && <pre>{text}</pre>}
      {e === 'zip' && (err ? <div className="meta">{err}</div> : entries && <ul>{entries.slice(0, 200).map((x) => <li key={x.name}>{x.name} <span className="meta">({fmtSize(x.size)})</span></li>)}</ul>)}
    </div>
    <div className="bar">
      {e === 'zip' && !err && <button className="btn p" onClick={() => onExtract(node)}>📦 {t('extract')}</button>}
      <button className="btn" onClick={() => onDownload(node)}>⬇ {t('download')}</button>
      <button className="btn" onClick={() => onShare(node)}>📤 {t('share')}</button>
      <button className="btn" onClick={onClose}>{t('back')}</button>
    </div></div></div>
}

function Donate({ t, toast }: { t: T; toast: (m: string) => void }) {
  const methods = DONATION.methods.filter((m) => m.enabled && m.address)
  const [amt, setAmt] = useState<number | null>(null)
  const [qrErr, setQrErr] = useState(false)
  const cv = useRef<HTMLCanvasElement>(null)
  const m = methods[0]
  useEffect(() => { if (m && cv.current) QRCode.toCanvas(cv.current, m.address, { width: 200, margin: 1 }).catch(() => setQrErr(true)) }, [m?.address])
  const copy = async () => {
    try { await navigator.clipboard.writeText(m.address) }
    catch { const ta = document.createElement('textarea'); ta.value = m.address; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove() }
    toast(t('copied') + ' ✓')
  }
  return <div>
    <div className="card"><h2>💚 {t('donationTitle')}</h2><p>{t('donationMsg')}</p></div>
    {!DONATION.enabled || !m ? <div className="card">⚠ {t('notConfigured')}</div> : <div className="card">
      <h3>{m.label}</h3>
      <div className="meta">{t('donationAmount')}</div>
      <div className="chips" style={{ margin: '6px 0 12px' }}>{DONATION.suggestedAmounts.map((a) => <button key={a} className={'chip ' + (amt === a ? 'on' : '')} onClick={() => setAmt(a)}>{a} {DONATION.currency}</button>)}</div>
      {amt && <p><b>→ {amt} {DONATION.currency}</b></p>}
      <div className="meta">{t('network')}: {m.network}</div>
      <div className="meta">{t('address')}</div>
      <div className="mono">{m.address}</div>
      <div className="bar" style={{ marginTop: 8 }}><button className="btn p" onClick={copy}>📋 {t('copyBtn')}</button></div>
      <div style={{ textAlign: 'center', margin: '8px 0' }}>{qrErr ? <div className="meta">QR unavailable</div> : <canvas ref={cv} />}</div>
      <p className="meta">⚠ {m.instructions}</p>
      <p className="meta">{t('notVerified')}</p>
    </div>}
  </div>
}
