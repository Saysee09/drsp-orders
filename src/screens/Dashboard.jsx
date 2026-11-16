import { useMemo, useState } from 'react'
import { BellRing, Crown, IndianRupee, MessageCircle, Package, Star, TrendingDown, TrendingUp } from 'lucide-react'
import { useStore } from '../lib/store'
import { getConfig } from '../lib/api'
import { EXPENSE_CATEGORIES, addDays, daysBetween, inr, needsFeedback, nudgeText, prettyDate, todayStr, waLink } from '../lib/utils'
import { FeedbackButton, PayButton } from './Orders'
import { Badge, Card, Empty, Pill, SectionTitle, cx } from '../components/ui'

function range(id) {
  const t = todayStr()
  const ym = t.slice(0, 7)
  if (id === 'today') return [t, t]
  if (id === '7d') return [addDays(t, -6), t]
  if (id === 'month') return [ym + '-01', t]
  if (id === 'last') {
    const [y, m] = ym.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return [s + '-01', addDays(ym + '-01', -1)]
  }
  return ['0000', '9999']
}
const RANGES = [['today', 'Today'], ['7d', '7 days'], ['month', 'This month'], ['last', 'Last month'], ['all', 'All time']]

function Kpi({ label, value, sub, tone = 'slate' }) {
  const c = { slate: 'text-slate-900', green: 'text-emerald-700', red: 'text-rose-600', indigo: 'text-indigo-700', amber: 'text-amber-600' }[tone]
  return (
    <Card className="p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cx('mt-1 text-2xl font-black tabular-nums', c)}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </Card>
  )
}

