import { useMemo, useState } from 'react'
import { CheckCircle2, Crown, Minus, Plus, ShoppingBasket, Trash2, UserCheck } from 'lucide-react'
import { useStore } from '../lib/store'
import { PAY, PAY_LABEL, cleanPhone, groupOrders, inr, isValidPhone, makeId, prettyDate, todayStr } from '../lib/utils'
import { Badge, Button, Card, Field, PAY_COLORS, Segmented, Sheet, cx, inputCls } from '../components/ui'
import { MessageButton, useMessage } from '../components/Messages'
import { PayButton } from './Orders'

const blank = () => ({ phone: '', name: '', address: '', items: [], deliveryCharge: '', notes: '', dueDate: '', payment: 'Unpaid' })

function Stepper({ value, onChange, min = 1 }) {
  return (
    <div className="flex items-center rounded-xl bg-slate-100">
      <button type="button" className="grid h-11 w-11 place-items-center active:bg-slate-200 rounded-l-xl" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Less">
        <Minus size={18} />
      </button>
      <input
        inputMode="numeric"
        className="h-11 w-10 bg-transparent text-center font-bold outline-none"
        value={value}
        onChange={(e) => onChange(Math.max(min, parseInt(e.target.value.replace(/\D/g, ''), 10) || min))}
      />
      <button type="button" className="grid h-11 w-11 place-items-center active:bg-slate-200 rounded-r-xl" onClick={() => onChange(value + 1)} aria-label="More">
        <Plus size={18} />
      </button>
    </div>
  )
}

