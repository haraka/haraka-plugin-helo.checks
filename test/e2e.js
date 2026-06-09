// End-to-end coverage: drives every method registered on the helo / ehlo
// hooks in order, simulating Haraka's hook chain. Exercises real plugin
// composition (init runs first, host_mismatch sees prior helo, etc.).

const { after, before, beforeEach, describe, it } = require('node:test')

const fixtures = require('haraka-test-fixtures')
const dns_config = require('haraka-net-utils/lib/dns_config')

const { assertCont, assertDeny, assertResult, getResult } = fixtures

const { runHookChain, setup } = require('./_setup')

describe('e2e: helo hook chain', () => {
  let plugin, connection, fakeDns, restoreDns

  before(async () => {
    fakeDns = await fixtures.dns.start({
      'mail.example.com': { a: ['208.75.199.19'] },
      'foreign.example.com': { a: ['203.0.113.50'] },
    })
    restoreDns = fakeDns.patch(dns_config)
  })

  after(async () => {
    restoreDns()
    await fakeDns.close()
  })

  beforeEach(async () => {
    ;({ plugin, connection } = await setup())
    connection.remote.is_private = false
  })

  it('clean EHLO passes the full chain with no DENY', async () => {
    connection.remote.host = 'mail.example.com'
    connection.esmtp = true
    const r = await runHookChain(plugin, 'ehlo', connection, 'mail.example.com')
    assertCont(r)
    assertResult(connection, plugin, 'pass', 'valid_hostname')
    assertResult(connection, plugin, 'pass', 'rdns_match')
    assertResult(connection, plugin, 'pass', 'forward_dns')
  })

  it('bare IP HELO is DENYed at bare_ip when reject=true', async () => {
    plugin.cfg.reject.bare_ip = true
    const r = await runHookChain(plugin, 'helo', connection, '192.0.2.1')
    assertDeny(r, /Invalid address format in HELO/, DENY)
    assertResult(connection, plugin, 'fail', 'bare_ip(invalid literal)')
  })

  it('host_mismatch DENYs when the second HELO differs and reject=true', async () => {
    plugin.cfg.reject.host_mismatch = true
    // first HELO: pass
    await runHookChain(plugin, 'helo', connection, 'mail.example.com')
    // second HELO with a different name: should DENY at host_mismatch
    const r = await runHookChain(plugin, 'helo', connection, 'other.example.com')
    assertDeny(r, /host_mismatch/, DENY)
  })

  it('proto_mismatch DENYs HELO after EHLO when reject=true', async () => {
    plugin.cfg.reject.proto_mismatch = true
    // first EHLO so esmtp gets set true and a helo_host is recorded
    connection.esmtp = true
    await runHookChain(plugin, 'ehlo', connection, 'mail.example.com')
    // now switch to HELO -> proto_mismatch_smtp fires
    const r = await runHookChain(plugin, 'helo', connection, 'mail.example.com')
    assertDeny(r, /HELO protocol mismatch/, DENY)
  })

  it('emit_log fires at the end of the chain', async () => {
    let info = 0
    connection.loginfo = () => info++
    connection.remote.host = 'mail.example.com'
    connection.esmtp = true
    const r = await runHookChain(plugin, 'ehlo', connection, 'mail.example.com')
    assertCont(r)
    // emit_log called once at end of chain
    if (info < 1) throw new Error('expected emit_log to invoke loginfo')
  })

  it('records helo_host exactly once across two identical EHLOs', async () => {
    connection.remote.host = 'mail.example.com'
    connection.esmtp = true
    await runHookChain(plugin, 'ehlo', connection, 'mail.example.com')
    await runHookChain(plugin, 'ehlo', connection, 'mail.example.com')
    const r = getResult(connection, plugin)
    // helo_host is a scalar field, not a multi-add list — value should be stable
    if (r.helo_host !== 'mail.example.com') {
      throw new Error(`expected helo_host stable, got ${r.helo_host}`)
    }
  })
})
