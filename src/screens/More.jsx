import { useRef, useState } from 'react'
import { ArrowLeft, ChevronRight, ExternalLink, FileText, Image as ImageIcon, KeyRound, ListOrdered, LogOut, MessageSquareText, Plus, RotateCcw, Save, Smartphone, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { getConfig } from '../lib/api'
import { PLACEHOLDERS, SAMPLE_ORDER, customerCtx, fillTemplate, orderCtx } from '../lib/templates'
import { menuFileUrl, useMenuFiles } from '../lib/menu'
import { Badge, Button, Card, Field, SectionTitle, Segmented, Sheet, inputCls } from '../components/ui'
import Admin from './Admin'

function Row({ icon: Icon, title, sub, onClick, right }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 p-4 text-left active:bg-slate-50">
      <Icon size={22} className="shrink-0 text-indigo-600" />
      <div className="min-w-0 flex-1">
        <div className="font-bold text-slate-900">{title}</div>
        {sub && <div className="truncate text-xs text-slate-500">{sub}</div>}
      </div>
      {right}
      <ChevronRight size={18} className="text-slate-400" />
    </button>
  )
}

/* ----------------------------------------------------------- messages */

function TemplateEditor({ tpl, onClose }) {
  const { mutate, notify, activeProducts } = useStore()
  const menu = useMenuFiles()
  const isNew = !tpl.key
  const [t, setT] = useState({ key: tpl.key || 'custom_' + Date.now().toString(36), name: tpl.name || '', type: tpl.type || 'customer', text: tpl.text || 'Namaste {first_name}! 🙏\n\n' })
  const ref = useRef(null)
  const set = (k, v) => setT((s) => ({ ...s, [k]: v }))
  const cfg = getConfig()
  const extra = { menuLink: menu.link || 'https://…/menu/', products: activeProducts, favorite: 'Mango - 500gm' }
  const preview = fillTemplate(t.text, t.type === 'order' ? orderCtx(SAMPLE_ORDER, cfg, extra) : customerCtx({ name: 'Lakshmi Reddy', favorite: 'Mango - 500gm' }, cfg, extra))

  const insert = (key) => {
    const el = ref.current
    const tag = `{${key}}`
    const at = el ? el.selectionStart : t.text.length
    const next = t.text.slice(0, at) + tag + t.text.slice(el ? el.selectionEnd : at)
    set('text', next)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(at + tag.length, at + tag.length)
    })
  }
  const save = () => {
    if (!t.name.trim() || !t.text.trim()) return notify('Give the message a name and some text', 'error')
    mutate('saveTemplate', { template: { ...t, name: t.name.trim() } })
    notify('Message saved', 'success')
    onClose()
  }

  return (
    <div className="space-y-3">
      <Field label="Name">
        <input className={inputCls} value={t.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Diwali offer" />
      </Field>
      {!tpl.builtIn && (
        <Field label="Send it from" hint="Order messages can use order details like items and total.">
          <Segmented options={['customer', 'order']} labels={{ customer: 'Send screen', order: 'An order' }} value={t.type} onChange={(v) => set('type', v)} />
        </Field>
      )}
      <Field label="Message">
        <textarea ref={ref} className={inputCls + ' h-56 py-2 text-sm'} value={t.text} onChange={(e) => set('text', e.target.value)} />
      </Field>
      <div>
        <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Tap to insert</div>
        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDERS.filter(([k]) => t.type === 'order' || !['order_id', 'items', 'items_short', 'total', 'amount_due', 'payment_status', 'payment_line', 'upi_link', 'due_date', 'address'].includes(k)).map(([k, label]) => (
            <button key={k} type="button" onClick={() => insert(k)} className="rounded-lg bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-800 active:bg-indigo-100" title={label}>
              {label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">A line is skipped automatically when its detail is empty (e.g. no delivery date).</p>
      </div>
      <div>
        <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Preview (sample customer)</div>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-[#e7ffdb] p-3 font-sans text-sm text-slate-800">{preview}</pre>
      </div>
      <Button size="lg" className="w-full" onClick={save}>
        <Save size={18} /> Save message
      </Button>
      {tpl.builtIn && tpl.edited && (
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => {
            mutate('deleteTemplate', { key: t.key })
            notify('Back to the original wording', 'success')
            onClose()
          }}
        >
          <RotateCcw size={18} /> Reset to original
        </Button>
      )}
      {!tpl.builtIn && !isNew && (
        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            if (!confirm(`Delete “${t.name}”?`)) return
            mutate('deleteTemplate', { key: t.key })
            notify('Message deleted')
            onClose()
          }}
        >
          <Trash2 size={18} /> Delete message
        </Button>
      )}
    </div>
  )
}

function Messages() {
  const { templates } = useStore()
  const [editing, setEditing] = useState(null)
  const group = (type) => templates.filter((t) => t.type === type)
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">These are the WhatsApp messages the app fills in for you. Change the words once here and every phone uses the new version.</p>
      {[
        ['customer', 'Sent from the Send screen'],
        ['order', 'Sent from an order'],
      ].map(([type, title]) => (
        <div key={type}>
          <SectionTitle>{title}</SectionTitle>
          <Card className="divide-y divide-slate-100">
            {group(type).map((t) => (
              <Row
                key={t.key}
                icon={MessageSquareText}
                title={t.name}
                sub={t.text.replace(/\s+/g, ' ').slice(0, 90)}
                onClick={() => setEditing(t)}
                right={t.builtIn && t.edited ? <Badge className="bg-indigo-100 text-indigo-800">edited</Badge> : !t.builtIn ? <Badge className="bg-amber-100 text-amber-800">yours</Badge> : null}
              />
            ))}
          </Card>
        </div>
      ))}
      <Button variant="dark" className="mt-3 w-full" onClick={() => setEditing({})}>
        <Plus size={18} /> New message (offer, greeting…)
      </Button>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.key ? 'Edit message' : 'New message'}>
        {editing && <TemplateEditor key={editing.key || 'new'} tpl={editing} onClose={() => setEditing(null)} />}
      </Sheet>
    </div>
  )
}

