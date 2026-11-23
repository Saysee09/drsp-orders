import { PAY_LABEL, inr, isValidUpi, menuText, prettyDate, upiUri } from './utils'

/**
 * WhatsApp message templates.
 * Built-in ones can be edited in the app (the edit is saved to the Templates tab)
 * and reset back to these defaults. Families can also add their own.
 *
 * type 'customer' → needs only a phone number (menu, reminders, offers)
 * type 'order'    → sent from an order (confirmation, payment, on the way…)
 *
 * A line whose {placeholder} has no value is left out automatically,
 * e.g. "Expected by: {due_date}" disappears when there is no date.
 */
export const DEFAULT_TEMPLATES = [
  {
    key: 'menu',
    name: 'Menu (photo + PDF link)',
    type: 'customer',
    text: `Namaste {first_name}! 🙏

Here is the *{business}* menu 🏺
👉 {menu_link}

Fresh, authentic, homemade pickles made with premium ingredients.

📞 Reply here with your choice and delivery address to place an order!`,
  },
  {
    key: 'menu_text',
    name: 'Menu (price list as text)',
    type: 'customer',
    text: `*{business} — MENU* 🏺

Namaste {first_name}! 🙏 Fresh, authentic, homemade pickles made with premium ingredients.

{menu_text}

📞 Reply here with your choice and delivery address to place an order!`,
  },
  {
    key: 'order_confirm',
    name: 'Order confirmation',
    type: 'order',
    text: `*ORDER CONFIRMATION — {business}* 📦

*Order ID:* {order_id}
*Name:* {name}

*Items:*
{items}
*Total:* {total}

*Payment:* {payment_status}
*Expected by:* {due_date}

Thank you for supporting our family business! 🙏`,
  },
  {
    key: 'payment',
    name: 'Payment request (UPI)',
    type: 'order',
    text: `*PAYMENT REQUEST — {business}* 🧾

Namaste {first_name}! 🙏

*Order ID:* {order_id}
{items}
*Amount to pay:* {amount_due}

*Pay by UPI to:* {upi_id}
GPay / PhonePe / Paytm — any UPI app works.

Tap to pay: {upi_link}

Please send a screenshot here once paid. Thank you! 🏺`,
  },
  {
    key: 'on_the_way',
    name: 'Out for delivery',
    type: 'order',
    text: `Namaste {first_name}! 🚚

Your *{business}* order is *out for delivery* and will reach you soon.

*Order ID:* {order_id}
{items}
*Total:* {total}
{payment_line}

Delivering to: {address}

Thank you! 🏺`,
  },
  {
    key: 'delivered',
    name: 'Delivered — thank you',
    type: 'order',
    text: `Namaste {first_name}! ✅

Your *{business}* order {order_id} has been delivered. We hope you enjoy every bite! 🏺

Tip: always use a dry spoon and keep the lid tight so the pickle stays fresh for longer.

Thank you for supporting our family kitchen! 🙏`,
  },
  {
    key: 'feedback',
    name: 'Ask for feedback',
    type: 'order',
    text: `Namaste {first_name}! 🙏

Hope you are enjoying your *{items_short}* from *{business}*!

How did you like it? Please reply with a rating ⭐ 1–5 and a line about the taste, spice and freshness. Your feedback helps our small family kitchen a lot.

If you loved it, a quick review here would mean the world to us: {review_link}

Thank you for supporting us! 🏺`,
  },
  {
    key: 'nudge',
    name: 'Reorder reminder',
    type: 'customer',
    text: `Namaste {first_name}! 🙏

It's been a while since your last order from *{business}*.
Running low on your favourite *{favorite}*?

Fresh batches are being made this week. Just reply here and we will keep a jar ready for you! 🏺`,
  },
]

export const DEFAULT_KEYS = new Set(DEFAULT_TEMPLATES.map((t) => t.key))

/** What each placeholder means — shown in the template editor. */
export const PLACEHOLDERS = [
  ['first_name', 'Customer first name'],
  ['name', 'Customer full name'],
  ['business', 'Business name'],
  ['menu_link', 'Link to menu photo & PDF'],
  ['menu_text', 'Price list from the catalog'],
  ['order_id', 'Order ID'],
  ['items', 'Items with qty & price'],
  ['items_short', 'Pickle names only'],
  ['total', 'Order total'],
  ['amount_due', 'Amount still to pay'],
  ['payment_status', 'Paid / Unpaid'],
  ['payment_line', 'Pay-now line or "Payment received"'],
  ['upi_id', 'Your UPI ID'],
  ['upi_link', 'Tap-to-pay UPI link'],
  ['due_date', 'Deliver-by date'],
  ['address', 'Delivery address'],
  ['favorite', 'Customer’s usual pickle'],
  ['review_link', 'Review link'],
]
const KNOWN = new Set(PLACEHOLDERS.map((p) => p[0]))

