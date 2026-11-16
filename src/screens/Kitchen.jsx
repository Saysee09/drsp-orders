import { useMemo } from 'react'
import { CalendarClock, CheckCircle2, Flame, PackageCheck, StickyNote } from 'lucide-react'
import { useStore } from '../lib/store'
import { prettyDate, todayStr } from '../lib/utils'
import { cx } from '../components/ui'

const byDue = (a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.date.localeCompare(b.date)

function KitchenCard({ o }) {
  const { mutate, notify } = useStore()
  const next = o.prep === 'Pending' ? 'In Batch' : 'Packed'
  const go = () => {
    mutate('updateOrder', { orderId: o.orderId, fields: { Prep_Status: next } })
    notify(next === 'Packed' ? `Packed: ${o.customerName}` : `Started: ${o.customerName}`, 'success', {
      label: 'Undo',
      run: () => mutate('updateOrder', { orderId: o.orderId, fields: { Prep_Status: o.prep } }),
    })
  }
  const late = o.dueDate && o.dueDate < todayStr()
  const today = o.dueDate === todayStr()

  return (
    <div className={cx('overflow-hidden rounded-3xl bg-white ring-2', o.prep === 'In Batch' ? 'ring-orange-500' : 'ring-slate-300')}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="text-2xl font-black leading-tight text-slate-950">{o.customerName}</div>
          {o.dueDate && (
            <span
              className={cx(
                'flex shrink-0 items-center gap-1 rounded-xl px-3 py-1.5 text-lg font-black',
                late ? 'bg-rose-600 text-white' : today ? 'bg-amber-400 text-slate-950' : 'bg-slate-100 text-slate-800',
              )}
            >
              <CalendarClock size={20} />
              {prettyDate(o.dueDate)}
            </span>
          )}
        </div>
        <ul className="mt-3 space-y-2">
          {o.items.map((i, n) => (
            <li key={n} className="flex items-center gap-3 text-xl font-bold text-slate-900">
              <span className="grid h-11 min-w-11 place-items-center rounded-xl bg-slate-900 px-2 text-xl font-black text-white">{i.qty}</span>
              <span>{i.name}</span>
            </li>
          ))}
        </ul>
        {o.notes && (
          <div className="mt-3 flex gap-2 rounded-2xl bg-amber-100 p-3 text-xl font-bold text-amber-950">
            <StickyNote size={24} className="mt-0.5 shrink-0" />
            {o.notes}
          </div>
        )}
      </div>
      <button
        onClick={go}
        className={cx(
          'flex h-20 w-full items-center justify-center gap-3 text-2xl font-black tracking-wide',
          o.prep === 'Pending' ? 'bg-amber-500 text-slate-950 active:bg-amber-600' : 'bg-emerald-600 text-white active:bg-emerald-700',
        )}
      >
        {o.prep === 'Pending' ? (
          <>
            <Flame size={30} /> START PREP
          </>
        ) : (
          <>
            <PackageCheck size={30} /> MARK PACKED
          </>
        )}
      </button>
    </div>
  )
}

export default function Kitchen() {
  const { orders } = useStore()
  const open = useMemo(() => orders.filter((o) => o.prep !== 'Packed'), [orders])
  const pending = open.filter((o) => o.prep === 'Pending').sort(byDue)
  const batch = open.filter((o) => o.prep === 'In Batch').sort(byDue)

  const toMake = useMemo(() => {
    const m = new Map()
    for (const o of open) for (const i of o.items) m.set(i.name, (m.get(i.name) || 0) + i.qty)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [open])

  if (!open.length)
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <CheckCircle2 size={88} className="text-emerald-600" />
        <p className="mt-4 text-3xl font-black text-slate-900">All orders packed!</p>
        <p className="mt-2 text-xl text-slate-600">Nothing left to prepare.</p>
      </div>
    )

  return (
    <div className="space-y-6 text-[20px]">
      <div className="rounded-3xl bg-slate-900 p-5 text-white">
        <div className="text-lg font-bold uppercase tracking-wide text-amber-300">To make now</div>
        <ul className="mt-2 space-y-1.5">
          {toMake.map(([name, qty]) => (
            <li key={name} className="flex items-center justify-between text-xl font-bold">
              <span>{name}</span>
              <span className="shrink-0 whitespace-nowrap rounded-lg bg-white/15 px-3 text-2xl font-black">× {qty}</span>
            </li>
          ))}
        </ul>
      </div>

      {batch.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-black text-orange-700">Cooking now ({batch.length})</h2>
          {batch.map((o) => (
            <KitchenCard key={o.orderId} o={o} />
          ))}
        </section>
      )}
      {pending.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-black text-slate-900">Not started ({pending.length})</h2>
          {pending.map((o) => (
            <KitchenCard key={o.orderId} o={o} />
          ))}
        </section>
      )}
    </div>
  )
}
