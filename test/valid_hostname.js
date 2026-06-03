const { beforeEach, describe, it } = require('node:test')

const {
  callHook,
  assertCont,
  assertDeny,
  assertResult,
} = require('haraka-test-fixtures')

const { setup } = require('./_setup')

describe('valid_hostname', () => {
  let plugin, connection

  beforeEach(async () => {
    ;({ plugin, connection } = await setup())
    plugin.cfg.check.valid_hostname = true
  })

  it('passes for a valid FQDN', async () => {
    const r = await callHook(
      plugin,
      'valid_hostname',
      connection,
      'great.domain.com',
    )
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
    const r = await callHook(
      plugin,
      'valid_hostname',
      connection,
      '[192.0.2.1]',
    )
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

  it('allows .local TLD without requiring valid org domain', async () => {
    const r = await callHook(
      plugin,
      'valid_hostname',
      connection,
      'workstation.local',
    )
    assertCont(r)
  })

  it('allows .lan TLD', async () => {
    const r = await callHook(plugin, 'valid_hostname', connection, 'host.lan')
    assertCont(r)
  })

  it('allows .corp TLD', async () => {
    const r = await callHook(plugin, 'valid_hostname', connection, 'host.corp')
    assertCont(r)
  })

  it('fails (no reject) when helo contains non-ASCII characters', async () => {
    plugin.cfg.reject.valid_hostname = false
    const r = await callHook(
      plugin,
      'valid_hostname',
      connection,
      'café.example',
    )
    assertCont(r)
    assertResult(connection, plugin, 'fail', 'valid_hostname(not_ascii)')
  })

  it('DENYs non-ASCII helo when reject=true (RFC 5321 §2.3.5)', async () => {
    plugin.cfg.reject.valid_hostname = true
    const r = await callHook(
      plugin,
      'valid_hostname',
      connection,
      'üöä.example',
    )
    assertDeny(r, undefined, DENY)
    assertResult(connection, plugin, 'fail', 'valid_hostname(not_ascii)')
  })
})
