import { useEffect, useState } from 'react'

const TXT = {
  en: { title: 'Install FileNest', hint: 'Chrome menu (⋮) > Install app. On iPhone: Share > Add to Home Screen.', btn: 'Install app' },
  bn: { title: 'FileNest ইনস্টল করুন', hint: 'Chrome মেনু (⋮) > Install app। আইফোনে: Share > Add to Home Screen।', btn: 'অ্যাপ ইনস্টল করুন' },
}

export default function Install({ lang }: { lang: 'en' | 'bn' }) {
  const [ev, setEv] = useState<any>(null)
  const [ok, setOk] = useState(false)
  useEffect(() => {
    const a = (e: any) => { e.preventDefault(); setEv(e) }
    const b = () => setOk(true)
    window.addEventListener('beforeinstallprompt', a)
    window.addEventListener('appinstalled', b)
    return () => { window.removeEventListener('beforeinstallprompt', a); window.removeEventListener('appinstalled', b) }
  }, [])
  if (ok || matchMedia('(display-mode: standalone)').matches) return null
  const x = TXT[lang]
  return <div className="card">
    <h3>📲 {x.title}</h3>
    <p className="meta">{x.hint}</p>
    {ev && <button className="btn p" onClick={async () => { try { ev.prompt(); await ev.userChoice } catch { /* ignore */ } setEv(null) }}>{x.btn}</button>}
  </div>
}
