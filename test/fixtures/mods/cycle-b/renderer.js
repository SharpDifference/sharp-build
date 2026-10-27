import { jsx } from 'react/jsx-runtime'
import { registerHooks } from '@vx/modkit/renderer'

registerHooks('cycle-b', { settingsSection: () => jsx('p', { children: 'cycle-b' }) })
