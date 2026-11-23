import { addDays, todayStr, makeId } from './utils'

let config = { apiUrl: '', businessName: 'DRSP Homemade Pickles', businessPhone: '', upiId: '', upiName: '', reviewLink: '' }

export async function loadConfig() {
  try {
    const res = await fetch(import.meta.env.BASE_URL + 'config.json', { cache: 'no-store' })
    if (res.ok) config = { ...config, ...(await res.json()) }
  } catch {
    /* offline: fall back to cached copy below */
  }
  try {
    if (config.apiUrl) localStorage.setItem('drsp_config', JSON.stringify(config))
    else {
      const cached = JSON.parse(localStorage.getItem('drsp_config') || 'null')
      if (cached?.apiUrl) config = cached
    }
  } catch { /* storage unavailable */ }
  return config
}

/** Business details saved in the app (More → Business details) win over config.json. */
let appSettings = {}
export function applySettings(s) {
  appSettings = Object.fromEntries(Object.entries(s || {}).filter(([, v]) => v !== '' && v != null))
}

/** In demo mode a sample UPI ID is used so the payment flow can be tried. */
export const getConfig = () => {
  const c = { ...config, ...appSettings }
  return !config.apiUrl && !c.upiId ? { ...c, upiId: 'drsppickles@okaxis', upiName: 'DRSP Pickles' } : c
}
export const isDemo = () => !config.apiUrl

export class ApiError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}
export const SESSION_ERRORS = ['NO_SESSION', 'SESSION_EXPIRED']

/** Network failures throw TypeError (retry later); server refusals throw ApiError. */
export async function call(action, payload = {}) {
  if (isDemo()) return demoCall(action, payload)
  const res = await fetch(config.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // "simple" request: no CORS preflight for Apps Script
    body: JSON.stringify({ action, ...payload }),
    redirect: 'follow',
  })
  if (!res.ok) throw new TypeError('HTTP ' + res.status)
  let j
  try {
    j = await res.json()
  } catch {
    throw new TypeError('Bad response')
  }
  if (!j.ok) throw new ApiError(j.error || 'UNKNOWN')
  return j.data
}

/* ------------------------------------------------- shared optimistic logic */

/** Applies a write to a local data snapshot (used for instant UI and for demo mode). */
export function applyOp(data, op) {
  const d = { ...data }
  const now = new Date().toISOString()
  switch (op.action) {
    case 'addOrder': {
      const o = op.order
      if (d.orders.some((r) => r.Order_ID === o.orderId)) return d
      const rows = o.items.map((it, idx) => ({
        Order_ID: o.orderId,
        Date: o.date,
        Customer_Name: o.customerName,
        Customer_Phone: o.phone,
        Product_Code: it.code,
        Product_Name: it.name,
        QTY: it.qty,
        MRP: it.mrp,
        Discount: it.discount || 0,
        Sold_Amount: it.qty * it.mrp - (it.discount || 0),
        Lead_By: o.leadBy || '',
        Prep_Status: o.prep || 'Pending',
        Payment_Status: o.payment || 'Unpaid',
        Delivery_Status: o.delivery || 'Pending',
        Delivery_Charge: idx === 0 ? Number(o.deliveryCharge) || 0 : 0,
        Address: o.address || '',
        Notes: o.notes || '',
        Due_Date: o.dueDate || '',
        Updated_At: now,
      }))
      d.orders = [...d.orders, ...rows]
      return d
    }
    case 'updateOrder': {
      const fields = { ...op.fields }
      if (fields.Delivery_Status === 'Delivered') fields.Delivered_At = op.deliveredAt || todayStr()
      if (fields.Delivery_Status && fields.Delivery_Status !== 'Delivered') fields.Delivered_At = ''
      d.orders = d.orders.map((r) => (r.Order_ID === op.orderId ? { ...r, ...fields, Updated_At: now } : r))
      return d
    }
    case 'deleteOrder':
      d.orders = d.orders.filter((r) => r.Order_ID !== op.orderId)
      return d
    case 'addExpense': {
      const x = op.expense
      if (d.expenses.some((e) => e.Expense_ID === x.expenseId)) return d
      d.expenses = [
        ...d.expenses,
        { Expense_ID: x.expenseId, Date: x.date, Category: x.category, Item_Name: x.item, Amount: Number(x.amount), Remarks: x.remarks || '', Lead_By: x.leadBy || '' },
      ]
      return d
    }
    case 'deleteExpense':
      d.expenses = d.expenses.filter((e) => e.Expense_ID !== op.expenseId)
      return d
    case 'updatePrices': {
      const m = new Map(op.updates.map((u) => [u.code, Number(u.mrp)]))
      d.products = d.products.map((p) => (m.has(p.Product_Code) ? { ...p, MRP: m.get(p.Product_Code) } : p))
      return d
    }
    case 'saveProduct': {
      const p = op.product
      const row = { Product_Code: p.code, Product_Name: p.name, MRP: Number(p.mrp), Category: p.category, Active_Status: p.active === false ? 'Inactive' : 'Active' }
      const exists = d.products.some((x) => x.Product_Code === p.code)
      d.products = exists ? d.products.map((x) => (x.Product_Code === p.code ? row : x)) : [...d.products, row]
      return d
    }
    case 'saveTemplate': {
      const t = op.template
      const row = { Key: t.key, Name: t.name, Type: t.type, Text: t.text }
      const list = d.templates || []
      d.templates = list.some((x) => x.Key === t.key) ? list.map((x) => (x.Key === t.key ? row : x)) : [...list, row]
      return d
    }
    case 'saveCampaign': {
      const c = op.campaign
      const list = d.campaigns || []
      const old = list.find((x) => x.Campaign_ID === c.id)
      const row = { Campaign_ID: c.id, Name: c.name, Type: c.type, Text: c.text, Audience: c.audience, Numbers: c.numbers || '', Created_At: c.createdAt, Sent: old?.Sent || '[]' }
      d.campaigns = old ? list.map((x) => (x.Campaign_ID === c.id ? row : x)) : [...list, row]
      return d
    }
    case 'deleteCampaign':
      d.campaigns = (d.campaigns || []).filter((x) => x.Campaign_ID !== op.id)
      return d
    case 'markCampaignSent':
      d.campaigns = (d.campaigns || []).map((x) => {
        if (x.Campaign_ID !== op.id) return x
        let sent = []
        try {
          sent = JSON.parse(x.Sent || '[]')
        } catch { /* empty */ }
        sent = op.undo ? sent.filter((p) => p !== op.phone) : sent.includes(op.phone) ? sent : [...sent, op.phone]
        return { ...x, Sent: JSON.stringify(sent) }
      })
      return d
    case 'deleteTemplate':
      d.templates = (d.templates || []).filter((x) => x.Key !== op.key)
      return d
    default:
      return d
  }
}

