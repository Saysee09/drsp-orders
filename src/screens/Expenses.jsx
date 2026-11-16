import { useMemo, useState } from 'react'
import { Receipt, Trash2, Wallet } from 'lucide-react'
import { useStore } from '../lib/store'
import { EXPENSE_CATEGORIES, inr, makeId, prettyDate, todayStr } from '../lib/utils'
import { Button, Card, Empty, Field, Pill, SectionTitle, inputCls } from '../components/ui'

const blank = () => ({ date: todayStr(), category: 'Raw Material', item: '', amount: '', remarks: '' })

export default function Expenses() {
  const { data, mutate, notify, user } = useStore()
  const [f, setF] = useState(blank)
  const [touched, setTouched] = useState(false)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const month = todayStr().slice(0, 7)

  const list = useMemo(() => [...data.expenses].sort((a, b) => (String(b.Date) + b.Expense_ID).localeCompare(String(a.Date) + a.Expense_ID)), [data.expenses])
  const monthList = list.filter((e) => String(e.Date).startsWith(month))
  const monthTotal = monthList.reduce((a, e) => a + Number(e.Amount || 0), 0)
  const byCat = EXPENSE_CATEGORIES.map((c) => [c, monthList.filter((e) => e.Category === c).reduce((a, e) => a + Number(e.Amount || 0), 0)]).filter((x) => x[1] > 0)

  const errors = { item: !f.item.trim() ? 'What was bought?' : '', amount: !(Number(f.amount) > 0) ? 'Enter an amount' : '' }
  const submit = () => {
    setTouched(true)
    if (errors.item || errors.amount) return
    mutate('addExpense', { expense: { expenseId: makeId('EXP'), date: f.date, category: f.category, item: f.item.trim(), amount: Number(f.amount), remarks: f.remarks.trim() } })
    notify(`Expense saved: ${inr(f.amount)}`, 'success')
    setF((s) => ({ ...blank(), date: s.date, category: s.category }))
    setTouched(false)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-slate-900">Expenses</h1>
      <Card className="space-y-3 p-4">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {EXPENSE_CATEGORIES.map((c) => (
            <Pill key={c} active={f.category === c} onClick={() => set('category', c)}>
              {c}
            </Pill>
          ))}
        </div>
        <Field label="Item / service" error={touched && errors.item}>
          <input className={inputCls} value={f.item} onChange={(e) => set('item', e.target.value)} placeholder="e.g. Mangoes 20kg" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)" error={touched && errors.amount}>
            <input className={inputCls + ' text-lg font-bold'} inputMode="decimal" value={f.amount} onChange={(e) => set('amount', e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" />
          </Field>
          <Field label="Date">
            <input className={inputCls} type="date" max={todayStr()} value={f.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
        </div>
        <Field label="Remarks / vendor">
          <input className={inputCls} value={f.remarks} onChange={(e) => set('remarks', e.target.value)} placeholder="Optional" />
        </Field>
        <Button size="lg" className="w-full" onClick={submit}>
          <Wallet size={20} /> Save Expense
        </Button>
      </Card>

      <Card className="p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-slate-500">This month</span>
          <span className="text-2xl font-black text-slate-900">{inr(monthTotal)}</span>
        </div>
        {byCat.length > 0 && (
          <div className="mt-3 space-y-2">
            {byCat.map(([c, v]) => (
              <div key={c}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-700">{c}</span>
                  <span className="font-semibold">{inr(v)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${(v / monthTotal) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <SectionTitle>Recent expenses</SectionTitle>
      {list.length === 0 ? (
        <Empty icon={Receipt} title="No expenses yet" />
      ) : (
        <Card className="divide-y divide-slate-100">
          {list.slice(0, 50).map((e) => (
            <div key={e.Expense_ID} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-slate-900">{e.Item_Name}</div>
                <div className="truncate text-xs text-slate-500">
                  {prettyDate(e.Date)} · {e.Category}
                  {e.Remarks ? ` · ${e.Remarks}` : ''}
                  {e.Lead_By ? ` · ${e.Lead_By}` : ''}
                </div>
              </div>
              <div className="font-bold text-slate-900">{inr(e.Amount)}</div>
              {user?.role === 'Admin' && (
                <button
                  className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 active:bg-rose-50 active:text-rose-600"
                  aria-label="Delete expense"
                  onClick={() => confirm(`Delete "${e.Item_Name}" (${inr(e.Amount)})?`) && mutate('deleteExpense', { expenseId: e.Expense_ID })}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
