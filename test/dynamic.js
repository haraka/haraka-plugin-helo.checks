const { beforeEach, describe, it } = require('node:test')

const {
  callHook,
  assertCont,
  assertDeny,
  assertResult,
} = require('haraka-test-fixtures')

const { setup } = require('./_setup')

describe('dynamic', () => {
  let plugin, connection

  beforeEach(async () => {
    ;({ plugin, connection } = await setup())
    plugin.cfg.check.dynamic = true
  })

  it('passes when helo has no IP fragments', async () => {
    connection.remote.ip = '208.75.177.99'
    plugin.cfg.reject.dynamic = true
    const r = await callHook(plugin, 'dynamic', connection, 'matt.simerson.tld')
    assertCont(r)
    assertResult(connection, plugin, 'pass', 'dynamic')
  })

  it('fails (no reject) when remote IP appears in helo', async () => {
    connection.remote.ip = '76.121.96.159'
    plugin.cfg.reject.dynamic = false
    const r = await callHook(
      plugin,
      'dynamic',
      connection,
      'c-76-121-96-159.hsd1.wa.comcast.net',
    )
    assertCont(r)
    assertResult(connection, plugin, 'fail', 'dynamic')
  })

  it('DENYs when remote IP is in helo and reject=true', async () => {
    connection.remote.ip = '76.121.96.159'
    plugin.cfg.reject.dynamic = true
    const r = await callHook(
      plugin,
      'dynamic',
      connection,
      'c-76-121-96-159.hsd1.wa.comcast.net',
    )
    assertDeny(r, /HELO is dynamic/, DENY)
  })

  it('skips when helo has no dots', async () => {
    const r = await callHook(plugin, 'dynamic', connection, 'localhost')
    assertCont(r)
    assertResult(connection, plugin, 'skip', 'dynamic(no dots)')
  })

  it('skips when helo is an address literal', async () => {
    const r = await callHook(plugin, 'dynamic', connection, '[10.0.0.1]')
    assertCont(r)
    assertResult(connection, plugin, 'skip', 'dynamic(literal)')
  })
})
