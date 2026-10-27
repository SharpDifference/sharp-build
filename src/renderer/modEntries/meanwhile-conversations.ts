import { MEANWHILE_MOD } from '../../shared/meanwhile'
import { MeanwhilePage } from '../views/MeanwhileModal'
import { MeanwhileIcon } from '../components/BunnyboardFeatureIcons'
import { registerHooks } from '../mods/hooks'

registerHooks(MEANWHILE_MOD, { bunnyboardPage: { id: 'meanwhile', word: 'MEANWHILE', Mark: MeanwhileIcon, Page: MeanwhilePage } })
