const assert = require('node:assert/strict')
const { beforeEach, describe, it } = require('node:test')

const { assertResult, callHook, assertCont } = require('haraka-test-fixtures')

const { setup } = require('./_setup')

describe('should_skip', () => {
  let plugin, connection

  beforeEach(async () => {
    ;({ plugin, connection } = await setup())
  })

  it('returns true (and short-circuits) when relaying and skip.relaying=true', () => {
    plugin.cfg.skip.relaying = true
    connection.relaying = true
    assert.equal(plugin.should_skip(connection, 'bare_ip'), true)
    assertResult(connection, plugin, 'skip', 'bare_ip(relay)')
  })

  it('returns true when remote is private and skip.private_ip=true', () => {
    plugin.cfg.skip.private_ip = true
    connection.remote.is_private = true
    assert.equal(plugin.should_skip(connection, 'bare_ip'), true)
    assertResult(connection, plugin, 'skip', 'bare_ip(private)')
  })

  it('returns true on a repeat invocation for the same hello.host', async () => {
    // first call records the helo_host and the _skip_hooks marker
    await callHook(plugin, 'init', connection, 'a.example.com')
    connection.hello.host = 'a.example.com'
    assert.equal(plugin.should_skip(connection, 'bare_ip'), false)
    // mark hello.host so the second call recognizes "already invoked"
    assert.equal(plugin.should_skip(connection, 'bare_ip'), true)
  })

  it('integration: bare_ip skips when relaying', async () => {
    plugin.cfg.check.bare_ip = true
    plugin.cfg.skip.relaying = true
    connection.relaying = true
    const r = await callHook(plugin, 'bare_ip', connection, '192.0.2.1')
    assertCont(r)
    assertResult(connection, plugin, 'skip', 'bare_ip(relay)')
  })
})
