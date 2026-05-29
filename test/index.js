'use strict'
const assert = require('node:assert/strict')
const path = require('node:path')
const { beforeEach, describe, it } = require('node:test')

const { makeConnection, makePlugin } = require('haraka-test-fixtures')
const tlds = require('haraka-tld')

const _set_up = async () => {
  // haraka-tld loads its public suffix list asynchronously; without this
  // get_organizational_domain() returns null and rdns_match/valid_hostname
  // checks misfire (see https://github.com/haraka/haraka-tld)
  await tlds.ready

  this.plugin = makePlugin('helo.checks', { register: false })
  this.plugin.config.root_path = path.resolve('test', 'config')

  this.connection = makeConnection({ ip: '208.75.199.19' })

  this.plugin.register()
}

describe('helo.checks', () => {
  beforeEach(_set_up)

  it('init is always run', () => {
    assert.ok(this.plugin.hooks.helo.includes('init'))
    assert.ok(this.plugin.hooks.ehlo.includes('init'))
  })

  it('hooks are registered', () => {
    const checks = [
      'init',
      'match_re',
      'bare_ip',
      'dynamic',
      'big_company',
      'valid_hostname',
      'rdns_match',
      'forward_dns',
      'host_mismatch',
      'literal_mismatch',
      'emit_log',
    ]
    assert.deepEqual(this.plugin.hooks, {
      helo: ['proto_mismatch_smtp', ...checks],
      ehlo: ['proto_mismatch_esmtp', ...checks],
    })
  })

  it('default config is loaded', () => {
    assert.deepEqual(this.plugin.cfg, {
      main: {},
      skip: { private_ip: true, whitelist: true, relaying: true },
      reject: {
        proto_mismatch: false,
        match_re: false,
        bare_ip: false,
        dynamic: false,
        big_company: false,
        valid_hostname: false,
        rdns_match: false,
        forward_dns: false,
        host_mismatch: false,
        literal_mismatch: false,
      },
      bigco: {
        'msn.com': 'msn.com',
        'hotmail.com': 'hotmail.com',
        'yahoo.com': 'yahoo.com,yahoo.co.jp',
        'yahoo.co.jp': 'yahoo.com,yahoo.co.jp',
        'yahoo.co.uk': 'yahoo.co.uk',
        'excite.com': 'excite.com,excitenetwork.com',
        'mailexcite.com': 'excite.com,excitenetwork.com',
        'aol.com': 'aol.com',
        'compuserve.com': 'compuserve.com,adelphia.net',
        'nortelnetworks.com': 'nortelnetworks.com,nortel.com',
        'earthlink.net': 'earthlink.net',
        'earthling.net': 'earthling.net',
        'google.com': 'google.com',
        'gmail.com': 'google.com,gmail.com',
      },
      check: {
        proto_mismatch: true,
        match_re: true,
        bare_ip: true,
        dynamic: true,
        big_company: true,
        valid_hostname: true,
        rdns_match: true,
        forward_dns: true,
        host_mismatch: true,
        literal_mismatch: 2,
      },
      list_re: /^()$/i,
    })
  })

  describe('host_mismatch', () => {
    beforeEach(_set_up)

    it('host_mismatch, reject=false', (t, done) => {
      this.plugin.init(() => {}, this.connection, 'helo.example.com')
      this.plugin.cfg.check.host_mismatch = true
      this.plugin.cfg.reject.host_mismatch = false
      this.plugin.host_mismatch(
        (rc) => {
          assert.equal(rc, undefined)
          assert.ok(this.connection.results.get('helo.checks').fail.length)
          done()
        },
        this.connection,
        'anything',
      )
    })

    it('host_mismatch, reject=true', (t, done) => {
      this.plugin.init(() => {}, this.connection, 'helo.example.com')
      this.plugin.cfg.check.host_mismatch = true
      this.plugin.cfg.reject.host_mismatch = true
      this.plugin.host_mismatch(
        (rc) => {
          assert.equal(rc, DENY)
          assert.ok(this.connection.results.get('helo.checks').fail.length)
          done()
        },
        this.connection,
        'anything',
      )
    })
  })

  describe('proto_mismatch', () => {
    beforeEach(_set_up)

    it('proto_mismatch, reject=false, esmtp=false', (t, done) => {
      this.plugin.init(() => {}, this.connection, 'helo.example.com')
      this.connection.esmtp = false
      this.plugin.cfg.check.proto_mismatch = true
      this.plugin.cfg.reject.proto_mismatch = false
      this.plugin.proto_mismatch(
        (rc) => {
          assert.equal(rc, undefined)
          assert.ok(this.connection.results.get('helo.checks').fail.length)
          done()
        },
        this.connection,
        'anything',
        'esmtp',
      )
    })

    it('proto_mismatch, reject=false, esmtp=true', (t, done) => {
      this.plugin.init(() => {}, this.connection, 'helo.example.com')
      this.connection.esmtp = true
      this.plugin.cfg.check.proto_mismatch = true
      this.plugin.cfg.reject.proto_mismatch = false
      this.plugin.proto_mismatch(
        (rc) => {
          assert.equal(rc, undefined)
          assert.ok(
            this.connection.results.get('helo.checks').fail.length === 0,
          )
          done()
        },
        this.connection,
        'anything',
        'esmtp',
      )
    })

    it('proto_mismatch, reject=true', (t, done) => {
      this.plugin.init(() => {}, this.connection, 'helo.example.com')
      this.connection.esmtp = false
      this.plugin.cfg.check.proto_mismatch = true
      this.plugin.cfg.reject.proto_mismatch = true
      this.plugin.proto_mismatch(
        (rc) => {
          assert.equal(rc, DENY)
          assert.ok(this.connection.results.get('helo.checks').fail.length)
          done()
        },
        this.connection,
        'anything',
        'esmtp',
      )
    })
  })

  describe('rdns_match', () => {
    beforeEach(_set_up)

    it('pass', (t, done) => {
      this.connection.remote.host = 'helo.example.com'
      this.plugin.cfg.check.rdns_match = true
      this.plugin.cfg.reject.rdns_match = true
      this.plugin.rdns_match(
        (rc) => {
          assert.equal(rc, undefined)
          assert.ok(this.connection.results.get('helo.checks').pass.length)
          done()
        },
        this.connection,
        'helo.example.com',
      )
    })

    it('pass (org dom match)', (t, done) => {
      this.connection.remote.host = 'ehlo.example.com'
      this.plugin.cfg.check.rdns_match = true
      this.plugin.cfg.reject.rdns_match = false
      this.plugin.rdns_match(
        (rc) => {
          assert.equal(rc, undefined)
          assert.ok(this.connection.results.get('helo.checks').pass.length)
          done()
        },
        this.connection,
        'helo.example.com',
      )
    })

    it('fail', (t, done) => {
      this.connection.remote.host = 'ehlo.gmail.com'
      this.plugin.cfg.check.rdns_match = true
      this.plugin.cfg.reject.rdns_match = false
      this.plugin.rdns_match(
        (rc) => {
          assert.equal(rc, undefined)
          assert.ok(this.connection.results.get('helo.checks').fail.length)
          done()
        },
        this.connection,
        'helo.example.com',
      )
    })

    it('fail, reject', (t, done) => {
      this.connection.remote.host = 'ehlo.gmail.com'
      this.plugin.cfg.check.rdns_match = true
      this.plugin.cfg.reject.rdns_match = true
      this.plugin.rdns_match(
        (rc) => {
          assert.equal(rc, DENY)
          assert.ok(this.connection.results.get('helo.checks').fail.length)
          done()
        },
        this.connection,
        'helo.example.com',
      )
    })
  })

  describe('bare_ip', () => {
    beforeEach(_set_up)

    it('pass', (t, done) => {
      this.plugin.cfg.check.bare_ip = true
      this.plugin.cfg.reject.bare_ip = true
      this.plugin.bare_ip(
        (rc) => {
          assert.equal(rc, undefined)
          assert.ok(this.connection.results.get('helo.checks').pass.length)
          done()
        },
        this.connection,
        '[192.168.1.2]',
      )
    })
    it('fail', (t, done) => {
      this.plugin.cfg.check.bare_ip = true
      this.plugin.cfg.reject.bare_ip = false
      this.plugin.bare_ip(
        (rc) => {
          assert.equal(rc, undefined)
          assert.ok(this.connection.results.get('helo.checks').fail.length)
          done()
        },
        this.connection,
        '192.168.1.1',
      )
    })
    it('fail, reject', (t, done) => {
      this.plugin.cfg.check.bare_ip = true
      this.plugin.cfg.reject.bare_ip = true
      this.plugin.bare_ip(
        (rc) => {
          assert.equal(rc, DENY)
          assert.ok(this.connection.results.get('helo.checks').fail.length)
          done()
        },
        this.connection,
        '192.168.1.1',
      )
    })
  })

  describe('dynamic', () => {
    beforeEach(_set_up)

    it('pass', (t, done) => {
      const test_helo = 'matt.simerson.tld'
      this.connection.remote.ip = '208.75.177.99'
      this.plugin.cfg.check.dynamic = true
      this.plugin.cfg.reject.dynamic = true
      this.plugin.dynamic(
        (rc) => {
          assert.equal(rc, undefined)
          assert.ok(this.connection.results.get('helo.checks').pass.length)
          done()
        },
        this.connection,
        test_helo,
      )
    })

    it('fail', (t, done) => {
      const test_helo = 'c-76-121-96-159.hsd1.wa.comcast.net'
      this.connection.remote.ip = '76.121.96.159'
      this.plugin.cfg.check.dynamic = true
      this.plugin.cfg.reject.dynamic = false
      this.plugin.dynamic(
        (rc) => {
          assert.equal(rc, undefined)
          assert.ok(this.connection.results.get('helo.checks').fail.length)
          done()
        },
        this.connection,
        test_helo,
      )
    })

    it('fail, reject', (t, done) => {
      const test_helo = 'c-76-121-96-159.hsd1.wa.comcast.net'
      this.connection.remote.ip = '76.121.96.159'
      this.plugin.cfg.check.dynamic = true
      this.plugin.cfg.reject.dynamic = true
      this.plugin.dynamic(
        (rc) => {
          assert.equal(rc, DENY)
          assert.ok(this.connection.results.get('helo.checks').fail.length)
          done()
        },
        this.connection,
        test_helo,
      )
    })
  })

  describe('big_company', () => {
    beforeEach(_set_up)

    it('pass, reject=false', (t, done) => {
      const test_helo = 'yahoo.co.jp'
      this.connection.remote.host = 'yahoo.co.jp'
      this.plugin.cfg.check.big_company = true
      this.plugin.cfg.reject.big_company = true
      this.plugin.big_company(
        (rc) => {
          assert.equal(rc, undefined)
          assert.ok(this.connection.results.get('helo.checks').pass.length)
          done()
        },
        this.connection,
        test_helo,
      )
    })

    it('fail, reject=false', (t, done) => {
      const test_helo = 'yahoo.com'
      this.connection.remote.host = 'anything-else.com'
      this.connection.remote.is_private = false
      this.plugin.cfg.check.big_company = true
      this.plugin.cfg.reject.big_company = false
      this.plugin.big_company(
        (rc) => {
          assert.equal(rc, undefined)
          assert.ok(this.connection.results.get('helo.checks').fail.length)
          done()
        },
        this.connection,
        test_helo,
      )
    })

    it('fail, reject=true', (t, done) => {
      const test_helo = 'yahoo.com'
      this.connection.remote.host = 'anything-else.com'
      this.plugin.cfg.check.big_company = true
      this.plugin.cfg.reject.big_company = true
      this.plugin.big_company(
        (rc) => {
          assert.equal(rc, DENY)
          assert.equal(
            this.connection.results.get('helo.checks').fail.length,
            1,
          )
          this.plugin.big_company(
            (rc) => {
              assert.equal(rc, DENY)
              assert.ok(
                this.connection.results.get('helo.checks').fail.length,
                2,
              )
              done()
            },
            this.connection,
            test_helo,
          )
        },
        this.connection,
        test_helo,
      )
    })
  })

  describe('literal_mismatch', () => {
    beforeEach(_set_up)

    it('pass', (t, done) => {
      const test_helo = '[10.0.1.1]'
      this.connection.remote.ip = '10.0.1.1'
      this.connection.remote.is_private = true
      this.plugin.cfg.check.literal_mismatch = 1
      this.plugin.cfg.reject.literal_mismatch = true
      this.plugin.literal_mismatch(
        (rc) => {
          assert.equal(rc, undefined)
          assert.ok(this.connection.results.get('helo.checks').skip.length)
          done()
        },
        this.connection,
        test_helo,
      )
    })

    it('pass, network', (t, done) => {
      const test_helo = '[10.0.1.1]'
      this.connection.remote.ip = '10.0.1.2'
      this.connection.remote.is_private = true
      this.plugin.cfg.check.literal_mismatch = 2
      this.plugin.cfg.reject.literal_mismatch = true
      this.plugin.literal_mismatch(
        (rc) => {
          assert.equal(rc, undefined)
          assert.ok(this.connection.results.get('helo.checks').skip.length)
          done()
        },
        this.connection,
        test_helo,
      )
    })

    it('fail, reject=false', (t, done) => {
      const test_helo = '[10.0.1.1]'
      this.connection.remote.ip = '10.0.1.2'
      this.connection.remote.is_private = true
      this.plugin.cfg.check.literal_mismatch = 0
      this.plugin.cfg.reject.literal_mismatch = false
      this.plugin.literal_mismatch(
        (rc) => {
          assert.equal(rc, undefined)
          assert.ok(this.connection.results.get('helo.checks').skip.length)
          done()
        },
        this.connection,
        test_helo,
      )
    })

    it('fail, reject=true', (t, done) => {
      const test_helo = '[10.0.1.1]'
      this.connection.remote.ip = '10.0.1.2'
      this.connection.remote.is_private = true
      this.plugin.cfg.check.literal_mismatch = 0
      this.plugin.cfg.reject.literal_mismatch = true
      this.plugin.literal_mismatch(
        (rc) => {
          assert.equal(rc, undefined)
          assert.ok(this.connection.results.get('helo.checks').skip.length)
          done()
        },
        this.connection,
        test_helo,
      )
    })
  })

  describe('valid_hostname', () => {
    beforeEach(_set_up)

    it('pass', (t, done) => {
      const test_helo = 'great.domain.com'
      this.plugin.cfg.check.valid_hostname = true
      this.plugin.cfg.reject.valid_hostname = true
      this.plugin.valid_hostname(
        (rc) => {
          assert.equal(rc, undefined)
          assert.ok(this.connection.results.get('helo.checks').pass.length)
          done()
        },
        this.connection,
        test_helo,
      )
    })

    it('fail, reject=false', (t, done) => {
      const test_helo = 'great.domain.non-existent-tld'
      this.plugin.cfg.check.valid_hostname = true
      this.plugin.cfg.reject.valid_hostname = false
      this.plugin.valid_hostname(
        (rc) => {
          assert.equal(rc, undefined)
          assert.ok(this.connection.results.get('helo.checks').fail.length)
          done()
        },
        this.connection,
        test_helo,
      )
    })

    it('fail, reject=true', (t, done) => {
      const test_helo = 'great.domain.non-existent-tld'
      this.plugin.cfg.check.valid_hostname = true
      this.plugin.cfg.reject.valid_hostname = true
      this.plugin.valid_hostname(
        (rc) => {
          assert.equal(rc, DENY)
          assert.ok(this.connection.results.get('helo.checks').fail.length)
          done()
        },
        this.connection,
        test_helo,
      )
    })
  })

  describe('forward_dns', () => {
    beforeEach(_set_up)

    it('pass', (t, done) => {
      const test_helo = 'b.resolvers.level3.net'
      this.connection.remote.ip = '4.2.2.2'
      this.plugin.cfg.check.forward_dns = true
      this.plugin.cfg.reject.forward_dns = true
      this.connection.results.add(this.plugin, { pass: 'valid_hostname' })
      this.plugin.forward_dns(
        (rc) => {
          assert.equal(rc, undefined)
          assert.ok(this.connection.results.get('helo.checks').pass.length)
          done()
        },
        this.connection,
        test_helo,
      )
    })

    it('fail, reject=false', (t, done) => {
      const test_helo = 'www.google.com'
      this.connection.remote.ip = '66.128.51.163'
      this.plugin.cfg.check.forward_dns = true
      this.plugin.cfg.reject.forward_dns = false
      this.plugin.forward_dns(
        (rc) => {
          assert.equal(rc, undefined)
          assert.ok(this.connection.results.get('helo.checks').fail.length)
          done()
        },
        this.connection,
        test_helo,
      )
    })

    it('fail, reject=true', (t, done) => {
      const test_helo = 'www.google.com'
      this.connection.remote.ip = '66.128.51.163'
      this.plugin.cfg.check.forward_dns = true
      this.plugin.cfg.reject.forward_dns = true
      this.plugin.forward_dns(
        (rc) => {
          assert.equal(rc, DENY)
          assert.ok(this.connection.results.get('helo.checks').fail.length)
          done()
        },
        this.connection,
        test_helo,
      )
    })
  })

  describe('match_re', () => {
    beforeEach(_set_up)

    it('miss', (t, done) => {
      const test_helo = 'not_in_re_list.net'
      this.plugin.cfg.list_re = new RegExp(`^(${['bad.tld'].join('|')})$`, 'i')
      this.plugin.match_re(
        (rc, msg) => {
          assert.equal(undefined, rc)
          assert.equal(undefined, msg)
          assert.ok(this.connection.results.get('helo.checks').pass.length)
          done()
        },
        this.connection,
        test_helo,
      )
    })

    it('hit, reject=no', (t, done) => {
      const test_helo = 'ylmf-pc'
      this.plugin.cfg.reject.match_re = false
      this.plugin.cfg.list_re = new RegExp(`^(${['ylmf-pc'].join('|')})$`, 'i')
      this.plugin.match_re(
        (rc, msg) => {
          assert.equal(undefined, rc)
          assert.equal(undefined, msg)
          assert.ok(this.connection.results.get('helo.checks').fail.length)
          done()
        },
        this.connection,
        test_helo,
      )
    })

    it('hit, reject=yes, exact', (t, done) => {
      const test_helo = 'ylmf-pc'
      this.plugin.cfg.reject.match_re = true
      this.plugin.cfg.list_re = new RegExp(`^(${['ylmf-pc'].join('|')})$`, 'i')
      this.plugin.match_re(
        (rc, msg) => {
          assert.equal(DENY, rc)
          assert.equal('That HELO not allowed here', msg)
          assert.ok(this.connection.results.get('helo.checks').fail.length)
          done()
        },
        this.connection,
        test_helo,
      )
    })

    it('hit, reject=yes, pattern', (t, done) => {
      const test_helo = 'ylmf-pc'
      this.plugin.cfg.reject.match_re = true
      this.plugin.cfg.list_re = new RegExp(`^(${['ylm.*'].join('|')})$`, 'i')
      this.plugin.match_re(
        (rc, msg) => {
          assert.equal(DENY, rc)
          assert.equal('That HELO not allowed here', msg)
          assert.ok(this.connection.results.get('helo.checks').fail.length)
          done()
        },
        this.connection,
        test_helo,
      )
    })
  })

  describe('init', () => {
    beforeEach(_set_up)

    it('does not re-add helo_host when already recorded', (t, done) => {
      this.connection.results.add(this.plugin, { helo_host: 'a.example.com' })
      this.plugin.init(
        () => {
          const r = this.connection.results.get('helo.checks')
          assert.equal(r.helo_host, 'a.example.com')
          done()
        },
        this.connection,
        'a.example.com',
      )
    })
  })

  describe('deprecated check.mismatch migration', () => {
    beforeEach(_set_up)

    it('migrates check.mismatch -> check.host_mismatch', () => {
      const logged = []
      this.plugin.logerror = (msg) => logged.push(msg)
      this.plugin.config.get = () => ({
        check: { mismatch: true },
        reject: {},
        skip: {},
        bigco: {},
      })
      this.plugin.load_helo_checks_ini()
      assert.equal(this.plugin.cfg.check.host_mismatch, true)
      assert.ok(logged.some((m) => /deprecated/.test(m)))
    })
  })

  describe('get_a_records error handling', () => {
    beforeEach(_set_up)

    it('does not throw TypeError when get_ips_by_host rejects with unknown codes', async () => {
      const net_utils = require('haraka-net-utils')
      const original = net_utils.get_ips_by_host
      net_utils.get_ips_by_host = async () => {
        throw [Object.assign(new Error('quirky'), { code: 'EFOO' })]
      }
      try {
        await assert.rejects(
          () => this.plugin.get_a_records('mail.example.com'),
          (err) => !(err instanceof TypeError),
        )
      } finally {
        net_utils.get_ips_by_host = original
      }
    })
  })

  describe('load_helo_checks_ini back-compat', () => {
    beforeEach(_set_up)

    const inject = (cfg) => {
      this.plugin.config.get = () => cfg
      this.plugin.load_helo_checks_ini()
    }

    it('check_no_dot -> check.valid_hostname', () => {
      inject({
        check: {},
        reject: {},
        skip: {},
        bigco: {},
        check_no_dot: true,
      })
      assert.equal(this.plugin.cfg.check.valid_hostname, true)
    })

    it('check_dynamic -> check.dynamic', () => {
      inject({
        check: {},
        reject: {},
        skip: {},
        bigco: {},
        check_dynamic: true,
      })
      assert.equal(this.plugin.cfg.check.dynamic, true)
    })

    it('check_raw_ip -> check.bare_ip', () => {
      inject({
        check: {},
        reject: {},
        skip: {},
        bigco: {},
        check_raw_ip: true,
      })
      assert.equal(this.plugin.cfg.check.bare_ip, true)
    })

    it('reject.mismatch -> reject.host_mismatch', () => {
      const logged = []
      this.plugin.logerror = (msg) => logged.push(msg)
      inject({
        check: {},
        reject: { mismatch: true },
        skip: {},
        bigco: {},
      })
      assert.equal(this.plugin.cfg.reject.host_mismatch, true)
      assert.ok(logged.some((m) => /deprecated/.test(m)))
    })

    it('defaults literal_mismatch to 2 when missing', () => {
      inject({ check: {}, reject: {}, skip: {}, bigco: {} })
      assert.equal(this.plugin.cfg.check.literal_mismatch, 2)
    })
  })

  describe('emit_log', () => {
    beforeEach(_set_up)

    it('writes collated results via loginfo and calls next', (t, done) => {
      let logged = false
      this.connection.loginfo = () => {
        logged = true
      }
      this.connection.results.add(this.plugin, { pass: 'valid_hostname' })
      this.plugin.emit_log(
        () => {
          assert.ok(logged)
          done()
        },
        this.connection,
        'host.example.com',
      )
    })
  })

  describe('get_a_records', () => {
    beforeEach(_set_up)

    it('throws NOTFOUND for a single-label hostname', async () => {
      await assert.rejects(() => this.plugin.get_a_records('localhost'), {
        message: 'invalid hostname',
      })
    })
  })

  describe('proto_mismatch_smtp / esmtp', () => {
    beforeEach(_set_up)

    it('proto_mismatch_smtp forwards proto=smtp', (t, done) => {
      this.plugin.init(() => {}, this.connection, 'helo.example.com')
      this.connection.esmtp = true // smtp arg + esmtp=true -> mismatch
      this.plugin.cfg.check.proto_mismatch = true
      this.plugin.cfg.reject.proto_mismatch = false
      this.plugin.proto_mismatch_smtp(
        (rc) => {
          assert.equal(rc, undefined)
          assert.ok(this.connection.results.get('helo.checks').fail.length)
          done()
        },
        this.connection,
        'host',
      )
    })

    it('proto_mismatch_esmtp forwards proto=esmtp', (t, done) => {
      this.plugin.init(() => {}, this.connection, 'helo.example.com')
      this.connection.esmtp = false // esmtp arg + esmtp=false -> mismatch
      this.plugin.cfg.check.proto_mismatch = true
      this.plugin.cfg.reject.proto_mismatch = false
      this.plugin.proto_mismatch_esmtp(
        (rc) => {
          assert.equal(rc, undefined)
          assert.ok(this.connection.results.get('helo.checks').fail.length)
          done()
        },
        this.connection,
        'host',
      )
    })
  })

  describe('forward_dns short-circuit paths', () => {
    beforeEach(_set_up)

    it('errs and continues when valid_hostname is disabled', (t, done) => {
      this.plugin.cfg.check.forward_dns = true
      this.plugin.cfg.check.valid_hostname = false
      this.plugin.forward_dns(
        (rc) => {
          assert.equal(rc, undefined)
          assert.ok(this.connection.results.get('helo.checks').err.length)
          done()
        },
        this.connection,
        'host.example.com',
      )
    })

    it('skips when helo is an IP literal', (t, done) => {
      this.plugin.cfg.check.forward_dns = true
      this.plugin.cfg.check.valid_hostname = true
      this.plugin.forward_dns(
        (rc) => {
          assert.equal(rc, undefined)
          assert.ok(this.connection.results.get('helo.checks').skip.length)
          done()
        },
        this.connection,
        '[192.0.2.1]',
      )
    })

    it('DENYs invalid hostname when reject is on', (t, done) => {
      this.plugin.cfg.check.forward_dns = true
      this.plugin.cfg.check.valid_hostname = true
      this.plugin.cfg.reject.forward_dns = true
      // no prior `pass: valid_hostname` result, so the host is "invalid"
      this.plugin.forward_dns(
        (rc) => {
          assert.equal(rc, DENY)
          assert.ok(this.connection.results.get('helo.checks').fail.length)
          done()
        },
        this.connection,
        'host.example.com',
      )
    })
  })
})
