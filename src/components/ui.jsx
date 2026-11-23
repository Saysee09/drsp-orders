import { useEffect } from 'react'
import { X } from 'lucide-react'

export const cx = (...a) => a.filter(Boolean).join(' ')

export function Card({ className, children, ...rest }) {
  return (
    <div className={cx('rounded-2xl bg-white shadow-sm ring-1 ring-slate-200', className)} {...rest}>
      {children}
    </div>
  )
}

export function Button({ variant = 'primary', size = 'md', className, children, ...rest }) {
  const v = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-300',
    dark: 'bg-slate-900 text-white active:bg-slate-700 disabled:bg-slate-300',
    success: 'bg-emerald-600 text-white active:bg-emerald-700',
    amber: 'bg-amber-500 text-slate-950 active:bg-amber-600',
    whatsapp: 'bg-[#25D366] text-slate-950 active:bg-[#1ebe5a]',
    ghost: 'bg-slate-100 text-slate-800 active:bg-slate-200',
    danger: 'bg-rose-600 text-white active:bg-rose-700',
    outline: 'bg-white text-slate-800 ring-1 ring-slate-300 active:bg-slate-50',
  }[variant]
  const s = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-4 text-base', lg: 'h-14 px-5 text-lg' }[size]
  return (
    <button className={cx('inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed', v, s, className)} {...rest}>
      {children}
    </button>
  )
}

export function Field({ label, hint, error, children, className, group }) {
  const Tag = group ? 'div' : 'label' // chip/button groups must not sit inside a <label>
  return (
    <Tag className={cx('block', className)}>
      {label && <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>}
      {children}
      {error ? <span className="mt-1 block text-sm font-medium text-rose-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </Tag>
  )
}

export const inputCls =
  'w-full rounded-xl border-0 bg-white px-3 h-12 text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-600 outline-none'

/** High-contrast segmented status control. */
export function Segmented({ options, value, onChange, colors, labels = {}, size = 'md', disabled }) {
  return (
    <div className="grid gap-1 rounded-xl bg-slate-100 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => {
        const on = o === value
        return (
          <button
            key={o}
            type="button"
            disabled={disabled}
            onClick={() => !on && onChange(o)}
            className={cx(
              'rounded-lg font-bold transition',
              size === 'lg' ? 'h-14 text-lg' : 'h-10 text-sm',
              on ? colors?.[o] || 'bg-slate-900 text-white' : 'text-slate-600 active:bg-slate-200',
            )}
          >
            {labels[o] || o}
          </button>
        )
      })}
    </div>
  )
}

export const PREP_COLORS = { Pending: 'bg-amber-500 text-slate-950', 'In Batch': 'bg-orange-600 text-white', Packed: 'bg-emerald-600 text-white' }
export const PAY_COLORS = { Unpaid: 'bg-rose-600 text-white', UPI: 'bg-emerald-600 text-white', Cash: 'bg-emerald-700 text-white' }
export const DEL_COLORS = { Pending: 'bg-slate-700 text-white', 'Out for Delivery': 'bg-indigo-600 text-white', Delivered: 'bg-emerald-600 text-white' }

export function Pill({ active, children, ...rest }) {
  return (
    <button
      type="button"
      className={cx(
        'h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold transition',
        active ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300',
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Badge({ className, children }) {
  return <span className={cx('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold', className)}>{children}</span>
}

export function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-safe sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {Icon && <Icon size={40} className="mb-3 text-slate-300" />}
      <p className="font-semibold text-slate-700">{title}</p>
      {children && <p className="mt-1 text-sm text-slate-500">{children}</p>}
    </div>
  )
}

export function SectionTitle({ children, right }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between px-1">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{children}</h3>
      {right}
    </div>
  )
}
