# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/).

### Unreleased

### [1.1.3] - 2026-06-07

- fix(valid_hostname): moved tld exemption list from code to .ini file
- fix(conf): replace undocumented helo.checks.allow file with cfg.tld.skip
- fix(rdns_match): require both org domains to be truthy
- fix(big_company): anchor the suffix, prevent spoof bypass
- fix(valid_hostname): guard against empty
- fix(valid_hostname): don't short circuit tests with early exit
- refactor forward_dns as async/await

### [1.1.2] - 2026-05-29

- fix: actually migrate deprecated `mismatch` setting to `host_mismatch`
- fix: `get_a_records` initializes `ips=[]` and rethrows an Error (was bare string)
- fix: `init()` preserves the first HELO so `host_mismatch` can detect a change
- fix: anchor `valid_hostname` non-ASCII check to `^…$` (RFC 5321 §2.3.5)
- doc: README closing paren in `results.has(...)` example
- test: split monolithic test/index.js into per-check files
- test: coverage 74% → 100% line / 87% → 100% funcs
- test: refactored against test-fixtures 1.7.0 (#10)

### [1.1.1] - 2026-05-15

- deps(all): bump versions to latest
- test: updates to accompany test-fixture updates

### [1.1.0] - 2025-10-22

- valid_hostname - check helo hostname for valid ascii string (#7)
- create a valid DSN response for such an error
- deps: bump versions to latest

### [1.0.3] - 2025-02-06

- fix: results.ips wasn't being populated

### [1.0.2] - 2025-01-30

- replace .replace(//g) with a replaceAll
- prettier: move config into package.json
- dep(eslint): upgrade to v9
- dep(all): bump versions
- doc(CONTRIBUTORS): added

### [1.0.1] - 2024-11-04

- Merge pull request #2 from lnedry/master
- fix: removed redundant timer.
- chore: remove unused set of conn.notes.prev_helo

### [1.0.0] - 2024-05-08

- initial release

[1.0.0]: https://github.com/haraka/haraka-plugin-helo.checks/releases/tag/v1.0.0
[1.0.1]: https://github.com/haraka/haraka-plugin-helo.checks/releases/tag/v1.0.1
[1.0.2]: https://github.com/haraka/haraka-plugin-helo.checks/releases/tag/v1.0.2
[1.0.3]: https://github.com/haraka/haraka-plugin-helo.checks/releases/tag/v1.0.3
[1.1.0]: https://github.com/haraka/haraka-plugin-helo.checks/releases/tag/v1.1.0
[1.1.1]: https://github.com/haraka/haraka-plugin-helo.checks/releases/tag/v1.1.1
[1.1.2]: https://github.com/haraka/haraka-plugin-helo.checks/releases/tag/v1.1.2
[1.1.3]: https://github.com/haraka/haraka-plugin-helo.checks/releases/tag/v1.1.3
