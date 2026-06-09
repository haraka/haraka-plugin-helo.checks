const { beforeEach, describe, it } = require('node:test')

const { callHook, assertCont, assertDeny, assertResult } = require('haraka-test-fixtures')

const { setup } = require('./_setup')

describe('big_company', () => {
  let plugin, connection

  beforeEach(async () => {
    ;({ plugin, connection } = await setup())
    plugin.cfg.check.big_company = true
  })

  it('passes when helo matches one of the allowed rDNS suffixes', async () => {
    connection.remote.host = 'yahoo.co.jp'
    plugin.cfg.reject.big_company = true
    const r = await callHook(plugin, 'big_company', connection, 'yahoo.co.jp')
    assertCont(r)
    assertResult(connection, plugin, 'pass', 'big_co')
  })

  it('fails when rDNS ends with the suffix but is a different domain (e.g. notyahoo.com)', async () => {
    connection.remote.host = 'notyahoo.com'
    plugin.cfg.reject.big_company = false
    const r = await callHook(plugin, 'big_company', connection, 'yahoo.com')
    assertCont(r)
    assertResult(connection, plugin, 'fail', 'big_co')
  })

  it('fails (no reject) when bigco helo and rDNS do not match', async () => {
    connection.remote.host = 'anything-else.com'
    connection.remote.is_private = false
    plugin.cfg.reject.big_company = false
    const r = await callHook(plugin, 'big_company', connection, 'yahoo.com')
    assertCont(r)
    assertResult(connection, plugin, 'fail', 'big_co')
  })

  it('DENYs when bigco helo and rDNS do not match and reject=true', async () => {
    connection.remote.host = 'anything-else.com'
    plugin.cfg.reject.big_company = true
    const r = await callHook(plugin, 'big_company', connection, 'yahoo.com')
    assertDeny(r, /You are not who you say you are/, DENY)
  })

  it('skips when helo is an IP literal', async () => {
    const r = await callHook(plugin, 'big_company', connection, '[10.0.0.1]')
    assertCont(r)
    assertResult(connection, plugin, 'skip', 'big_co(literal)')
  })

  it('records err when cfg.bigco is missing', async () => {
    plugin.cfg.bigco = undefined
    const r = await callHook(plugin, 'big_company', connection, 'yahoo.com')
    assertCont(r)
    assertResult(connection, plugin, 'err', 'big_co(config missing)')
  })

  it('passes (not bigco) when helo is not in cfg.bigco', async () => {
    const r = await callHook(plugin, 'big_company', connection, 'unknown.example')
    assertCont(r)
    assertResult(connection, plugin, 'pass', 'big_co(not)')
  })

  it('fails when bigco helo but rDNS is "Unknown"', async () => {
    connection.remote.host = 'Unknown'
    plugin.cfg.reject.big_company = false
    const r = await callHook(plugin, 'big_company', connection, 'yahoo.com')
    assertCont(r)
    assertResult(connection, plugin, 'fail', 'big_co(rDNS)')
  })

  it('DENYs when bigco helo and rDNS missing and reject=true', async () => {
    connection.remote.host = 'DNSERROR'
    plugin.cfg.reject.big_company = true
    const r = await callHook(plugin, 'big_company', connection, 'yahoo.com')
    assertDeny(r, /Big company w\/o rDNS/, DENY)
  })
})
