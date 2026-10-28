import { jsx } from 'react/jsx-runtime'
import { registerHooks } from '@vx/modkit/renderer'
import { greet } from 'vxmod://lib/renderer.js'

registerHooks('uses-lib', {
  settingsSection: () => jsx('p', { id: 'uses-lib-section', children: greet() })
})
