import { useEffect, useRef } from 'react'

export default function PdfPage({ pdf, pageIndex, scale, onSize, children }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    let task
    let cancelled = false
    ;(async () => {
      const page = await pdf.getPage(pageIndex + 1)
      if (cancelled) return
      const vp = page.getViewport({ scale })
      const canvas = canvasRef.current
      const dpr = window.devicePixelRatio || 1
      canvas.width = vp.width * dpr
      canvas.height = vp.height * dpr
      canvas.style.width = vp.width + 'px'
      canvas.style.height = vp.height + 'px'
      onSize?.(pageIndex, vp.width, vp.height)
      task = page.render({
        canvasContext: canvas.getContext('2d'),
        viewport: vp,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
      })
      task.promise.catch(() => {})
    })()
    return () => { cancelled = true; task?.cancel() }
  }, [pdf, pageIndex, scale])

  return (
    <div className="page" data-page={pageIndex}>
      <canvas ref={canvasRef} />
      {children}
    </div>
  )
}
