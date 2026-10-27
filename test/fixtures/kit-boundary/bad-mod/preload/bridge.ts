// A fixture for the boundary test: a mod has no preload code, so any import here is refused.
import { contextBridge } from 'electron'

export const bridge = contextBridge
