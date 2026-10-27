// Hand-written as `vxmod build` would emit it: one CommonJS file.
module.exports = {
  protocols: [{ route: 'ping', handle: () => 'ok' }]
}
