const { beforeEach, describe, it } = require('node:test')

const { callHook, assertCont, assertDeny, assertResult } = require('haraka-test-fixtures')

const { setup } = require('./_setup')

describe('match_re', () => {
  let plugin, connection

  beforeEach(async () => {
    ;({ plugin, connection } = await setup())
  })

  it('passes when helo does not match the list_re', async () => {
    plugin.cfg.list_re = /^(bad\.tld)$/i
    const r = await callHook(plugin, 'match_re', connection, 'not_in_re_list.net')
    assertCont(r)
    assertResult(connection, plugin, 'pass', 'match_re')
  })

  it('fails (no reject) on exact match', async () => {
    plugin.cfg.reject.match_re = false
    plugin.cfg.list_re = /^(ylmf-pc)$/i
    const r = await callHook(plugin, 'match_re', connection, 'ylmf-pc')
    assertCont(r)
    assertResult(connection, plugin, 'fail', 'match_re')
  })

  it('DENYs on exact match when reject=true', async () => {
    plugin.cfg.reject.match_re = true
    plugin.cfg.list_re = /^(ylmf-pc)$/i
    const r = await callHook(plugin, 'match_re', connection, 'ylmf-pc')
    assertDeny(r, /That HELO not allowed here/, DENY)
  })

  it('DENYs on pattern match when reject=true', async () => {
    plugin.cfg.reject.match_re = true
    plugin.cfg.list_re = /^(ylm.*)$/i
    const r = await callHook(plugin, 'match_re', connection, 'ylmf-pc')
    assertDeny(r, /That HELO not allowed here/, DENY)
  })

  it('passes when no list_re is configured', async () => {
    plugin.cfg.list_re = undefined
    const r = await callHook(plugin, 'match_re', connection, 'whatever.example')
    assertCont(r)
    assertResult(connection, plugin, 'pass', 'match_re')
  })
})
