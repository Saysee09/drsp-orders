import { cleanPhone, daysBetween, isValidPhone, todayStr } from './utils'

export const CAMPAIGN_TYPES = [
  {
    id: 'Offer',
    emoji: '🎉',
    text: `Namaste {first_name}! 🙏

🎉 *Special offer from {business}*
Write your offer here (e.g. 10% off on all 500g jars this week).

Reply here to order. 🏺`,
  },
  {
    id: 'Festival',
    emoji: '🪔',
    text: `Namaste {first_name}! 🪔

Wishing you and your family a very happy festival from all of us at *{business}*!

Festival special: write the special here.

Reply here to book your jars. 🏺`,
  },
  {
    id: 'New batch',
    emoji: '🏺',
    text: `Namaste {first_name}! 🏺

A fresh batch is ready at *{business}* — write which pickles here.

Limited jars. Reply here to book yours!`,
  },
  {
    id: 'We miss you',
    emoji: '💛',
    text: `Namaste {first_name}! 🙏

It's been a while since your last order from *{business}*.
Running low on your favourite *{favorite}*?

Fresh batches are being made this week. Reply here and we will keep a jar ready for you! 🏺`,
  },
  { id: 'Other', emoji: '💬', text: 'Namaste {first_name}! 🙏\n\n' },
]
export const typeOf = (id) => CAMPAIGN_TYPES.find((t) => t.id === id) || CAMPAIGN_TYPES[CAMPAIGN_TYPES.length - 1]

export const LAPSED_DAYS = 30
export const AUDIENCES = [
  { id: 'all', label: 'All customers', test: () => true },
  { id: 'lapsed', label: `Not ordered in ${LAPSED_DAYS}+ days`, test: (c, t) => c.lastOrder && daysBetween(c.lastOrder, t) > LAPSED_DAYS },
  { id: 'vip', label: 'VIP', test: (c) => c.tier === 'VIP' },
  { id: 'regular', label: 'Regular', test: (c) => c.tier === 'Regular' },
  { id: 'new', label: 'New', test: (c) => c.tier === 'New' },
  { id: 'none', label: 'Only numbers I add', test: () => false },
]

/** "Ravi 98480 12345" / "9848012345" lines → [{ phone, name }] */
export function parseNumbers(text) {
  const out = []
  for (const line of String(text || '').split(/\n|,|;/)) {
    const digits = line.replace(/\D/g, '')
    const phone = cleanPhone(digits.slice(-12))
    if (!isValidPhone(phone)) continue
    const name = line.replace(/[+\d\s()-]{6,}/g, ' ').replace(/[-–:]+/g, ' ').trim()
    out.push({ phone, name })
  }
  return out
}

/** Everyone this campaign goes to (customer list + typed numbers, no duplicates). */
export function recipientsOf(c, customers, today = todayStr()) {
  const aud = AUDIENCES.find((a) => a.id === c.Audience) || AUDIENCES[0]
  const map = new Map()
  for (const cu of customers) if (aud.test(cu, today)) map.set(cu.phone, { phone: cu.phone, name: cu.name, favorite: cu.favorite })
  for (const p of parseNumbers(c.Numbers)) {
    if (map.has(p.phone)) continue
    const cu = customers.find((x) => x.phone === p.phone)
    map.set(p.phone, { phone: p.phone, name: p.name || cu?.name || '', favorite: cu?.favorite || '' })
  }
  return [...map.values()]
}

export function sentOf(c) {
  try {
    return new Set(JSON.parse(c.Sent || '[]'))
  } catch {
    return new Set()
  }
}
