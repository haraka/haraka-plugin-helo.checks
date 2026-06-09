const { beforeEach, describe, it } = require('node:test')

const { callHook, assertCont, assertDeny, assertResult } = require('haraka-test-fixtures')

const { setup } = require('./_setup')

describe('proto_mismatch', () => {
  let plugin, connection

  beforeEach(async () => {
    ;({ plugin, connection } = await setup())
    plugin.cfg.check.proto_mismatch = true
  })

  it('returns next() when no prior helo_host is recorded', async () => {
    const r = await callHook(plugin, 'proto_mismatch', connection, 'host', 'smtp')
    assertCont(r)
  })

  it('fails (no reject) when esmtp=false and proto=esmtp', async () => {
    await callHook(plugin, 'init', connection, 'helo.example.com')
    connection.esmtp = false
    plugin.cfg.reject.proto_mismatch = false
    const r = await callHook(plugin, 'proto_mismatch', connection, 'anything', 'esmtp')
    assertCont(r)
    assertResult(connection, plugin, 'fail', 'proto_mismatch(esmtp)')
  })

  it('passes when esmtp=true and proto=esmtp', async () => {
    await callHook(plugin, 'init', connection, 'helo.example.com')
    connection.esmtp = true
    const r = await callHook(plugin, 'proto_mismatch', connection, 'anything', 'esmtp')
    assertCont(r)
  })

  it('DENYs (proto=esmtp arg) when reject=true', async () => {
    await callHook(plugin, 'init', connection, 'helo.example.com')
    connection.esmtp = false
    plugin.cfg.reject.proto_mismatch = true
    const r = await callHook(plugin, 'proto_mismatch', connection, 'anything', 'esmtp')
    assertDeny(r, /EHLO protocol mismatch/, DENY)
  })

  it('DENYs (proto=smtp arg) with HELO wording when reject=true', async () => {
    await callHook(plugin, 'init', connection, 'helo.example.com')
    connection.esmtp = true
    plugin.cfg.reject.proto_mismatch = true
    const r = await callHook(plugin, 'proto_mismatch', connection, 'anything', 'smtp')
    assertDeny(r, /HELO protocol mismatch/, DENY)
  })

  it('proto_mismatch_smtp forwards proto=smtp', async () => {
    await callHook(plugin, 'init', connection, 'helo.example.com')
    connection.esmtp = true // smtp arg + esmtp=true -> mismatch
    plugin.cfg.reject.proto_mismatch = false
    const r = await callHook(plugin, 'proto_mismatch_smtp', connection, 'host')
    assertCont(r)
    assertResult(connection, plugin, 'fail', 'proto_mismatch(smtp)')
  })

  it('proto_mismatch_esmtp forwards proto=esmtp', async () => {
    await callHook(plugin, 'init', connection, 'helo.example.com')
    connection.esmtp = false // esmtp arg + esmtp=false -> mismatch
    plugin.cfg.reject.proto_mismatch = false
    const r = await callHook(plugin, 'proto_mismatch_esmtp', connection, 'host')
    assertCont(r)
    assertResult(connection, plugin, 'fail', 'proto_mismatch(esmtp)')
  })

  it('DENY message uses EHLO when proto=esmtp', async () => {
    await callHook(plugin, 'init', connection, 'helo.example.com')
    connection.esmtp = false
    plugin.cfg.reject.proto_mismatch = true
    const r = await callHook(plugin, 'proto_mismatch_esmtp', connection, 'host')
    assertDeny(r, /EHLO protocol mismatch/, DENY)
  })
})
