import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, SESSION_ERRORS, applyOp, applySettings, call, isDemo } from './api'
import { buildCustomers, groupOrders } from './utils'
import { mergeTemplates } from './templates'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

const EMPTY = { products: [], orders: [], expenses: [], templates: [], files: {}, campaigns: [], settings: {} }
const load = (k, fallback) => {
  try {
    const v = JSON.parse(localStorage.getItem(k) || 'null')
    return v ?? fallback
  } catch {
    return fallback
  }
}
const save = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch { /* quota / private mode */ }
}

const ERROR_TEXT = {
  INVALID_TEMPLATE: 'Message needs a name and some text.',
  INVALID_PHONE: 'Phone number must be 10 digits starting with 6–9.',
  ORDER_NOT_FOUND: 'That order was already removed on another phone.',
  INVALID_ORDER: 'Order is missing details.',
  INVALID_EXPENSE: 'Expense is missing details.',
}

export function StoreProvider({ children }) {
  const [auth, setAuth] = useState(() => load('drsp_auth', null)) // { session, user: { username } }
  const [deviceName, setDeviceNameState] = useState(() => localStorage.getItem('drsp_device_name') || '')
  const [server, setServer] = useState(() => load('drsp_cache', EMPTY))
  const [queue, setQueue] = useState(() => load('drsp_queue', []))
  const [online, setOnline] = useState(navigator.onLine)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState(() => load('drsp_last_sync', null))
  const [toast, setToast] = useState(null)
  const [authError, setAuthError] = useState('')
  const queueRef = useRef(queue)
  // Writes already saved but not yet seen in a fresh pull of the sheet. Keeping them
  // on screen until the next pull stops buttons "jumping back" for a moment.
  const [confirmed, setConfirmed] = useState([])
  const confirmedRef = useRef([])
  const busy = useRef(false)
  const again = useRef(false)
  const syncRef = useRef(null)
  const authRef = useRef(auth)
  authRef.current = auth

  useEffect(() => {
    save('drsp_auth', auth)
  }, [auth])
  useEffect(() => {
    save('drsp_cache', server)
  }, [server])
  useEffect(() => {
    queueRef.current = queue
    save('drsp_queue', queue)
  }, [queue])

  const notify = useCallback((msg, kind = 'info', action) => {
    setToast({ msg, kind, action, id: Date.now() })
  }, [])

  const signOut = useCallback(
    async (reason = '') => {
      const s = authRef.current?.session
      if (s) call('logout', { session: s }).catch(() => {})
      localStorage.removeItem('drsp_auth')
      localStorage.removeItem('drsp_cache')
      localStorage.removeItem('drsp_queue')
      localStorage.removeItem('drsp_last_sync')
      setServer(EMPTY)
      setQueue([])
      confirmedRef.current = []
      setConfirmed([])
      setAuth(null)
      setAuthError(reason)
    },
    [],
  )

  const handleError = useCallback(
    (err) => {
      if (err instanceof ApiError) {
        if (SESSION_ERRORS.includes(err.code)) {
          signOut('You were signed out (password changed or login expired). Please log in again.')
          return 'session'
        }
        notify(ERROR_TEXT[err.code] || `Sheet error: ${err.code}`, 'error')
        return 'rejected'
      }
      setOnline(false)
      return 'network'
    },
    [notify, signOut],
  )

  const sync = useCallback(async () => {
    if (!auth?.session) return
    if (busy.current) {
      again.current = true
      return
    }
    busy.current = true
    setSyncing(true)
    try {
      // 1. flush queued writes in order
      while (queueRef.current.length) {
        const op = queueRef.current[0]
        try {
          const { action, _opId, ...payload } = op
          await call(action, { session: auth.session, ...payload })
          setOnline(true)
        } catch (err) {
          const r = handleError(err)
          if (r === 'network' || r === 'session') return
        }
        confirmedRef.current = [...confirmedRef.current, op]
        setConfirmed(confirmedRef.current)
        queueRef.current = queueRef.current.slice(1)
        setQueue(queueRef.current)
      }
      // 2. pull the latest sheet (skip if the user tapped something meanwhile; it'll run again)
      const pulledAfter = confirmedRef.current.length
      const data = await call('sync', { session: auth.session })
      if (queueRef.current.length) {
        again.current = true
        return
      }
      setOnline(true)
      setServer({ products: data.products || [], orders: data.orders || [], expenses: data.expenses || [], templates: data.templates || [], files: data.files || {}, campaigns: data.campaigns || [], settings: data.settings || {} })
      confirmedRef.current = confirmedRef.current.slice(pulledAfter)
      setConfirmed(confirmedRef.current)
      if (data.user)
        setAuth((a) => {
          if (!a) return a
          const u = { ...a.user, ...data.user }
          return JSON.stringify(u) === JSON.stringify(a.user) ? a : { ...a, user: u }
        })
      const ts = new Date().toISOString()
      setLastSync(ts)
      save('drsp_last_sync', ts)
    } catch (err) {
      handleError(err)
    } finally {
      busy.current = false
      setSyncing(false)
      if (again.current) {
        again.current = false
        setTimeout(() => syncRef.current?.(), 300)
      }
    }
  }, [auth?.session, handleError])
  syncRef.current = sync

  /** Optimistic write: shows instantly, saved to the sheet in the background (or when back online). */
  const mutate = useCallback(
    (action, payload) => {
      const name = localStorage.getItem('drsp_device_name') || ''
      if (action === 'addOrder' && payload.order && !payload.order.leadBy) payload = { ...payload, order: { ...payload.order, leadBy: name } }
      if (action === 'addExpense' && payload.expense && !payload.expense.leadBy) payload = { ...payload, expense: { ...payload.expense, leadBy: name } }
      const op = { _opId: crypto.randomUUID(), action, ...payload }
      queueRef.current = [...queueRef.current, op]
      setQueue(queueRef.current)
      setTimeout(sync, 0)
      return op
    },
    [sync],
  )

  const login = useCallback(async ({ username, password, name }) => {
    setAuthError('')
    try {
      const res = await call('login', { username: String(username).trim(), password })
      localStorage.removeItem('drsp_cache')
      setServer(EMPTY)
      if (name !== undefined) setDeviceName(name)
      setAuth(res)
      return true
    } catch (err) {
      if (err instanceof ApiError)
        setAuthError(
          err.code === 'WRONG_LOGIN'
            ? 'Wrong username or password.'
            : err.code === 'LOCKED'
              ? 'Too many wrong tries. Please wait 15 minutes and try again.'
              : `Login failed (${err.code}).`,
        )
      else setAuthError('No internet connection. Please try again.')
      return false
    }
  }, [])

  const setDeviceName = useCallback((n) => {
    const v = String(n || '').trim().slice(0, 30)
    localStorage.setItem('drsp_device_name', v)
    setDeviceNameState(v)
  }, [])

  /** For actions that must reach the sheet right now (e.g. changing the password). */
  const callNow = useCallback((action, payload = {}) => call(action, { session: authRef.current?.session, ...payload }), [])

  // first load + polling + reconnect
  useEffect(() => {
    if (!auth?.session) return
    sync()
    const t = setInterval(() => document.visibilityState === 'visible' && sync(), 30000)
    const onVis = () => document.visibilityState === 'visible' && sync()
    const onOnline = () => {
      setOnline(true)
      sync()
    }
    const onOffline = () => setOnline(false)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [auth?.session, sync])

  // local view = server snapshot + writes not yet confirmed
  const data = useMemo(() => {
    let d = server
    for (const op of confirmed) d = applyOp(d, op)
    for (const op of queue) {
      d = applyOp(d, op)
      if (op.action === 'addOrder') d.orders = d.orders.map((r) => (r.Order_ID === op.order.orderId ? { ...r, _pending: true } : r))
    }
    return d
  }, [server, queue, confirmed])

  const orders = useMemo(() => groupOrders(data.orders), [data.orders])
  const customers = useMemo(() => buildCustomers(data.orders), [data.orders])
  const activeProducts = useMemo(() => data.products.filter((p) => (p.Active_Status || 'Active') === 'Active'), [data.products])
  const templates = useMemo(() => mergeTemplates(data.templates), [data.templates])
  applySettings(server.settings) // business details from the sheet (used by getConfig)
  const user = auth ? { username: auth.user?.username || '', name: deviceName || auth.user?.username || '' } : null

  /** After an upload: show the new file at once (next sync confirms it). */
  const setFileMeta = useCallback((kind, meta) => {
    setServer((s) => {
      const files = { ...(s.files || {}) }
      if (meta) files[kind] = meta
      else delete files[kind]
      return { ...s, files }
    })
  }, [])

  const value = {
    files: data.files || {},
    campaigns: data.campaigns || [],
    settings: server.settings || {},
    setSettings: (s) => setServer((x) => ({ ...x, settings: s })),
    setFileMeta,
    auth,
    user,
    deviceName,
    setDeviceName,
    callNow,
    templates,
    demo: isDemo(),
    data,
    orders,
    customers,
    activeProducts,
    queue,
    online,
    syncing,
    lastSync,
    sync,
    mutate,
    login,
    signOut,
    authError,
    toast,
    notify,
    clearToast: () => setToast(null),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
