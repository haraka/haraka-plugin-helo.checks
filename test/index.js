const assert = require('node:assert/strict')
const path = require('node:path')
const { beforeEach, describe, it } = require('node:test')

const {
  callHook,
  assertCont,
  getResult,
  makePlugin,
} = require('haraka-test-fixtures')
const tlds = require('haraka-tld')

const { setup } = require('./_setup')

describe('register', () => {
  let plugin

  beforeEach(async () => {
    ;({ plugin } = await setup())
  })

  it('init runs on both helo and ehlo', () => {
    assert.ok(plugin.hooks.helo.includes('init'))
    assert.ok(plugin.hooks.ehlo.includes('init'))
  })

  it('registers all expected checks on helo + ehlo', () => {
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
    assert.deepEqual(plugin.hooks, {
      helo: ['proto_mismatch_smtp', ...checks],
      ehlo: ['proto_mismatch_esmtp', ...checks],
    })
  })

  it('skips proto_mismatch hooks when check.proto_mismatch=false', async () => {
    await tlds.ready
    const p = makePlugin('helo.checks', { register: false })
    p.config.root_path = path.resolve('test', 'config')
    const realGet = p.config.get.bind(p.config)
    p.config.get = (name, opts, cb) => {
      const cfg = realGet(name, opts, cb)
      if (name === 'helo.checks.ini') cfg.check.proto_mismatch = false
      return cfg
    }
    p.register()
    assert.ok(!p.hooks.helo.includes('proto_mismatch_smtp'))
    assert.ok(!p.hooks.ehlo.includes('proto_mismatch_esmtp'))
  })
})

describe('default config', () => {
  let plugin

  beforeEach(async () => {
    ;({ plugin } = await setup())
  })

  it('is loaded after register', () => {
    assert.deepEqual(plugin.cfg, {
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
})

describe('deprecated key migration', () => {
  let plugin

  beforeEach(async () => {
    ;({ plugin } = await setup())
  })

  const inject = (p, cfg) => {
    p.config.get = () => cfg
    p.load_helo_checks_ini()
  }

  it('check.mismatch -> check.host_mismatch (with deprecation log)', () => {
    const logged = []
    plugin.logerror = (msg) => logged.push(msg)
    inject(plugin, {
      check: { mismatch: true },
      reject: {},
      skip: {},
      bigco: {},
    })
    assert.equal(plugin.cfg.check.host_mismatch, true)
    assert.ok(logged.some((m) => /deprecated/.test(m)))
  })

  it('reject.mismatch -> reject.host_mismatch (with deprecation log)', () => {
    const logged = []
    plugin.logerror = (msg) => logged.push(msg)
    inject(plugin, {
      check: {},
      reject: { mismatch: true },
      skip: {},
      bigco: {},
    })
    assert.equal(plugin.cfg.reject.host_mismatch, true)
    assert.ok(logged.some((m) => /deprecated/.test(m)))
  })

  it('check_no_dot -> check.valid_hostname', () => {
    inject(plugin, {
      check: {},
      reject: {},
      skip: {},
      bigco: {},
      check_no_dot: true,
    })
    assert.equal(plugin.cfg.check.valid_hostname, true)
  })

  it('check_dynamic -> check.dynamic', () => {
    inject(plugin, {
      check: {},
      reject: {},
      skip: {},
      bigco: {},
      check_dynamic: true,
    })
    assert.equal(plugin.cfg.check.dynamic, true)
  })

  it('check_raw_ip -> check.bare_ip', () => {
    inject(plugin, {
      check: {},
      reject: {},
      skip: {},
      bigco: {},
      check_raw_ip: true,
    })
    assert.equal(plugin.cfg.check.bare_ip, true)
  })

  it('defaults literal_mismatch to 2 when missing', () => {
    inject(plugin, { check: {}, reject: {}, skip: {}, bigco: {} })
    assert.equal(plugin.cfg.check.literal_mismatch, 2)
  })

  it('preserves an explicit literal_mismatch=0', () => {
    inject(plugin, {
      check: { literal_mismatch: 0 },
      reject: {},
      skip: {},
      bigco: {},
    })
    assert.equal(plugin.cfg.check.literal_mismatch, 0)
  })

  it('re-loads cfg when the registered watch callback fires', () => {
    let captured
    plugin.config.get = (name, opts, cb) => {
      captured = cb
      return { check: { dynamic: false }, reject: {}, skip: {}, bigco: {} }
    }
    plugin.load_helo_checks_ini()
    assert.equal(plugin.cfg.check.dynamic, false)

    plugin.config.get = (name, opts, cb) => {
      captured = cb
      return { check: { dynamic: true }, reject: {}, skip: {}, bigco: {} }
    }
    captured()
    assert.equal(plugin.cfg.check.dynamic, true)
  })
})

describe('init', () => {
  let plugin, connection

  beforeEach(async () => {
    ;({ plugin, connection } = await setup())
  })

  it('records helo_host on first invocation', async () => {
    const r = await callHook(plugin, 'init', connection, 'a.example.com')
    assertCont(r)
    assert.equal(getResult(connection, plugin).helo_host, 'a.example.com')
  })

  it('does not re-add helo_host when already recorded', async () => {
    connection.results.add(plugin, { helo_host: 'a.example.com' })
    await callHook(plugin, 'init', connection, 'a.example.com')
    assert.equal(getResult(connection, plugin).helo_host, 'a.example.com')
  })

  it('preserves the first helo when a different second helo arrives', async () => {
    await callHook(plugin, 'init', connection, 'first.example.com')
    await callHook(plugin, 'init', connection, 'second.example.com')
    assert.equal(getResult(connection, plugin).helo_host, 'first.example.com')
  })
})
