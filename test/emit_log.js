const assert = require('node:assert/strict')
const { beforeEach, describe, it } = require('node:test')

const { callHook, assertCont } = require('haraka-test-fixtures')

const { setup } = require('./_setup')

describe('emit_log', () => {
  let plugin, connection

  beforeEach(async () => {
    ;({ plugin, connection } = await setup())
  })

  it('writes collated results via loginfo and continues', async () => {
    let logged = false
    connection.loginfo = () => {
      logged = true
    }
    connection.results.add(plugin, { pass: 'valid_hostname' })
    const r = await callHook(plugin, 'emit_log', connection, 'host.example.com')
    assertCont(r)
    assert.ok(logged)
  })
})
