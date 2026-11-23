import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, MessageCircle, Paperclip, Send } from 'lucide-react'
import { useStore } from '../lib/store'
import { getConfig } from '../lib/api'
import { customerCtx, fillTemplate, orderCtx } from '../lib/templates'
import { FILE_KINDS, MENU_KINDS, shareFiles, useFiles } from '../lib/files'
import { waLink } from '../lib/utils'
import { Button, Sheet, cx } from './ui'

/** Builds the filled-in text of a template for an order or a customer. */
export function useMessage() {
  const { activeProducts, customers, files } = useStore()
  return (tpl, { order, phone, name } = {}) => {
    if (!tpl) return ''
    const cfg = getConfig()
    const c = customers.find((x) => x.phone === (order?.phone || phone))
    const extra = { menuLink: files.menu_pdf?.url || files.menu_image?.url || '', products: activeProducts, favorite: c?.favorite }
    const ctx = order ? orderCtx(order, cfg, extra) : customerCtx({ name: name || c?.name, favorite: c?.favorite }, cfg, extra)
    return fillTemplate(tpl.text, ctx)
  }
}

/** Which uploaded files go with a message: menu files for menu messages, QR for payment. */
export function attachmentsFor(tpl) {
  if (!tpl) return []
  if (tpl.key === 'payment') return ['upi_qr']
  if (tpl.key === 'menu' || tpl.key === 'menu_text' || tpl.text.includes('{menu_link}')) return MENU_KINDS
  return []
}

/** "Step 2" button: attach the photo / PDF / QR through the share menu. */
export function AttachButton({ kinds, who, className }) {
  const { files, callNow, notify } = useStore()
  const { loading, recs } = useFiles(kinds, files, callNow)
  const have = kinds.filter((k) => files[k])
  if (!have.length) return null
  const labels = have.length === 2 && have.includes('menu_pdf') ? 'menu photo + PDF' : have.map((k) => (FILE_KINDS.find((x) => x.kind === k)?.label || 'photo').replace(' (scanner)', '')).join(' + ')
  const go = async () => {
    const r = await shareFiles(recs)
    if (r === 'downloaded') notify('This phone can’t attach from the app — the file was downloaded. Attach it in WhatsApp.', 'info')
  }
  return (
    <div className={className}>
      <Button variant="outline" size="lg" className="w-full" disabled={loading || !recs.length} onClick={go}>
        {loading ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />} 2. Attach {labels}
      </Button>
      <p className="mt-1 text-xs text-slate-500">WhatsApp asks which chat — tap {who || 'the customer'} (at the top, since you just opened their chat).</p>
    </div>
  )
}

/**
 * Pick a message → check / edit it → open WhatsApp on the customer's number,
 * then (if there is a menu / QR file) attach it in one more tap.
 */
export function MessageSheet({ open, onClose, order, phone, name, suggested }) {
  const { templates, mutate } = useStore()
  const build = useMessage()
  const list = useMemo(() => {
    const l = templates.filter((t) => order || t.type === 'customer')
    return suggested ? [...l.filter((t) => t.key === suggested), ...l.filter((t) => t.key !== suggested)] : l
  }, [templates, order, suggested])
  const [key, setKey] = useState(suggested || list[0]?.key)
  const [text, setText] = useState('')
  const [opened, setOpened] = useState(false)
  const tpl = list.find((t) => t.key === key) || list[0]
  const to = order?.phone || phone
  const who = order?.customerName || name

  useEffect(() => {
    if (open) {
      setKey(suggested || list[0]?.key)
      setOpened(false)
    }
  }, [open, suggested]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open && tpl) setText(build(tpl, { order, phone, name }))
  }, [open, tpl?.key, tpl?.text, order, phone, name]) // eslint-disable-line react-hooks/exhaustive-deps

  const kinds = attachmentsFor(tpl)
  const sent = () => {
    if (order && tpl?.key === 'feedback' && !order.feedbackSent) mutate('updateOrder', { orderId: order.orderId, fields: { Feedback_Sent: 'Yes' } })
    setOpened(true)
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Message ${who || (to ? '+91 ' + to : '')}`}>
      <div className="no-scrollbar -mx-5 mb-3 flex gap-2 overflow-x-auto px-5">
        {list.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setKey(t.key)
              setOpened(false)
            }}
            className={cx('h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-semibold', t.key === tpl?.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700')}
          >
            {t.name}
          </button>
        ))}
      </div>
      <textarea
        className="h-60 w-full rounded-xl bg-slate-50 p-3 text-sm text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-600"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <p className="mb-3 mt-1 text-xs text-slate-500">Change the words here just for this customer, or for everyone in More → Messages.</p>
      <a href={waLink(to, text)} target="_blank" rel="noreferrer" onClick={sent} className="block">
        <Button variant="whatsapp" size="lg" className="w-full">
          {opened ? <Check size={20} /> : <Send size={20} />} {kinds.length ? '1. Open WhatsApp with message' : 'Open WhatsApp'}
        </Button>
      </a>
      {kinds.length > 0 && <AttachButton kinds={kinds} who={who} className="mt-2" />}
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
