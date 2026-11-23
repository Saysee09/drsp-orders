import { useMemo, useState } from 'react'
import { CalendarClock, ClipboardList, CloudUpload, IndianRupee, MapPin, MoreVertical, Phone, Search, Star, StickyNote, Trash2, Truck } from 'lucide-react'
import { useStore } from '../lib/store'
import { PAY, STAGES, inr, needsFeedback, prettyDate, stageOf, todayStr } from '../lib/utils'
import { Badge, Button, Card, Empty, PAY_COLORS, Pill, Segmented, Sheet, cx } from '../components/ui'
import { MessageButton, MessageSheet } from '../components/Messages'

const FILTERS = [
  ['active', 'Not delivered', (o) => o.delivery !== 'Delivered'],
  ['make', 'To make', (o) => o.prep !== 'Packed'],
  ['ready', 'Packed', (o) => stageOf(o) === 'packed'],
  ['way', 'On the way', (o) => o.delivery === 'Out for Delivery'],
  ['unpaid', 'Unpaid', (o) => o.payment === 'Unpaid'],
  ['feedback', 'Ask feedback', (o) => needsFeedback(o)],
  ['all', 'All', () => true],
]

const STAGE_COLORS = {
  new: 'bg-amber-500 text-slate-950',
  making: 'bg-orange-600 text-white',
  packed: 'bg-emerald-600 text-white',
  way: 'bg-indigo-600 text-white',
  done: 'bg-slate-900 text-white',
}

