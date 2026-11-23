import { useEffect, useState } from 'react'
import { isDemo } from './api'

/**
 * Files uploaded in the app (More → Menu & payment files).
 * They are saved in a Google Drive folder by the Apps Script, and kept on
 * each phone after the first download so sharing is instant.
 */
export const FILE_KINDS = [
  { kind: 'menu_image', label: 'Menu photo', accept: 'image/*', share: 'DRSP-Menu.jpg' },
  { kind: 'menu_pdf', label: 'Menu PDF', accept: 'application/pdf', share: 'DRSP-Menu.pdf' },
  { kind: 'upi_qr', label: 'UPI QR (scanner)', accept: 'image/*', share: 'DRSP-UPI-QR.jpg' },
]
export const MENU_KINDS = ['menu_image', 'menu_pdf']
const MAX_MB = 10

/* ------------------------------------------------------------ phone cache */

function db() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('drsp-files', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('files', { keyPath: 'kind' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function idb(mode, fn) {
  const d = await db()
  return new Promise((resolve, reject) => {
    const tx = d.transaction('files', mode)
    const r = fn(tx.objectStore('files'))
    tx.oncomplete = () => resolve(r?.result)
    tx.onerror = () => reject(tx.error)
  })
}
const cacheGet = (kind) => idb('readonly', (s) => s.get(kind)).catch(() => null)
const cachePut = (rec) => idb('readwrite', (s) => s.put(rec)).catch(() => {})
const cacheDel = (kind) => idb('readwrite', (s) => s.delete(kind)).catch(() => {})

/* ---------------------------------------------------------------- helpers */

const toBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
const fromBase64 = (b64, type) => {
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type })
}

/** Big phone photos are shrunk (max 2000px) so they upload and share quickly. */
async function shrink(file) {
  if (!file.type.startsWith('image/') || file.size < 1.5 * 1048576) return file
  const img = await createImageBitmap(file)
  const k = Math.min(1, 2000 / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * k)
  c.height = Math.round(img.height * k)
  const g = c.getContext('2d')
  g.fillStyle = '#fff'
  g.fillRect(0, 0, c.width, c.height)
  g.drawImage(img, 0, 0, c.width, c.height)
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88))
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
}

const demoMeta = () => JSON.parse(localStorage.getItem('drsp_demo_files') || '{}')
export const demoFilesMeta = demoMeta

/* -------------------------------------------------------------------- API */

export async function uploadFile(kind, picked, callNow) {
  const file = await shrink(picked)
  if (file.size > MAX_MB * 1048576) throw Object.assign(new Error('FILE_TOO_BIG'), { code: 'FILE_TOO_BIG' })
  const base = { name: file.name, mimeType: file.type, size: file.size }
  let meta
  if (isDemo()) {
    meta = { ...base, updatedAt: new Date().toISOString(), url: '' }
    localStorage.setItem('drsp_demo_files', JSON.stringify({ ...demoMeta(), [kind]: meta }))
  } else {
    meta = await callNow('uploadFile', { kind, ...base, data: await toBase64(file) })
  }
  await cachePut({ kind, updatedAt: meta.updatedAt, name: file.name, mimeType: file.type, blob: file })
  return meta
}

export async function removeFile(kind, callNow) {
  if (isDemo()) {
    const m = demoMeta()
    delete m[kind]
    localStorage.setItem('drsp_demo_files', JSON.stringify(m))
  } else await callNow('deleteFile', { kind })
  await cacheDel(kind)
}

/** The file from this phone, or downloaded once from Drive if it changed. */
export async function loadFile(kind, meta, callNow) {
  if (!meta) return null
  const c = await cacheGet(kind)
  if (c && c.updatedAt === meta.updatedAt) return c
  if (isDemo()) return c
  const r = await callNow('getFile', { kind })
  const rec = { kind, updatedAt: r.updatedAt, name: r.name, mimeType: r.mimeType, blob: fromBase64(r.data, r.mimeType) }
  await cachePut(rec)
  return rec
}

/** Loads files ahead of time — the share menu must open right after the tap. */
export function useFiles(kinds, files, callNow) {
  const [state, setState] = useState({ loading: true, recs: [] })
  const key = kinds.map((k) => k + (files?.[k]?.updatedAt || '')).join('|')
  useEffect(() => {
    let live = true
    const wanted = kinds.filter((k) => files?.[k])
    if (!wanted.length) {
      setState({ loading: false, recs: [] })
      return
    }
    setState((s) => ({ ...s, loading: true }))
    Promise.all(wanted.map((k) => loadFile(k, files[k], callNow).catch(() => null))).then((recs) => {
      if (live) setState({ loading: false, recs: recs.filter(Boolean) })
    })
    return () => {
      live = false
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return state
}

/**
 * Opens the phone's share menu with the files attached (pick the WhatsApp chat).
 * Returns 'shared' | 'cancelled' | 'downloaded'.
 */
export async function shareFiles(recs, text) {
  const files = recs.map((r) => {
    const def = FILE_KINDS.find((k) => k.kind === r.kind)
    const ext = r.mimeType === 'application/pdf' ? '.pdf' : r.mimeType === 'image/png' ? '.png' : '.jpg'
    return new File([r.blob], (def?.share || r.name).replace(/\.\w+$/, ext), { type: r.mimeType || r.blob.type })
  })
  const data = text ? { files, text } : { files }
  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share(data)
      return 'shared'
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled'
    }
  }
  for (const f of files) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(f)
    a.download = f.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }
  return 'downloaded'
}
