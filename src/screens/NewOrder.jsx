import { useMemo, useRef, useState } from 'react'
import { CheckCircle2, Crown, Minus, Plus, ShoppingBasket, Tag, Trash2, UserCheck } from 'lucide-react'
import { useStore } from '../lib/store'
import { PAY, PAY_LABEL, addDays, cleanPhone, groupOrders, inr, isValidPhone, makeId, prettyDate, todayStr } from '../lib/utils'
import { Badge, Button, Card, Field, PAY_COLORS, Segmented, Sheet, cx, inputCls } from '../components/ui'
import { MessageButton, useMessage } from '../components/Messages'
import { PayButton } from './Orders'

const blank = () => ({ phone: '', name: '', address: '', items: [], deliveryCharge: '', notes: '', dueDate: '', payment: 'Unpaid' })

function Stepper({ value, onChange, min = 1 }) {
  return (
    <div className="flex items-center rounded-xl bg-slate-100">
      <button type="button" className="grid h-10 w-10 place-items-center rounded-l-xl active:bg-slate-200" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Less">
        <Minus size={18} />
      </button>
      <span className="w-8 text-center text-lg font-black">{value}</span>
      <button type="button" className="grid h-10 w-10 place-items-center rounded-r-xl active:bg-slate-200" onClick={() => onChange(value + 1)} aria-label="More">
        <Plus size={18} />
      </button>
    </div>
  )
}