/** One row of steps: New → Making → Packed → On the way → Delivered. */
export function StageBar({ o }) {
  const { mutate, notify } = useStore()
  const cur = stageOf(o)
  const curIdx = STAGES.findIndex((s) => s.id === cur)
  const go = (s) => {
    if (s.id === cur) return
    const prev = { Prep_Status: o.prep, Delivery_Status: o.delivery }
    mutate('updateOrder', { orderId: o.orderId, fields: { Prep_Status: s.prep, Delivery_Status: s.delivery } })
    notify(`${o.customerName}: ${s.label}`, 'info', { label: 'Undo', run: () => mutate('updateOrder', { orderId: o.orderId, fields: prev }) })
  }
  return (
    <div className="grid grid-cols-5 gap-1 rounded-xl bg-slate-100 p-1">
      {STAGES.map((s, i) => (
        <button
          key={s.id}
          type="button"
          onClick={() => go(s)}
          className={cx(
            'flex h-12 items-center justify-center rounded-lg px-0.5 text-center text-[13px] font-bold leading-tight transition',
            s.id === cur ? STAGE_COLORS[s.id] : i < curIdx ? 'text-slate-400 line-through decoration-2' : 'text-slate-600 active:bg-slate-200',
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}

/** Opens the payment-request message (UPI). */
export function PayButton({ o, className, size }) {
  const [open, setOpen] = useState(false)
  if (o.payment !== 'Unpaid') return null
  return (
    <>
      <Button variant="primary" size={size} className={className} onClick={() => setOpen(true)}>
        <IndianRupee size={18} /> Ask {inr(o.total)}
      </Button>
      <MessageSheet open={open} onClose={() => setOpen(false)} order={o} suggested="payment" />
    </>
  )
}

/** Opens the feedback message; marks the order so it is not asked twice. */
export function FeedbackButton({ o, className, size }) {
  const [open, setOpen] = useState(false)
  if (!needsFeedback(o)) return null
  return (
    <>
      <Button variant="amber" size={size} className={className} onClick={() => setOpen(true)}>
        <Star size={18} /> Ask feedback
      </Button>
      <MessageSheet open={open} onClose={() => setOpen(false)} order={o} suggested="feedback" />
    </>
  )
}

/** The message that fits where the order is right now. */
const suggestFor = (o) => {
  const st = stageOf(o)
  if (st === 'way') return 'on_the_way'
  if (st === 'done') return needsFeedback(o) ? 'feedback' : 'delivered'
  return 'order_confirm'
}

export function OrderCard({ o }) {
  const { mutate, notify } = useStore()
  const [menu, setMenu] = useState(false)
  const [msg, setMsg] = useState(false)
  const setPay = (v) => {
    const prev = o.payment
    mutate('updateOrder', { orderId: o.orderId, fields: { Payment_Status: v } })
    notify(`${o.customerName}: ${v === 'Unpaid' ? 'Unpaid' : 'Paid ' + v}`, 'info', { label: 'Undo', run: () => mutate('updateOrder', { orderId: o.orderId, fields: { Payment_Status: prev } }) })
  }
  const overdue = o.dueDate && o.dueDate < todayStr() && o.delivery !== 'Delivered'
  const onTheWay = o.delivery === 'Out for Delivery'

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-2 p-4 pb-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <span className="font-mono font-semibold">{o.orderId}</span>
            <span>· {prettyDate(o.date)}</span>
            {o.leadBy && <span>· by {o.leadBy}</span>}
            {o.pending && (
              <Badge className="bg-amber-100 text-amber-800">
                <CloudUpload size={12} className="mr-1" />
                saving
              </Badge>
            )}
          </div>
          <div className="mt-0.5 truncate text-lg font-extrabold text-slate-900">{o.customerName}</div>
          <a href={`tel:+91${o.phone}`} className="text-sm font-semibold text-indigo-700">
            +91 {o.phone.replace(/(\d{5})(\d{5})/, '$1 $2')}
          </a>
        </div>
        <div className="text-right">
          <div className="text-xl font-black text-slate-900">{inr(o.total)}</div>
          {o.dueDate && o.delivery !== 'Delivered' && (
            <Badge className={cx('mt-1', overdue ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700')}>
              <CalendarClock size={12} className="mr-1" />
              {prettyDate(o.dueDate)}
            </Badge>
          )}
        </div>
      </div>

      <ul className="space-y-0.5 px-4 text-sm text-slate-700">
        {o.items.map((i, n) => (
          <li key={n} className="flex justify-between gap-2">
            <span>
              <b className="text-slate-900">{i.qty} ×</b> {i.name}
            </span>
            <span className="text-slate-500">{inr(i.sold)}</span>
          </li>
        ))}
        {o.deliveryCharge > 0 && (
          <li className="flex justify-between text-slate-500">
            <span>Delivery</span>
            <span>{inr(o.deliveryCharge)}</span>
          </li>
        )}
      </ul>
      {(o.notes || o.address) && (
        <div className="mt-2 space-y-1 px-4 text-sm">
          {o.notes && (
            <div className="flex gap-1.5 rounded-lg bg-amber-50 px-2 py-1 font-medium text-amber-900">
              <StickyNote size={16} className="mt-0.5 shrink-0" />
              {o.notes}
            </div>
          )}
          {o.address && (
            <div className="flex gap-1.5 text-slate-500">
              <MapPin size={16} className="mt-0.5 shrink-0" />
              {o.address}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 space-y-2 bg-slate-50 p-3">
        <StageBar o={o} />
        <Segmented options={PAY} value={o.payment} colors={PAY_COLORS} labels={{ Unpaid: 'Unpaid', UPI: 'Paid UPI', Cash: 'Paid cash' }} onChange={setPay} />
        {onTheWay && (
          <Button variant="dark" className="w-full" onClick={() => setMsg(true)}>
            <Truck size={18} /> Tell customer it’s on the way
          </Button>
        )}
        {(o.payment === 'Unpaid' || needsFeedback(o)) && (
          <div className="flex gap-2">
            <PayButton o={o} className="flex-1" />
            <FeedbackButton o={o} className="flex-1" />
          </div>
        )}
        {o.delivery === 'Delivered' && o.feedbackSent && <p className="text-xs font-semibold text-emerald-700">✓ Feedback asked</p>}
        <div className="flex gap-2">
          <MessageButton order={o} suggested={suggestFor(o)} className="flex-1" label="WhatsApp" />
          <a href={`tel:+91${o.phone}`}>
            <Button variant="outline" aria-label="Call">
              <Phone size={18} />
            </Button>
          </a>
          <Button variant="outline" aria-label="More" onClick={() => setMenu(true)}>
            <MoreVertical size={18} />
          </Button>
        </div>
      </div>
      <MessageSheet open={msg} onClose={() => setMsg(false)} order={o} suggested="on_the_way" />

      <Sheet open={menu} onClose={() => setMenu(false)} title={o.orderId}>
        <p className="mb-4 text-sm text-slate-600">Delete only for mistakes or cancelled orders. It removes this order from the Google Sheet.</p>
        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            if (!confirm(`Delete order ${o.orderId} for ${o.customerName}?`)) return
            mutate('deleteOrder', { orderId: o.orderId })
            setMenu(false)
            notify('Order deleted')
          }}
        >
          <Trash2 size={18} /> Delete order
        </Button>
      </Sheet>
    </Card>
  )
}

export default function Orders() {
  const { orders } = useStore()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('active')
  const [limit, setLimit] = useState(30)

  const counts = useMemo(() => Object.fromEntries(FILTERS.map(([id, , fn]) => [id, orders.filter(fn).length])), [orders])
  const list = useMemo(() => {
    const fn = FILTERS.find((x) => x[0] === filter)[2]
    const s = q.trim().toLowerCase()
    return orders.filter(fn).filter((o) => !s || o.customerName.toLowerCase().includes(s) || o.phone.includes(s) || o.orderId.toLowerCase().includes(s))
  }, [orders, filter, q])

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-black text-slate-900">Orders</h1>
      <div className="flex items-center gap-2 rounded-xl bg-white px-3 ring-1 ring-slate-300 focus-within:ring-2 focus-within:ring-indigo-600">
        <Search size={18} className="text-slate-400" />
        <input className="h-12 w-full bg-transparent outline-none" placeholder="Search name, phone or order ID" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {FILTERS.map(([id, label]) => (
          <Pill key={id} active={filter === id} onClick={() => setFilter(id)}>
            {label} <span className="ml-1 opacity-60">{counts[id]}</span>
          </Pill>
        ))}
      </div>
      {list.length === 0 ? (
        <Empty icon={ClipboardList} title="No orders here">
          {q ? 'Try a different search.' : 'New orders will show up here.'}
        </Empty>
      ) : (
        <>
          {list.slice(0, limit).map((o) => (
            <OrderCard key={o.orderId} o={o} />
          ))}
          {list.length > limit && (
            <Button variant="ghost" className="w-full" onClick={() => setLimit((l) => l + 30)}>
              Show more ({list.length - limit} left)
            </Button>
          )}
        </>
      )}
    </div>
  )
}
