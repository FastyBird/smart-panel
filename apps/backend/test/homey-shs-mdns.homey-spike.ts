import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
	type HomeyMdnsBrowser,
	type HomeyMdnsClientFactory,
	type HomeyShsMdnsReport,
	assertHomeyShsMdnsReportSafe,
	assertHomeyShsMdnsReportSchema,
	loadHomeyShsMdnsProbeConfig,
	probeHomeyShsMdns,
	writeHomeyShsMdnsReport,
} from './support/homey-shs-mdns-probe';

const BASE_ENVIRONMENT: NodeJS.ProcessEnv = {
	FB_HOMEY_SHS_EXPECTED_HOST: '192.0.2.10',
	FB_HOMEY_SHS_MDNS_OBSERVE_MS: '1000',
	FB_HOMEY_SHS_PRIVATE_TERMS: 'Private Room,Private Device',
	FB_HOMEY_SHS_URL: 'http://192.0.2.10:4859',
};

interface FakeMdnsService {
	addresses?: string[];
	host?: string;
	name?: string;
	port: number;
	protocol: 'tcp' | 'udp';
	txt?: unknown;
	type: string;
}

const createMdnsHarness = (options: { destroyFails?: boolean; stopFails?: boolean } = {}) => {
	let onError: (() => void) | null = null;
	let onUp: ((service: FakeMdnsService) => void) | null = null;
	let destroyed = false;
	let stopped = false;
	const browser: HomeyMdnsBrowser = {
		stop: () => {
			stopped = true;

			if (options.stopFails === true) {
				throw new Error('raw browser cleanup detail');
			}
		},
	};
	const factory: HomeyMdnsClientFactory = (errorListener) => {
		onError = errorListener;

		return {
			destroy: () => {
				destroyed = true;

				if (options.destroyFails === true) {
					throw new Error('raw client cleanup detail');
				}
			},
			find: (_query, serviceListener) => {
				onUp = serviceListener;

				return browser;
			},
		};
	};

	return {
		emit: (service: FakeMdnsService) => onUp?.(service),
		fail: () => onError?.(),
		factory,
		isDestroyed: () => destroyed,
		isStopped: () => stopped,
	};
};

