import { useMemo, useState } from 'react'
import { CalendarClock, ClipboardList, CloudUpload, IndianRupee, MapPin, MessageCircle, MoreVertical, Phone, Search, Star, StickyNote, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { getConfig } from '../lib/api'
import { DELIVERY, PAY, PREP, feedbackText, inr, isValidUpi, needsFeedback, paymentText, prettyDate, receiptText, todayStr, waLink } from '../lib/utils'
import { Badge, Button, Card, DEL_COLORS, Empty, PAY_COLORS, PREP_COLORS, Pill, Segmented, Sheet, cx } from '../components/ui'

const FILTERS = [
  ['all', 'All', () => true],
  ['prep', 'Pending Prep', (o) => o.prep !== 'Packed'],
  ['unpaid', 'Unpaid', (o) => o.payment === 'Unpaid'],
  ['ready', 'Ready for Delivery', (o) => o.prep === 'Packed' && o.delivery === 'Pending'],
  ['due', 'Due ≤ Today', (o) => o.dueDate && o.dueDate <= todayStr() && o.delivery !== 'Delivered'],
  ['feedback', 'Ask Feedback', (o) => needsFeedback(o)],
]

/** WhatsApp payment request with the UPI ID and a tap-to-pay link. */
export function PayButton({ o, className, size }) {
  const { notify } = useStore()
  const cfg = getConfig()
  if (o.payment !== 'Unpaid') return null
  if (!isValidUpi(cfg.upiId))
    return (
      <Button variant="primary" size={size} className={className} onClick={() => notify('Add your UPI ID as "upiId" in config.json first', 'error')}>
        <IndianRupee size={18} /> Request UPI Payment
      </Button>
    )
  return (
    <a href={waLink(o.phone, paymentText(o, cfg))} target="_blank" rel="noreferrer" className={className}>
      <Button variant="primary" size={size} className="w-full">
        <IndianRupee size={18} /> Request {inr(o.total)} via UPI
      </Button>
    </a>
  )
}

/** Opens WhatsApp with the feedback message and marks the order so it is not asked twice. */
export function FeedbackButton({ o, className, size }) {
  const { mutate } = useStore()
  if (!needsFeedback(o)) return null
  return (
    <a
      href={waLink(o.phone, feedbackText(o, getConfig()))}
      target="_blank"
      rel="noreferrer"
      className={className}
      onClick={() => mutate('updateOrder', { orderId: o.orderId, fields: { Feedback_Sent: 'Yes' } })}
    >
      <Button variant="amber" size={size} className="w-full">
        <Star size={18} /> Ask for Feedback
      </Button>
    </a>
  )
}

export function OrderCard({ o }) {
  const { mutate, user, notify } = useStore()
  const [menu, setMenu] = useState(false)
  const biz = getConfig().businessName
  const canDelete = ['Admin', 'Ops'].includes(user?.role)

  const set = (field, value, prev) => {
    mutate('updateOrder', { orderId: o.orderId, fields: { [field]: value } })
    notify(`${o.customerName}: ${value}`, 'info', { label: 'Undo', run: () => mutate('updateOrder', { orderId: o.orderId, fields: { [field]: prev } }) })
  }
  const overdue = o.dueDate && o.dueDate < todayStr() && o.delivery !== 'Delivered'

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
          {o.dueDate && (
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
        <Row label="Prep">
          <Segmented options={PREP} value={o.prep} colors={PREP_COLORS} onChange={(v) => set('Prep_Status', v, o.prep)} />
        </Row>
        <Row label="Payment">
          <Segmented options={PAY} value={o.payment} colors={PAY_COLORS} labels={{ UPI: 'UPI' }} onChange={(v) => set('Payment_Status', v, o.payment)} />
        </Row>
        <Row label="Delivery">
          <Segmented options={DELIVERY} value={o.delivery} colors={DEL_COLORS} onChange={(v) => set('Delivery_Status', v, o.delivery)} />
        </Row>
        {(o.payment === 'Unpaid' || needsFeedback(o)) && (
          <div className="flex gap-2 pt-1">
            <PayButton o={o} className="flex-1" />
            <FeedbackButton o={o} className="flex-1" />
          </div>
        )}
        {o.delivery === 'Delivered' && o.feedbackSent && <p className="text-xs font-semibold text-emerald-700">✓ Feedback asked</p>}
        <div className="flex gap-2 pt-1">
          <a href={waLink(o.phone, receiptText(o, biz))} target="_blank" rel="noreferrer" className="flex-1">
            <Button variant="whatsapp" className="w-full">
              <MessageCircle size={18} /> WhatsApp Receipt
            </Button>
          </a>
          <a href={`tel:+91${o.phone}`}>
            <Button variant="outline" aria-label="Call">
              <Phone size={18} />
            </Button>
          </a>
          {canDelete && (
            <Button variant="outline" aria-label="More" onClick={() => setMenu(true)}>
              <MoreVertical size={18} />
            </Button>
          )}
        </div>
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title={o.orderId}>
        <p className="mb-4 text-sm text-slate-600">
          Deleting removes all {o.items.length} item row(s) of this order from the Google Sheet. Use this only for mistakes or cancelled orders.
        </p>
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

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[64px_1fr] items-center gap-2">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </div>
  )
}

export default function Orders() {
  const { orders } = useStore()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
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
