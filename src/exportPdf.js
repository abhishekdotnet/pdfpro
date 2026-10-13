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
 * items: overlay items; x/y/w/h are CSS px at `scale`, relative to the page top-left
 */
export async function exportPdf(pdfBytes, items, scale) {
  const doc = await PDFDocument.load(pdfBytes)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const pages = doc.getPages()

  for (const it of items) {
    const page = pages[it.page]
    if (!page) continue
    const { height: pageH } = page.getSize()

    if (it.type === 'text') {
      const size = it.fontSize / scale
      const lineH = size * 1.2
      it.text.split('\n').forEach((line, i) => {
        page.drawText(safe(font, line), {
          x: it.x / scale,
          y: pageH - it.y / scale - size * 0.95 - i * lineH,
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
        x: it.x / scale,
        y: pageH - (it.y + it.h) / scale,
        width: it.w / scale,
        height: it.h / scale,
        opacity: it.opacity,
      })
    }
  }
  return doc.save()
}
