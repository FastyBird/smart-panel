import { readFileSync } from 'fs';
import { join } from 'path';

import { HAND_BUILT_CONSOLE_TLVS, buildDiscoveryReply } from '../../../../test/support/protect-discovery-reply';

import {
	ProtectDiscoveryReply,
	isProtectConsoleCandidate,
	parseDiscoveryReply,
	replyIdentityMac,
} from './protect-discovery-tlv';
import { ProtectDiscoveryParseFailure } from './protect-discovery.constants';

const fixture = (name: string): Buffer => readFileSync(join(__dirname, '..', '__fixtures__', name));
const MAC = Buffer.from([0xaa, 0xbb, 0xcc, 0, 0, 1]);
const UUID = '00112233-4455-6677-8899-aabbccddeeff';

const replyOf = (tlvs: ReadonlyArray<readonly [number, Buffer | string]>): ProtectDiscoveryReply => {
	const result = parseDiscoveryReply(buildDiscoveryReply({ tlvs }));

	if ('reason' in result) {
		throw new Error(`unexpected failure ${result.reason}`);
	}

	return result.reply;
};

const mulberry32 = (seed: number) => () => {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);

	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe('parseDiscoveryReply', () => {
	it('parses a hand-built v1 console reply', () =>
		expect(parseDiscoveryReply(buildDiscoveryReply({ version: 1, tlvs: HAND_BUILT_CONSOLE_TLVS }))).toEqual({
			ok: true,
			reply: {
				headerVersion: 1,
				hwaddr: 'aa:bb:cc:00:00:01',
				addresses: [{ mac: 'aa:bb:cc:00:00:01', ip: '192.168.1.10' }],
				firmware: '6.0.17',
				hostname: 'Dream-Machine-Pro',
				shortModel: 'UNVR',
				directConnectDomain: 'abc123.id.ui.direct',
				uuid: UUID,
			},
		}));

	it('parses the sanitized v1 fixture: header, length and fields', () => {
		const bytes = fixture('discovery-reply.bin');
		const result = parseDiscoveryReply(bytes);

		expect(bytes.length).toBe(4 + bytes.readUInt16BE(2));
		expect(result.ok).toBe(true);

		if (!result.ok) {
			return;
		}

		const { reply } = result;

		expect(reply.headerVersion).toBe(1);
		expect(reply.firmware).toBe('6.0.17');
		expect(reply.shortModel).toBe('UNVR');
		expect(reply.hostname).toBe('Dream-Machine-Pro');
		expect(reply.directConnectDomain).toMatch(/^[0-9a-f]+\.id\.ui\.direct$/);
		expect(reply.hwaddr).toMatch(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/);
		expect(reply.uuid).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
		expect(reply.addresses.length).toBeGreaterThanOrEqual(1);
		expect(isProtectConsoleCandidate(reply)).toBe(true);
	});

	it('parses the sanitized v0 fixture and does not treat it as a console', () => {
		const result = parseDiscoveryReply(fixture('discovery-reply-v0.bin'));

		if ('reason' in result) {
			throw new Error(`unexpected failure ${result.reason}`);
		}

		expect(result.reply.headerVersion).toBe(0);
		expect(replyIdentityMac(result.reply)).not.toBeNull();
		expect(isProtectConsoleCandidate(result.reply)).toBe(false);
	});

	it('accepts header versions 0 and 1 and rejects version 2', () => {
		expect(parseDiscoveryReply(buildDiscoveryReply({ version: 0, tlvs: [] })).ok).toBe(true);
		expect(parseDiscoveryReply(buildDiscoveryReply({ version: 1, command: 7, tlvs: [] })).ok).toBe(true);
		expect(parseDiscoveryReply(Uint8Array.of(0x02, 0x08, 0x00, 0x00))).toEqual({
			ok: false,
			reason: 'unsupported_version',
		});
	});

	it('skips unknown TLV types and keeps them out of the model', () => {
		const reply = replyOf([
			[0x0a, Buffer.from([0, 0, 0, 1])],
			[0x32, '{"a":1}'],
			[0x2f, Buffer.concat([MAC, Buffer.from([10, 0, 0, 1])])],
			[0xee, 'x'],
			[0x0c, 'UNVR'],
		]);

		expect(Object.keys(reply).sort()).toEqual(
			[
				'addresses',
				'directConnectDomain',
				'firmware',
				'headerVersion',
				'hostname',
				'hwaddr',
				'shortModel',
				'uuid',
			].sort(),
		);
		expect(reply.addresses).toEqual([]);
		expect(reply.shortModel).toBe('UNVR');
	});

	it('keeps the first value of a repeated scalar TLV and every 0x02 pair', () => {
		const reply = replyOf([
			[0x0c, 'UNVR'],
			[0x0c, 'OTHER'],
			[0x01, MAC],
			[0x01, Buffer.from([1, 2, 3, 4, 5, 6])],
			[0x02, Buffer.concat([MAC, Buffer.from([10, 0, 0, 1])])],
			[0x02, Buffer.concat([MAC, Buffer.from([10, 0, 0, 2])])],
		]);

		expect(reply.shortModel).toBe('UNVR');
		expect(reply.hwaddr).toBe('aa:bb:cc:00:00:01');
		expect(reply.addresses.map((a) => a.ip)).toEqual(['10.0.0.1', '10.0.0.2']);
	});

	it.each([0, 1, 2, 3])('rejects a %i byte datagram as truncated_header', (n) =>
		expect(parseDiscoveryReply(new Uint8Array(n))).toEqual({
			ok: false,
			reason: ProtectDiscoveryParseFailure.TRUNCATED_HEADER,
		}),
	);

	it('rejects a declared length beyond the datagram as truncated_datagram', () =>
		expect(
			parseDiscoveryReply(
				buildDiscoveryReply({
					tlvs: [
						[0x0c, 'UNVR'],
						[0x03, '6.0.17'],
					],
					declaredLength: 100,
				}),
			),
		).toEqual({ ok: false, reason: 'truncated_datagram' }));

	it('ignores bytes after the declared length', () => {
		const bytes = Buffer.concat([buildDiscoveryReply({ tlvs: [[0x0c, 'UNVR']] }), Buffer.from([0x0b, 0xff, 0xff, 1])]);
		const result = parseDiscoveryReply(bytes);

		expect(result.ok && result.reply.shortModel).toBe('UNVR');
	});

	it('rejects a TLV whose length runs past the end as truncated_tlv', () => {
		const bytes = buildDiscoveryReply({ tlvs: [[0x0c, 'UNVR']] });

		bytes.writeUInt16BE(50, 5);

		expect(parseDiscoveryReply(bytes)).toEqual({ ok: false, reason: 'truncated_tlv' });
	});

	it('rejects a TLV header cut after two bytes as truncated_tlv', () =>
		expect(parseDiscoveryReply(Uint8Array.of(1, 0, 0, 2, 0x0c, 0x00))).toEqual({
			ok: false,
			reason: 'truncated_tlv',
		}));

	it('rejects a TLV above 1024 bytes as oversized_tlv', () =>
		expect(parseDiscoveryReply(buildDiscoveryReply({ tlvs: [[0x32, Buffer.alloc(1025, 0x61)]] }))).toEqual({
			ok: false,
			reason: 'oversized_tlv',
		}));

	it('accepts a TLV of exactly 1024 bytes', () =>
		expect(parseDiscoveryReply(buildDiscoveryReply({ tlvs: [[0x32, Buffer.alloc(1024, 0x61)]] })).ok).toBe(true));

	it('rejects a datagram above 4096 bytes as oversized_datagram', () =>
		expect(parseDiscoveryReply(new Uint8Array(4097))).toEqual({ ok: false, reason: 'oversized_datagram' }));

	it.each<[string, readonly [number, Buffer | string], keyof ProtectDiscoveryReply]>([
		['0x01 with 5 bytes', [0x01, Buffer.alloc(5, 1)], 'hwaddr'],
		['0x33 that is not UUID-shaped', [0x33, 'not-a-uuid'], 'uuid'],
		['0x0b with invalid UTF-8 (0xff 0xfe)', [0x0b, Buffer.from([0xff, 0xfe])], 'hostname'],
		['0x0c containing a control character', [0x0c, 'UN\u0001VR'], 'shortModel'],
		['0x30 of 129 characters', [0x30, 'a'.repeat(129)], 'directConnectDomain'],
		['0x30 "not a host"', [0x30, 'not a host'], 'directConnectDomain'],
	])('drops %s but keeps the reply', (_name, tlv, field) => {
		const reply = replyOf([[0x03, '6.0.17'], tlv, [0x01, MAC]]);

		expect(reply[field]).toBeNull();
		expect(reply.firmware).toBe('6.0.17');
		expect(reply.hwaddr).toBe(field === 'hwaddr' ? null : 'aa:bb:cc:00:00:01');
	});

	it('returns an uppercase UUID string lowercased', () =>
		expect(replyOf([[0x33, UUID.toUpperCase()]]).uuid).toBe(UUID));

	it('skips a 0x02 TLV that is not 10 bytes', () =>
		expect(replyOf([[0x02, Buffer.alloc(9, 1)]]).addresses).toEqual([]));

	it('never throws for any prefix of either fixture', () => {
		for (const name of ['discovery-reply.bin', 'discovery-reply-v0.bin']) {
			const bytes = fixture(name);

			for (let n = 0; n <= bytes.length; n++) {
				expect(() => parseDiscoveryReply(bytes.subarray(0, n))).not.toThrow();
			}
		}
	});

	it('never throws for 500 deterministic pseudo-random buffers', () => {
		const random = mulberry32(1182);

		for (let i = 0; i < 500; i++) {
			const bytes = Buffer.alloc(Math.floor(random() * 601));

			for (let j = 0; j < bytes.length; j++) {
				bytes[j] = Math.floor(random() * 256);
			}

			if (bytes.length >= 4) {
				bytes[0] = 1;
				bytes[1] = 0;
				bytes.writeUInt16BE(Math.floor(random() * (bytes.length + 8)), 2);
			}

			expect(() => parseDiscoveryReply(bytes)).not.toThrow();
		}
	});
});

describe('console candidate helpers', () => {
	const base: ProtectDiscoveryReply = {
		headerVersion: 1,
		hwaddr: 'aa:bb:cc:00:00:01',
		addresses: [],
		firmware: null,
		hostname: null,
		shortModel: null,
		directConnectDomain: null,
		uuid: null,
	};

	it.each<[Partial<ProtectDiscoveryReply>, boolean]>([
		[{ shortModel: 'UNVR' }, true],
		[{ directConnectDomain: 'x.id.ui.direct' }, true],
		[{}, false],
		[{ shortModel: 'U6-LR', hwaddr: null, addresses: [] }, false],
	])('isProtectConsoleCandidate %j -> %s', (patch, expected) =>
		expect(isProtectConsoleCandidate({ ...base, ...patch })).toBe(expected),
	);

	it('replyIdentityMac falls back to the first 0x02 MAC', () =>
		expect(replyIdentityMac({ ...base, hwaddr: null, addresses: [{ mac: 'aa:bb:cc:00:00:09', ip: '10.0.0.1' }] })).toBe(
			'aa:bb:cc:00:00:09',
		));
});
