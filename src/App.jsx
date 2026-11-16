import { useEffect, useMemo, useState } from 'react'
import { BarChart3, ClipboardList, PlusCircle, Settings2, Wallet } from 'lucide-react'
import { useStore } from './lib/store'
import { BottomNav, Header, Toast, UpdatePrompt } from './components/Shell'
import Login from './screens/Login'
import NewOrder from './screens/NewOrder'
import Orders from './screens/Orders'
import Kitchen from './screens/Kitchen'
import Expenses from './screens/Expenses'
import Admin from './screens/Admin'
import Dashboard from './screens/Dashboard'

const ALL_TABS = [
  { id: 'new', label: 'New', icon: PlusCircle, roles: ['Admin', 'Ops', 'Kitchen'], C: NewOrder },
  { id: 'orders', label: 'Orders', icon: ClipboardList, roles: ['Admin', 'Ops', 'Kitchen', 'Helper'], C: Orders },
  { id: 'expenses', label: 'Expenses', icon: Wallet, roles: ['Admin', 'Ops'], C: Expenses },
  { id: 'stats', label: 'Profit', icon: BarChart3, roles: ['Admin', 'Ops'], C: Dashboard },
  { id: 'admin', label: 'Catalog', icon: Settings2, roles: ['Admin'], C: Admin },
]

export default function App() {
  const { auth, user, orders } = useStore()
  const role = user?.role || 'Helper'
  const tabs = useMemo(() => ALL_TABS.filter((t) => t.roles.includes(role)), [role])
  const [tab, setTab] = useState(() => localStorage.getItem('drsp_tab') || 'new')
  const [kitchen, setKitchen] = useState(() => {
    const v = localStorage.getItem('drsp_kitchen')
    return v === null ? null : v === '1'
  })
  const kitchenOn = kitchen ?? role === 'Kitchen' // Mother starts in Kitchen mode by default

  useEffect(() => {
    localStorage.setItem('drsp_tab', tab)
  }, [tab])
  useEffect(() => {
    if (kitchen !== null) localStorage.setItem('drsp_kitchen', kitchen ? '1' : '0')
  }, [kitchen])
  useEffect(() => {
    if (user && tabs.length && !tabs.some((t) => t.id === tab)) setTab(tabs[0].id)
  }, [user, tabs, tab])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab, kitchenOn])

  if (!auth) return <Login />

  const open = orders.filter((o) => o.prep !== 'Packed').length
  const navTabs = tabs.map((t) => (t.id === 'orders' ? { ...t, badge: open || null } : t))
  const Current = (tabs.find((t) => t.id === tab) || tabs[0]).C

  return (
    <div className={kitchenOn ? 'min-h-full bg-amber-50' : 'min-h-full bg-slate-100'}>
      <Header kitchen={kitchenOn} onKitchen={() => setKitchen(!kitchenOn)} />
      <main className={kitchenOn ? 'mx-auto max-w-3xl px-4 pb-16 pt-4' : 'mx-auto max-w-3xl px-4 pb-28 pt-4'}>
        {kitchenOn ? <Kitchen /> : <Current />}
      </main>
      {!kitchenOn && <BottomNav tabs={navTabs} tab={tab} setTab={setTab} />}
      <Toast />
      <UpdatePrompt />
    </div>
  )
}
