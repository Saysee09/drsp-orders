import { useState } from 'react'
import { Segmented } from '../components/ui'
import Dashboard from './Dashboard'
import Expenses from './Expenses'

/** Profit dashboard and expense entry, side by side under one tab. */
export default function Money() {
  const [view, setView] = useState(() => localStorage.getItem('drsp_money_view') || 'Profit')
  const pick = (v) => {
    setView(v)
    localStorage.setItem('drsp_money_view', v)
  }
  return (
    <div className="space-y-3">
      <Segmented options={['Profit', 'Expenses']} value={view} onChange={pick} size="lg" />
      {view === 'Profit' ? <Dashboard /> : <Expenses />}
    </div>
  )
}
