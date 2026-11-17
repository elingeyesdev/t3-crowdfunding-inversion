import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const helper = new URL('../src/utils/campaignDate.ts', import.meta.url).href;

for (const [zone, samples] of [
  ['America/La_Paz', [
    ['2026-11-20T18:00', '2026-11-20T22:00:00.000Z'],
    ['2026-06-20T18:00', '2026-06-20T22:00:00.000Z'],
    ['2026-11-20T23:30', '2026-11-21T03:30:00.000Z'],
  ]],
  ['Europe/Berlin', [
    ['2026-11-20T18:00', '2026-11-20T17:00:00.000Z'],
    ['2026-06-20T18:00', '2026-06-20T16:00:00.000Z'],
    ['2026-06-20T00:30', '2026-06-19T22:30:00.000Z'],
  ]],
]) {
  test(`local input, UTC submission and editing preserve the closing time in ${zone}`, () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import { localDateTimeToUtc, toLocalDateTime, isFutureLocalDateTime } from ${JSON.stringify(helper)};
      assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, ${JSON.stringify(zone)});
      for (const [local, utc] of ${JSON.stringify(samples)}) {
        assert.equal(localDateTimeToUtc(local), utc);
        assert.equal(toLocalDateTime(utc), local);
        assert.equal(localDateTimeToUtc(toLocalDateTime(utc)), utc);
        const deadline = Date.parse(utc);
        assert.equal(isFutureLocalDateTime(local, deadline - 1), true);
        assert.equal(isFutureLocalDateTime(local, deadline), false);
        assert.equal(isFutureLocalDateTime(local, deadline + 1), false);
      }
      assert.equal(localDateTimeToUtc(''), undefined);
      assert.equal(toLocalDateTime(null), '');
      assert.equal(toLocalDateTime('invalid'), '');
      for (const invalid of ['invalid', '2026-02-30T18:00', '2026-11-20T25:00']) {
        assert.throws(() => localDateTimeToUtc(invalid));
        assert.equal(isFutureLocalDateTime(invalid), false);
      }
    `], { env: { ...process.env, TZ: zone }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });
}

test('editing preserves a repeated DST hour and seconds in an unchanged closing time', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { localDateTimeToUtc, toLocalDateTime, isFutureLocalDateTime } from ${JSON.stringify(helper)};
    const original = '2026-10-25T01:30:42.000Z';
    const local = toLocalDateTime(original);
    assert.equal(local, '2026-10-25T02:30');
    assert.equal(localDateTimeToUtc(local, original), original);
    assert.equal(isFutureLocalDateTime(local, Date.parse('2026-10-25T01:15:00Z'), original), true);
    assert.equal(isFutureLocalDateTime(local, Date.parse(original), original), false);
    assert.equal(localDateTimeToUtc('2026-10-25T03:00', original), '2026-10-25T02:00:00.000Z');
    assert.throws(() => localDateTimeToUtc('2026-03-29T02:30'));
  `], { env: { ...process.env, TZ: 'Europe/Berlin' }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
