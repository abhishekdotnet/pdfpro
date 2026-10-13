import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

// Convert any browser-decodable image (webp, gif, svg...) to PNG bytes.
async function toPngBytes(src) {
  const img = new Image()
  img.src = src
  await img.decode()
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  c.getContext('2d').drawImage(img, 0, 0)
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
  return new Uint8Array(await blob.arrayBuffer())
}

// Standard fonts only cover WinAnsi; replace unsupported characters instead of throwing.
const safe = (font, str) =>
  [...str].map((ch) => { try { font.encodeText(ch); return ch } catch { return '?' } }).join('')

/**
 * pdfBytes: original file bytes
 * Items use page-relative geometry, so every annotation is drawn on every page.
 */
export async function exportPdf(pdfBytes, items) {
  const doc = await PDFDocument.load(pdfBytes)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const pages = doc.getPages()

  for (const page of pages) {
    const { width: pageW, height: pageH } = page.getSize()
    for (const it of items) {
      const x = it.xRatio * pageW
      const y = it.yRatio * pageH

      if (it.type === 'text') {
        const size = it.fontRatio * pageW
        const lineH = size * 1.2
        it.text.split('\n').forEach((line, i) => {
          page.drawText(safe(font, line), {
            x,
            y: pageH - y - size * 0.95 - i * lineH,
            size,
            font,
            color: hexToRgb(it.color),
            opacity: it.opacity,
          })
        })
      } else {
        const direct = it.mime === 'image/png' || it.mime === 'image/jpeg'
        const bytes = direct
          ? new Uint8Array(await (await fetch(it.src)).arrayBuffer())
          : await toPngBytes(it.src)
        const img = it.mime === 'image/jpeg' ? await doc.embedJpg(bytes) : await doc.embedPng(bytes)
        page.drawImage(img, {
          x,
          y: pageH - (y + it.hRatio * pageH),
          width: it.wRatio * pageW,
          height: it.hRatio * pageH,
          opacity: it.opacity,
        })
      }
    }
  }
  return doc.save()
}
