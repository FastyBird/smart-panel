import { ProtectTlsMode } from '../devices-unifi-protect.constants';
import { ProtectApiError, ProtectErrorCategory } from '../errors/protect-api.error';

import {
	ProtectTlsConnectPlan,
	fingerprintsEqual,
	peerFingerprint,
	planProtectTls,
	resolveProtectServername,
} from './protect-tls-policy';

const PIN = 'ab'.repeat(32);

describe('planProtectTls', () => {
	it.each<[ProtectTlsMode, string, string | null, Partial<ProtectTlsConnectPlan>]>([
		['verify', '10.0.0.2', null, { servername: undefined, rejectUnauthorized: true, pinnedFingerprint: null }],
		['verify', '10.0.0.2', 'abc.id.ui.direct', { servername: 'abc.id.ui.direct', rejectUnauthorized: true }],
		['verify', 'unvr.local', null, { servername: 'unvr.local', rejectUnauthorized: true }],
		['verify', 'fe80::1', null, { servername: undefined, rejectUnauthorized: true }],
	])('plans %s for %s with server name %s', (mode, host, serverName, expected) => {
		expect(planProtectTls(host, { mode, serverName, fingerprintSha256: null })).toMatchObject(expected);
	});

	it('plans pinned mode with a normalized fingerprint and no chain check', () => {
		const plan = planProtectTls('10.0.0.2', {
			mode: 'pinned',
			serverName: null,
			fingerprintSha256: 'AB:'.repeat(31) + 'AB',
		});

		expect(plan).toEqual({ servername: undefined, rejectUnauthorized: false, pinnedFingerprint: PIN });
	});

	it('keeps the SNI in pinned mode when a server name is set', () => {
		expect(
			planProtectTls('10.0.0.2', { mode: 'pinned', serverName: 'abc.id.ui.direct', fingerprintSha256: PIN }),
		).toMatchObject({ servername: 'abc.id.ui.direct', rejectUnauthorized: false, pinnedFingerprint: PIN });
	});

	it.each([null, '', 'zz', 'ab'.repeat(31)])(
		'requires a valid fingerprint in pinned mode (%p)',
		(fingerprintSha256) => {
			expect.assertions(2);

			try {
				planProtectTls('10.0.0.2', { mode: 'pinned', serverName: null, fingerprintSha256 });
			} catch (error) {
				expect(error).toBeInstanceOf(ProtectApiError);
				expect((error as ProtectApiError).category).toBe(ProtectErrorCategory.VALIDATION);
			}
		},
	);

	it('never returns rejectUnauthorized=false without a pin, whatever the mode value', () => {
		for (const mode of ['verify', 'pinned', 'insecure', '', undefined, null]) {
			let plan: ReturnType<typeof planProtectTls> | null = null;

			try {
				plan = planProtectTls('10.0.0.2', { mode, serverName: null, fingerprintSha256: null } as never);
			} catch (error) {
				expect(error).toBeInstanceOf(ProtectApiError);
			}

			if (plan !== null) {
				expect(plan.rejectUnauthorized || plan.pinnedFingerprint !== null).toBe(true);
			}
		}
	});

	it('rejects the insecure mode and unknown modes as validation errors', () => {
		expect(() =>
			planProtectTls('10.0.0.2', { mode: 'insecure', serverName: null, fingerprintSha256: null } as never),
		).toThrow(ProtectApiError);
	});

	it('rejects an invalid server name', () => {
		expect(() =>
			planProtectTls('10.0.0.2', { mode: 'verify', serverName: '10.0.0.3', fingerprintSha256: null }),
		).toThrow(ProtectApiError);
		expect(() =>
			planProtectTls('10.0.0.2', { mode: 'verify', serverName: 'bad name', fingerprintSha256: null }),
		).toThrow(ProtectApiError);
	});
});

describe('resolveProtectServername', () => {
	it('prefers the server name, falls back to a DNS host and omits SNI for IPs', () => {
		expect(resolveProtectServername('10.0.0.2', 'abc.id.ui.direct')).toBe('abc.id.ui.direct');
		expect(resolveProtectServername('unvr.local', null)).toBe('unvr.local');
		expect(resolveProtectServername('10.0.0.2', null)).toBeUndefined();
		expect(resolveProtectServername('::1', null)).toBeUndefined();
	});
});

describe('fingerprints', () => {
	it('compares fingerprints regardless of case and colons', () => {
		expect(fingerprintsEqual('AB:'.repeat(31) + 'AB', 'ab'.repeat(32))).toBe(true);
	});

	it('does not match different or malformed fingerprints', () => {
		expect(fingerprintsEqual('ab'.repeat(32), 'cd'.repeat(32))).toBe(false);
		expect(fingerprintsEqual('ab'.repeat(32), 'ab'.repeat(31))).toBe(false);
		expect(fingerprintsEqual('not-a-fingerprint', 'not-a-fingerprint')).toBe(false);
		expect(fingerprintsEqual('', '')).toBe(false);
	});

	it('normalizes the peer fingerprint and returns null when absent', () => {
		expect(peerFingerprint({ fingerprint256: 'AB:'.repeat(31) + 'AB' })).toBe(PIN);
		expect(peerFingerprint({})).toBeNull();
		expect(peerFingerprint({ fingerprint256: 'garbage' })).toBeNull();
	});
});
