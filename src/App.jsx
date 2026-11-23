import { useEffect, useState } from 'react'
import { ClipboardList, IndianRupee, Menu, PlusCircle, Send as SendIcon } from 'lucide-react'
import { useStore } from './lib/store'
import { BottomNav, Header, Toast, UpdatePrompt } from './components/Shell'
import Login from './screens/Login'
import NewOrder from './screens/NewOrder'
import Orders from './screens/Orders'
import Kitchen from './screens/Kitchen'
import Send from './screens/Send'
import Money from './screens/Money'
import More from './screens/More'

const TABS = [
  { id: 'new', label: 'New order', icon: PlusCircle, C: NewOrder },
  { id: 'orders', label: 'Orders', icon: ClipboardList, C: Orders },
  { id: 'send', label: 'Send', icon: SendIcon, C: Send },
  { id: 'money', label: 'Money', icon: IndianRupee, C: Money },
  { id: 'more', label: 'More', icon: Menu, C: More },
]

export default function App() {
  const { auth, orders } = useStore()
  const [tab, setTab] = useState(() => {
    const t = localStorage.getItem('drsp_tab')
    return TABS.some((x) => x.id === t) ? t : 'new'
  })
  // Kitchen Mode is remembered per phone (turn it on once on Amma's phone)
  const [kitchen, setKitchen] = useState(() => localStorage.getItem('drsp_kitchen') === '1')

  useEffect(() => {
    localStorage.setItem('drsp_tab', tab)
  }, [tab])
  useEffect(() => {
    localStorage.setItem('drsp_kitchen', kitchen ? '1' : '0')
  }, [kitchen])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab, kitchen])

  if (!auth) return <Login />

  const open = orders.filter((o) => o.delivery !== 'Delivered').length
  const navTabs = TABS.map((t) => (t.id === 'orders' ? { ...t, badge: open || null } : t))
  const Current = (TABS.find((t) => t.id === tab) || TABS[0]).C

  return (
    <div className={kitchen ? 'min-h-full bg-amber-50' : 'min-h-full bg-slate-100'}>
      <Header kitchen={kitchen} onKitchen={() => setKitchen(!kitchen)} />
      <main className={kitchen ? 'mx-auto max-w-3xl px-4 pb-16 pt-4' : 'mx-auto max-w-3xl px-4 pb-28 pt-4'}>
        {kitchen ? <Kitchen /> : <Current />}
      </main>
      {!kitchen && <BottomNav tabs={navTabs} tab={tab} setTab={setTab} />}
      <Toast />
      <UpdatePrompt />
    </div>
  )
}
