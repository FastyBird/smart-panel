import { describe, expect, it } from 'vitest';

import { explainProbeError } from './probe-messages';

const P = 'devicesModbusPlugin.wizard.probe.errors.';

describe('explainProbeError', () => {
	it.each<[string, number | null, string]>([
		['connection', null, 'connection'],
		['timeout', null, 'timeout'],
		['busy', null, 'busy'],
		['rate_limited', null, 'rateLimited'],
		['unavailable', null, 'unavailable'],
		['exception', 2, 'illegalAddress'],
		['exception', 1, 'illegalFunction'],
		['exception', 0x0a, 'gatewayUnreachable'],
		['exception', 0x0b, 'gatewayUnreachable'],
		['exception', 4, 'generic'],
		['exception', null, 'generic'],
		['encode', null, 'generic'],
		['whatever', null, 'generic'],
	])('maps %s / %s to %s', (kind, exceptionCode, key) => {
		expect(explainProbeError({ kind, exceptionCode })).toBe(`${P}${key}`);
	});
});