function Step({ n, title, done, children, innerRef }) {
  return (
    <Card className="scroll-mt-20 p-4" ref={innerRef}>
      <div className="mb-3 flex items-center gap-2">
        <span className={cx('grid h-7 w-7 place-items-center rounded-full text-sm font-black', done ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white')}>{done ? '✓' : n}</span>
        <h2 className="text-lg font-black text-slate-900">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </Card>
  )
}

export default function NewOrder() {
  const { activeProducts, customers, mutate, user, templates } = useStore()
  const [f, setF] = useState(blank)
  const [touched, setTouched] = useState(false)
  const [saved, setSaved] = useState(null)
  const [discOpen, setDiscOpen] = useState({})
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const build = useMessage()
  const customerRef = useRef(null)
  const itemsRef = useRef(null)

  const phone = cleanPhone(f.phone)
  const phoneOk = isValidPhone(phone)
  const known = useMemo(() => (phoneOk ? customers.find((c) => c.phone === phone) : null), [phoneOk, phone, customers])

  const onPhone = (v) => {
    const p = cleanPhone(v).slice(0, 10)
    setF((s) => {
      const next = { ...s, phone: p }
      const c = isValidPhone(p) && customers.find((x) => x.phone === p)
      if (c) {
        if (!s.name) next.name = c.name
        if (!s.address) next.address = c.address
      }
      return next
    })
  }

  // Category → pickle → sizes, e.g. Veg Pickle → Mango → [250gm, 500gm, 1000gm]
  const byCat = useMemo(() => {
    const m = new Map()
    for (const p of activeProducts) {
      const c = p.Category || 'Other'
      if (!m.has(c)) m.set(c, new Map())
      const name = String(p.Product_Name)
      const cut = name.lastIndexOf(' - ')
      const base = cut > -1 ? name.slice(0, cut) : name
      const size = cut > -1 ? name.slice(cut + 3) : ''
      if (!m.get(c).has(base)) m.get(c).set(base, [])
      m.get(c).get(base).push({ ...p, size })
    }
    return m
  }, [activeProducts])
  const inCart = (code) => f.items.find((x) => x.code === code)?.qty || 0

  const addItem = (code, qty = 1) => {
    const p = activeProducts.find((x) => x.Product_Code === code)
    if (!p) return
    setF((s) => {
      const i = s.items.findIndex((x) => x.code === code)
      if (i > -1) return { ...s, items: s.items.map((x, j) => (j === i ? { ...x, qty: x.qty + qty } : x)) }
      return { ...s, items: [...s.items, { code, name: p.Product_Name, mrp: Number(p.MRP), qty, discount: 0 }] }
    })
  }
  const updItem = (i, patch) => setF((s) => ({ ...s, items: s.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) }))
  const delItem = (i) => setF((s) => ({ ...s, items: s.items.filter((_, j) => j !== i) }))

  const count = f.items.reduce((a, x) => a + x.qty, 0)
  const subtotal = f.items.reduce((a, x) => a + x.qty * x.mrp, 0)
  const discount = f.items.reduce((a, x) => a + (Number(x.discount) || 0), 0)
  const delivery = Math.max(0, Number(f.deliveryCharge) || 0)
  const total = subtotal - discount + delivery

  const errors = {
    phone: !phoneOk ? 'Enter a 10-digit mobile number (starts with 6–9)' : '',
    name: !f.name.trim() ? 'Enter the customer’s name' : '',
    items: !f.items.length ? 'Tap at least one pickle above' : '',
    discount: f.items.some((x) => Number(x.discount) > x.qty * x.mrp) ? 'Discount can’t be more than the item price' : '',
  }
  const valid = !Object.values(errors).some(Boolean)
  const err = (k) => (touched ? errors[k] : '')

  const submit = () => {
    setTouched(true)
    if (!valid) {
      ;(errors.phone || errors.name ? customerRef : itemsRef).current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    const order = {
      orderId: makeId('ORD'),
      date: todayStr(),
      customerName: f.name.trim(),
      phone,
      address: f.address.trim(),
      items: f.items.map((x) => ({ ...x, discount: Number(x.discount) || 0 })),
      deliveryCharge: delivery,
      notes: f.notes.trim(),
      dueDate: f.dueDate,
      prep: 'Pending',
      payment: f.payment,
      delivery: 'Pending',
    }
    mutate('addOrder', { order })
    const rows = order.items.map((it, idx) => ({
      Order_ID: order.orderId, Date: order.date, Customer_Name: order.customerName, Customer_Phone: phone, Product_Code: it.code,
      Product_Name: it.name, QTY: it.qty, MRP: it.mrp, Discount: it.discount, Sold_Amount: it.qty * it.mrp - it.discount, Lead_By: user?.name || '',
      Prep_Status: 'Pending', Payment_Status: order.payment, Delivery_Status: 'Pending', Delivery_Charge: idx === 0 ? delivery : 0, Due_Date: order.dueDate,
      Address: order.address,
    }))
    setSaved(groupOrders(rows)[0])
    setF(blank())
    setDiscOpen({})
    setTouched(false)
    window.scrollTo(0, 0)
  }

  const t = todayStr()
  const dueChips = [
    ['', 'No date'],
    [t, 'Today'],
    [addDays(t, 1), 'Tomorrow'],
    [addDays(t, 2), prettyDate(addDays(t, 2))],
  ]
  const customDate = !dueChips.some(([v]) => v === f.dueDate)

  return (
    <div className="space-y-3 pb-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900">New order</h1>
        <MessageButton phone={phoneOk ? phone : ''} name={f.name || known?.name} suggested="menu" size="sm" label="Send menu" />
      </div>

      <Step n={1} title="Customer" done={phoneOk && !!f.name.trim()} innerRef={customerRef}>
        <Field label="WhatsApp number" error={err('phone')}>
          <div className="flex items-center rounded-xl bg-white ring-1 ring-slate-300 focus-within:ring-2 focus-within:ring-indigo-600">
            <span className="pl-3 font-semibold text-slate-500">+91</span>
            <input
              className="h-12 w-full rounded-xl bg-transparent px-2 text-lg font-semibold tracking-wider outline-none"
              type="tel"
              inputMode="numeric"
              autoComplete="off"
              placeholder="10-digit number"
              value={f.phone}
              onChange={(e) => onPhone(e.target.value)}
            />
          </div>
        </Field>
        {known && (
          <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
            {known.tier === 'VIP' ? <Crown size={20} className="mt-0.5 text-amber-500" /> : <UserCheck size={20} className="mt-0.5 text-emerald-600" />}
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-bold text-emerald-900">
                Returning customer <Badge className="ml-1 bg-emerald-600 text-white">{known.tier}</Badge>
              </div>
              <div className="text-emerald-800">
                {known.totalOrders} orders · {inr(known.totalSpent)} · last {prettyDate(known.lastOrder)}
              </div>
              {known.favorite && activeProducts.some((p) => p.Product_Name === known.favorite) && (
                <button
                  className="mt-1.5 rounded-lg bg-white px-2.5 py-1 font-semibold text-indigo-700 ring-1 ring-indigo-200"
                  onClick={() => addItem(activeProducts.find((p) => p.Product_Name === known.favorite).Product_Code, 1)}
                >
                  + Add usual: {known.favorite}
                </button>
              )}
            </div>
          </div>
        )}
        <Field label="Name" error={err('name')}>
          <input className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Customer name" autoComplete="off" />
        </Field>
        <Field label="Delivery address (optional)">
          <textarea className={inputCls + ' h-auto py-2'} rows={2} value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="Flat, street, area, city" />
        </Field>
      </Step>

      <Step n={2} title="Pickles" done={f.items.length > 0} innerRef={itemsRef}>
        {activeProducts.length === 0 ? (
          <p className="rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900">
            No products yet. Tap the refresh button at the top, or add pickles in More → Catalog & prices.
          </p>
        ) : (
          <p className="-mt-1 text-sm text-slate-500">Tap a size to add it. Tap again to add one more.</p>
        )}
        {[...byCat.entries()].map(([cat, groups]) => (
          <div key={cat}>
            <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">{cat}</div>
            <div className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
              {[...groups.entries()].map(([base, sizes]) => (
                <div key={base} className="flex flex-wrap items-center gap-2 p-2.5">
                  <span className="w-full font-bold text-slate-900 sm:w-40 sm:shrink-0">{base}</span>
                  {sizes.map((p) => {
                    const n = inCart(p.Product_Code)
                    return (
                      <button
                        key={p.Product_Code}
                        type="button"
                        onClick={() => addItem(p.Product_Code)}
                        className={cx(
                          'relative flex h-12 min-w-[5.25rem] flex-1 flex-col items-center justify-center rounded-xl px-2 text-sm font-bold leading-tight ring-1 transition sm:max-w-[7rem]',
                          n ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-slate-800 ring-slate-300 active:bg-slate-100',
                        )}
                      >
                        <span>{p.size || 'Add'}</span>
                        <span className={cx('text-xs font-semibold', n ? 'text-indigo-100' : 'text-slate-500')}>{inr(p.MRP)}</span>
                        {n > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-amber-400 px-1 text-xs font-black text-slate-950">{n}</span>}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
        {err('items') && <p className="text-sm font-medium text-rose-600">{err('items')}</p>}

        {f.items.length > 0 && (
          <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200">
            <div className="px-3 pt-3 text-xs font-bold uppercase tracking-wide text-slate-500">In this order</div>
            <div className="divide-y divide-slate-200">
              {f.items.map((x, i) => (
                <div key={x.code} className="space-y-1.5 p-3">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-slate-900">{x.name}</div>
                      <div className="text-xs text-slate-500">{inr(x.mrp)} each</div>
                    </div>
                    <Stepper value={x.qty} onChange={(q) => updItem(i, { qty: q })} />
                    <button onClick={() => delItem(i)} className="grid h-9 w-9 place-items-center rounded-lg text-rose-600 active:bg-rose-50" aria-label="Remove">
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {discOpen[x.code] || Number(x.discount) ? (
                      <div className="flex max-w-[12rem] items-center gap-1.5 rounded-lg bg-white px-2 ring-1 ring-slate-200">
                        <Tag size={14} className="text-emerald-600" />
                        <span className="whitespace-nowrap text-xs font-semibold text-slate-500">Discount ₹</span>
                        <input
                          inputMode="numeric"
                          autoFocus={!Number(x.discount)}
                          className="h-8 w-full bg-transparent font-semibold outline-none"
                          value={x.discount || ''}
                          placeholder="0"
                          onChange={(e) => updItem(i, { discount: e.target.value.replace(/\D/g, '') })}
                        />
                      </div>
                    ) : (
                      <button className="text-xs font-semibold text-indigo-700" onClick={() => setDiscOpen((d) => ({ ...d, [x.code]: true }))}>
                        + Add discount
                      </button>
                    )}
                    <div className="font-black text-slate-900">{inr(x.qty * x.mrp - (Number(x.discount) || 0))}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {err('discount') && <p className="text-sm font-medium text-rose-600">{err('discount')}</p>}
      </Step>

      <Step n={3} title="Delivery & payment">
        <Field group label="Deliver by">
          <div className="flex flex-wrap gap-2">
            {dueChips.map(([v, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => set('dueDate', v)}
                className={cx('h-10 rounded-full px-4 text-sm font-semibold', f.dueDate === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300')}
              >
                {label}
              </button>
            ))}
            <input
              type="date"
              aria-label="Pick a date"
              min={t}
              value={customDate ? f.dueDate : ''}
              onChange={(e) => set('dueDate', e.target.value)}
              className={cx('h-10 rounded-full px-3 text-sm font-semibold outline-none', customDate ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-300')}
            />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Delivery charge ₹">
            <input className={inputCls} inputMode="numeric" value={f.deliveryCharge} onChange={(e) => set('deliveryCharge', e.target.value.replace(/\D/g, ''))} placeholder="0" />
          </Field>
          <Field label="Note for kitchen">
            <input className={inputCls} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="e.g. less spicy" />
          </Field>
        </div>
        <Field group label="Payment">
          <Segmented options={PAY} value={f.payment} onChange={(v) => set('payment', v)} colors={PAY_COLORS} labels={{ ...PAY_LABEL, UPI: 'Paid UPI', Cash: 'Paid cash' }} />
        </Field>
      </Step>

      {/* slim total bar above the bottom tabs */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20">
        <div className="pointer-events-auto mx-auto max-w-3xl px-3 pb-2">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-900 p-2 pl-4 text-white shadow-xl">
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-xs text-slate-400">
                {count} item{count === 1 ? '' : 's'}
                {discount > 0 && ` · −${inr(discount)} off`}
                {delivery > 0 && ` · +${inr(delivery)} delivery`}
              </div>
              <div className="text-xl font-black">{inr(total)}</div>
            </div>
            <Button size="lg" variant="amber" className="h-12 px-5" onClick={submit}>
              <ShoppingBasket size={20} /> Save order
            </Button>
          </div>
        </div>
      </div>

      <Sheet open={!!saved} onClose={() => setSaved(null)} title="Order saved">
        {saved && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
              <CheckCircle2 className="shrink-0 text-emerald-600" size={28} />
              <div>
                <div className="font-bold text-emerald-900">
                  {saved.customerName} · {inr(saved.total)}
                </div>
                <div className="text-sm text-emerald-800">It’s now in Orders and on the kitchen list.</div>
              </div>
            </div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 font-sans text-sm text-slate-700">
              {build(templates.find((x) => x.key === 'order_confirm'), { order: saved })}
            </pre>
            <MessageButton order={saved} suggested="order_confirm" size="lg" className="w-full" label="Send confirmation on WhatsApp" />
            <PayButton o={saved} size="lg" className="w-full" />
            <Button variant="ghost" className="w-full" onClick={() => setSaved(null)}>
              Take next order
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  )
}
