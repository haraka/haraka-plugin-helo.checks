const { beforeEach, describe, it } = require('node:test')

const { callHook, assertCont, assertDeny, assertResult } = require('haraka-test-fixtures')

const { setup } = require('./_setup')

describe('valid_hostname', () => {
  let plugin, connection

  beforeEach(async () => {
    ;({ plugin, connection } = await setup())
    plugin.cfg.check.valid_hostname = true
  })

  it('passes for a valid FQDN', async () => {
    const r = await callHook(plugin, 'valid_hostname', connection, 'great.domain.com')
    assertCont(r)
    assertResult(connection, plugin, 'pass', 'valid_hostname')
  })

  it('passes for a valid FQDN even when an earlier check failed', async () => {
    // a prior check (e.g. match_re) may have recorded a fail; that must not
    // suppress this check's own pass, which forward_dns keys off of
    connection.results.add(plugin, { fail: 'match_re' })
    const r = await callHook(plugin, 'valid_hostname', connection, 'great.domain.com')
    assertCont(r)
    assertResult(connection, plugin, 'pass', 'valid_hostname')
  })

  it('fails (no reject) for invalid TLD', async () => {
    plugin.cfg.reject.valid_hostname = false
    const r = await callHook(
      plugin,
      'valid_hostname',
      connection,
      'great.domain.non-existent-tld',
    )
    assertCont(r)
    assertResult(connection, plugin, 'fail', 'valid_hostname')
  })

  it('DENYs invalid TLD when reject=true', async () => {
    plugin.cfg.reject.valid_hostname = true
    const r = await callHook(
      plugin,
      'valid_hostname',
      connection,
      'great.domain.non-existent-tld',
    )
    assertDeny(r, /HELO host name invalid/, DENY)
  })

  it('skips when helo is an IP literal', async () => {
    const r = await callHook(plugin, 'valid_hostname', connection, '[192.0.2.1]')
    assertCont(r)
    assertResult(connection, plugin, 'skip', 'valid_hostname(literal)')
  })

  it('fails when helo has no dot (single label)', async () => {
    plugin.cfg.reject.valid_hostname = false
    const r = await callHook(plugin, 'valid_hostname', connection, 'localhost')
    assertCont(r)
    assertResult(connection, plugin, 'fail', 'valid_hostname(no_dot)')
  })

  it('DENYs when helo has no dot and reject=true', async () => {
    plugin.cfg.reject.valid_hostname = true
    const r = await callHook(plugin, 'valid_hostname', connection, 'localhost')
    assertDeny(r, /FQDN or address literal/, DENY)
  })

  it('fails an exempt-looking TLD when skip.tlds is empty (default)', async () => {
    plugin.cfg.reject.valid_hostname = false
    const r = await callHook(plugin, 'valid_hostname', connection, 'workstation.local')
    assertCont(r)
    assertResult(connection, plugin, 'fail', 'valid_hostname')
  })

  it('skips a TLD listed in skip.tlds', async () => {
    plugin.cfg.skip.tlds = ['local', 'lan', 'corp']
    const r = await callHook(plugin, 'valid_hostname', connection, 'host.lan')
    assertCont(r)
    assertResult(connection, plugin, 'skip', 'valid_hostname')
  })

  it('skips a custom TLD listed in skip.tlds', async () => {
    plugin.cfg.skip.tlds = ['internal']
    const r = await callHook(plugin, 'valid_hostname', connection, 'box.internal')
    assertCont(r)
    assertResult(connection, plugin, 'skip', 'valid_hostname')
  })

  it('fails (no reject) when helo contains non-ASCII characters', async () => {
    plugin.cfg.reject.valid_hostname = false
    const r = await callHook(plugin, 'valid_hostname', connection, 'café.example')
    assertCont(r)
    assertResult(connection, plugin, 'fail', 'valid_hostname(not_ascii)')
  })

  it('DENYs non-ASCII helo when reject=true (RFC 5321 §2.3.5)', async () => {
    plugin.cfg.reject.valid_hostname = true
    const r = await callHook(plugin, 'valid_hostname', connection, 'üöä.example')
    assertDeny(r, undefined, DENY)
    assertResult(connection, plugin, 'fail', 'valid_hostname(not_ascii)')
  })

  it('Detects non-ASCII helo (RFC 5321 §2.3.5)', async () => {
    plugin.cfg.reject.valid_hostname = false
    await callHook(plugin, 'valid_hostname', connection, 'exaöple')
    assertResult(connection, plugin, 'fail', 'valid_hostname(not_ascii)')
  })

  it('Detects non-ASCII helo with dot (RFC 5321 §2.3.5)', async () => {
    plugin.cfg.reject.valid_hostname = false
    await callHook(plugin, 'valid_hostname', connection, 'host.exaöple')
    assertResult(connection, plugin, 'fail', 'valid_hostname(not_ascii)')
  })
})
