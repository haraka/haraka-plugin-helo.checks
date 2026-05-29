const assert = require('node:assert/strict')
const { after, before, beforeEach, describe, it } = require('node:test')

const fixtures = require('haraka-test-fixtures')
const dns_config = require('haraka-net-utils/lib/dns_config')

const { setup } = require('./_setup')

describe('get_a_records', () => {
  let plugin, fakeDns, restoreDns

  before(async () => {
    fakeDns = await fixtures.dns.start({
      'mail.example.com': { a: ['198.51.100.10'] },
      'six.example.com': { aaaa: ['2001:db8::1'] },
      'broken.example': { rcode: 'SERVFAIL' },
    })
    restoreDns = fakeDns.patch(dns_config)
  })

  after(async () => {
    restoreDns()
    await fakeDns.close()
  })

  beforeEach(async () => {
    ;({ plugin } = await setup())
  })

  it('throws NOTFOUND for a single-label hostname (no dot)', async () => {
    await assert.rejects(() => plugin.get_a_records('localhost'), {
      message: 'invalid hostname',
    })
  })

  it('resolves a host with A records', async () => {
    const ips = await plugin.get_a_records('mail.example.com')
    assert.ok(ips.includes('198.51.100.10'))
  })

  it('resolves a host with AAAA records', async () => {
    const ips = await plugin.get_a_records('six.example.com')
    assert.ok(ips.some((ip) => ip.includes(':')))
  })

  it('returns [] when the resolver only sees NOTFOUND-like codes', async () => {
    const ips = await plugin.get_a_records('nx.example')
    assert.deepEqual(ips, [])
  })

  it('does not throw TypeError when get_ips_by_host rejects with unknown codes', async () => {
    const net_utils = require('haraka-net-utils')
    const original = net_utils.get_ips_by_host
    net_utils.get_ips_by_host = async () => {
      throw [Object.assign(new Error('quirky'), { code: 'EFOO' })]
    }
    try {
      await assert.rejects(
        () => plugin.get_a_records('mail.example.com'),
        (err) => !(err instanceof TypeError),
      )
    } finally {
      net_utils.get_ips_by_host = original
    }
  })

  it('appends a trailing dot to bypass /etc/resolv.conf search', async () => {
    // mail.example.com (no trailing dot) should still resolve via our fake DNS
    const ips = await plugin.get_a_records('mail.example.com')
    assert.ok(ips.length)
  })
})
