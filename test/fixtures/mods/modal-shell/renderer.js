// Fixture-only emitted-style module. No private game imports or copied dismissal implementation.
import { useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { createPortal } from 'react-dom'
import { registerHooks, useModalShell, useDismissLayer } from '@vx/modkit/renderer'

function Layer({ close }) {
  useDismissLayer(close, true)
  return jsxs('div', { id: 'fixture-modal-layer', children: [
    jsx('span', { children: 'Inner layer' }),
    jsx('input', { id: 'fixture-modal-input', 'aria-label': 'Layer input' })
  ] })
}

function Modal({ close }) {
  const [layer, setLayer] = useState(false)
  const { host, overlayProps } = useModalShell(close, 'none')
  if (!host) return null
  return createPortal(jsx('div', {
    id: 'fixture-modal-overlay',
    style: { position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center', background: '#0006' },
    ...overlayProps,
    children: jsxs('section', {
      id: 'fixture-modal', role: 'dialog', 'aria-modal': true, 'aria-label': 'Fixture modal',
      style: { padding: 30, background: 'white', color: 'black' },
      children: [
        jsx('p', { children: 'Installed modal' }),
        jsx('button', { id: 'fixture-modal-open-layer', type: 'button', onClick: () => setLayer(true), children: 'Open layer' }),
        jsx('button', { id: 'fixture-modal-close', type: 'button', onClick: close, children: 'Close' }),
        layer ? jsx(Layer, { close: () => setLayer(false) }) : null
      ]
    })
  }), host)
}

function Section() {
  const [open, setOpen] = useState(false)
  return jsxs('section', { children: [
    jsx('button', { id: 'fixture-modal-open', type: 'button', onClick: () => setOpen(true), children: 'Open fixture modal' }),
    open ? jsx(Modal, { close: () => setOpen(false) }) : null
  ] })
}

registerHooks('modal-shell', { settingsSection: Section })
