import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, SESSION_ERRORS, applyOp, call, isDemo } from './api'
import { buildCustomers, groupOrders } from './utils'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

const EMPTY = { products: [], orders: [], expenses: [] }
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
  NOT_ALLOWED: 'Your account is not allowed to do that.',
  INVALID_PHONE: 'Phone number must be 10 digits starting with 6–9.',
  ORDER_NOT_FOUND: 'That order was already removed on another phone.',
  INVALID_ORDER: 'Order is missing details.',
  INVALID_EXPENSE: 'Expense is missing details.',
}

export function StoreProvider({ children }) {
  const [auth, setAuth] = useState(() => load('drsp_auth', null)) // { session, user }
  const [server, setServer] = useState(() => load('drsp_cache', EMPTY))
  const [queue, setQueue] = useState(() => load('drsp_queue', []))
  const [online, setOnline] = useState(navigator.onLine)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState(() => load('drsp_last_sync', null))
  const [toast, setToast] = useState(null)
  const [authError, setAuthError] = useState('')
  const queueRef = useRef(queue)
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
      try {
        window.google?.accounts?.id?.disableAutoSelect()
      } catch { /* ignore */ }
      setServer(EMPTY)
      setQueue([])
      setAuth(null)
      setAuthError(reason)
    },
    [],
  )

  const handleError = useCallback(
    (err) => {
      if (err instanceof ApiError) {
        if (SESSION_ERRORS.includes(err.code)) {
          signOut(err.code === 'ACCESS_DENIED' ? 'Access Denied: Unregistered Family Account' : 'Your session expired. Please sign in again.')
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
          const { action, id, ...payload } = op
          await call(action, { session: auth.session, ...payload })
          setOnline(true)
        } catch (err) {
          const r = handleError(err)
          if (r === 'network' || r === 'session') return
        }
        queueRef.current = queueRef.current.slice(1)
        setQueue(queueRef.current)
      }
      // 2. pull the latest sheet
      const data = await call('sync', { session: auth.session })
      setOnline(true)
      setServer({ products: data.products || [], orders: data.orders || [], expenses: data.expenses || [] })
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
        if (queueRef.current.length) setTimeout(() => syncRef.current?.(), 300)
      }
    }
  }, [auth?.session, handleError])
  syncRef.current = sync

  /** Optimistic write: shows instantly, saved to the sheet in the background (or when back online). */
  const mutate = useCallback(
    (action, payload) => {
      const op = { id: crypto.randomUUID(), action, ...payload }
      queueRef.current = [...queueRef.current, op]
      setQueue(queueRef.current)
      setTimeout(sync, 0)
      return op
    },
    [sync],
  )

  const login = useCallback(async (payload) => {
    setAuthError('')
    try {
      const res = await call('login', payload)
      localStorage.removeItem('drsp_cache')
      setServer(EMPTY)
      setAuth(res)
      return true
    } catch (err) {
      try {
        window.google?.accounts?.id?.disableAutoSelect()
      } catch { /* ignore */ }
      if (err instanceof ApiError) {
        localStorage.clear()
        setAuthError(
          err.code === 'ACCESS_DENIED'
            ? 'Access Denied: Unregistered Family Account'
            : err.code === 'WRONG_CLIENT'
              ? 'Setup issue: the Client ID in Apps Script does not match config.json.'
              : `Sign-in failed (${err.code}).`,
        )
      } else setAuthError('No internet connection. Please try again.')
      return false
    }
  }, [])

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
    for (const op of queue) {
      d = applyOp(d, op, auth?.user)
      if (op.action === 'addOrder') d.orders = d.orders.map((r) => (r.Order_ID === op.order.orderId ? { ...r, _pending: true } : r))
    }
    return d
  }, [server, queue, auth?.user])

  const orders = useMemo(() => groupOrders(data.orders), [data.orders])
  const customers = useMemo(() => buildCustomers(data.orders), [data.orders])
  const activeProducts = useMemo(() => data.products.filter((p) => (p.Active_Status || 'Active') === 'Active'), [data.products])

  const value = {
    auth,
    user: auth?.user,
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
