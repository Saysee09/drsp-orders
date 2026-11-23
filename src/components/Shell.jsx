import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { ChefHat, CloudOff, Download, LogOut, RefreshCw, Undo2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { cx, Sheet, Button } from './ui'
import { resetDemo } from '../lib/api'

function timeAgo(iso) {
  if (!iso) return 'never'
  const s = Math.round((Date.now() - new Date(iso)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export function Header({ kitchen, onKitchen }) {
  const { user, online, syncing, queue, sync, lastSync, signOut, demo } = useStore()
  const [menu, setMenu] = useState(false)
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  const status = !online ? 'Offline' : syncing ? 'Syncing…' : queue.length ? `${queue.length} to save` : 'Live'
  const dot = !online ? 'bg-rose-500' : syncing || queue.length ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'

  return (
    <header className="sticky top-0 z-30 bg-slate-900 pt-safe text-white">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-3">
        <img src={import.meta.env.BASE_URL + 'icons/icon-192.png'} alt="" className="h-8 w-8 rounded-lg" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center gap-1 whitespace-nowrap text-base font-extrabold tracking-tight">
            DRSP Orders
            {demo && <span className="rounded bg-amber-400 px-1 text-[10px] font-black text-slate-900">DEMO</span>}
          </div>
          <button onClick={sync} className="flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-300">
            <span className={cx('h-2 w-2 rounded-full', dot)} />
            {status} · {timeAgo(lastSync)}
          </button>
        </div>
        <button onClick={sync} aria-label="Sync now" className="grid h-10 w-10 place-items-center rounded-xl bg-slate-800 active:bg-slate-700">
          {online ? <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} /> : <CloudOff size={18} className="text-rose-400" />}
        </button>
        <button
          onClick={onKitchen}
          aria-pressed={kitchen}
          aria-label={kitchen ? "Exit Kitchen mode" : "Kitchen mode"}
          className={cx('flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold', kitchen ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-white')}
        >
          <ChefHat size={18} />
          <span className="hidden min-[440px]:inline">{kitchen ? 'Exit Kitchen' : 'Kitchen'}</span>
        </button>
        <button onClick={() => setMenu(true)} className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-indigo-600 text-sm font-black uppercase" aria-label="Account">
          {(user?.name || '?')[0]}
        </button>
      </div>
      <Sheet open={menu} onClose={() => setMenu(false)} title="Account">
        <p className="text-lg font-bold">{user?.name}</p>
        <p className="text-sm text-slate-500">Family login: {user?.username}</p>
        <p className="mt-3 text-sm text-slate-600">
          {queue.length ? `${queue.length} change(s) waiting to save to the sheet.` : 'Everything is saved to the Google Sheet.'}
        </p>
        {demo && (
          <Button
            variant="ghost"
            className="mt-4 w-full"
            onClick={() => {
              resetDemo()
              location.reload()
            }}
          >
            Reset demo data
          </Button>
        )}
        <Button
          variant="danger"
          className="mt-3 w-full"
          onClick={() => {
            if (queue.length && !confirm(`${queue.length} change(s) are not saved yet and will be lost. Log out anyway?`)) return
            setMenu(false)
            signOut()
          }}
        >
          <LogOut size={18} /> Log out
        </Button>
      </Sheet>
    </header>
  )
}

export function BottomNav({ tabs, tab, setTab }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-safe">
      <div className="mx-auto grid max-w-3xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0,1fr))` }}>
        {tabs.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cx('relative flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold', tab === id ? 'text-indigo-600' : 'text-slate-500')}
          >
            <Icon size={22} strokeWidth={tab === id ? 2.6 : 2} />
            {label}
            {badge ? <span className="absolute right-1/2 top-2 translate-x-5 rounded-full bg-rose-600 px-1.5 text-[10px] font-bold text-white">{badge}</span> : null}
          </button>
        ))}
      </div>
    </nav>
  )
}

export function Toast() {
  const { toast, clearToast } = useStore()
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(clearToast, toast.action ? 6000 : 3500)
    return () => clearTimeout(t)
  }, [toast, clearToast])
  if (!toast) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
      <div
        className={cx(
          'pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg',
          toast.kind === 'error' ? 'bg-rose-600 text-white' : toast.kind === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white',
        )}
      >
        <span>{toast.msg}</span>
        {toast.action && (
          <button
            className="flex shrink-0 items-center gap-1 rounded-lg bg-white/20 px-3 py-1.5 font-bold"
            onClick={() => {
              toast.action.run()
              clearToast()
            }}
          >
            <Undo2 size={16} /> {toast.action.label}
          </button>
        )}
      </div>
    </div>
  )
}

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, r) {
      if (!r) return
      // check for a new build every 30 min and whenever the app comes to the front
      setInterval(() => r.update(), 30 * 60 * 1000)
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && r.update())
    },
  })
  if (!needRefresh) return null
  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] bg-indigo-600 pb-safe text-white shadow-2xl">
      <button onClick={() => updateServiceWorker(true)} className="mx-auto flex h-16 w-full max-w-3xl items-center justify-center gap-2 text-base font-bold">
        <Download size={20} /> App Update Available — Tap to Install Now
      </button>
    </div>
  )
}
