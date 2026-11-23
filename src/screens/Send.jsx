import { useMemo, useState } from 'react'
import { ChevronRight, Crown, FileText, Image as ImageIcon, MessageCircle, Pencil, Send as SendIcon, UserCheck } from 'lucide-react'
import { useStore } from '../lib/store'
import { cleanPhone, inr, isValidPhone, prettyDate, waLink } from '../lib/utils'
import { shareMenuFile, useMenuFiles } from '../lib/menu'
import { Badge, Button, Card, Field, SectionTitle, inputCls } from '../components/ui'
import { MessageSheet, useMessage } from '../components/Messages'

export default function Send() {
  const { customers, templates, notify } = useStore()
  const menu = useMenuFiles()
  const build = useMessage()
  const [raw, setRaw] = useState('')
  const [name, setName] = useState('')
  const [sheet, setSheet] = useState(null) // template key being edited
  const [touched, setTouched] = useState(false)

  const phone = cleanPhone(raw)
  const ok = isValidPhone(phone)
  const known = useMemo(() => (ok ? customers.find((c) => c.phone === phone) : null), [ok, phone, customers])
  const who = name.trim() || known?.name || ''

  const hasFiles = menu.image || menu.pdf
  const menuTpl = templates.find((t) => t.key === (hasFiles || menu.link ? 'menu' : 'menu_text'))
  const others = templates.filter((t) => t.type === 'customer' && t.key !== 'menu' && t.key !== 'menu_text')
  const menuMsg = menuTpl ? build(menuTpl, { phone, name: who }) : ''

  const guard = (e) => {
    setTouched(true)
    if (!ok) {
      e?.preventDefault()
      notify('Enter the customer’s 10-digit WhatsApp number first', 'error')
      return false
    }
    return true
  }

  const share = async (kind) => {
    const r = await shareMenuFile(kind, menuMsg)
    if (r === 'unsupported') notify('This phone can’t attach files from the app — the file was downloaded instead. Attach it in WhatsApp.', 'info')
  }

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-black text-slate-900">Send to customer</h1>

      <Card className="space-y-3 p-4">
        <Field label="Customer WhatsApp number" error={touched && !ok ? 'Enter a 10-digit mobile number (starts with 6–9)' : ''}>
          <div className="flex items-center rounded-xl bg-white ring-1 ring-slate-300 focus-within:ring-2 focus-within:ring-indigo-600">
            <span className="pl-3 font-semibold text-slate-500">+91</span>
            <input
              className="h-14 w-full rounded-xl bg-transparent px-2 text-xl font-semibold tracking-wider outline-none"
              type="tel"
              inputMode="numeric"
              autoComplete="off"
              placeholder="98480 12345"
              value={raw}
              onChange={(e) => setRaw(cleanPhone(e.target.value).slice(0, 10))}
            />
          </div>
        </Field>
        {known ? (
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-3 text-sm ring-1 ring-emerald-200">
            {known.tier === 'VIP' ? <Crown size={20} className="text-amber-500" /> : <UserCheck size={20} className="text-emerald-600" />}
            <div className="min-w-0 flex-1">
              <div className="font-bold text-emerald-900">
                {known.name} <Badge className="ml-1 bg-emerald-600 text-white">{known.tier}</Badge>
              </div>
              <div className="text-emerald-800">
                {known.totalOrders} orders · {inr(known.totalSpent)} · last {prettyDate(known.lastOrder)}
              </div>
            </div>
          </div>
        ) : (
          <Field label="Name (optional)" hint="Used in the greeting, e.g. “Namaste Ravi!”">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" autoComplete="off" />
          </Field>
        )}
      </Card>

      <SectionTitle>Menu</SectionTitle>
      <Card className="space-y-3 p-4">
        <a href={ok ? waLink(phone, menuMsg) : '#'} target="_blank" rel="noreferrer" onClick={guard} className="block">
          <Button variant="whatsapp" size="lg" className="w-full">
            <SendIcon size={20} /> Send menu on WhatsApp
          </Button>
        </a>
        <p className="text-xs text-slate-500">
          {hasFiles
            ? 'Opens this customer’s chat with the menu message and a link to your menu photo & PDF. WhatsApp shows the photo in the chat.'
            : menu.loading
              ? 'Checking menu files…'
              : 'Menu photo & PDF are not added yet, so this sends the price list as text for now.'}
        </p>
        {hasFiles && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {menu.image && (
                <Button variant="outline" onClick={() => share('image')}>
                  <ImageIcon size={18} /> Share photo
                </Button>
              )}
              {menu.pdf && (
                <Button variant="outline" onClick={() => share('pdf')}>
                  <FileText size={18} /> Share PDF
                </Button>
              )}
            </div>
            <p className="text-xs text-slate-500">“Share” attaches the actual file. WhatsApp then asks which chat — pick the customer (open their chat first with the green button so they’re at the top).</p>
          </>
        )}
        <Button variant="ghost" size="sm" onClick={() => setSheet(menuTpl?.key)}>
          <Pencil size={16} /> Change the words first
        </Button>
      </Card>

      <SectionTitle>Other messages</SectionTitle>
      <Card className="divide-y divide-slate-100">
        {others.map((t) => (
          <button
            key={t.key}
            onClick={() => (ok ? setSheet(t.key) : guard())}
            className="flex w-full items-center gap-3 p-4 text-left active:bg-slate-50"
          >
            <MessageCircle size={20} className="shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-900">{t.name}</div>
              <div className="truncate text-xs text-slate-500">{t.text.replace(/\s+/g, ' ').slice(0, 80)}</div>
            </div>
            <ChevronRight size={18} className="text-slate-400" />
          </button>
        ))}
        {others.length === 0 && <p className="p-4 text-sm text-slate-500">Add your own messages (offers, festival greetings) in More → Messages.</p>}
      </Card>

      <MessageSheet open={!!sheet} onClose={() => setSheet(null)} phone={ok ? phone : ''} name={who} suggested={sheet} />
    </div>
  )
}