/* --------------------------------------------------------------- demo mode */

/** Demo login (only when config.json has no apiUrl). */
export const DEMO_LOGIN = { username: 'drsp', password: 'demo' }

const SEED_PRODUCTS = [
  ['MNG-250', 'Mango - 250gm', 249, 'Veg Pickle'],
  ['MNG-500', 'Mango - 500gm', 449, 'Veg Pickle'],
  ['MNG-1000', 'Mango - 1000gm', 799, 'Veg Pickle'],
  ['CHK-BL-250', 'Chicken Boneless - 250gm', 399, 'Non-Veg Pickle'],
  ['CHK-BL-500', 'Chicken Boneless - 500gm', 749, 'Non-Veg Pickle'],
  ['CHK-BL-1000', 'Chicken Boneless - 1000gm', 1399, 'Non-Veg Pickle'],
  ['PRW-100', 'Prawns - 100gm', 200, 'Non-Veg Pickle'],
  ['PRW-250', 'Prawns - 250gm', 499, 'Non-Veg Pickle'],
  ['PRW-500', 'Prawns - 500gm', 899, 'Non-Veg Pickle'],
  ['FSH-250', 'Fish - 250gm', 399, 'Non-Veg Pickle'],
  ['FSH-500', 'Fish - 500gm', 749, 'Non-Veg Pickle'],
  ['CMB-CHK-PRW-250', 'Chicken + Prawns 250g', 849, 'Combo Pack'],
  ['MTN-BL-100', 'Mutton Boneless - 100gm', 349, 'Non-Veg Pickle'],
  ['PWD-CHK-100', 'Powder - Chicken - 100g', 100, 'Spices / Powders'],
].map(([c, n, m, cat]) => ({ Product_Code: c, Product_Name: n, MRP: m, Category: cat, Active_Status: 'Active' }))

