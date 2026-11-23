import { useEffect, useState } from 'react'
import { getConfig } from './api'

/**
 * The menu photo and PDF live in public/menu/ of the repo:
 *   public/menu/menu.jpg  and  public/menu/menu.pdf
 * Customers get a link to public/menu/ (a small page that shows the photo,
 * with a PDF download). WhatsApp shows the photo as the link preview.
 */
const base = () => import.meta.env.BASE_URL + 'menu/'
export const MENU_FILES = { image: 'menu.jpg', pdf: 'menu.pdf' }

async function exists(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    return r.ok && !String(r.headers.get('content-type') || '').includes('text/html')
  } catch {
    return false
  }
}

let cache = null
export function useMenuFiles() {
  const [state, setState] = useState(cache || { loading: true, image: false, pdf: false, link: '' })
  useEffect(() => {
    if (cache) return
    let live = true
    Promise.all([exists(base() + MENU_FILES.image), exists(base() + MENU_FILES.pdf)]).then(([image, pdf]) => {
      const cfg = getConfig()
      const link = cfg.menuUrl || (image || pdf ? new URL(base(), location.origin).href : '')
      cache = { loading: false, image, pdf, link }
      if (live) setState(cache)
    })
    return () => {
      live = false
    }
  }, [])
  return state
}

export const menuFileUrl = (kind) => base() + MENU_FILES[kind]

/**
 * Shares the real file (photo or PDF) through the phone's share menu.
 * WhatsApp opens with the file attached; you pick the chat.
 * Returns 'shared' | 'cancelled' | 'unsupported'.
 */
export async function shareMenuFile(kind, caption) {
  const res = await fetch(menuFileUrl(kind), { cache: 'no-store' })
  const blob = await res.blob()
  const name = kind === 'pdf' ? 'DRSP-Menu.pdf' : 'DRSP-Menu.jpg'
  const file = new File([blob], name, { type: kind === 'pdf' ? 'application/pdf' : blob.type || 'image/jpeg' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: caption })
      return 'shared'
    } catch (e) {
      return e?.name === 'AbortError' ? 'cancelled' : 'unsupported'
    }
  }
  // desktop / old phones: just download it
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  return 'unsupported'
}
