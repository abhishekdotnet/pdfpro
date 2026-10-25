import { useEffect, useRef, useState } from 'react'

// Canvas backing-store budget; phones crash or blank out on very large canvases.
const MAX_PIXELS = 4_000_000

export default function PdfPage({ pdf, pageIndex, scale, onSize, children }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const [size, setSize] = useState(null)
  const [visible, setVisible] = useState(pageIndex === 0)

  // Page dimensions are cheap, so every page reserves its space (and gets its
  // overlays) immediately; only the canvas rendering is deferred.
  useEffect(() => {
    let cancelled = false
    pdf.getPage(pageIndex + 1).then((page) => {
      if (cancelled) return
      const vp = page.getViewport({ scale })
      setSize({ w: vp.width, h: vp.height })
      onSize?.(pageIndex, vp.width, vp.height)
    })
    return () => { cancelled = true }
  }, [pdf, pageIndex, scale])

  useEffect(() => {
    if (visible) return
    const io = new IntersectionObserver(
      (e) => { if (e.some((x) => x.isIntersecting)) { setVisible(true); io.disconnect() } },
      { rootMargin: '600px 0px' }
    )
    io.observe(wrapRef.current)
    return () => io.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible || !size) return
    let task
    let cancelled = false
    ;(async () => {
      const page = await pdf.getPage(pageIndex + 1)
      if (cancelled) return
      const canvas = canvasRef.current
      let dpr = Math.min(window.devicePixelRatio || 1, 2)
      dpr = Math.min(dpr, Math.sqrt(MAX_PIXELS / (size.w * size.h)))
      const vp = page.getViewport({ scale })
      canvas.width = Math.floor(vp.width * dpr)
      canvas.height = Math.floor(vp.height * dpr)
      task = page.render({
        canvasContext: canvas.getContext('2d'),
        viewport: vp,
        transform: [dpr, 0, 0, dpr, 0, 0],
      })
      task.promise.catch(() => {})
    })()
    return () => { cancelled = true; task?.cancel() }
  }, [pdf, pageIndex, scale, visible, size])

  const style = size
    ? { width: `min(100%, ${size.w}px)`, aspectRatio: `${size.w} / ${size.h}` }
    : { width: 'min(100%, 600px)', aspectRatio: '3 / 4' }

  return (
    <div className="page" data-page={pageIndex} ref={wrapRef} style={style}>
      <canvas ref={canvasRef} />
      {children}
    </div>
  )
}
