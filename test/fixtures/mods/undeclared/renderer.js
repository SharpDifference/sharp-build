import { jsx } from 'react/jsx-runtime'
import { registerHooks } from '@vx/modkit/renderer'

registerHooks('undeclared', {
  settingsSection: () => jsx('p', { id: 'undeclared-section', children: 'undeclared' }),
  gameEntered: () => {}
})