function Bar({ label, value, max, right, color = 'bg-indigo-600' }) {
  return (
    <div>
      <div className="flex flex-wrap justify-between gap-x-2 text-sm">
        <span className="font-medium text-slate-800">{label}</span>
        <span className="ml-auto font-semibold tabular-nums text-slate-900">{right}</span>
      </div>
      <div className="mt-1 h-2.5 rounded-full bg-slate-100">
        <div className={cx('h-2.5 rounded-full', color)} style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { orders, data, customers } = useStore()
  const [rid, setRid] = useState('month')
  const [from, to] = range(rid)
  const biz = getConfig().businessName
  const t = todayStr()

  const s = useMemo(() => {
    const os = orders.filter((o) => o.date >= from && o.date <= to)
    const ex = data.expenses.filter((e) => String(e.Date) >= from && String(e.Date) <= to)
    const items = os.reduce((a, o) => a + o.itemsTotal, 0)
    const delivery = os.reduce((a, o) => a + o.deliveryCharge, 0)
    const gross = items + delivery
    const expenses = ex.reduce((a, e) => a + Number(e.Amount || 0), 0)
    const net = gross - expenses
    const unpaid = os.filter((o) => o.payment === 'Unpaid')
    const prod = new Map()
    for (const o of os)
      for (const i of o.items) {
        const p = prod.get(i.name) || { name: i.name, units: 0, revenue: 0 }
        p.units += i.qty
        p.revenue += i.sold
        prod.set(i.name, p)
      }
    const byCat = EXPENSE_CATEGORIES.map((c) => [c, ex.filter((e) => e.Category === c).reduce((a, e) => a + Number(e.Amount || 0), 0)]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1])
    return {
      count: os.length,
      gross,
      delivery,
      expenses,
      net,
      aov: os.length ? gross / os.length : 0,
      margin: gross ? (net / gross) * 100 : 0,
      unpaidAmt: unpaid.reduce((a, o) => a + o.total, 0),
      unpaidCount: unpaid.length,
      products: [...prod.values()].sort((a, b) => b.revenue - a.revenue),
      byCat,
    }
  }, [orders, data.expenses, from, to])

  const vip = customers.slice(0, 8)
  const feedback = orders.filter((o) => needsFeedback(o, t)).sort((a, b) => a.deliveredAt.localeCompare(b.deliveredAt))
  const unpaidAll = orders.filter((o) => o.payment === 'Unpaid').sort((a, b) => a.date.localeCompare(b.date))
  const nudges = customers.filter((c) => c.lastOrder && daysBetween(c.lastOrder, t) > 30).sort((a, b) => b.totalSpent - a.totalSpent)
  const tiers = ['VIP', 'Regular', 'New'].map((x) => [x, customers.filter((c) => c.tier === x).length])
  const maxRev = s.products[0]?.revenue || 0

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-black text-slate-900">Profit & Customers</h1>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {RANGES.map(([id, label]) => (
          <Pill key={id} active={rid === id} onClick={() => setRid(id)}>
            {label}
          </Pill>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Kpi label="Gross revenue" value={inr(s.gross)} sub={`${s.count} orders${s.delivery ? ` · incl. ${inr(s.delivery)} delivery` : ''}`} tone="indigo" />
        <Kpi label="Expenses" value={inr(s.expenses)} tone="amber" />
        <Kpi label="Net profit" value={inr(s.net)} tone={s.net >= 0 ? 'green' : 'red'} sub={s.net >= 0 ? 'Revenue − expenses' : 'Spending more than earning'} />
        <Kpi label="Profit margin" value={`${s.margin.toFixed(1)}%`} tone={s.margin >= 0 ? 'green' : 'red'} />
        <Kpi label="Avg order value" value={inr(s.aov)} />
        <Kpi label="Unpaid" value={inr(s.unpaidAmt)} sub={`${s.unpaidCount} order(s) to collect`} tone={s.unpaidAmt ? 'red' : 'green'} />
      </div>

      <SectionTitle>Product performance</SectionTitle>
      <Card className="space-y-3 p-4">
        {s.products.length === 0 ? (
          <Empty icon={Package} title="No sales in this period" />
        ) : (
          s.products.map((p, i) => (
            <Bar
              key={p.name}
              label={`${i + 1}. ${p.name}`}
              value={p.revenue}
              max={maxRev}
              right={`${p.units} units · ${inr(p.revenue)} · ${s.gross ? Math.round((p.revenue / (s.gross - s.delivery || 1)) * 100) : 0}%`}
              color={i === 0 ? 'bg-emerald-600' : 'bg-indigo-600'}
            />
          ))
        )}
      </Card>

      {s.byCat.length > 0 && (
        <>
          <SectionTitle>Where money went</SectionTitle>
          <Card className="space-y-3 p-4">
            {s.byCat.map(([c, v]) => (
              <Bar key={c} label={c} value={v} max={s.byCat[0][1]} right={inr(v)} color="bg-amber-500" />
            ))}
          </Card>
        </>
      )}

      <SectionTitle right={<span className="text-xs text-slate-500">delivered 1+ day ago</span>}>Feedback to ask ({feedback.length})</SectionTitle>
      <Card className="divide-y divide-slate-100">
        {feedback.length === 0 && <Empty icon={Star} title="No feedback pending">Delivered orders show here the day after delivery.</Empty>}
        {feedback.slice(0, 20).map((o) => (
          <div key={o.orderId} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold text-slate-900">{o.customerName}</div>
              <div className="truncate text-xs text-slate-500">
                Delivered {prettyDate(o.deliveredAt)} · {o.items.map((i) => i.name).join(', ')}
              </div>
            </div>
            <FeedbackButton o={o} size="sm" />
          </div>
        ))}
      </Card>

      <SectionTitle right={<span className="text-xs text-slate-500">all time</span>}>Payments to collect ({unpaidAll.length})</SectionTitle>
      <Card className="divide-y divide-slate-100">
        {unpaidAll.length === 0 && <Empty icon={IndianRupee} title="All orders are paid" />}
        {unpaidAll.slice(0, 20).map((o) => (
          <div key={o.orderId} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold text-slate-900">{o.customerName}</div>
              <div className="truncate text-xs text-slate-500">
                {o.orderId} · {prettyDate(o.date)} · {o.delivery}
              </div>
            </div>
            <PayButton o={o} size="sm" />
          </div>
        ))}
      </Card>

      <SectionTitle right={<span className="text-xs text-slate-500">{tiers.map(([x, n]) => `${n} ${x}`).join(' · ')}</span>}>Top customers (all time)</SectionTitle>
      <Card className="divide-y divide-slate-100">
        {vip.length === 0 && <Empty title="No customers yet" />}
        {vip.map((c, i) => (
          <div key={c.phone} className="flex items-center gap-3 p-3">
            <div className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black', i < 3 ? 'bg-amber-400 text-slate-900' : 'bg-slate-100 text-slate-600')}>
              {i < 3 ? <Crown size={16} /> : i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold text-slate-900">
                {c.name} <Badge className={cx('ml-1', c.tier === 'VIP' ? 'bg-amber-400 text-slate-900' : c.tier === 'Regular' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600')}>{c.tier}</Badge>
              </div>
              <div className="truncate text-xs text-slate-500">
                {c.totalOrders} orders · fav {c.favorite || '—'} · last {prettyDate(c.lastOrder)}
              </div>
            </div>
            <div className="font-black tabular-nums">{inr(c.totalSpent)}</div>
          </div>
        ))}
      </Card>

      <SectionTitle right={<span className="text-xs text-slate-500">no order in 30+ days</span>}>Reorder nudges ({nudges.length})</SectionTitle>
      <Card className="divide-y divide-slate-100">
        {nudges.length === 0 && (
          <Empty icon={BellRing} title="Everyone ordered recently">
            Customers who haven’t ordered for 30 days will show here.
          </Empty>
        )}
        {nudges.slice(0, 30).map((c) => (
          <div key={c.phone} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold text-slate-900">{c.name}</div>
              <div className="truncate text-xs text-slate-500">
                {daysBetween(c.lastOrder, t)} days ago · {inr(c.totalSpent)} lifetime · {c.tier}
              </div>
            </div>
            <a
              href={waLink(c.phone, nudgeText(c, biz))}
              target="_blank"
              rel="noreferrer"
              className="flex h-10 items-center gap-1.5 rounded-xl bg-[#25D366] px-3 text-sm font-bold text-slate-950 active:bg-[#1ebe5a]"
            >
              <MessageCircle size={16} /> Nudge
            </a>
          </div>
        ))}
      </Card>
      <p className="px-1 pb-2 pt-1 text-center text-xs text-slate-400">
        <TrendingUp size={12} className="inline" /> Net profit = revenue − expenses · Margin = net ÷ revenue <TrendingDown size={12} className="inline" />
      </p>
    </div>
  )
}
