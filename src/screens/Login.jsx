import { useState } from 'react'
import { Eye, EyeOff, Loader2, LogIn, ShieldAlert } from 'lucide-react'
import { useStore } from '../lib/store'
import { DEMO_LOGIN, getConfig, isDemo } from '../lib/api'

const field =
  'h-14 w-full rounded-2xl bg-slate-800 px-4 text-lg font-semibold text-white outline-none ring-1 ring-slate-700 placeholder:text-slate-500 focus:ring-2 focus:ring-amber-400'

export default function Login() {
  const { login, authError, deviceName } = useStore()
  const demo = isDemo()
  const cfg = getConfig()
  const [username, setUsername] = useState(() => localStorage.getItem('drsp_last_username') || (demo ? DEMO_LOGIN.username : ''))
  const [password, setPassword] = useState('')
  const [name, setName] = useState(deviceName)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    setBusy(true)
    localStorage.setItem('drsp_last_username', username.trim())
    await login({ username, password, name })
    setBusy(false)
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-slate-900 px-6 py-10 text-white">
      <img src={import.meta.env.BASE_URL + 'icons/icon-512.png'} alt="" className="h-24 w-24 rounded-3xl shadow-xl" />
      <h1 className="mt-5 text-3xl font-black tracking-tight">DRSP Orders</h1>
      <p className="mt-1 text-slate-400">{cfg.businessName || 'Homemade pickles'}</p>

      <form onSubmit={submit} className="mt-8 w-full max-w-sm space-y-3">
        {authError && (
          <div className="flex items-start gap-3 rounded-2xl bg-rose-600 p-4 text-sm font-semibold">
            <ShieldAlert className="shrink-0" size={20} />
            <span>{authError}</span>
          </div>
        )}
        {demo && (
          <p className="rounded-xl bg-amber-400/15 p-3 text-center text-sm text-amber-200">
            Demo mode — sample data stays on this phone. Log in with <b>{DEMO_LOGIN.username}</b> / <b>{DEMO_LOGIN.password}</b>.
          </p>
        )}
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-300">Username</span>
          <input className={field} autoCapitalize="none" autoCorrect="off" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-300">Password</span>
          <div className="relative">
            <input
              className={field + ' pr-14'}
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-xl text-slate-400" aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-300">Who uses this phone? (optional)</span>
          <input className={field} placeholder="e.g. Sasi" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
          <span className="mt-1 block text-xs text-slate-500">Shown on orders as “taken by”. Change it any time in More.</span>
        </label>
        <button
          type="submit"
          disabled={busy || !username.trim() || !password}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 text-lg font-black text-slate-950 active:bg-amber-500 disabled:opacity-50"
        >
          {busy ? <Loader2 className="animate-spin" size={22} /> : <LogIn size={22} />}
          {busy ? 'Checking…' : 'Log in'}
        </button>
        <p className="text-center text-xs text-slate-500">One family login. You stay logged in on this phone for 90 days.</p>
      </form>
    </div>
  )
}
