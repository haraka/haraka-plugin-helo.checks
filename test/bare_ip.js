const { beforeEach, describe, it } = require('node:test')

const { callHook, assertCont, assertDeny, assertResult } = require('haraka-test-fixtures')

const { setup } = require('./_setup')

describe('bare_ip', () => {
  let plugin, connection

  beforeEach(async () => {
    ;({ plugin, connection } = await setup())
    plugin.cfg.check.bare_ip = true
  })

  it('passes when helo is bracketed (address literal)', async () => {
    plugin.cfg.reject.bare_ip = true
    const r = await callHook(plugin, 'bare_ip', connection, '[192.168.1.2]')
    assertCont(r)
    assertResult(connection, plugin, 'pass', 'bare_ip')
  })

  it('fails (no reject) when helo is a bare IPv4', async () => {
    plugin.cfg.reject.bare_ip = false
    const r = await callHook(plugin, 'bare_ip', connection, '192.168.1.1')
    assertCont(r)
    assertResult(connection, plugin, 'fail', 'bare_ip(invalid literal)')
  })

  it('DENYs when helo is a bare IPv4 and reject=true', async () => {
    plugin.cfg.reject.bare_ip = true
    const r = await callHook(plugin, 'bare_ip', connection, '192.168.1.1')
    assertDeny(r, /Invalid address format in HELO/, DENY)
  })

  it('fails when helo is a bare IPv6 (with IPv6: prefix)', async () => {
    plugin.cfg.reject.bare_ip = false
    const r = await callHook(plugin, 'bare_ip', connection, 'IPv6:2001:db8::1')
    assertCont(r)
    assertResult(connection, plugin, 'fail', 'bare_ip(invalid literal)')
  })
})
