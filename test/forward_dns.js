const { after, before, beforeEach, describe, it } = require('node:test')

const fixtures = require('haraka-test-fixtures')
const dns_config = require('haraka-net-utils/lib/dns_config')

const { callHook, assertCont, assertDeny, assertResult } = fixtures

const { setup } = require('./_setup')

describe('forward_dns', () => {
  let plugin, connection, fakeDns, restoreDns

  before(async () => {
    fakeDns = await fixtures.dns.start({
      'b.resolvers.level3.net': { a: ['4.2.2.2'] },
      'mail.example.com': { a: ['198.51.100.10'] },
      'sub.example.com': { a: ['198.51.100.10'] },
      'timeout.example': { drop: true },
      'broken.example': { rcode: 'SERVFAIL' },
    })
    restoreDns = fakeDns.patch(dns_config)
  })

  after(async () => {
    restoreDns()
    await fakeDns.close()
  })

  beforeEach(async () => {
    ;({ plugin, connection } = await setup())
    plugin.cfg.check.forward_dns = true
    plugin.cfg.check.valid_hostname = true
  })

  it('passes when helo resolves to the connecting IP', async () => {
    connection.remote.ip = '4.2.2.2'
    connection.results.add(plugin, { pass: 'valid_hostname' })
    plugin.cfg.reject.forward_dns = true
    const r = await callHook(
      plugin,
      'forward_dns',
      connection,
      'b.resolvers.level3.net',
    )
    assertCont(r)
    assertResult(connection, plugin, 'pass', 'forward_dns')
  })

  it('fails (no reject) when helo resolves but not to connecting IP', async () => {
    connection.remote.ip = '66.128.51.163'
    connection.results.add(plugin, { pass: 'valid_hostname' })
    plugin.cfg.reject.forward_dns = false
    const r = await callHook(
      plugin,
      'forward_dns',
      connection,
      'mail.example.com',
    )
    assertCont(r)
    assertResult(connection, plugin, 'fail', /forward_dns/)
  })

  it('DENYs when no forward DNS match and reject=true', async () => {
    connection.remote.ip = '66.128.51.163'
    connection.results.add(plugin, { pass: 'valid_hostname' })
    plugin.cfg.reject.forward_dns = true
    const r = await callHook(
      plugin,
      'forward_dns',
      connection,
      'mail.example.com',
    )
    assertDeny(r, /no forward DNS match/, DENY)
  })

  it('passes via org-domain fallback when rDNS shares organizational domain', async () => {
    connection.remote.ip = '66.128.51.163'
    connection.remote.host = 'sub.example.com'
    connection.results.add(plugin, { pass: 'valid_hostname' })
    connection.results.add(plugin, { pass: 'rdns_match' })
    const r = await callHook(
      plugin,
      'forward_dns',
      connection,
      'mail.example.com',
    )
    assertCont(r)
    assertResult(connection, plugin, 'pass', 'forward_dns(domain)')
  })

  it('errs and continues when valid_hostname check is disabled', async () => {
    plugin.cfg.check.valid_hostname = false
    const r = await callHook(
      plugin,
      'forward_dns',
      connection,
      'host.example.com',
    )
    assertCont(r)
    assertResult(connection, plugin, 'err', /valid_hostname disabled/)
  })

  it('skips when helo is an IP literal', async () => {
    const r = await callHook(plugin, 'forward_dns', connection, '[192.0.2.1]')
    assertCont(r)
    assertResult(connection, plugin, 'skip', 'forward_dns(literal)')
  })

  it('fails when prior valid_hostname did not pass', async () => {
    plugin.cfg.reject.forward_dns = false
    const r = await callHook(
      plugin,
      'forward_dns',
      connection,
      'host.example.com',
    )
    assertCont(r)
    assertResult(connection, plugin, 'fail', 'forward_dns(invalid_hostname)')
  })

  it('DENYs invalid hostname when reject is on', async () => {
    plugin.cfg.reject.forward_dns = true
    const r = await callHook(
      plugin,
      'forward_dns',
      connection,
      'host.example.com',
    )
    assertDeny(r, /Invalid HELO host/, DENY)
  })

  it('records fail(NOTFOUND) when DNS has no A records for hostname', async () => {
    connection.results.add(plugin, { pass: 'valid_hostname' })
    const r = await callHook(
      plugin,
      'forward_dns',
      connection,
      'nx.example.com',
    )
    assertCont(r)
    assertResult(connection, plugin, 'fail', /forward_dns\(/)
  })

  it('records fail(SERVFAIL) on DNS SERVFAIL', async () => {
    connection.results.add(plugin, { pass: 'valid_hostname' })
    const r = await callHook(
      plugin,
      'forward_dns',
      connection,
      'broken.example',
    )
    assertCont(r)
    assertResult(connection, plugin, 'fail', /forward_dns\(/)
  })

  describe('catch branches (via monkey-patched get_a_records)', () => {
    const dns = require('node:dns')
    let origGetA

    beforeEach(() => {
      origGetA = plugin.get_a_records
      connection.results.add(plugin, { pass: 'valid_hostname' })
    })

    function restore() {
      plugin.get_a_records = origGetA
    }

    it('treats NOTFOUND as fail and continues', async () => {
      plugin.get_a_records = async () => {
        throw Object.assign(new Error('nope'), { code: dns.NOTFOUND })
      }
      try {
        const r = await callHook(
          plugin,
          'forward_dns',
          connection,
          'mail.example.com',
        )
        assertCont(r)
        assertResult(connection, plugin, 'fail', /forward_dns\(/)
      } finally {
        restore()
      }
    })

    it('DENYSOFTs on TIMEOUT when reject=true', async () => {
      plugin.cfg.reject.forward_dns = true
      plugin.get_a_records = async () => {
        throw Object.assign(new Error('boom'), { code: dns.TIMEOUT })
      }
      try {
        const r = await callHook(
          plugin,
          'forward_dns',
          connection,
          'mail.example.com',
        )
        assertDeny(r, /DNS timeout/, DENYSOFT)
      } finally {
        restore()
      }
    })

    it('records err with emit_log_level=warn on unknown error codes', async () => {
      plugin.get_a_records = async () => {
        throw Object.assign(new Error('weird'), { code: 'EWEIRD' })
      }
      try {
        const r = await callHook(
          plugin,
          'forward_dns',
          connection,
          'mail.example.com',
        )
        assertCont(r)
        assertResult(connection, plugin, 'err', /forward_dns/)
      } finally {
        restore()
      }
    })

    it('records err when get_a_records resolves to a falsy value', async () => {
      plugin.get_a_records = async () => null
      try {
        const r = await callHook(
          plugin,
          'forward_dns',
          connection,
          'mail.example.com',
        )
        assertCont(r)
        assertResult(connection, plugin, 'err', /forward_dns, no ips/)
      } finally {
        restore()
      }
    })
  })
})