export default function NewOrder() {
  const { activeProducts, customers, mutate, user, templates } = useStore()
  const [f, setF] = useState(blank)
  const [touched, setTouched] = useState(false)
  const [saved, setSaved] = useState(null)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const build = useMessage()

  const phone = cleanPhone(f.phone)
  const phoneOk = isValidPhone(phone)
  const known = useMemo(() => (phoneOk ? customers.find((c) => c.phone === phone) : null), [phoneOk, phone, customers])

  const onPhone = (v) => {
    const p = cleanPhone(v).slice(0, 10)
    setF((s) => {
      const next = { ...s, phone: p }
      if (isValidPhone(p)) {
        const c = customers.find((x) => x.phone === p)
        if (c) {
          if (!s.name) next.name = c.name
          if (!s.address) next.address = c.address
        }
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

  const subtotal = f.items.reduce((a, x) => a + x.qty * x.mrp, 0)
  const discount = f.items.reduce((a, x) => a + (Number(x.discount) || 0), 0)
  const delivery = Math.max(0, Number(f.deliveryCharge) || 0)
  const total = subtotal - discount + delivery

  const errors = {
    phone: !phoneOk ? 'Enter a 10-digit mobile number (starts with 6–9)' : '',
    name: !f.name.trim() ? 'Customer name is required' : '',
    items: !f.items.length ? 'Add at least one product' : '',
    discount: f.items.some((x) => Number(x.discount) > x.qty * x.mrp) ? 'Discount cannot be more than the item price' : '',
  }
  const valid = !Object.values(errors).some(Boolean)

  const submit = () => {
    setTouched(true)
    if (!valid) return
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
    setTouched(false)
  }

  const err = (k) => (touched ? errors[k] : '')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900">New Order</h1>
        <MessageButton phone={phoneOk ? phone : ''} name={f.name || known?.name} suggested="menu" size="sm" label="Send menu" />
      </div>

      <Card className="space-y-3 p-4">
        <Field label="Customer phone" error={err('phone')}>
          <div className="flex items-center rounded-xl bg-white ring-1 ring-slate-300 focus-within:ring-2 focus-within:ring-indigo-600">
            <span className="pl-3 font-semibold text-slate-500">+91</span>
            <input
              className="h-12 w-full rounded-xl bg-transparent px-2 text-lg font-semibold tracking-wider outline-none"
              type="tel"
              inputMode="numeric"
              autoComplete="off"
              placeholder="98480 12345"
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
                  className="mt-1 font-semibold text-indigo-700 underline"
                  onClick={() => addItem(activeProducts.find((p) => p.Product_Name === known.favorite).Product_Code, 1)}
                >
                  + Add usual: {known.favorite}
                </button>
              )}
            </div>
          </div>
        )}
        <Field label="Customer name" error={err('name')}>
          <input className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Full name" autoComplete="off" />
        </Field>
        <Field label="Delivery address / area">
          <textarea className={inputCls + ' h-auto py-2'} rows={2} value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="Flat, street, area, city" />
        </Field>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="text-sm font-semibold text-slate-700">Tap to add · tap again for more</div>
        {[...byCat.entries()].map(([cat, groups]) => (
          <div key={cat}>
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{cat}</div>
            <div className="space-y-1.5">
              {[...groups.entries()].map(([base, sizes]) => (
                <div key={base} className="flex flex-wrap items-center gap-1.5">
                  <span className="w-full text-sm font-bold text-slate-900 min-[420px]:w-28 min-[420px]:shrink-0">{base}</span>
                  {sizes.map((p) => {
                    const n = inCart(p.Product_Code)
                    return (
                      <button
                        key={p.Product_Code}
                        type="button"
                        onClick={() => addItem(p.Product_Code)}
                        className={cx(
                          'relative flex h-12 min-w-[5.5rem] flex-col items-center justify-center rounded-xl px-3 text-sm font-bold leading-tight ring-1 transition',
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
          <div className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
            <div className="bg-slate-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">In this order</div>
            {f.items.map((x, i) => (
              <div key={x.code} className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900">{x.name}</div>
                    <div className="text-xs text-slate-500">
                      {x.code} · MRP {inr(x.mrp)}
                    </div>
                  </div>
                  <button onClick={() => delItem(i)} className="grid h-9 w-9 place-items-center rounded-lg text-rose-600 active:bg-rose-50" aria-label="Remove">
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Stepper value={x.qty} onChange={(q) => updItem(i, { qty: q })} />
                  <div className="flex flex-1 items-center rounded-xl bg-slate-100 px-2">
                    <span className="text-xs font-semibold text-slate-500">Disc ₹</span>
                    <input
                      inputMode="numeric"
                      className="h-11 w-full bg-transparent px-1 font-semibold outline-none"
                      value={x.discount || ''}
                      placeholder="0"
                      onChange={(e) => updItem(i, { discount: e.target.value.replace(/\D/g, '') })}
                    />
                  </div>
                  <div className="w-20 text-right font-black text-slate-900">{inr(x.qty * x.mrp - (Number(x.discount) || 0))}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {err('discount') && <p className="text-sm font-medium text-rose-600">{err('discount')}</p>}
      </Card>

      <Card className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Delivery charge (₹)">
            <input className={inputCls} inputMode="numeric" value={f.deliveryCharge} onChange={(e) => set('deliveryCharge', e.target.value.replace(/\D/g, ''))} placeholder="0" />
          </Field>
          <Field label="Deliver by">
            <input className={inputCls} type="date" min={todayStr()} value={f.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          </Field>
        </div>
        <Field label="Order notes" hint="Shown to the kitchen, e.g. less spicy, gift pack">
          <input className={inputCls} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Payment">
          <Segmented options={PAY} value={f.payment} onChange={(v) => set('payment', v)} colors={PAY_COLORS} labels={PAY_LABEL} />
        </Field>
      </Card>

      <Card className="sticky bottom-20 z-10 p-4 shadow-lg">
        <div className="mb-3 space-y-1 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Items ({f.items.reduce((a, x) => a + x.qty, 0)})</span>
            <span>{inr(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Discount</span>
              <span>− {inr(discount)}</span>
            </div>
          )}
          {delivery > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Delivery</span>
              <span>{inr(delivery)}</span>
            </div>
          )}
          <div className="flex justify-between pt-1 text-xl font-black text-slate-900">
            <span>Total</span>
            <span>{inr(total)}</span>
          </div>
        </div>
        <Button size="lg" className="w-full" onClick={submit}>
          <ShoppingBasket size={20} /> Save order
        </Button>
      </Card>

      <Sheet open={!!saved} onClose={() => setSaved(null)} title="Order saved">
        {saved && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
              <CheckCircle2 className="text-emerald-600" size={28} />
              <div>
                <div className="font-bold text-emerald-900">{saved.orderId}</div>
                <div className="text-sm text-emerald-800">
                  {saved.customerName} · {inr(saved.total)}
                </div>
              </div>
            </div>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 font-sans text-sm text-slate-700">
              {build(templates.find((t) => t.key === 'order_confirm'), { order: saved })}
            </pre>
            <MessageButton order={saved} suggested="order_confirm" size="lg" className="w-full" label="Send confirmation on WhatsApp" />
            <PayButton o={saved} size="lg" className="block w-full" />
            <Button variant="ghost" className="w-full" onClick={() => setSaved(null)}>
              Take next order
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  )
}
