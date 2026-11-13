import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

test('pin.env lists a version and one 64-hex checksum for each supported architecture', () => {
	const entries = new Map();

	for (const line of read('build/go2rtc/pin.env').split('\n')) {
		if (line.trim() === '' || line.startsWith('#')) {
			continue;
		}

		const separator = line.indexOf('=');

		assert.notEqual(separator, -1, `not a KEY=value line: ${line}`);
		entries.set(line.slice(0, separator), line.slice(separator + 1));
	}

	assert.deepEqual([...entries.keys()].sort(), [
		'GO2RTC_SHA256_LINUX_AMD64',
		'GO2RTC_SHA256_LINUX_ARM',
		'GO2RTC_SHA256_LINUX_ARM64',
		'GO2RTC_VERSION',
	]);
	assert.match(entries.get('GO2RTC_VERSION'), /^\d+\.\d+\.\d+$/);

	for (const key of ['GO2RTC_SHA256_LINUX_AMD64', 'GO2RTC_SHA256_LINUX_ARM64', 'GO2RTC_SHA256_LINUX_ARM']) {
		assert.match(entries.get(key), /^[0-9a-f]{64}$/, key);
	}
});
