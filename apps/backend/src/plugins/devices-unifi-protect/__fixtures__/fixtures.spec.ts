import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIRECTORY = __dirname;

const CAPTURED_JSON = [
	'meta-info.json',
	'nvrs.json',
	'cameras.json',
	'liveviews.json',
	'rtsps-stream.json',
	'snapshot-hq-unsupported.json',
	'rate-limit-headers.json',
	'system.json',
];
const CAPTURED_BINARY = ['discovery-reply.bin', 'discovery-reply-v0.bin'];
const SYNTHETIC_JSON = [
	'cameras-doorbell.json',
	'rtsps-stream-post.json',
	'sensors.json',
	'lights.json',
	'chimes.json',
];
const SYNTHETIC_JSONL = ['ws-devices.jsonl', 'ws-events.jsonl'];
const SYNTHETIC_OTHER = ['snapshot.jpg'];
const NOT_FIXTURES = ['README.md', 'fixtures.spec.ts'];

const REDACTED_DOMAIN = '0cea14000000000000000000000000000000.id.ui.direct';
const FAKE_MAC_PREFIX = '0CEA1400';

const PRIVATE_IPV4 =
	/\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/;
const ANY_IPV4 = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
const DIRECT_DOMAIN = /[0-9a-z]+\.id\.ui\.direct/gi;
const RTSPS_URL = /rtsps:\/\/[^\s"'<>]+/g;
// A 12 hex digit run that is not the tail of a UUID or part of a longer token.
const MAC_PLAIN = /(?<![0-9a-z:-])[0-9a-f]{12}(?![0-9a-z:-])/gi;
const MAC_SEPARATED = /(?<![0-9a-z:-])(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}(?![0-9a-z:-])/gi;

const read = (name: string): string => readFileSync(join(DIRECTORY, name), 'latin1');

const readJsonLines = (name: string): unknown[] =>
	read(name)
		.split('\n')
		.filter((line) => line.length > 0)
		.map((line) => JSON.parse(line) as unknown);

const topLevelObjects = (value: unknown): unknown[] => (Array.isArray(value) ? value : [value]);

const isSynthetic = (value: unknown): boolean =>
	typeof value === 'object' && value !== null && (value as { _synthetic?: unknown })._synthetic === true;

describe('UniFi Protect fixtures', () => {
	it('classifies every file in the directory and documents it in the README', () => {
		const known = [
			...CAPTURED_JSON,
			...CAPTURED_BINARY,
			...SYNTHETIC_JSON,
			...SYNTHETIC_JSONL,
			...SYNTHETIC_OTHER,
			...NOT_FIXTURES,
		].sort();

		expect(readdirSync(DIRECTORY).sort()).toEqual(known);

		const readme = read('README.md');

		for (const name of known.filter((file) => !NOT_FIXTURES.includes(file))) {
			expect(readme).toContain(`\`${name}\``);
		}
	});

	describe.each([...CAPTURED_JSON, ...SYNTHETIC_JSON])('%s', (name) => {
		it('parses as JSON', () => {
			expect(() => {
				JSON.parse(read(name));
			}).not.toThrow();
		});
	});

	describe.each(SYNTHETIC_JSONL)('%s', (name) => {
		it('has one JSON object per line with a frame type and item', () => {
			const frames = readJsonLines(name) as { type: string; item: { id: string; modelKey: string } }[];

			expect(frames.length).toBeGreaterThan(0);

			for (const frame of frames) {
				expect(['add', 'update', 'remove']).toContain(frame.type);
				expect(typeof frame.item.id).toBe('string');
				expect(typeof frame.item.modelKey).toBe('string');
			}
		});
	});

	describe('synthetic marker', () => {
		it.each(SYNTHETIC_JSON)('%s: every top-level object carries _synthetic: true', (name) => {
			const objects = topLevelObjects(JSON.parse(read(name)));

			expect(objects.length).toBeGreaterThan(0);
			expect(objects.every(isSynthetic)).toBe(true);
		});

		it.each(SYNTHETIC_JSONL)('%s: every line carries _synthetic: true', (name) => {
			expect(readJsonLines(name).every(isSynthetic)).toBe(true);
		});

		it.each(CAPTURED_JSON)('%s: captured files are not marked synthetic', (name) => {
			expect(read(name)).not.toContain('_synthetic');
		});

		it('covers the event and sensor scenarios the later tasks rely on', () => {
			const events = readJsonLines('ws-events.jsonl') as { item: { type?: string; smartDetectTypes?: string[] } }[];
			const types = new Set(events.map((frame) => frame.item.type).filter(Boolean));

			for (const type of [
				'motion',
				'smartDetectZone',
				'smartAudioDetect',
				'ring',
				'sensorOpened',
				'sensorClosed',
				'sensorMotion',
				'sensorWaterLeak',
				'sensorTamper',
			]) {
				expect(types).toContain(type);
			}

			const detected = new Set(events.flatMap((frame) => frame.item.smartDetectTypes ?? []));

			for (const detection of ['person', 'vehicle', 'alrmSmoke', 'alrmBabyCry']) {
				expect(detected).toContain(detection);
			}

			const doorbells = JSON.parse(read('cameras-doorbell.json')) as {
				hasPackageCamera: boolean;
				featureFlags: { hasLcdScreen: boolean };
			}[];

			expect(doorbells.every((doorbell) => doorbell.featureFlags.hasLcdScreen)).toBe(true);
			expect(doorbells.some((doorbell) => doorbell.hasPackageCamera)).toBe(true);
		});
	});

	describe.each([...CAPTURED_JSON, ...CAPTURED_BINARY, ...SYNTHETIC_JSON, ...SYNTHETIC_JSONL])(
		'%s sanitization',
		(name) => {
			const text = (): string => read(name);

			it('contains no private IPv4 address', () => {
				expect(PRIVATE_IPV4.test(text())).toBe(false);
			});

			it('contains only documentation IPv4 addresses (192.0.2.0/24)', () => {
				for (const address of text().match(ANY_IPV4) ?? []) {
					expect(address).toMatch(/^192\.0\.2\.\d{1,3}$/);
				}
			});

			it('contains no direct-connect domain other than the redacted placeholder', () => {
				for (const domain of text().match(DIRECT_DOMAIN) ?? []) {
					// The binary discovery reply has the one-byte TLV length (49 = '1') in front of the domain.
					expect(domain.toLowerCase().endsWith(REDACTED_DOMAIN)).toBe(true);
					expect(domain.length - REDACTED_DOMAIN.length).toBeLessThanOrEqual(1);
				}
			});

			it('contains no RTSPS URL with a real alias', () => {
				for (const url of text().match(RTSPS_URL) ?? []) {
					expect(url).toMatch(/^rtsps:\/\/192\.0\.2\.\d{1,3}:7441\/REDACTEDALIAS[A-Za-z0-9]*(\?enableSrtp)?$/);
				}
			});

			it('contains no MAC address other than the fake 0CEA1400 pattern', () => {
				const macs = [...(text().match(MAC_PLAIN) ?? []), ...(text().match(MAC_SEPARATED) ?? [])];

				for (const mac of macs) {
					expect(mac.replace(/[:-]/g, '').toUpperCase().startsWith(FAKE_MAC_PREFIX)).toBe(true);
				}
			});
		},
	);

	describe('discovery replies', () => {
		const walk = (buffer: Buffer): { version: number; command: number; tlvs: { type: number; value: Buffer }[] } => {
			const version = buffer.readUInt8(0);
			const command = buffer.readUInt8(1);
			const length = buffer.readUInt16BE(2);

			expect(buffer.length).toBe(4 + length);

			const tlvs: { type: number; value: Buffer }[] = [];
			let offset = 4;

			while (offset < buffer.length) {
				const type = buffer.readUInt8(offset);
				const valueLength = buffer.readUInt16BE(offset + 1);

				expect(offset + 3 + valueLength).toBeLessThanOrEqual(buffer.length);

				tlvs.push({ type, value: buffer.subarray(offset + 3, offset + 3 + valueLength) });
				offset += 3 + valueLength;
			}

			// The TLVs must consume the payload exactly.
			expect(offset).toBe(buffer.length);

			return { version, command, tlvs };
		};

		it('parses the console reply (header version 1) and identifies the console by its TLVs', () => {
			const reply = walk(readFileSync(join(DIRECTORY, 'discovery-reply.bin')));
			const byType = (type: number): Buffer | undefined => reply.tlvs.find((tlv) => tlv.type === type)?.value;

			expect(reply.version).toBe(1);
			expect(byType(0x0c)?.toString('utf8')).toBe('UNVR');
			expect(byType(0x30)?.toString('utf8')).toBe(REDACTED_DOMAIN);
			expect(byType(0x03)?.toString('utf8')).toBe('6.0.17');
			expect(byType(0x01)?.length).toBe(6);
		});

		it.each([
			['discovery-reply.bin', [0x01, 0x02, 0x2f, 0x32]],
			['discovery-reply-v0.bin', [0x02, 0x21]],
		])('%s: binary MACs and IPs are the fake 0CEA1400 / 192.0.2.x values', (name, macTypes) => {
			const reply = walk(readFileSync(join(DIRECTORY, name)));

			for (const tlv of reply.tlvs.filter((entry) => macTypes.includes(entry.type))) {
				expect(tlv.value.subarray(0, 4).toString('hex')).toBe('0cea1400');

				// 0x02 / 0x2f / 0x32 carry the IPv4 address right after the MAC.
				if (tlv.type !== 0x01 && tlv.type !== 0x21) {
					expect(tlv.value.subarray(6, 9).toString('hex')).toBe('c00002');
				}
			}
		});

		it('parses the non-console reply (header version 0), which has none of the console TLVs', () => {
			const reply = walk(readFileSync(join(DIRECTORY, 'discovery-reply-v0.bin')));
			const types = reply.tlvs.map((tlv) => tlv.type);

			expect(reply.version).toBe(0);
			expect(types).not.toContain(0x0c);
			expect(types).not.toContain(0x30);
			expect(reply.tlvs.find((tlv) => tlv.type === 0x15)?.value.toString('utf8')).toBe('uum_controller');
		});
	});

	describe('captured API shapes', () => {
		it('records the Protect version and the 400 for an unsupported HQ snapshot', () => {
			expect(JSON.parse(read('meta-info.json'))).toEqual({ applicationVersion: '7.3.74' });
			expect(JSON.parse(read('snapshot-hq-unsupported.json'))).toEqual({
				error: 'Camera does not support full HD snapshot',
				name: 'BAD_REQUEST',
			});
		});

		it('records the rate-limit policy and Retry-After on a 429', () => {
			const headers = JSON.parse(read('rate-limit-headers.json')) as Record<string, Record<string, string>>;

			expect(headers.ok.ratelimit).toContain('10-in-1sec');
			expect(headers.rate_limited['retry-after']).toBe('1');
		});

		it('keeps the console-wide guid shared while camera ids stay unique', () => {
			const cameras = JSON.parse(read('cameras.json')) as { id: string; guid: string }[];

			expect(cameras.length).toBeGreaterThan(1);
			// Captured behaviour: Protect reports one guid for every camera on this console, so it is not a device key.
			expect(new Set(cameras.map((camera) => camera.guid)).size).toBe(1);
			expect(new Set(cameras.map((camera) => camera.id)).size).toBe(cameras.length);
		});

		it('keeps only the enabled stream quality non-null', () => {
			expect(JSON.parse(read('rtsps-stream.json'))).toEqual({
				high: expect.stringMatching(/^rtsps:\/\//) as string,
				medium: null,
				low: null,
				package: null,
			});
		});
	});

	describe('snapshot.jpg', () => {
		it('is a tiny JPEG', () => {
			const jpeg = readFileSync(join(DIRECTORY, 'snapshot.jpg'));

			expect(jpeg.subarray(0, 2).toString('hex')).toBe('ffd8');
			expect(jpeg.subarray(-2).toString('hex')).toBe('ffd9');
			expect(jpeg.length).toBeLessThan(2048);
		});
	});
});
