import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronRight, ImagePlus, Loader2, Megaphone, Pencil, Send, ShieldAlert, SkipForward, Trash2, Undo2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { getConfig } from '../lib/api'
import { AUDIENCES, CAMPAIGN_TYPES, LAPSED_DAYS, parseNumbers, recipientsOf, sentOf, typeOf } from '../lib/campaigns'
import { customerCtx, fillTemplate } from '../lib/templates'
import { loadFile, removeFile, uploadFile } from '../lib/files'
import { daysBetween, todayStr, waLink } from '../lib/utils'
import { AttachButton } from '../components/Messages'
import { Badge, Button, Card, Field, SectionTitle, Sheet, cx, inputCls } from '../components/ui'

const photoKind = (id) => 'camp_' + id

function usePhotoUrl(kind) {
  const { files, callNow } = useStore()
  const meta = files[kind]
  const [url, setUrl] = useState('')
  useEffect(() => {
    let u = ''
    if (meta) loadFile(kind, meta, callNow).then((r) => r && setUrl((u = URL.createObjectURL(r.blob)))).catch(() => {})
    else setUrl('')
    return () => u && URL.revokeObjectURL(u)
  }, [kind, meta?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps
  return url
}

function textFor(c, r, ctxExtra) {
  return fillTemplate(c.Text, customerCtx({ name: r?.name, favorite: r?.favorite }, getConfig(), ctxExtra))
}

/* ---------------------------------------------------------------- editor */

export function CampaignEditor({ campaign, preset, onClose, onSaved }) {
  const { mutate, notify, customers, files, callNow, setFileMeta } = useStore()
  const isNew = !campaign
  const [c, setC] = useState(() =>
    campaign
      ? { id: campaign.Campaign_ID, name: campaign.Name, type: campaign.Type, text: campaign.Text, audience: campaign.Audience, numbers: campaign.Numbers || '', createdAt: campaign.Created_At }
      : { id: Date.now().toString(36), name: preset?.name || '', type: preset?.type || 'Offer', text: typeOf(preset?.type || 'Offer').text, audience: preset?.audience || 'all', numbers: '', createdAt: new Date().toISOString() },
  )
  const [busy, setBusy] = useState(false)
  const input = useRef(null)
  const set = (k, v) => setC((s) => ({ ...s, [k]: v }))
  const kind = photoKind(c.id)
  const photo = usePhotoUrl(kind)
  const t = todayStr()
  const counts = useMemo(() => Object.fromEntries(AUDIENCES.map((a) => [a.id, customers.filter((cu) => a.test(cu, t)).length])), [customers, t])
  const typed = parseNumbers(c.numbers).length
  const total = recipientsOf({ Audience: c.audience, Numbers: c.numbers }, customers).length

  const pickType = (id) => {
    const untouched = CAMPAIGN_TYPES.some((x) => x.text === c.text) || !c.text.trim()
    setC((s) => ({ ...s, type: id, text: untouched ? typeOf(id).text : s.text, audience: id === 'We miss you' && s.audience === 'all' ? 'lapsed' : s.audience }))
  }
  const upload = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setBusy(true)
    try {
      setFileMeta(kind, await uploadFile(kind, f, callNow))
    } catch (err) {
      notify(err.code === 'FILE_TOO_BIG' ? 'Photo is too big (max 10 MB)' : 'Upload failed — check internet', 'error')
    } finally {
      setBusy(false)
    }
  }
  const dropPhoto = async () => {
    setBusy(true)
    try {
      await removeFile(kind, callNow)
      setFileMeta(kind, null)
    } catch {
      notify('Could not remove — check internet', 'error')
    } finally {
      setBusy(false)
    }
  }
  const save = () => {
    if (!c.name.trim()) return notify('Give the campaign a name', 'error')
    if (!c.text.trim()) return notify('Write the message', 'error')
    mutate('saveCampaign', { campaign: { ...c, name: c.name.trim() } })
    notify(isNew ? 'Campaign created' : 'Campaign saved', 'success')
    onSaved?.(c.id)
    onClose()
  }

  return (
    <div className="space-y-4">
      <Field label="Campaign name">
        <input className={inputCls} value={c.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Sankranti special 2027" />
      </Field>
      <Field group label="Type">
        <div className="flex flex-wrap gap-2">
          {CAMPAIGN_TYPES.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => pickType(x.id)}
              className={cx('h-10 rounded-full px-3.5 text-sm font-semibold', c.type === x.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300')}
            >
              {x.emoji} {x.id}
            </button>
          ))}
        </div>
      </Field>

      <Field group label="Photo (optional)" hint="e.g. the offer poster you made. It’s attached in WhatsApp after the message.">
        {photo || files[kind] ? (
          <div className="flex items-center gap-3">
            <div className="h-24 w-24 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">{photo && <img src={photo} alt="" className="h-full w-full object-cover" />}</div>
            <div className="space-y-2">
              <Button variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />} Change photo
              </Button>
              <button className="block text-xs font-semibold text-rose-600" onClick={dropPhoto} disabled={busy}>
                Remove photo
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="flex h-24 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white font-semibold text-slate-600 active:bg-slate-50"
          >
            {busy ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />} {busy ? 'Uploading…' : 'Add a photo'}
          </button>
        )}
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={upload} />
      </Field>

      <Field label="Message" hint="{first_name} becomes each customer’s name. {favorite} = their usual pickle. Lines with an empty detail are left out.">
        <textarea className={inputCls + ' h-48 py-2 text-sm'} value={c.text} onChange={(e) => set('text', e.target.value)} />
      </Field>

      <Field group label="Send to">
        <div className="flex flex-wrap gap-2">
          {AUDIENCES.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => set('audience', a.id)}
              className={cx('h-10 rounded-full px-3.5 text-sm font-semibold', c.audience === a.id ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300')}
            >
              {a.label}
              {a.id !== 'none' && <span className="ml-1 opacity-60">{counts[a.id]}</span>}
            </button>
          ))}
        </div>
      </Field>
      <Field label={c.audience === 'none' ? 'Numbers' : 'Add more numbers (optional)'} hint={`One per line, name optional — e.g. “Ravi 98480 12345”.${typed ? ` ${typed} number(s) found.` : ''}`}>
        <textarea className={inputCls + ' h-24 py-2 text-sm'} value={c.numbers} onChange={(e) => set('numbers', e.target.value)} placeholder={'Ravi 9848012345\n9701234567'} />
      </Field>

      <div className="sticky bottom-0 -mx-5 border-t border-slate-200 bg-white px-5 pb-1 pt-3">
        <Button size="lg" className="w-full" onClick={save} disabled={busy}>
          <Check size={20} /> {isNew ? 'Create campaign' : 'Save'} · {total} customer{total === 1 ? '' : 's'}
        </Button>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- runner */

function CampaignRunner({ id, onBack }) {
  const { campaigns, customers, mutate, files, notify } = useStore()
  const c = campaigns.find((x) => x.Campaign_ID === id)
  const [edit, setEdit] = useState(false)
  const [skipped, setSkipped] = useState([])
  const [opened, setOpened] = useState('')
  const kind = photoKind(id)
  const photo = usePhotoUrl(kind)
  if (!c) return null
  const list = recipientsOf(c, customers)
  const sent = sentOf(c)
  const done = list.filter((r) => sent.has(r.phone)).length
  const next = list.find((r) => !sent.has(r.phone) && !skipped.includes(r.phone))
  const extra = { menuLink: files.menu_pdf?.url || files.menu_image?.url || '' }
  const t = typeOf(c.Type)

  const mark = (phone, undo = false) => mutate('markCampaignSent', { id, phone, undo })

  return (
    <div className="space-y-3">
      <button onClick={onBack} className="flex items-center gap-1 text-sm font-bold text-indigo-700">
        <ArrowLeft size={18} /> Send
      </button>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black leading-tight text-slate-900">{c.Name}</h1>
          <div className="mt-0.5 text-sm text-slate-500">
            {t.emoji} {c.Type} · {AUDIENCES.find((a) => a.id === c.Audience)?.label}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEdit(true)}>
          <Pencil size={16} /> Edit
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between text-sm font-bold">
          <span>
            {done} of {list.length} sent
          </span>
          <span className="text-slate-500">{list.length ? Math.round((done / list.length) * 100) : 0}%</span>
        </div>
        <div className="mt-2 h-2.5 rounded-full bg-slate-100">
          <div className="h-2.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${list.length ? (done / list.length) * 100 : 0}%` }} />
        </div>
      </Card>

      {next ? (
        <Card className="space-y-3 p-4 ring-2 ring-indigo-500">
          <div className="text-xs font-bold uppercase tracking-wide text-indigo-600">Next customer</div>
          <div>
            <div className="text-xl font-black text-slate-900">{next.name || 'Customer'}</div>
            <div className="text-sm text-slate-500">+91 {next.phone.replace(/(\d{5})(\d{5})/, '$1 $2')}</div>
          </div>
          <div className="flex gap-3">
            {photo && <img src={photo} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />}
            <pre className="max-h-40 min-w-0 flex-1 overflow-auto whitespace-pre-wrap rounded-xl bg-[#e7ffdb] p-3 font-sans text-sm text-slate-800">{textFor(c, next, extra)}</pre>
          </div>
          <a
            href={waLink(next.phone, textFor(c, next, extra))}
            target="_blank"
            rel="noreferrer"
            className="block"
            onClick={() => {
              setOpened(next.phone)
              if (!files[kind]) mark(next.phone)
            }}
          >
            <Button variant="whatsapp" size="lg" className="w-full">
              <Send size={20} /> {files[kind] ? '1. Open chat with message' : 'Open chat & send'}
            </Button>
          </a>
          {files[kind] && opened === next.phone && <AttachButton kinds={[kind]} who={next.name} />}
          {files[kind] && (
            <Button
              variant="dark"
              size="lg"
              className="w-full"
              disabled={opened !== next.phone}
              onClick={() => {
                mark(next.phone)
                setOpened('')
              }}
            >
              <Check size={20} /> Done — next customer
            </Button>
          )}
          <button className="flex items-center gap-1 text-sm font-semibold text-slate-500" onClick={() => setSkipped((s) => [...s, next.phone])}>
            <SkipForward size={16} /> Skip for now
          </button>
        </Card>
      ) : (
        <Card className="p-6 text-center">
          <Check size={40} className="mx-auto text-emerald-600" />
          <p className="mt-2 font-black text-slate-900">{list.length ? 'Everyone in this campaign is done 🎉' : 'No customers in this campaign yet'}</p>
          {skipped.length > 0 && (
            <button className="mt-2 text-sm font-semibold text-indigo-700" onClick={() => setSkipped([])}>
              Show the {skipped.length} skipped again
            </button>
          )}
        </Card>
      )}

      <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
        <ShieldAlert size={16} className="shrink-0" />
        Send to people who know DRSP, a few at a time (e.g. 20–30 a day). If many people block or report a personal number, WhatsApp can restrict it. For big lists later, a WhatsApp Business number is safer.
      </p>

      <SectionTitle>All customers in this campaign</SectionTitle>
      <Card className="divide-y divide-slate-100">
        {list.map((r) => {
          const isSent = sent.has(r.phone)
          return (
            <div key={r.phone} className="flex items-center gap-3 p-3">
              <span className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-full', isSent ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400')}>
                {isSent ? <Check size={16} strokeWidth={3} /> : <Megaphone size={14} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-slate-900">{r.name || 'Customer'}</div>
                <div className="text-xs text-slate-500">+91 {r.phone}</div>
              </div>
              {isSent ? (
                <button className="flex items-center gap-1 text-xs font-semibold text-slate-500" onClick={() => mark(r.phone, true)}>
                  <Undo2 size={14} /> Not sent
                </button>
              ) : (
                <a
                  href={waLink(r.phone, textFor(c, r, extra))}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => (files[kind] ? setOpened(r.phone) : mark(r.phone))}
                  className="flex h-9 items-center gap-1 rounded-xl bg-[#25D366] px-3 text-sm font-bold text-slate-950"
                >
                  <Send size={14} /> Send
                </a>
              )}
            </div>
          )
        })}
        {list.length === 0 && <p className="p-4 text-sm text-slate-500">Tap Edit to choose who gets it.</p>}
      </Card>

      <Button
        variant="ghost"
        className="w-full text-rose-600"
        onClick={() => {
          if (!confirm(`Delete campaign “${c.Name}”?`)) return
          mutate('deleteCampaign', { id })
          notify('Campaign deleted')
          onBack()
        }}
      >
        <Trash2 size={18} /> Delete campaign
      </Button>

      <Sheet open={edit} onClose={() => setEdit(false)} title="Edit campaign">
        {edit && <CampaignEditor campaign={c} onClose={() => setEdit(false)} />}
      </Sheet>
    </div>
  )
}

