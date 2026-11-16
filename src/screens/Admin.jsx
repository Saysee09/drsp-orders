import { useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Download, FileUp, Pencil, Plus, Save } from 'lucide-react'
import { useStore } from '../lib/store'
import { downloadText, inr, parseCSV, toCSV, todayStr } from '../lib/utils'
import { Badge, Button, Card, Field, SectionTitle, Sheet, cx, inputCls } from '../components/ui'

const SAMPLE = `Product_Code,Product_Name,MRP
MNG-250,Mango - 250gm,269
MNG-500,Mango - 500gm,479`

function PriceImport() {
  const { data, mutate, notify } = useStore()
  const [text, setText] = useState('')
  const [diff, setDiff] = useState(null)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const build = (csv) => {
    setError('')
    const rows = parseCSV(csv.replace(/^﻿/, ''))
    if (!rows.length) return setError('The CSV is empty.')
    const head = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, '_'))
    const ci = head.indexOf('product_code')
    const mi = head.indexOf('mrp')
    const ni = head.indexOf('product_name')
    if (ci === -1 || mi === -1) return setError('Header row must include Product_Code and MRP.')
    const master = new Map(data.products.map((p) => [String(p.Product_Code).trim(), p]))
    const out = rows.slice(1).map((r) => {
      const code = (r[ci] || '').trim()
      const mrp = Number(String(r[mi] || '').replace(/[₹,\s]/g, ''))
      const cur = master.get(code)
      let status = 'unchanged'
      if (!cur) status = 'unknown'
      else if (!(mrp > 0)) status = 'invalid'
      else if (mrp !== Number(cur.MRP)) status = mrp > Number(cur.MRP) ? 'up' : 'down'
      return { code, name: cur?.Product_Name || r[ni] || '', current: cur ? Number(cur.MRP) : null, mrp, status }
    })
    setDiff(out)
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const t = await file.text()
    setText(t)
    build(t)
    e.target.value = ''
  }

  const changes = diff?.filter((d) => d.status === 'up' || d.status === 'down') || []
  const confirmUpdate = () => {
    mutate('updatePrices', { updates: changes.map((c) => ({ code: c.code, mrp: c.mrp })) })
    notify(`${changes.length} price(s) updated in Products_Master`, 'success')
    setDiff(null)
    setText('')
  }

  const exportCurrent = () =>
    downloadText(`drsp-prices-${todayStr()}.csv`, toCSV([['Product_Code', 'Product_Name', 'MRP'], ...data.products.map((p) => [p.Product_Code, p.Product_Name, p.MRP])]))

  return (
    <Card className="space-y-3 p-4">
      <p className="text-sm text-slate-600">
        Upload a CSV with <code className="rounded bg-slate-100 px-1">Product_Code, Product_Name, MRP</code>. Prices match on Product_Code only. Past orders keep their old prices.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="dark" onClick={() => fileRef.current?.click()}>
          <FileUp size={18} /> Upload CSV
        </Button>
        <Button variant="outline" onClick={exportCurrent}>
          <Download size={18} /> Current prices
        </Button>
      </div>
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-indigo-700">…or paste CSV text</summary>
        <textarea className={inputCls + ' mt-2 h-32 py-2 font-mono text-sm'} placeholder={SAMPLE} value={text} onChange={(e) => setText(e.target.value)} />
        <Button variant="ghost" size="sm" className="mt-2" disabled={!text.trim()} onClick={() => build(text)}>
          Preview changes
        </Button>
      </details>
      {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}

      {diff && (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-white">
                <tr>
                  <th className="p-2">Product</th>
                  <th className="p-2 text-right">Current</th>
                  <th className="p-2 text-right">New</th>
                  <th className="p-2 text-right">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {diff.map((d, i) => (
                  <tr key={i} className={cx(d.status === 'up' && 'bg-rose-50', d.status === 'down' && 'bg-emerald-50', (d.status === 'unknown' || d.status === 'invalid') && 'bg-slate-50 text-slate-400')}>
                    <td className="p-2">
                      <div className="font-mono text-xs">{d.code || '—'}</div>
                      <div className="font-medium">{d.name}</div>
                    </td>
                    <td className="p-2 text-right">{d.current != null ? inr(d.current) : '—'}</td>
                    <td className="p-2 text-right font-bold">{d.mrp > 0 ? inr(d.mrp) : '—'}</td>
                    <td className="p-2 text-right">
                      {d.status === 'up' && (
                        <Badge className="bg-rose-600 text-white">
                          <ArrowUp size={12} />
                          {inr(d.mrp - d.current)}
                        </Badge>
                      )}
                      {d.status === 'down' && (
                        <Badge className="bg-emerald-600 text-white">
                          <ArrowDown size={12} />
                          {inr(d.current - d.mrp)}
                        </Badge>
                      )}
                      {d.status === 'unchanged' && <span className="text-xs text-slate-500">Unchanged</span>}
                      {d.status === 'unknown' && <span className="text-xs">Not in catalog — skipped</span>}
                      {d.status === 'invalid' && <span className="text-xs">Bad price — skipped</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setDiff(null)}>
              Cancel
            </Button>
            <Button className="flex-[2]" disabled={!changes.length} onClick={confirmUpdate}>
              <Save size={18} /> Confirm & Overwrite {changes.length} Price{changes.length === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

function ProductEditor({ product, onClose, categories }) {
  const { mutate, notify, data } = useStore()
  const isNew = !product?.Product_Code
  const [p, setP] = useState(() => ({
    code: product?.Product_Code || '',
    name: product?.Product_Name || '',
    mrp: product?.MRP ? String(product.MRP) : '',
    category: product?.Category || categories[0] || 'Veg Pickle',
    active: (product?.Active_Status || 'Active') === 'Active',
  }))
  const set = (k, v) => setP((s) => ({ ...s, [k]: v }))
  const dup = isNew && data.products.some((x) => x.Product_Code === p.code.trim().toUpperCase())
  const valid = p.code.trim() && p.name.trim() && Number(p.mrp) > 0 && !dup
  return (
    <div className="space-y-3">
      <Field label="Product code (SKU)" error={dup ? 'This code already exists' : ''}>
        <input className={inputCls + ' font-mono uppercase'} disabled={!isNew} value={p.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="e.g. GNG-250" />
      </Field>
      <Field label="Product name" hint='Use "Name - Size" so the WhatsApp menu groups sizes, e.g. "Gongura - 250gm"'>
        <input className={inputCls} value={p.name} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="MRP (₹)">
          <input className={inputCls} inputMode="numeric" value={p.mrp} onChange={(e) => set('mrp', e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Category">
          <input className={inputCls} list="drsp-cats" value={p.category} onChange={(e) => set('category', e.target.value)} />
          <datalist id="drsp-cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
      </div>
      <label className="flex h-12 items-center justify-between rounded-xl bg-slate-100 px-4 font-semibold">
        Active (shown in order form & menu)
        <input type="checkbox" className="h-6 w-6 accent-emerald-600" checked={p.active} onChange={(e) => set('active', e.target.checked)} />
      </label>
      <Button
        size="lg"
        className="w-full"
        disabled={!valid}
        onClick={() => {
          mutate('saveProduct', { product: { code: p.code.trim().toUpperCase(), name: p.name.trim(), mrp: Number(p.mrp), category: p.category.trim() || 'Other', active: p.active } })
          notify('Product saved', 'success')
          onClose()
        }}
      >
        <Save size={18} /> Save product
      </Button>
    </div>
  )
}

export default function Admin() {
  const { data } = useStore()
  const [editing, setEditing] = useState(null)
  const categories = useMemo(() => [...new Set(data.products.map((p) => p.Category).filter(Boolean))], [data.products])

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-black text-slate-900">Catalog & Prices</h1>
      <SectionTitle>Bulk price update (CSV)</SectionTitle>
      <PriceImport />

      <SectionTitle
        right={
          <Button size="sm" variant="dark" onClick={() => setEditing({})}>
            <Plus size={16} /> Add product
          </Button>
        }
      >
        Products_Master ({data.products.length})
      </SectionTitle>
      <Card className="divide-y divide-slate-100">
        {data.products.map((p) => (
          <button key={p.Product_Code} onClick={() => setEditing(p)} className="flex w-full items-center gap-3 p-3 text-left active:bg-slate-50">
            <div className="min-w-0 flex-1">
              <div className={cx('truncate font-semibold', p.Active_Status === 'Inactive' ? 'text-slate-400 line-through' : 'text-slate-900')}>{p.Product_Name}</div>
              <div className="truncate text-xs text-slate-500">
                <span className="font-mono">{p.Product_Code}</span> · {p.Category}
              </div>
            </div>
            <div className="font-bold">{inr(p.MRP)}</div>
            <Pencil size={16} className="text-slate-400" />
          </button>
        ))}
      </Card>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.Product_Code ? 'Edit product' : 'New product'}>
        {editing && <ProductEditor key={editing.Product_Code || 'new'} product={editing} categories={categories} onClose={() => setEditing(null)} />}
      </Sheet>
    </div>
  )
}
