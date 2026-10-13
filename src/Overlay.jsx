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

  const track = (move) => {
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const startDrag = (e) => {
    if (editing) return
    e.stopPropagation()
    onSelect()
    const sx = e.clientX, sy = e.clientY, ox = item.x, oy = item.y
    const box = e.currentTarget.getBoundingClientRect()
    track((ev) => onChange(clamp(ox + ev.clientX - sx, oy + ev.clientY - sy, box.width, box.height)))
  }

  const startResize = (e) => {
    e.stopPropagation()
    e.preventDefault()
    const sx = e.clientX, ow = item.w, ratio = item.h / item.w
    track((ev) => {
      const w = Math.max(20, Math.min(ow + ev.clientX - sx, pageSize.w - item.x))
      onChange({ w, h: w * ratio })
    })
  }

  const style = { left: item.x, top: item.y, opacity: item.opacity }
  if (item.type === 'image') { style.width = item.w; style.height = item.h }

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
          style={{ fontSize: item.fontSize, color: item.color, lineHeight: 1.2 }}
          onChange={(e) => onChange({ text: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={() => setEditing(false)}
        />
      ) : (
        <div className="text-view" style={{ fontSize: item.fontSize, color: item.color, lineHeight: 1.2 }}>
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
