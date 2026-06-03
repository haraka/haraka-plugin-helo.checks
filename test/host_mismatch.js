const { beforeEach, describe, it } = require('node:test')

const {
  callHook,
  assertCont,
  assertDeny,
  assertResult,
} = require('haraka-test-fixtures')

const { setup } = require('./_setup')

describe('host_mismatch', () => {
  let plugin, connection

  beforeEach(async () => {
    ;({ plugin, connection } = await setup())
    plugin.cfg.check.host_mismatch = true
  })

  it('skips when no previous helo recorded (1st)', async () => {
    const r = await callHook(
      plugin,
      'host_mismatch',
      connection,
      'a.example.com',
    )
    assertCont(r)
    assertResult(connection, plugin, 'skip', 'host_mismatch(1st)')
  })

  it('passes when current helo matches previous', async () => {
    await callHook(plugin, 'init', connection, 'a.example.com')
    const r = await callHook(
      plugin,
      'host_mismatch',
      connection,
      'a.example.com',
    )
    assertCont(r)
    assertResult(connection, plugin, 'pass', 'host_mismatch')
  })

  it('fails (no reject) when helo differs', async () => {
    await callHook(plugin, 'init', connection, 'helo.example.com')
    plugin.cfg.reject.host_mismatch = false
    const r = await callHook(plugin, 'host_mismatch', connection, 'anything')
    assertCont(r)
    assertResult(connection, plugin, 'fail')
  })

  it('DENYs when helo differs and reject=true', async () => {
    await callHook(plugin, 'init', connection, 'helo.example.com')
    plugin.cfg.reject.host_mismatch = true
    const r = await callHook(plugin, 'host_mismatch', connection, 'anything')
    assertDeny(r, /helo.example.com.*anything/i, DENY)
  })
})