/* -------------------------------------------------------------- menu files */

function MenuFiles() {
  const menu = useMenuFiles()
  return (
    <Card className="space-y-3 p-4">
      <div className="flex gap-2">
        <Badge className={menu.image ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}>
          <ImageIcon size={12} className="mr-1" /> Photo {menu.image ? 'added' : 'missing'}
        </Badge>
        <Badge className={menu.pdf ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}>
          <FileText size={12} className="mr-1" /> PDF {menu.pdf ? 'added' : 'missing'}
        </Badge>
      </div>
      {menu.image && <img src={menuFileUrl('image')} alt="Menu" className="max-h-80 w-full rounded-xl object-contain ring-1 ring-slate-200" />}
      {menu.link ? (
        <a href={menu.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm font-semibold text-indigo-700">
          <ExternalLink size={16} /> See the page customers get
        </a>
      ) : null}
      <p className="text-xs text-slate-500">
        To add or update the menu, upload <b>menu.jpg</b> and <b>menu.pdf</b> into the <code>public/menu</code> folder of the GitHub repo (or send them to Claude). The app updates about a minute later.
      </p>
    </Card>
  )
}

/* ----------------------------------------------------------- login settings */

function Password({ onDone }) {
  const { callNow, notify, demo, auth } = useStore()
  const [f, setF] = useState({ current: '', username: auth?.user?.username || '', next: '', again: '' })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const err = f.next && f.next.length < 6 ? 'At least 6 characters' : f.again && f.again !== f.next ? 'Passwords don’t match' : ''
  const save = async () => {
    if (demo) return notify('Not available in demo mode', 'error')
    setBusy(true)
    try {
      await callNow('changePassword', { currentPassword: f.current, newPassword: f.next, newUsername: f.username })
      notify('Login changed. Other phones need to log in again with the new password.', 'success')
      onDone()
    } catch (e) {
      notify(e.code === 'WRONG_PASSWORD' ? 'Current password is wrong' : e.code ? `Could not change (${e.code})` : 'No internet — try again', 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="space-y-3 p-4">
      <Field label="Current password">
        <input className={inputCls} type="password" value={f.current} onChange={(e) => set('current', e.target.value)} />
      </Field>
      <Field label="Username">
        <input className={inputCls} autoCapitalize="none" value={f.username} onChange={(e) => set('username', e.target.value)} />
      </Field>
      <Field label="New password">
        <input className={inputCls} type="password" value={f.next} onChange={(e) => set('next', e.target.value)} />
      </Field>
      <Field label="New password again" error={err}>
        <input className={inputCls} type="password" value={f.again} onChange={(e) => set('again', e.target.value)} />
      </Field>
      <Button className="w-full" size="lg" disabled={busy || !f.current || !f.next || f.next !== f.again || f.next.length < 6} onClick={save}>
        <KeyRound size={18} /> {busy ? 'Saving…' : 'Change login'}
      </Button>
      <p className="text-xs text-slate-500">Changing it signs out every other phone. Tell the family the new password.</p>
    </Card>
  )
}

/* -------------------------------------------------------------------- More */

export default function More() {
  const { deviceName, setDeviceName, signOut, queue, auth, templates, data, notify } = useStore()
  const menu = useMenuFiles()
  const [view, setView] = useState(null)
  const [name, setName] = useState(deviceName)

  const views = {
    messages: ['Messages', <Messages key="m" />],
    catalog: ['Catalog & prices', <Admin key="c" />],
    password: ['Username & password', <Password key="p" onDone={() => setView(null)} />],
  }
  if (view)
    return (
      <div className="space-y-3">
        <button onClick={() => setView(null)} className="flex items-center gap-1 text-sm font-bold text-indigo-700">
          <ArrowLeft size={18} /> More
        </button>
        <h1 className="text-2xl font-black text-slate-900">{views[view][0]}</h1>
        {views[view][1]}
      </div>
    )

  const edited = templates.filter((t) => !t.builtIn || t.edited).length
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-black text-slate-900">More</h1>

      <Card className="divide-y divide-slate-100">
        <Row icon={MessageSquareText} title="Messages" sub={`${templates.length} WhatsApp messages${edited ? ` · ${edited} changed by you` : ''}`} onClick={() => setView('messages')} />
        <Row icon={ListOrdered} title="Catalog & prices" sub={`${data.products.length} products · CSV price update`} onClick={() => setView('catalog')} />
        <Row icon={KeyRound} title="Username & password" sub={`Family login: ${auth?.user?.username || ''}`} onClick={() => setView('password')} />
      </Card>

      <SectionTitle>Menu photo & PDF</SectionTitle>
      {menu.loading ? <Card className="p-4 text-sm text-slate-500">Checking…</Card> : <MenuFiles />}

      <SectionTitle>This phone</SectionTitle>
      <Card className="space-y-3 p-4">
        <Field label="Who uses this phone?" hint="Shown on orders as “by …”.">
          <div className="flex gap-2">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sasi" maxLength={30} />
            <Button
              variant="dark"
              disabled={name.trim() === deviceName}
              onClick={() => {
                setDeviceName(name)
                notify('Saved', 'success')
              }}
            >
              <Smartphone size={18} /> Save
            </Button>
          </div>
        </Field>
        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            if (queue.length && !confirm(`${queue.length} change(s) are not saved yet and will be lost. Log out anyway?`)) return
            signOut()
          }}
        >
          <LogOut size={18} /> Log out of this phone
        </Button>
      </Card>
    </div>
  )
}
