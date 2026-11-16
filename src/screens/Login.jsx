import { useEffect, useRef, useState } from 'react'
import { ShieldAlert, Loader2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { DEMO_USERS, getConfig, isDemo } from '../lib/api'

function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
}

export default function Login() {
  const { login, authError } = useStore()
  const btn = useRef(null)
  const [busy, setBusy] = useState(false)
  const [gisError, setGisError] = useState('')
  const demo = isDemo()
  const cfg = getConfig()

  useEffect(() => {
    if (demo) return
    if (!cfg.googleClientId) {
      setGisError('googleClientId is missing in config.json')
      return
    }
    loadGis()
      .then(() => {
        window.google.accounts.id.initialize({
          client_id: cfg.googleClientId,
          auto_select: !authError,
          callback: async (resp) => {
            setBusy(true)
            await login({ idToken: resp.credential })
            setBusy(false)
          },
        })
        window.google.accounts.id.renderButton(btn.current, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', width: 280 })
        if (!authError) window.google.accounts.id.prompt()
      })
      .catch(() => setGisError('Could not load Google Sign-In. Check your internet connection.'))
  }, [demo, cfg.googleClientId, login, authError])

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-slate-900 px-6 py-10 text-white">
      <img src={import.meta.env.BASE_URL + 'icons/icon-512.png'} alt="" className="h-24 w-24 rounded-3xl shadow-xl" />
      <h1 className="mt-5 text-3xl font-black tracking-tight">DRSP Orders</h1>
      <p className="mt-1 text-slate-400">{cfg.businessName || 'Family pickle business'}</p>

      {authError && (
        <div className="mt-8 flex max-w-sm items-start gap-3 rounded-2xl bg-rose-600 p-4 text-sm font-semibold">
          <ShieldAlert className="shrink-0" size={20} />
          <span>{authError}</span>
        </div>
      )}

      {demo ? (
        <div className="mt-8 w-full max-w-sm">
          <p className="mb-3 rounded-xl bg-amber-400/15 p-3 text-center text-sm text-amber-200">
            Demo mode — sample data stays on this device. Connect the Google Sheet in <code className="font-mono">config.json</code> to go live.
          </p>
          <div className="grid gap-2">
            {DEMO_USERS.map((u) => (
              <button
                key={u.email}
                onClick={() => login({ demoUser: u })}
                className="flex h-14 items-center justify-between rounded-2xl bg-slate-800 px-5 text-left font-bold active:bg-slate-700"
              >
                <span>Continue as {u.name}</span>
                <span className="text-sm font-medium text-slate-400">{u.role}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-10 flex flex-col items-center gap-4">
          {busy && (
            <div className="flex items-center gap-2 text-slate-300">
              <Loader2 className="animate-spin" size={20} /> Checking family access…
            </div>
          )}
          <div ref={btn} className={busy ? 'hidden' : 'min-h-11'} />
          {gisError && <p className="max-w-xs text-center text-sm text-rose-300">{gisError}</p>}
          <p className="max-w-xs text-center text-xs text-slate-500">Only registered family Google accounts can sign in.</p>
        </div>
      )}
    </div>
  )
}
