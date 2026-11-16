export const PREP = ['Pending', 'In Batch', 'Packed']
export const PAY = ['Unpaid', 'UPI', 'Cash']
export const DELIVERY = ['Pending', 'Shipped', 'Delivered']
export const EXPENSE_CATEGORIES = ['Raw Material', 'Masala & Oil', 'Packaging', 'Equipment', 'Travel', 'Other']
export const PAY_LABEL = { Unpaid: 'Unpaid', UPI: 'Paid via UPI', Cash: 'Cash' }

const inrFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
export const inr = (n) => '₹' + inrFmt.format(Math.round(Number(n) || 0))

export const pad = (n) => String(n).padStart(2, '0')
export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return todayStr(new Date(y, m - 1, d + days))
}
export function daysBetween(a, b) {
  const pa = a.split('-').map(Number)
  const pb = b.split('-').map(Number)
  return Math.round((new Date(pb[0], pb[1] - 1, pb[2]) - new Date(pa[0], pa[1] - 1, pa[2])) / 864e5)
}
export function prettyDate(s) {
  if (!s) return ''
  const [y, m, d] = String(s).split('-').map(Number)
  if (!y || !m || !d) return String(s)
  const date = new Date(y, m - 1, d)
  const t = todayStr()
  if (s === t) return 'Today'
  if (s === addDays(t, -1)) return 'Yesterday'
  if (s === addDays(t, 1)) return 'Tomorrow'
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: y === new Date().getFullYear() ? undefined : 'numeric' })
}

const ID_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
/** ORD-YYYYMMDD-XXX. Random suffix so phones offline at the same time never clash. */
export function makeId(prefix) {
  let s = ''
  const rnd = crypto.getRandomValues(new Uint8Array(3))
  for (const b of rnd) s += ID_CHARS[b % ID_CHARS.length]
  return `${prefix}-${todayStr().replace(/-/g, '')}-${s}`
}

export const isValidPhone = (p) => /^[6-9]\d{9}$/.test(String(p))
export const cleanPhone = (p) => String(p || '').replace(/\D/g, '').replace(/^(91|0)(?=[6-9]\d{9}$)/, '')

/* ---------------------------------------------------------- order grouping */

/** Sheet rows (one per item) -> orders (one per Order_ID). */
export function groupOrders(rows) {
  const map = new Map()
  for (const r of rows) {
    const id = String(r.Order_ID)
    let o = map.get(id)
    if (!o) {
      o = {
        orderId: id,
        date: String(r.Date || ''),
        customerName: r.Customer_Name || '',
        phone: String(r.Customer_Phone || ''),
        leadBy: r.Lead_By || '',
        prep: r.Prep_Status || 'Pending',
        payment: r.Payment_Status || 'Unpaid',
        delivery: r.Delivery_Status || 'Pending',
        address: r.Address || '',
        notes: r.Notes || '',
        dueDate: String(r.Due_Date || ''),
        deliveryCharge: 0,
        items: [],
        subtotal: 0,
        discount: 0,
        itemsTotal: 0,
        pending: !!r._pending,
      }
      map.set(id, o)
    }
    const qty = Number(r.QTY) || 0
    const mrp = Number(r.MRP) || 0
    const disc = Number(r.Discount) || 0
    o.items.push({ code: r.Product_Code, name: r.Product_Name, qty, mrp, discount: disc, sold: Number(r.Sold_Amount) || qty * mrp - disc })
    o.subtotal += qty * mrp
    o.discount += disc
    o.itemsTotal += Number(r.Sold_Amount) || qty * mrp - disc
    o.deliveryCharge += Number(r.Delivery_Charge) || 0
    if (r._pending) o.pending = true
  }
  const list = [...map.values()]
  for (const o of list) o.total = o.itemsTotal + o.deliveryCharge
  list.sort((a, b) => (b.date + b.orderId).localeCompare(a.date + a.orderId))
  return list
}

/** Customers rollup, computed on the phone so it also works offline. */
export function buildCustomers(rows) {
  const map = new Map()
  const sorted = [...rows].sort((a, b) => String(a.Date).localeCompare(String(b.Date)))
  for (const o of sorted) {
    const ph = String(o.Customer_Phone || '')
    if (!ph) continue
    let c = map.get(ph)
    if (!c) {
      c = { phone: ph, name: '', orderIds: new Set(), spent: 0, lastOrder: '', products: {}, address: '' }
      map.set(ph, c)
    }
    c.orderIds.add(o.Order_ID)
    c.spent += Number(o.Sold_Amount) || 0
    if (o.Customer_Name) c.name = o.Customer_Name
    if (o.Address) c.address = o.Address
    if (String(o.Date) > c.lastOrder) c.lastOrder = String(o.Date)
    c.products[o.Product_Name] = (c.products[o.Product_Name] || 0) + (Number(o.QTY) || 0)
  }
  return [...map.values()]
    .map((c) => {
      const fav = Object.entries(c.products).sort((a, b) => b[1] - a[1])[0]
      return {
        phone: c.phone,
        name: c.name,
        totalOrders: c.orderIds.size,
        totalSpent: c.spent,
        lastOrder: c.lastOrder,
        favorite: fav ? fav[0] : '',
        tier: c.spent > 5000 ? 'VIP' : c.spent > 2000 ? 'Regular' : 'New',
        address: c.address,
      }
    })
    .sort((a, b) => b.totalSpent - a.totalSpent)
}

