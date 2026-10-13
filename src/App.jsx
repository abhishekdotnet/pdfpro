import { useState, useRef, useCallback } from 'react'
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import PdfPage from './PdfPage.jsx'
import Overlay from './Overlay.jsx'
import { exportPdf } from './exportPdf.js'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const SCALE = 1.5
let uid = 1

export default function App() {
  const [pdf, setPdf] = useState(null)
  const [bytes, setBytes] = useState(null)
  const [name, setName] = useState('document.pdf')
  const [items, setItems] = useState([])
  const [selId, setSelId] = useState(null)
  const [curPage, setCurPage] = useState(0)
  const [sizes, setSizes] = useState({})
  const [busy, setBusy] = useState(false)
  const imgInput = useRef(null)
  const pagesRef = useRef(null)

  const sel = items.find((i) => i.id === selId)
  const currentSize = sizes[curPage] || { w: 600, h: 800 }

  const loadPdf = async (file) => {
    if (!file) return
    const buf = new Uint8Array(await file.arrayBuffer())
    setBytes(buf)
    setName(file.name)
    setItems([]); setSelId(null); setCurPage(0); setSizes({})
    setPdf(await pdfjs.getDocument({ data: buf.slice() }).promise)
  }

  const onSize = useCallback(
    (i, w, h) => setSizes((s) => (s[i]?.w === w ? s : { ...s, [i]: { w, h } })),
    []
  )

  const update = (id, patch) => setItems((arr) => arr.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  // Geometry is kept as a fraction of a page, so one annotation can be used
  // on every page even when individual page dimensions differ.
  const updateLayout = (id, patch, pageSize) => {
    const next = { ...patch }
    if ('x' in next) { next.xRatio = next.x / pageSize.w; delete next.x }
    if ('y' in next) { next.yRatio = next.y / pageSize.h; delete next.y }
    if ('w' in next) { next.wRatio = next.w / pageSize.w; delete next.w }
    if ('h' in next) { next.hRatio = next.h / pageSize.h; delete next.h }
    update(id, next)
  }
  const remove = (id) => { setItems((arr) => arr.filter((i) => i.id !== id)); setSelId(null) }

  const add = (item) => {
    const id = uid++
    setItems((arr) => [...arr, { id, opacity: 1, ...item }])
    setSelId(id)
  }

  const addText = () => {
    const s = currentSize
    add({ type: 'text', text: 'Double-click to edit', xRatio: .5 - 100 / s.w, yRatio: .5, fontRatio: 24 / s.w, color: '#000000' })
  }

  const addImage = async (file) => {
    if (!file) return
    const src = URL.createObjectURL(file)
    const img = new Image()
    img.src = src
    await img.decode()
    const s = currentSize
    const w = Math.min(200, s.w * 0.4)
    const h = w * (img.naturalHeight / img.naturalWidth)
    add({ type: 'image', src, mime: file.type, xRatio: .5 - w / s.w / 2, yRatio: .5 - h / s.h / 2, wRatio: w / s.w, hRatio: h / s.h })
  }

  const download = async () => {
    setBusy(true)
    try {
      const out = await exportPdf(bytes, items)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([out], { type: 'application/pdf' }))
      a.download = name.replace(/\.pdf$/i, '') + '-edited.pdf'
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      alert('Export failed: ' + e.message)
    }
    setBusy(false)
  }

  // Track the page at the viewport centre so "+ Text / + Image" targets it.
  const onScroll = () => {
    const root = pagesRef.current
    if (!root) return
    const mid = root.getBoundingClientRect().top + root.clientHeight / 2
    for (const el of root.querySelectorAll('.page')) {
      const r = el.getBoundingClientRect()
      if (r.top <= mid && r.bottom >= mid) { setCurPage(Number(el.dataset.page)); break }
    }
  }

  return (
    <div className="app">
      <header className="toolbar">
        <label className="btn">
          Open PDF
          <input type="file" accept="application/pdf" hidden onChange={(e) => loadPdf(e.target.files[0])} />
        </label>
        <button className="btn" disabled={!pdf} onClick={addText}>+ Text</button>
        <button className="btn" disabled={!pdf} onClick={() => imgInput.current.click()}>+ Image</button>
        <input ref={imgInput} type="file" accept="image/*" hidden
          onChange={(e) => { addImage(e.target.files[0]); e.target.value = '' }} />
        {pdf && <span className="muted">Adding to all {pdf.numPages} pages · editing from page {curPage + 1}</span>}

        {sel && (
          <div className="props">
            <label>Opacity
              <input type="range" min="0.05" max="1" step="0.05" value={sel.opacity}
                onChange={(e) => update(sel.id, { opacity: +e.target.value })} />
              <span>{Math.round(sel.opacity * 100)}%</span>
            </label>
            {sel.type === 'text' && (
              <>
                <label>Size
                  <input type="number" min="6" max="200" value={Math.round(sel.fontRatio * currentSize.w / SCALE)}
                    onChange={(e) => update(sel.id, { fontRatio: Math.max(6, +e.target.value) * SCALE / currentSize.w })} />
                </label>
                <label>Color
                  <input type="color" value={sel.color} onChange={(e) => update(sel.id, { color: e.target.value })} />
                </label>
              </>
            )}
            <button className="btn danger" onClick={() => remove(sel.id)}>Delete</button>
          </div>
        )}

        <button className="btn primary push" disabled={!pdf || busy} onClick={download}>
          {busy ? 'Saving...' : 'Download PDF'}
        </button>
      </header>

      <main className="pages" ref={pagesRef} onScroll={onScroll} onPointerDown={() => setSelId(null)}>
        {!pdf && <div className="empty">Open a PDF, then add text or images. Each item is automatically placed on every page.</div>}
        {pdf && Array.from({ length: pdf.numPages }, (_, i) => (
          <PdfPage key={name + i} pdf={pdf} pageIndex={i} scale={SCALE} onSize={onSize}>
            {sizes[i] && items.map((it) => {
              const s = sizes[i]
              const positioned = {
                ...it,
                x: it.xRatio * s.w,
                y: it.yRatio * s.h,
                ...(it.type === 'image'
                  ? { w: it.wRatio * s.w, h: it.hRatio * s.h }
                  : { fontSize: it.fontRatio * s.w }),
              }
              return <Overlay key={it.id} item={positioned} pageSize={s} selected={it.id === selId}
                onSelect={() => setSelId(it.id)}
                onChange={(p) => updateLayout(it.id, p, s)}
                onDelete={() => remove(it.id)} />
            })}
          </PdfPage>
        ))}
      </main>
    </div>
  )
}