/* ------------------------------------------------------------ list on Send */

export function CampaignsSection({ open, setOpen }) {
  const { campaigns, customers, files } = useStore()
  const [creating, setCreating] = useState(null) // preset object
  const t = todayStr()
  const lapsed = customers.filter((c) => c.lastOrder && daysBetween(c.lastOrder, t) > LAPSED_DAYS).length
  const sorted = [...campaigns].sort((a, b) => String(b.Created_At).localeCompare(String(a.Created_At)))

  if (open) return <CampaignRunner id={open} onBack={() => setOpen(null)} />

  return (
    <>
      <SectionTitle>Campaigns & offers</SectionTitle>
      {lapsed > 0 && (
        <button
          onClick={() => setCreating({ type: 'We miss you', audience: 'lapsed', name: 'We miss you' })}
          className="flex w-full items-center gap-3 rounded-2xl bg-amber-50 p-4 text-left ring-1 ring-amber-200 active:bg-amber-100"
        >
          <span className="text-2xl">💛</span>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-amber-950">
              {lapsed} customer{lapsed === 1 ? ' hasn’t' : 's haven’t'} ordered in {LAPSED_DAYS}+ days
            </div>
            <div className="text-sm text-amber-800">Send them a “we miss you” message</div>
          </div>
          <ChevronRight size={18} className="text-amber-700" />
        </button>
      )}
      <Card className="divide-y divide-slate-100">
        {sorted.map((c) => {
          const list = recipientsOf(c, customers)
          const sent = sentOf(c)
          const done = list.filter((r) => sent.has(r.phone)).length
          return (
            <button key={c.Campaign_ID} onClick={() => setOpen(c.Campaign_ID)} className="flex w-full items-center gap-3 p-4 text-left active:bg-slate-50">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-xl">{typeOf(c.Type).emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold text-slate-900">
                  {c.Name} {files[photoKind(c.Campaign_ID)] && <Badge className="ml-1 bg-slate-100 text-slate-600">photo</Badge>}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                    <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${list.length ? (done / list.length) * 100 : 0}%` }} />
                  </div>
                  <span className="whitespace-nowrap text-xs font-semibold text-slate-500">
                    {done}/{list.length} sent
                  </span>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-400" />
            </button>
          )
        })}
        {sorted.length === 0 && <p className="p-4 text-sm text-slate-500">Make an offer, festival special or new-batch message once, add a photo, and send it to many customers one by one.</p>}
      </Card>
      <Button variant="dark" size="lg" className="w-full" onClick={() => setCreating({})}>
        <Megaphone size={20} /> New campaign
      </Button>

      <Sheet open={!!creating} onClose={() => setCreating(null)} title="New campaign">
        {creating && <CampaignEditor preset={creating} onClose={() => setCreating(null)} onSaved={(id) => setOpen(id)} />}
      </Sheet>
    </>
  )
}