/* ---------------------------------------------------------------- WhatsApp */

export function waLink(phone, text) {
  const p = cleanPhone(phone)
  const t = encodeURIComponent(text)
  return isValidPhone(p) ? `https://wa.me/91${p}?text=${t}` : `https://wa.me/?text=${t}`
}

export function receiptText(o, businessName = 'DRSP PICKLES') {
  const lines = [
    `*ORDER CONFIRMATION — ${businessName.toUpperCase()}* 📦`,
    '',
    `*Order ID:* ${o.orderId}`,
    `*Customer Name:* ${o.customerName}`,
    '',
    '*Items Ordered:*',
    ...o.items.map((i) => `• ${i.name} x ${i.qty} — ${inr(i.sold)}${i.discount ? ` (incl. ${inr(i.discount)} off)` : ''}`),
  ]
  if (o.deliveryCharge) lines.push(`• Delivery — ${inr(o.deliveryCharge)}`)
  lines.push('', `*Total:* ${inr(o.total)}`)
  lines.push(`*Payment Status:* ${PAY_LABEL[o.payment] || o.payment}`)
  lines.push(`*Delivery Status:* ${o.delivery}`)
  if (o.dueDate) lines.push(`*Expected by:* ${prettyDate(o.dueDate)}`)
  lines.push('', 'Thank you for supporting our family business! 🙏')
  return lines.join('\n')
}

export function menuText(products, businessName = 'DRSP Homemade Pickles') {
  const active = products.filter((p) => (p.Active_Status || 'Active') === 'Active')
  const byCat = new Map()
  for (const p of active) {
    const cat = p.Category || 'Other'
    if (!byCat.has(cat)) byCat.set(cat, new Map())
    const name = String(p.Product_Name)
    const cut = name.lastIndexOf(' - ')
    const base = cut > -1 ? name.slice(0, cut) : name
    const size = cut > -1 ? name.slice(cut + 3) : ''
    const g = byCat.get(cat)
    if (!g.has(base)) g.set(base, [])
    g.get(base).push({ size, mrp: Number(p.MRP) })
  }
  const catTitle = (c) =>
    /^veg/i.test(c) ? 'Veg Specialties' : /non-veg/i.test(c) ? 'Non-Veg Specialties' : /combo/i.test(c) ? 'Combo Packs' : /powder|spice/i.test(c) ? 'Powders & Extras' : c
  const order = (c) => (/^veg/i.test(c) ? 0 : /non-veg/i.test(c) ? 1 : /combo/i.test(c) ? 2 : /powder|spice/i.test(c) ? 3 : 4)
  const lines = [`*${businessName.toUpperCase()} (ACHAR) — MENU* 🏺`, '', 'Fresh, authentic, homemade pickles made with premium ingredients!']
  for (const cat of [...byCat.keys()].sort((a, b) => order(a) - order(b))) {
    lines.push('', `*${catTitle(cat)}:*`)
    for (const [base, sizes] of byCat.get(cat)) {
      if (sizes.length === 1 && !sizes[0].size) lines.push(`• ${base}: ${inr(sizes[0].mrp)}`)
      else lines.push(`• ${base} (${sizes.map((s) => s.size).join('/')}): ${sizes.map((s) => inr(s.mrp)).join(' / ')}`)
    }
  }
  lines.push('', '📞 Reply to this message with your selection to place an order!')
  return lines.join('\n')
}

export function nudgeText(c, businessName = 'DRSP Homemade Pickles') {
  const first = String(c.name || '').split(' ')[0] || 'there'
  return [
    `Namaste ${first}! 🙏`,
    '',
    `It's been a while since your last order from *${businessName}*.${c.favorite ? ` Running low on your favourite *${c.favorite}*?` : ''}`,
    '',
    'Fresh batches are being made this week. Just reply here and we will keep a jar ready for you! 🏺',
  ].join('\n')
}

/* --------------------------------------------------------------------- CSV */

export function parseCSV(text) {
  const rows = []
  let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''))
}

export function toCSV(rows) {
  return rows.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(',')).join('\n')
}

export function downloadText(filename, text, type = 'text/csv') {
  const blob = new Blob([text], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
