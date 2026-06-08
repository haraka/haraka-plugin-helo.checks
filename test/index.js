const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { afterEach, beforeEach, describe, it } = require('node:test')

const {
  callHook,
  assertCont,
  getResult,
  makePlugin,
} = require('haraka-test-fixtures')
const tlds = require('haraka-tld')

const { setup } = require('./_setup')

async function waitFor(predicate, { timeout = 12000, interval = 50 } = {}) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (predicate()) return true
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
  return predicate()
}

const FIXTURES = path.join(__dirname, 'fixtures')

function makeConfigDir(prefix) {
  fs.mkdirSync(FIXTURES, { recursive: true })
  const dir = fs.mkdtempSync(path.join(FIXTURES, prefix))
  fs.mkdirSync(path.join(dir, 'config'))
  return dir
}

const pluginAt = (configDir) =>
  makePlugin('helo.checks', { configDir, register: false })

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

describe('load_helo_allow', () => {
  let dir

  beforeEach(() => {
    dir = makeConfigDir('helo-allow-')
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  const writeAllow = (lines) =>
    fs.writeFileSync(
      path.join(dir, 'config', 'helo.checks.allow'),
      `${lines.join('\n')}\n`,
    )

  it('loads the allow list from disk on register', () => {
    writeAllow(['.example', '.test'])
    const p = pluginAt(dir)
    p.register()
    try {
      assert.deepEqual(p.allowed, ['.example', '.test'])
    } finally {
      p.config.stop_watching('helo.checks.allow')
    }
  })

  it(
    'refreshes the allow list when the file changes on disk',
    { timeout: 20000 },
    async () => {
      writeAllow(['.first'])
      const p = pluginAt(dir)
      p.load_helo_allow()
      assert.deepEqual(p.allowed, ['.first'])

      try {
        // let the freshly-attached fs.watch arm before mutating (macOS
        // FSEvents drops changes that land in the same tick as watch())
        await new Promise((resolve) => setTimeout(resolve, 300))
        writeAllow(['.second'])
        // haraka-config debounces reloads with a ~5s sedation timer
        const refreshed = await waitFor(() => p.allowed.includes('.second'))
        assert.ok(
          refreshed,
          `allow list did not refresh; got ${JSON.stringify(p.allowed)}`,
        )
        assert.deepEqual(p.allowed, ['.second'])
      } finally {
        p.config.stop_watching('helo.checks.allow')
      }
    },
  )
})

describe('load_helo_checks_ini', () => {
  let dir

  beforeEach(() => {
    dir = makeConfigDir('helo-ini-')
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  const writeIni = (dynamic) =>
    fs.writeFileSync(
      path.join(dir, 'config', 'helo.checks.ini'),
      `[check]\ndynamic=${dynamic}\n`,
    )

  it('loads cfg from disk', () => {
    writeIni(false)
    const p = pluginAt(dir)
    p.load_helo_checks_ini()
    try {
      assert.equal(p.cfg.check.dynamic, false)
    } finally {
      p.config.stop_watching('helo.checks.ini')
    }
  })

  it(
    'reloads cfg when the ini changes on disk',
    { timeout: 20000 },
    async () => {
      writeIni(false)
      const p = pluginAt(dir)
      p.load_helo_checks_ini()
      assert.equal(p.cfg.check.dynamic, false)

      try {
        await new Promise((resolve) => setTimeout(resolve, 300))
        writeIni(true)
        // haraka-config debounces reloads with a ~5s sedation timer
        const reloaded = await waitFor(() => p.cfg.check.dynamic === true)
        assert.ok(
          reloaded,
          `cfg did not reload; dynamic=${p.cfg.check.dynamic}`,
        )
      } finally {
        p.config.stop_watching('helo.checks.ini')
      }
    },
  )
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