describe('Homey SHS mDNS compatibility probe', () => {
	it('preserves the sanitized live pre-restart host-match evidence', async () => {
		const evidencePath = resolve(
			__dirname,
			'../src/plugins/devices-homey/__fixtures__/evidence/2026-08-14-shs-13.4.0-mdns-host-match.json',
		);
		const evidence = JSON.parse(await readFile(evidencePath, 'utf8')) as unknown;
		const config = loadHomeyShsMdnsProbeConfig(BASE_ENVIRONMENT);

		assertHomeyShsMdnsReportSchema(evidence);
		expect(evidence.observation).toStrictEqual({
			durationMs: 5000,
			matchedServices: 1,
			services: [{ port: 80, protocol: 'tcp', txtKeys: [], type: 'http' }],
		});
		expect(() => assertHomeyShsMdnsReportSafe(evidence, config)).not.toThrow();
	});

	it('loads a key-free, exact-host configuration with bounded observation', () => {
		const config = loadHomeyShsMdnsProbeConfig(BASE_ENVIRONMENT, '/tmp/homey-mdns-spike');

		expect(config).toStrictEqual({
			expectedHost: '192.0.2.10',
			observeMs: 1000,
			outputRoot: '/tmp/homey-mdns-spike/test/.homey-shs-captures',
			privateTerms: ['Private Room', 'Private Device'],
		});
		expect(BASE_ENVIRONMENT.FB_HOMEY_SHS_API_KEY).toBeUndefined();

		expect(() =>
			loadHomeyShsMdnsProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_EXPECTED_HOST: '192.0.2.11',
			}),
		).toThrow('does not match');
		expect(() => loadHomeyShsMdnsProbeConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_MDNS_OBSERVE_MS: '999' })).toThrow(
			'between 1000 and 30000',
		);
		expect(() => loadHomeyShsMdnsProbeConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_PRIVATE_TERMS: 'ab' })).toThrow(
			'at least three characters',
		);
	});

	it('keeps only exact host matches and only public service metadata', async () => {
		const config = loadHomeyShsMdnsProbeConfig(BASE_ENVIRONMENT);
		const harness = createMdnsHarness();
		const report = await probeHomeyShsMdns(config, harness.factory, () => {
			harness.emit({
				addresses: ['192.0.2.99'],
				host: 'unrelated.local',
				name: 'Unrelated private service',
				port: 1234,
				protocol: 'tcp',
				txt: { private: 'unrelated private value' },
				type: 'unrelated',
			});
			harness.emit({
				addresses: ['192.0.2.10'],
				host: 'private-host.local.',
				name: 'Private Room Homey',
				port: 4859,
				protocol: 'tcp',
				txt: { id: 'private-id', version: '13.4.0' },
				type: 'homey-shs',
			});
			harness.emit({
				addresses: ['192.0.2.10'],
				port: 4859,
				protocol: 'tcp',
				txt: { version: 'a different private value', id: 'another private id' },
				type: 'homey-shs',
			});

			return Promise.resolve();
		});

		expect(report).toStrictEqual({
			metadata: { probe: 'homey-shs-mdns', schemaVersion: 1 },
			observation: {
				durationMs: 1000,
				matchedServices: 1,
				services: [{ port: 4859, protocol: 'tcp', txtKeys: ['id', 'version'], type: 'homey-shs' }],
			},
		});
		expect(JSON.stringify(report)).not.toContain('Private Room');
		expect(JSON.stringify(report)).not.toContain('192.0.2.10');
		expect(JSON.stringify(report)).not.toContain('private-id');
		expect(harness.isStopped()).toBe(true);
		expect(harness.isDestroyed()).toBe(true);
		expect(() => assertHomeyShsMdnsReportSafe(report, config)).not.toThrow();
	});

	it('accepts a zero-match observation without persisting unrelated LAN data', async () => {
		const config = loadHomeyShsMdnsProbeConfig(BASE_ENVIRONMENT);
		const harness = createMdnsHarness();
		const report = await probeHomeyShsMdns(config, harness.factory, () => {
			harness.emit({
				addresses: ['192.0.2.99'],
				port: 8123,
				protocol: 'tcp',
				txt: { location: 'Private Room' },
				type: 'home-assistant',
			});

			return Promise.resolve();
		});

		expect(report.observation).toStrictEqual({ durationMs: 1000, matchedServices: 0, services: [] });
		expect(() => assertHomeyShsMdnsReportSafe(report, config)).not.toThrow();
	});

	it('rejects unsafe matched metadata with a fixed error and still cleans up', async () => {
		const config = loadHomeyShsMdnsProbeConfig(BASE_ENVIRONMENT);
		const harness = createMdnsHarness();

		await expect(
			probeHomeyShsMdns(config, harness.factory, () => {
				harness.emit({
					addresses: ['192.0.2.10'],
					port: 4859,
					protocol: 'tcp',
					txt: { 'unsafe private key': 'value' },
					type: 'homey-shs',
				});

				return Promise.resolve();
			}),
		).rejects.toThrow('Homey mDNS service metadata was not safe to record');
		expect(harness.isStopped()).toBe(true);
		expect(harness.isDestroyed()).toBe(true);
	});

	it('sanitizes observer and cleanup errors while attempting all cleanup', async () => {
		const config = loadHomeyShsMdnsProbeConfig(BASE_ENVIRONMENT);
		const observerHarness = createMdnsHarness();

		await expect(
			probeHomeyShsMdns(config, observerHarness.factory, () => {
				observerHarness.fail();

				return Promise.resolve();
			}),
		).rejects.toThrow('Homey mDNS observation failed');
		expect(observerHarness.isStopped()).toBe(true);
		expect(observerHarness.isDestroyed()).toBe(true);

		const cleanupHarness = createMdnsHarness({ destroyFails: true, stopFails: true });

		await expect(probeHomeyShsMdns(config, cleanupHarness.factory, () => Promise.resolve())).rejects.toThrow(
			'Homey mDNS cleanup failed',
		);
		expect(cleanupHarness.isStopped()).toBe(true);
		expect(cleanupHarness.isDestroyed()).toBe(true);
	});

	it('rejects extra report fields, invalid scalars, and configured private values', () => {
		const report: HomeyShsMdnsReport = {
			metadata: { probe: 'homey-shs-mdns', schemaVersion: 1 },
			observation: {
				durationMs: 1000,
				matchedServices: 1,
				services: [{ port: 4859, protocol: 'tcp', txtKeys: ['version'], type: 'homey-shs' }],
			},
		};
		const extra = structuredClone(report) as unknown as Record<string, unknown>;
		extra.rawHost = 'private-host';

		expect(() => assertHomeyShsMdnsReportSchema(extra)).toThrow('root schema is invalid');

		const invalidPort = structuredClone(report);
		(invalidPort.observation.services[0] as unknown as Record<string, unknown>).port = '4859';

		expect(() => assertHomeyShsMdnsReportSchema(invalidPort)).toThrow('service schema is invalid');

		const privateReport = structuredClone(report);
		privateReport.observation.services[0].txtKeys = ['Private_Device'];
		const privateConfig = loadHomeyShsMdnsProbeConfig({
			...BASE_ENVIRONMENT,
			FB_HOMEY_SHS_PRIVATE_TERMS: 'Private_Device',
		});

		expect(() => assertHomeyShsMdnsReportSafe(privateReport, privateConfig)).toThrow(
			'contains a secret, address, or email-like value',
		);
	});

	it('writes a new restrictive, schema-validated report directory', async () => {
		const root = await mkdtemp(join(tmpdir(), 'homey-mdns-spike-'));
		const report: HomeyShsMdnsReport = {
			metadata: { probe: 'homey-shs-mdns', schemaVersion: 1 },
			observation: { durationMs: 1000, matchedServices: 0, services: [] },
		};

		try {
			const outputDirectory = await writeHomeyShsMdnsReport(report, root);
			const outputStat = await stat(outputDirectory);
			const reportStat = await stat(join(outputDirectory, 'report.json'));
			const written = JSON.parse(await readFile(join(outputDirectory, 'report.json'), 'utf8')) as unknown;

			expect(outputStat.mode & 0o777).toBe(0o700);
			expect(reportStat.mode & 0o777).toBe(0o600);
			expect(written).toStrictEqual(report);
		} finally {
			await rm(root, { force: true, recursive: true });
		}
	});
});
