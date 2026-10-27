// Hand-written as `vxmod build` would emit it: React and the kit left external, JSX as calls.
import React, { useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { registerHooks, useModOn } from '@vx/modkit/renderer'

function Section() {
  const [clicks, setClicks] = useState(0)
  const on = useModOn('hello-mod')
  return jsxs('section', {
    id: 'hello-mod-section',
    className: 'hello-mod',
    children: [
      jsx('h4', { children: 'Hello mod' }),
      jsx('button', { id: 'hello-mod-count', type: 'button', onClick: () => setClicks(clicks + 1), children: `clicked ${clicks}` }),
      jsx('img', { id: 'hello-mod-dot', src: 'vxmod://hello-mod/assets/dot.png', alt: '' }),
      jsx('span', { id: 'hello-mod-on', children: on ? 'on' : 'off' }),
      jsx('span', { id: 'hello-mod-react', children: React.version })
    ]
  })
}

registerHooks('hello-mod', { settingsSection: Section })
