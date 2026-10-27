// Hand-written as `vxmod build` would emit it: one CommonJS file. The `on` route answers what the
// main process makes of this mod's switch, for a check that main's rule knows an installed mod.
const { sharedModOn } = require('@vx/modkit/shared')
module.exports = {
  protocols: [
    { route: 'ping', handle: () => 'ok' },
    { route: 'on', handle: () => String(sharedModOn('hello-mod')) }
  ]
}
