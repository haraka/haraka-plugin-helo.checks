const { beforeEach, describe, it } = require('node:test')

const {
  callHook,
  assertCont,
  assertDeny,
  assertResult,
} = require('haraka-test-fixtures')

const { setup } = require('./_setup')

describe('rdns_match', () => {
  let plugin, connection

  beforeEach(async () => {
    ;({ plugin, connection } = await setup())
    plugin.cfg.check.rdns_match = true
  })

  it('passes when helo exactly matches rDNS', async () => {
    connection.remote.host = 'helo.example.com'
    plugin.cfg.reject.rdns_match = true
    const r = await callHook(
      plugin,
      'rdns_match',
      connection,
      'helo.example.com',
    )
    assertCont(r)
    assertResult(connection, plugin, 'pass', 'rdns_match')
  })

  it('passes (org dom) when helo and rDNS share organizational domain', async () => {
    connection.remote.host = 'ehlo.example.com'
    plugin.cfg.reject.rdns_match = false
    const r = await callHook(
      plugin,
      'rdns_match',
      connection,
      'helo.example.com',
    )
    assertCont(r)
    assertResult(connection, plugin, 'pass', 'rdns_match(org_dom)')
  })

  it('fails (no reject) when helo and rDNS differ', async () => {
    connection.remote.host = 'ehlo.gmail.com'
    plugin.cfg.reject.rdns_match = false
    const r = await callHook(
      plugin,
      'rdns_match',
      connection,
      'helo.example.com',
    )
    assertCont(r)
    assertResult(connection, plugin, 'fail', 'rdns_match')
  })

  it('DENYs when rdns mismatches and reject=true', async () => {
    connection.remote.host = 'ehlo.gmail.com'
    plugin.cfg.reject.rdns_match = true
    const r = await callHook(
      plugin,
      'rdns_match',
      connection,
      'helo.example.com',
    )
    assertDeny(r, /HELO host does not match rDNS/, DENY)
  })

  it('fails when helo is empty', async () => {
    const r = await callHook(plugin, 'rdns_match', connection, '')
    assertCont(r)
    assertResult(connection, plugin, 'fail', 'rdns_match(empty)')
  })

  it('fails when helo is an IP literal', async () => {
    const r = await callHook(plugin, 'rdns_match', connection, '[192.0.2.1]')
    assertCont(r)
    assertResult(connection, plugin, 'fail', 'rdns_match(literal)')
  })
})
