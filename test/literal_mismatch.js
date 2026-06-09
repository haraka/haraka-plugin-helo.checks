const { beforeEach, describe, it } = require('node:test')

const { callHook, assertCont, assertDeny, assertResult } = require('haraka-test-fixtures')

const { setup } = require('./_setup')

describe('literal_mismatch', () => {
  let plugin, connection

  beforeEach(async () => {
    ;({ plugin, connection } = await setup())
  })

  it('passes when helo is not an IP literal', async () => {
    const r = await callHook(plugin, 'literal_mismatch', connection, 'mail.example.com')
    assertCont(r)
    assertResult(connection, plugin, 'pass', 'literal_mismatch')
  })

  describe('mode 1: exact IP match', () => {
    it('passes when helo literal matches connecting IP', async () => {
      plugin.cfg.check.literal_mismatch = 1
      connection.remote.ip = '10.0.1.1'
      const r = await callHook(plugin, 'literal_mismatch', connection, '[10.0.1.1]')
      assertCont(r)
      assertResult(connection, plugin, 'pass', 'literal_mismatch')
    })

    it('fails (no reject) when literal differs from connecting IP', async () => {
      plugin.cfg.check.literal_mismatch = 1
      plugin.cfg.reject.literal_mismatch = false
      connection.remote.ip = '10.0.1.2'
      const r = await callHook(plugin, 'literal_mismatch', connection, '[10.0.1.1]')
      assertCont(r)
      assertResult(connection, plugin, 'fail', 'literal_mismatch')
    })

    it('DENYs when literal differs and reject=true', async () => {
      plugin.cfg.check.literal_mismatch = 1
      plugin.cfg.reject.literal_mismatch = true
      connection.remote.ip = '10.0.1.2'
      const r = await callHook(plugin, 'literal_mismatch', connection, '[10.0.1.1]')
      assertDeny(r, /does not match your IP address/, DENY)
    })
  })

  describe('mode 2: /24 network match', () => {
    it('passes when helo literal is in the same /24', async () => {
      plugin.cfg.check.literal_mismatch = 2
      connection.remote.ip = '10.0.1.2'
      const r = await callHook(plugin, 'literal_mismatch', connection, '[10.0.1.1]')
      assertCont(r)
      assertResult(connection, plugin, 'pass', 'literal_mismatch')
    })

    it('fails (no reject) when helo literal is in a different /24', async () => {
      plugin.cfg.check.literal_mismatch = 2
      plugin.cfg.reject.literal_mismatch = false
      connection.remote.ip = '10.0.2.2'
      const r = await callHook(plugin, 'literal_mismatch', connection, '[10.0.1.1]')
      assertCont(r)
      assertResult(connection, plugin, 'fail', 'literal_mismatch')
    })

    it('DENYs when literal in different /24 and reject=true', async () => {
      plugin.cfg.check.literal_mismatch = 2
      plugin.cfg.reject.literal_mismatch = true
      connection.remote.ip = '10.0.2.2'
      const r = await callHook(plugin, 'literal_mismatch', connection, '[10.0.1.1]')
      assertDeny(r, /not in the same \/24/, DENY)
    })
  })

  describe('mode 3: private IP literal passes', () => {
    it('passes when helo literal is private', async () => {
      plugin.cfg.check.literal_mismatch = 3
      connection.remote.ip = '203.0.113.5'
      const r = await callHook(plugin, 'literal_mismatch', connection, '[192.168.0.1]')
      assertCont(r)
      assertResult(connection, plugin, 'pass', 'literal_mismatch(private)')
    })
  })
})