function seedDemo() {
  const t = todayStr()
  const cust = [
    ['Lakshmi Reddy', '9848012345', 'Kukatpally, Hyderabad'],
    ['Ravi Kumar', '9701234567', 'Madhapur, Hyderabad'],
    ['Anitha Rao', '9866543210', 'Vijayawada'],
    ['Suresh Babu', '9123456780', 'Guntur'],
    ['Priya Sharma', '8885551234', 'Banjara Hills, Hyderabad'],
    ['Kiran Varma', '7799001122', 'Secunderabad'],
  ]
  const plan = [
    [-62, 0, [['MNG-1000', 2], ['CHK-BL-500', 1]], 'Delivered', 'UPI', 'Packed'],
    [-45, 1, [['PRW-250', 2]], 'Delivered', 'Cash', 'Packed'],
    [-40, 2, [['CHK-BL-1000', 1], ['FSH-500', 1]], 'Delivered', 'UPI', 'Packed'],
    [-35, 0, [['MNG-500', 3]], 'Delivered', 'UPI', 'Packed'],
    [-20, 3, [['MTN-BL-100', 2], ['PWD-CHK-100', 2]], 'Delivered', 'Cash', 'Packed'],
    [-12, 4, [['CMB-CHK-PRW-250', 1]], 'Delivered', 'UPI', 'Packed'],
    [-6, 1, [['CHK-BL-500', 2]], 'Out for Delivery', 'UPI', 'Packed'],
    [-3, 5, [['MNG-250', 4], ['PRW-100', 2]], 'Pending', 'Unpaid', 'Packed'],
    [-1, 2, [['FSH-250', 2]], 'Pending', 'Unpaid', 'In Batch'],
    [0, 4, [['CHK-BL-250', 1], ['MNG-500', 1]], 'Pending', 'UPI', 'Pending'],
    [0, 3, [['PRW-500', 1]], 'Pending', 'Unpaid', 'Pending'],
  ]
  let data = { products: SEED_PRODUCTS, orders: [], expenses: [], templates: [] }
  plan.forEach(([day, ci, items, del, pay, prep], n) => {
    const date = addDays(t, day)
    const [name, phone, address] = cust[ci]
    const id = `ORD-${date.replace(/-/g, '')}-${String(100 + n)}`
    data = applyOp(
      data,
      {
        action: 'addOrder',
        order: {
          orderId: id, date, customerName: name, phone, address,
          items: items.map(([code, qty]) => {
            const p = SEED_PRODUCTS.find((x) => x.Product_Code === code)
            return { code, name: p.Product_Name, qty, mrp: p.MRP, discount: qty > 2 ? 50 : 0 }
          }),
          deliveryCharge: n % 3 === 0 ? 60 : 0, prep, payment: pay, delivery: del,
          notes: n === 9 ? 'Less spicy please' : '', dueDate: day >= -1 ? addDays(t, day + 3) : '',
          leadBy: ['Sasi', 'Amma'][n % 2],
        },
      },
    )
  })
  const exp = [
    [-50, 'Raw Material', 'Mangoes 40kg', 2400], [-48, 'Masala & Oil', 'Gingelly oil 15L', 3300],
    [-30, 'Packaging', 'Glass jars x100', 2200], [-25, 'Raw Material', 'Chicken 10kg', 2600],
    [-10, 'Raw Material', 'Prawns 5kg', 3000], [-8, 'Travel', 'Courier drop-offs', 450],
    [-2, 'Masala & Oil', 'Chilli powder & spices', 1200],
  ]
  exp.forEach(([day, cat, item, amt], n) => {
    const date = addDays(t, day)
    data = applyOp(data, { action: 'addExpense', expense: { expenseId: `EXP-${date.replace(/-/g, '')}-${100 + n}`, date, category: cat, item, amount: amt, leadBy: 'Sasi' } })
  })
  // delivered demo orders: pretend they were delivered 2 days after ordering
  data.orders = data.orders.map((r) =>
    r.Delivery_Status === 'Delivered' ? { ...r, Delivered_At: addDays(String(r.Date), 2), Feedback_Sent: String(r.Date) < addDays(t, -30) ? 'Yes' : '' } : r,
  )
  return data
}

function demoDb() {
  try {
    const db = JSON.parse(localStorage.getItem('drsp_demo_db') || 'null')
    if (db) return { templates: [], campaigns: [], ...db }
  } catch { /* ignore */ }
  const db = seedDemo()
  localStorage.setItem('drsp_demo_db', JSON.stringify(db))
  return db
}

async function demoCall(action, payload) {
  await new Promise((r) => setTimeout(r, 250))
  if (action === 'login') {
    const ok = String(payload.username || '').trim().toLowerCase() === DEMO_LOGIN.username && payload.password === DEMO_LOGIN.password
    if (!ok) throw new ApiError('WRONG_LOGIN')
    return { session: 'demo:session', user: { username: DEMO_LOGIN.username } }
  }
  if (payload.session !== 'demo:session') throw new ApiError('SESSION_EXPIRED')
  if (action === 'logout') return null
  if (action === 'changePassword') throw new ApiError('DEMO_ONLY')
  if (action === 'saveSettings') {
    const cur = { ...JSON.parse(localStorage.getItem('drsp_demo_settings') || '{}'), ...payload.settings }
    localStorage.setItem('drsp_demo_settings', JSON.stringify(cur))
    return cur
  }
  const db = demoDb()
  if (action === 'sync') return { ...db, files: JSON.parse(localStorage.getItem('drsp_demo_files') || '{}'), settings: JSON.parse(localStorage.getItem('drsp_demo_settings') || '{}'), user: { username: DEMO_LOGIN.username }, serverTime: new Date().toISOString() }
  const next = applyOp(db, { action, ...payload })
  localStorage.setItem('drsp_demo_db', JSON.stringify(next))
  return { ok: true }
}

export function resetDemo() {
  localStorage.removeItem('drsp_demo_db')
}

export { makeId }
