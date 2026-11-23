import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, MessageCircle, Send } from 'lucide-react'
import { useStore } from '../lib/store'
import { getConfig } from '../lib/api'
import { customerCtx, fillTemplate, orderCtx } from '../lib/templates'
import { useMenuFiles } from '../lib/menu'
import { waLink } from '../lib/utils'
import { Button, Sheet, cx } from './ui'

/** Builds the filled-in text of a template for an order or a customer. */
export function useMessage() {
  const { activeProducts, customers } = useStore()
  const menu = useMenuFiles()
  return (tpl, { order, phone, name } = {}) => {
    const cfg = getConfig()
    const c = customers.find((x) => x.phone === (order?.phone || phone))
    const extra = { menuLink: menu.link, products: activeProducts, favorite: c?.favorite }
    const ctx = order ? orderCtx(order, cfg, extra) : customerCtx({ name: name || c?.name, favorite: c?.favorite }, cfg, extra)
    return fillTemplate(tpl.text, ctx)
  }
}

/**
 * Pick a message → check / edit it → open WhatsApp on the customer's number.
 * The final tap on Send happens inside WhatsApp (no ban risk).
 */
export function MessageSheet({ open, onClose, order, phone, name, suggested, onSent }) {
  const { templates, mutate } = useStore()
  const build = useMessage()
  const menu = useMenuFiles()
  const list = useMemo(() => {
    const l = templates.filter((t) => order || t.type === 'customer')
    return suggested ? [...l.filter((t) => t.key === suggested), ...l.filter((t) => t.key !== suggested)] : l
  }, [templates, order, suggested])
  const [key, setKey] = useState(suggested || list[0]?.key)
  const [text, setText] = useState('')
  const tpl = list.find((t) => t.key === key) || list[0]
  const to = order?.phone || phone

  useEffect(() => {
    if (open) setKey(suggested || list[0]?.key)
  }, [open, suggested]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open && tpl) setText(build(tpl, { order, phone, name }))
  }, [open, tpl?.key, tpl?.text, order, phone, name]) // eslint-disable-line react-hooks/exhaustive-deps

  const missingMenu = tpl?.text.includes('{menu_link}') && !menu.link && !menu.loading
  const sent = () => {
    if (order && tpl?.key === 'feedback' && !order.feedbackSent) mutate('updateOrder', { orderId: order.orderId, fields: { Feedback_Sent: 'Yes' } })
    onSent?.(tpl?.key)
    setTimeout(onClose, 300) // let the WhatsApp link open first
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Message ${order?.customerName || name || (to ? '+91 ' + to : '')}`}>
      <div className="no-scrollbar -mx-5 mb-3 flex gap-2 overflow-x-auto px-5">
        {list.map((t) => (
          <button
            key={t.key}
            onClick={() => setKey(t.key)}
            className={cx(
              'h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-semibold',
              t.key === tpl?.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700',
              t.key === suggested && t.key !== tpl?.key && 'ring-2 ring-emerald-500',
            )}
          >
            {t.name}
          </button>
        ))}
      </div>
      {missingMenu && (
        <p className="mb-2 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900">
          <AlertTriangle size={18} className="shrink-0" /> Menu photo/PDF not added yet, so the link line is left out. Use “Menu (price list as text)” for now.
        </p>
      )}
      <textarea
        className="h-64 w-full rounded-xl bg-slate-50 p-3 text-sm text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-600"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <p className="mb-3 mt-1 text-xs text-slate-500">You can change the words here just for this customer. To change it for everyone, edit it in More → Messages.</p>
      <a href={waLink(to, text)} target="_blank" rel="noreferrer" onClick={sent} className="block">
        <Button variant="whatsapp" size="lg" className="w-full">
          <Send size={20} /> Open WhatsApp
        </Button>
      </a>
      {order?.feedbackSent && tpl?.key === 'feedback' && (
        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-emerald-700">
          <Check size={14} /> Feedback was already asked for this order
        </p>
      )}
    </Sheet>
  )
}

/** Green WhatsApp button that opens the message sheet. */
export function MessageButton({ order, phone, name, suggested, label = 'WhatsApp', size, className, variant = 'whatsapp' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        <MessageCircle size={18} /> {label}
      </Button>
      <MessageSheet open={open} onClose={() => setOpen(false)} order={order} phone={phone} name={name} suggested={suggested} />
    </>
  )
}
