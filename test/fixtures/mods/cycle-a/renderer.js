import { jsx } from 'react/jsx-runtime'
import { registerHooks } from '@vx/modkit/renderer'

registerHooks('cycle-a', { settingsSection: () => jsx('p', { children: 'cycle-a' }) })
