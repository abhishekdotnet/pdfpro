import { useRef, useState, useEffect } from 'react'

/** Draggable / resizable sticker (text or image) positioned over a PDF page. */
export default function Overlay({ item, selected, onSelect, onChange, onDelete, pageSize }) {
  const [editing, setEditing] = useState(false)
  const taRef = useRef(null)

  useEffect(() => { if (editing) taRef.current?.focus() }, [editing])
  useEffect(() => { if (!selected) setEditing(false) }, [selected])

  const clamp = (x, y, w, h) => ({
    x: Math.min(Math.max(0, x), Math.max(0, pageSize.w - w)),
    y: Math.min(Math.max(0, y), Math.max(0, pageSize.h - h)),
  })

  const track = (move, onUp) => {
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      onUp?.()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const startDrag = (e) => {
    if (editing) return
    e.stopPropagation()
    const wasSelected = selected
    let moved = false
    onSelect()
    const sx = e.clientX, sy = e.clientY, ox = item.x, oy = item.y
    const box = e.currentTarget.getBoundingClientRect()
    const pageScale = e.currentTarget.parentElement.getBoundingClientRect().width / pageSize.w
    track((ev) => {
      if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 6) return
      moved = true
      onChange(clamp(ox + (ev.clientX - sx) / pageScale, oy + (ev.clientY - sy) / pageScale, box.width / pageScale, box.height / pageScale))
    }, () => {
      // Tapping an already-selected text edits it (double-click doesn't exist on touch).
      if (!moved && wasSelected && item.type === 'text') setEditing(true)
    })
  }

  const startResize = (e) => {
    e.stopPropagation()
    e.preventDefault()
    const sx = e.clientX, ow = item.w, ratio = item.h / item.w
    const pageScale = e.currentTarget.parentElement.getBoundingClientRect().width / pageSize.w
    track((ev) => {
      const w = Math.max(20, Math.min(ow + (ev.clientX - sx) / pageScale, pageSize.w - item.x))
      onChange({ w, h: w * ratio })
    })
  }

  // Relative to the page element's rendered width, so text scales with the page.
  const textSize = `${item.fontSize / pageSize.w * 100}cqw`
  const style = { left: `${item.x / pageSize.w * 100}%`, top: `${item.y / pageSize.h * 100}%`, opacity: item.opacity }
  if (item.type === 'image') { style.width = `${item.w / pageSize.w * 100}%`, style.height = `${item.h / pageSize.h * 100}%` }

  const lines = item.text?.split('\n') ?? []

  return (
    <div
      className={`overlay ${selected ? 'selected' : ''}`}
      style={style}
      onPointerDown={startDrag}
      onDoubleClick={() => item.type === 'text' && setEditing(true)}
    >
      {item.type === 'image' ? (
        <img src={item.src} draggable={false} alt="" />
      ) : editing ? (
        <textarea
          ref={taRef}
          className="text-edit"
          value={item.text}
          rows={lines.length}
          cols={Math.max(4, ...lines.map((l) => l.length)) + 1}
          style={{ fontSize: textSize, color: item.color, lineHeight: 1.2 }}
          onChange={(e) => onChange({ text: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={() => setEditing(false)}
        />
      ) : (
        <div className="text-view" style={{ fontSize: textSize, color: item.color, lineHeight: 1.2 }}>
          {item.text || ' '}
        </div>
      )}
      {selected && (
        <>
          <button className="del" onPointerDown={(e) => e.stopPropagation()} onClick={onDelete} title="Delete">×</button>
          {item.type === 'image' && <div className="handle" onPointerDown={startResize} />}
        </>
      )}
    </div>
  )
}
