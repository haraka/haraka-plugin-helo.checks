const path = require('node:path')

const fixtures = require('haraka-test-fixtures')
const tlds = require('haraka-tld')

const { callHook, makeConnection, makePlugin } = fixtures

// haraka-tld loads its public suffix list asynchronously; without this
// get_organizational_domain() returns null and rdns_match/valid_hostname
// checks misfire. See https://github.com/haraka/haraka-tld.
exports.setup = async function (opts = {}) {
  await tlds.ready

  const plugin = makePlugin('helo.checks', { register: false })
  plugin.config.root_path = path.resolve('test', 'config')
  plugin.register()

  const connection = makeConnection({ ip: opts.ip ?? '208.75.199.19' })

  return { plugin, connection }
}

// Run every method registered on hookName ('helo' or 'ehlo') in order,
// stopping early on the first DENY*/OK code. Returns the final {rc, msg}.
exports.runHookChain = async function (plugin, hookName, connection, helo) {
  const denySet = new Set([
    DENY,
    DENYSOFT,
    DENYDISCONNECT,
    DENYSOFTDISCONNECT,
    OK,
  ])
  let last = { rc: undefined, msg: undefined }
  for (const method of plugin.hooks[hookName] ?? []) {
    last = await callHook(plugin, method, connection, helo)
    if (denySet.has(last.rc)) break
  }
  return last
}