/** Sheet rows + defaults → list of templates (sheet edits win). */
export function mergeTemplates(rows = []) {
  const saved = new Map(rows.filter((r) => r.Key).map((r) => [String(r.Key), { key: String(r.Key), name: String(r.Name || r.Key), type: r.Type === 'order' ? 'order' : 'customer', text: String(r.Text || '') }]))
  const out = DEFAULT_TEMPLATES.map((d) => ({ ...d, ...(saved.get(d.key) || {}), builtIn: true, edited: saved.has(d.key) }))
  for (const [k, t] of saved) if (!DEFAULT_KEYS.has(k)) out.push({ ...t, builtIn: false })
  return out
}

/** Fills {placeholders}. Lines with an empty placeholder are dropped. */
export function fillTemplate(text, ctx) {
  const lines = String(text || '').split('\n')
  const out = []
  for (const line of lines) {
    let empty = false
    const filled = line.replace(/\{(\w+)\}/g, (m, key) => {
      if (!KNOWN.has(key)) return m
      const v = ctx[key]
      if (v === undefined || v === null || String(v).trim() === '') {
        empty = true
        return ''
      }
      return String(v)
    })
    if (!empty) out.push(filled)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || 'there'

function baseCtx(cfg, extra) {
  return {
    business: cfg.businessName || 'DRSP Homemade Pickles',
    menu_link: extra.menuLink || '',
    menu_text: extra.products ? menuText(extra.products).split('\n').slice(3, -2).join('\n').trim() : '',
    upi_id: isValidUpi(cfg.upiId) ? cfg.upiId + (cfg.upiName ? ` (${cfg.upiName})` : '') : '',
    review_link: cfg.reviewLink || '',
  }
}

/** Context for messages that only need a customer (menu, reminders, offers). */
export function customerCtx({ name, favorite } = {}, cfg, extra = {}) {
  return { ...baseCtx(cfg, extra), first_name: firstName(name), name: name || '', favorite: favorite || '' }
}

/** Context for messages about an order. */
export function orderCtx(o, cfg, extra = {}) {
  const due = o.payment === 'Unpaid' ? o.total : 0
  const upiOk = isValidUpi(cfg.upiId)
  const items = [
    ...o.items.map((i) => `• ${i.name} x ${i.qty} — ${inr(i.sold)}${i.discount ? ` (incl. ${inr(i.discount)} off)` : ''}`),
    ...(o.deliveryCharge ? [`• Delivery — ${inr(o.deliveryCharge)}`] : []),
  ].join('\n')
  return {
    ...customerCtx({ name: o.customerName, favorite: extra.favorite }, cfg, extra),
    order_id: o.orderId,
    items,
    items_short: [...new Set(o.items.map((i) => String(i.name).split(' - ')[0]))].join(', '),
    total: inr(o.total),
    amount_due: due ? inr(due) : '',
    payment_status: o.payment === 'Unpaid' ? 'Unpaid' : `Paid (${PAY_LABEL[o.payment] || o.payment})`,
    payment_line: due ? `*To pay:* ${inr(due)}${upiOk ? ` — UPI ${cfg.upiId} or cash` : ''}` : '✅ Payment received — thank you!',
    upi_link: upiOk && due ? upiUri(cfg, due, o.orderId) : '',
    due_date: o.dueDate ? prettyDate(o.dueDate) : '',
    address: o.address || '',
  }
}

/** Sample data for the editor preview. */
export const SAMPLE_ORDER = {
  orderId: 'ORD-20261201-K7P',
  customerName: 'Lakshmi Reddy',
  phone: '9848012345',
  items: [
    { name: 'Mango - 500gm', qty: 2, sold: 898, discount: 0 },
    { name: 'Chicken Boneless - 250gm', qty: 1, sold: 399, discount: 0 },
  ],
  deliveryCharge: 60,
  total: 1357,
  payment: 'Unpaid',
  dueDate: '',
  address: 'Kukatpally, Hyderabad',
}
