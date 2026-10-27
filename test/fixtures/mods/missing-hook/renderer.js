// Hand-written as `vxmod build` would emit it: React and the kit left external, JSX as calls.
import React, { useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { registerHooks, useModOn } from '@vx/modkit/renderer'

function Section() {
  const [clicks, setClicks] = useState(0)
  const on = useModOn('missing-hook')
  return jsxs('section', {
    id: 'missing-hook-section',
    className: 'missing-hook',
    children: [
      jsx('h4', { children: 'Missing hook' }),
      jsx('button', { id: 'missing-hook-count', type: 'button', onClick: () => setClicks(clicks + 1), children: `clicked ${clicks}` }),
      jsx('img', { id: 'missing-hook-dot', src: 'vxmod://missing-hook/assets/dot.png', alt: '' }),
      jsx('span', { id: 'missing-hook-on', children: on ? 'on' : 'off' }),
      jsx('span', { id: 'missing-hook-react', children: React.version })
    ]
  })
}

registerHooks('missing-hook', { settingsSection: Section })
