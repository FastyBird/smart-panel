import { randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import * as os from 'os';
import { join } from 'path';

import { FakeUdpSocket, createFakeDiscoveryEnvironment } from '../../../../test/support/fake-udp-socket';
import { buildDiscoveryReply } from '../../../../test/support/protect-discovery-reply';
import { ExtensionLoggerService } from '../../../common/logger/extension-logger.service';

import { ProtectDiscoveryProbeService, ProtectProbeResult } from './protect-discovery-probe.service';
import {
	PROTECT_DISCOVERY_REQUEST_V1,
	PROTECT_DISCOVERY_REQUEST_V2,
	ProtectDiscoveryFailureReason,
	ProtectDiscoveryStatus,
	ProtectDiscoveryWarning,
	ProtectInterfaceErrorCode,
	ProtectInterfaceStatus,
	ProtectPresence,
	ProtectProbeStatus,
} from './protect-discovery.constants';
import { ProtectDiscoveryScan, ProtectDiscoveryService } from './protect-discovery.service';

const fixture = (name: string): Buffer => readFileSync(join(__dirname, '..', '__fixtures__', name));
const info = (address: string, netmask: string, extra: Partial<os.NetworkInterfaceInfo> = {}) =>
	({
		address,
		netmask,
		family: 'IPv4',
		internal: false,
		mac: '00:00:00:00:00:00',
		cidr: null,
		...extra,
	}) as os.NetworkInterfaceInfo;

const EN0 = { en0: [info('192.168.1.20', '255.255.255.0')] };
const TWO = { en0: [info('192.168.1.20', '255.255.255.0')], en1: [info('10.0.0.5', '255.255.255.0')] };

const errno = (code: string): NodeJS.ErrnoException => Object.assign(new Error(code), { code });

const probeResult = (
	target: { host: string; port: number },
	status = ProtectProbeStatus.CONSOLE,
): ProtectProbeResult => ({
	host: target.host,
	port: target.port,
	status,
	failure: null,
	protect: ProtectPresence.PRESENT,
	model: 'UNVR',
	name: 'Dream Machine Pro',
	mac: null,
	deviceState: 'READY',
	directConnectDomain: null,
	certificate: null,
	preferredHost: target.host,
});

const macOf = (n: number): Buffer => Buffer.from([0xaa, 0xbb, 0xcc, 0, (n >> 8) & 0xff, n & 0xff]);
const consoleReply = (n: number): Buffer =>
	buildDiscoveryReply({
		tlvs: [
			[0x01, macOf(n)],
			[0x0b, `console-${n}`],
			[0x0c, 'UNVR'],
		],
	});
const otherReply = (n: number): Buffer =>
	buildDiscoveryReply({
		version: 0,
		tlvs: [
			[0x01, macOf(n)],
			[0x15, 'uum_controller'],
		],
	});

describe('ProtectDiscoveryService', () => {
	let probe: { probe: jest.Mock<Promise<ProtectProbeResult>, [{ host: string; port: number }]> };
	let service: ProtectDiscoveryService;
	let sockets: FakeUdpSocket[];

	const setup = (opts: Parameters<typeof createFakeDiscoveryEnvironment>[0] = { interfaces: EN0 }): void => {
		const fake = createFakeDiscoveryEnvironment(opts);

		sockets = fake.sockets;
		probe = { probe: jest.fn((target: { host: string; port: number }) => Promise.resolve(probeResult(target))) };
		service = new ProtectDiscoveryService(fake.env, probe as unknown as ProtectDiscoveryProbeService);
	};

	/** Wrapped, so the returned promise is not flattened by `await`. */
	const start = async (): Promise<{ done: Promise<ProtectDiscoveryScan> }> => {
		const done = service.scan();

		await jest.advanceTimersByTimeAsync(0);

		return { done };
	};

	const finish = async (promise: Promise<ProtectDiscoveryScan>): Promise<ProtectDiscoveryScan> => {
		await jest.advanceTimersByTimeAsync(5000);

		return promise;
	};

	/** Starts a scan, feeds the replies through the first socket, and runs the whole window. */
	const scanWith = async (replies: Array<[Buffer, string]>): Promise<ProtectDiscoveryScan> => {
		const { done: promise } = await start();

		for (const [buffer, address] of replies) {
			sockets[0].reply(buffer, address);
		}

		return finish(promise);
	};

	beforeEach(() => {
		jest.useFakeTimers();
		setup();
	});

	afterEach(() => {
		service.onModuleDestroy();
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it('getLastScan is idle with empty lists before the first scan', () => {
		expect(service.getLastScan()).toEqual({
			status: 'idle',
			failureReason: null,
			warnings: [],
			startedAt: null,
			finishedAt: null,
			interfaces: [],
			consoles: [],
			otherUnifiDevices: 0,
		});
	});

	it('binds one socket per usable interface and skips others', async () => {
		setup({
			interfaces: {
				en0: [
					info('192.168.1.20', '255.255.255.0'),
					{ ...info('fe80::1', 'ffff::'), family: 'IPv6' } as os.NetworkInterfaceInfo,
				],
				lo0: [info('127.0.0.1', '255.0.0.0', { internal: true })],
				tun0: [info('100.64.0.5', '255.255.255.255')],
			},
		});

		await finish((await start()).done);

		expect(sockets).toHaveLength(1);
		expect(sockets[0].boundAddress).toBe('192.168.1.20');
		expect(sockets[0].boundPort).toBe(0);
		expect(sockets[0].broadcast).toBe(true);
		expect(sockets[0].multicastTtl).toBe(1);
		expect(sockets[0].multicastInterface).toBe('192.168.1.20');
		expect(sockets[0].multicastLoopback).toBe(false);
	});

	it('sends V1 and V2 to the subnet broadcast address and the multicast group, never to 255.255.255.255', async () => {
		const { done: promise } = await start();

		expect(sockets[0].sends.map((s) => [s.msg.toString('hex'), s.address, s.port])).toEqual([
			['01000000', '192.168.1.255', 10001],
			['02080000', '192.168.1.255', 10001],
			['01000000', '233.89.188.1', 10001],
			['02080000', '233.89.188.1', 10001],
		]);
		expect(sockets[0].sends[0].msg.equals(PROTECT_DISCOVERY_REQUEST_V1)).toBe(true);
		expect(sockets[0].sends[1].msg.equals(PROTECT_DISCOVERY_REQUEST_V2)).toBe(true);

		await finish(promise);

		expect(sockets[0].sends.some((s) => s.address === '255.255.255.255')).toBe(false);
	});

	it('resends at one third and two thirds of the window and stops after three rounds', async () => {
		const { done: promise } = await start();

		expect(sockets[0].sends).toHaveLength(4);
		await jest.advanceTimersByTimeAsync(1666);
		expect(sockets[0].sends).toHaveLength(4);
		await jest.advanceTimersByTimeAsync(1);
		expect(sockets[0].sends).toHaveLength(8);
		await jest.advanceTimersByTimeAsync(1665);
		expect(sockets[0].sends).toHaveLength(8);
		await jest.advanceTimersByTimeAsync(1);
		expect(sockets[0].sends).toHaveLength(12);
		await jest.advanceTimersByTimeAsync(1667);
		await promise;
		await jest.advanceTimersByTimeAsync(10000);

		expect(sockets[0].sends).toHaveLength(12);
		expect(sockets[0].closed).toBe(true);
	});

	it('closes every socket and settles the scan at the end of the window', async () => {
		setup({ interfaces: TWO });

		const { done: promise } = await start();

		expect(service.getLastScan().status).toBe(ProtectDiscoveryStatus.SCANNING);
		expect(sockets.every((s) => !s.closed)).toBe(true);

		const scan = await finish(promise);

		expect(sockets).toHaveLength(2);
		expect(sockets.every((s) => s.closed)).toBe(true);
		expect(scan.status).toBe(ProtectDiscoveryStatus.COMPLETED);
		expect(scan.interfaces.map((i) => [i.name, i.status])).toEqual([
			['en0', 'ok'],
			['en1', 'ok'],
		]);
		expect(scan.startedAt).not.toBeNull();
		expect(scan.finishedAt).not.toBeNull();
		expect(jest.getTimerCount()).toBe(0);
		expect(service.getLastScan()).toBe(scan);
	});

	it('lists a console candidate from the sanitized v1 fixture and probes it on port 443', async () => {
		const scan = await scanWith([[fixture('discovery-reply.bin'), '192.168.1.10']]);

		expect(probe.probe).toHaveBeenCalledTimes(1);
		expect(probe.probe).toHaveBeenCalledWith({ host: '192.168.1.10', port: 443 });
		expect(scan.consoles).toHaveLength(1);
		expect(scan.consoles[0]).toMatchObject({
			mac: '0c:ea:14:00:00:01',
			host: '192.168.1.10',
			addresses: ['192.168.1.10'],
			hostname: 'Dream-Machine-Pro',
			model: 'UNVR',
			firmware: '6.0.17',
			probe: { host: '192.168.1.10', port: 443, status: 'console' },
		});
		expect(scan.warnings).toEqual([]);
	});

	it('counts a v0 reply as another UniFi device and never lists or probes it', async () => {
		const scan = await scanWith([[fixture('discovery-reply-v0.bin'), '192.168.1.11']]);

		expect(scan.otherUnifiDevices).toBe(1);
		expect(scan.consoles).toEqual([]);
		expect(probe.probe).not.toHaveBeenCalled();
		expect(scan.warnings).not.toContain(ProtectDiscoveryWarning.NO_REPLIES);
	});

	it('de-duplicates replies with the same MAC and keeps every source address', async () => {
		const reply = fixture('discovery-reply.bin');
		const scan = await scanWith([
			[reply, '192.168.1.10'],
			[reply, '192.168.1.11'],
			[reply, '192.168.1.10'],
		]);

		expect(scan.consoles).toHaveLength(1);
		expect(scan.consoles[0].host).toBe('192.168.1.10');
		expect(scan.consoles[0].addresses).toEqual(['192.168.1.10', '192.168.1.11']);
		expect(probe.probe).toHaveBeenCalledTimes(1);
	});

	it('fills null fields from later replies for the same MAC', async () => {
		const sparse = buildDiscoveryReply({
			tlvs: [
				[0x01, macOf(1)],
				[0x0c, 'UNVR'],
			],
		});
		const full = buildDiscoveryReply({
			tlvs: [
				[0x01, macOf(1)],
				[0x0b, 'Later'],
				[0x03, '1.2.3'],
				[0x0c, 'OTHER'],
			],
		});
		const scan = await scanWith([
			[sparse, '192.168.1.10'],
			[full, '192.168.1.10'],
		]);

		expect(scan.consoles[0]).toMatchObject({ hostname: 'Later', firmware: '1.2.3', model: 'UNVR' });
	});

	it('de-duplicates across resend rounds', async () => {
		const reply = fixture('discovery-reply.bin');
		const { done: promise } = await start();

		sockets[0].reply(reply, '192.168.1.10');
		await jest.advanceTimersByTimeAsync(1667);
		sockets[0].reply(reply, '192.168.1.10');
		await jest.advanceTimersByTimeAsync(1666);
		sockets[0].reply(reply, '192.168.1.10');

		const scan = await finish(promise);

		expect(scan.consoles).toHaveLength(1);
		expect(probe.probe).toHaveBeenCalledTimes(1);
	});

	it('drops a probed candidate that is not a console and counts it once', async () => {
		probe.probe.mockImplementation((target) => Promise.resolve(probeResult(target, ProtectProbeStatus.NOT_CONSOLE)));

		const reply = fixture('discovery-reply.bin');
		const scan = await scanWith([
			[reply, '192.168.1.10'],
			[reply, '192.168.1.10'],
		]);

		expect(scan.consoles).toEqual([]);
		expect(scan.otherUnifiDevices).toBe(1);
		expect(scan.warnings).not.toContain(ProtectDiscoveryWarning.NO_REPLIES);
	});

	it('keeps a console whose probe is unreachable and reports the probe status', async () => {
		probe.probe.mockImplementation((target) =>
			Promise.resolve({ ...probeResult(target, ProtectProbeStatus.UNREACHABLE), protect: ProtectPresence.UNKNOWN }),
		);

		const scan = await scanWith([[fixture('discovery-reply.bin'), '192.168.1.10']]);

		expect(scan.consoles).toHaveLength(1);
		expect(scan.consoles[0].probe.status).toBe('unreachable');
		expect(scan.otherUnifiDevices).toBe(0);
	});

	it('ignores a reply from a source port other than 10001', async () => {
		const { done: promise } = await start();

		sockets[0].reply(fixture('discovery-reply.bin'), '192.168.1.10', 40000);

		const scan = await finish(promise);

		expect(scan.consoles).toEqual([]);
		expect(scan.otherUnifiDevices).toBe(0);
		expect(scan.warnings).toContain(ProtectDiscoveryWarning.NO_REPLIES);
	});

	it('ignores the echoed request and replies without an identity MAC', async () => {
		const scan = await scanWith([
			[PROTECT_DISCOVERY_REQUEST_V1, '192.168.1.20'],
			[PROTECT_DISCOVERY_REQUEST_V2, '192.168.1.20'],
			[
				buildDiscoveryReply({
					tlvs: [
						[0x03, '6.0.17'],
						[0x0c, 'UNVR'],
					],
				}),
				'192.168.1.12',
			],
		]);

		expect(scan.consoles).toEqual([]);
		expect(scan.otherUnifiDevices).toBe(0);
		expect(probe.probe).not.toHaveBeenCalled();
	});

	it('ignores malformed datagrams without throwing and without counting them', async () => {
		const reference = fixture('discovery-reply.bin');
		const replies: Array<[Buffer, string]> = [
			[reference.subarray(0, 2), '192.168.1.30'],
			[reference.subarray(0, 100), '192.168.1.30'],
			[reference.subarray(0, reference.length - 1), '192.168.1.30'],
			[Buffer.alloc(5000, 1), '192.168.1.30'],
			[randomBytes(64), '192.168.1.30'],
			[Buffer.alloc(0), '192.168.1.30'],
		];
		const scan = await scanWith(replies);

		expect(scan.status).toBe(ProtectDiscoveryStatus.COMPLETED);
		expect(scan.consoles).toEqual([]);
		expect(scan.otherUnifiDevices).toBe(0);
	});

	it('keeps at most 16 candidates and warns candidate_limit_reached', async () => {
		const scan = await scanWith(
			Array.from({ length: 20 }, (_, n): [Buffer, string] => [consoleReply(n), `192.168.1.${100 + n}`]),
		);

		expect(scan.consoles).toHaveLength(16);
		expect(probe.probe).toHaveBeenCalledTimes(16);
		expect(scan.warnings).toContain(ProtectDiscoveryWarning.CANDIDATE_LIMIT_REACHED);
	});

	it('stops tracking other devices after 256 identities', async () => {
		const scan = await scanWith(
			Array.from({ length: 300 }, (_, n): [Buffer, string] => [otherReply(n), '192.168.1.50']),
		);

		expect(scan.otherUnifiDevices).toBe(256);
		expect(scan.consoles).toEqual([]);
	});

	it('reports a socket error event as that interface failing and still completes', async () => {
		setup({ interfaces: TWO });

		const { done: promise } = await start();

		sockets[0].emit('error', errno('EACCES'));

		const scan = await finish(promise);

		expect(scan.status).toBe(ProtectDiscoveryStatus.COMPLETED);
		expect(scan.interfaces[0]).toMatchObject({ name: 'en0', status: 'error', errorCode: 'permission_denied' });
		expect(scan.interfaces[1]).toMatchObject({ name: 'en1', status: 'ok', errorCode: null });
		expect(scan.warnings).toContain(ProtectDiscoveryWarning.SOME_INTERFACES_FAILED);
		expect(sockets[0].closed).toBe(true);
	});

	it('stops sending on an interface after its socket error', async () => {
		setup({ interfaces: TWO });

		const { done: promise } = await start();

		sockets[0].emit('error', errno('EACCES'));
		await jest.advanceTimersByTimeAsync(1667);

		expect(sockets[0].sends).toHaveLength(4);
		expect(sockets[1].sends).toHaveLength(8);

		await finish(promise);
	});

	it('does not throw when setBroadcast or setMulticastInterface throw', async () => {
		const promise = service.scan();

		sockets[0].throwOn.add('setBroadcast').add('setMulticastInterface');

		const scan = await finish(promise);

		expect(scan.status).toBe(ProtectDiscoveryStatus.COMPLETED);
		expect(scan.interfaces[0].status).toBe(ProtectInterfaceStatus.OK);
		expect(sockets[0].sends).toHaveLength(12);
	});

	it('reports failed/all_interfaces_failed when every interface cannot send', async () => {
		setup({ interfaces: EN0, onSend: () => errno('EACCES') });

		const scan = await scanWith([]);

		expect(scan.status).toBe(ProtectDiscoveryStatus.FAILED);
		expect(scan.failureReason).toBe(ProtectDiscoveryFailureReason.ALL_INTERFACES_FAILED);
		expect(scan.consoles).toEqual([]);
		expect(scan.interfaces[0]).toMatchObject({
			status: 'error',
			errorCode: ProtectInterfaceErrorCode.PERMISSION_DENIED,
		});
		expect(probe.probe).not.toHaveBeenCalled();
	});

	it('keeps an interface ok when only some sends fail', async () => {
		setup({
			interfaces: EN0,
			onSend: (_s, _m, _p, address) => (address === '233.89.188.1' ? errno('ENETUNREACH') : null),
		});

		const scan = await scanWith([]);

		expect(scan.interfaces[0]).toMatchObject({ status: 'ok', errorCode: null });
	});

	it('reports failed/no_usable_interface when no usable interface exists', async () => {
		setup({ interfaces: { lo0: [info('127.0.0.1', '255.0.0.0', { internal: true })] } });

		const scan = await service.scan();

		expect(scan.status).toBe(ProtectDiscoveryStatus.FAILED);
		expect(scan.failureReason).toBe(ProtectDiscoveryFailureReason.NO_USABLE_INTERFACE);
		expect(sockets).toHaveLength(0);
		expect(jest.getTimerCount()).toBe(0);
	});

	it('reports an interface bind error as address_unavailable', async () => {
		setup({
			interfaces: TWO,
			bindError: (address) => (address === '192.168.1.20' ? errno('EADDRNOTAVAIL') : null),
		});

		const scan = await scanWith([]);

		expect(scan.status).toBe(ProtectDiscoveryStatus.COMPLETED);
		expect(scan.interfaces[0]).toMatchObject({ status: 'error', errorCode: 'address_unavailable' });
		expect(scan.interfaces[1].status).toBe('ok');
		expect(sockets[0].sends).toHaveLength(0);
		expect(scan.warnings).toContain(ProtectDiscoveryWarning.SOME_INTERFACES_FAILED);
	});

	it('ends completed with no_replies when nothing answers', async () => {
		const scan = await scanWith([]);

		expect(scan.status).toBe(ProtectDiscoveryStatus.COMPLETED);
		expect(scan.warnings).toEqual([ProtectDiscoveryWarning.NO_REPLIES]);
	});

	it('adds container_network_isolated when nothing answers inside a container', async () => {
		setup({ interfaces: EN0, container: true });

		const scan = await scanWith([]);

		expect(scan.warnings).toEqual([
			ProtectDiscoveryWarning.NO_REPLIES,
			ProtectDiscoveryWarning.CONTAINER_NETWORK_ISOLATED,
		]);
	});

	it('does not warn about containers when a console answered', async () => {
		setup({ interfaces: EN0, container: true });

		const scan = await scanWith([[fixture('discovery-reply.bin'), '192.168.1.10']]);

		expect(scan.warnings).toEqual([]);
	});

	it('shares one scan between concurrent scan calls', async () => {
		const first = service.scan();
		const second = service.scan();

		await jest.advanceTimersByTimeAsync(5000);

		const [a, b] = await Promise.all([first, second]);

		expect(sockets).toHaveLength(1);
		expect(a).toBe(b);

		const third = service.scan();

		await jest.advanceTimersByTimeAsync(5000);
		await third;

		expect(sockets).toHaveLength(2);
	});

	it('replaces the previous result when a new scan starts', async () => {
		await scanWith([[fixture('discovery-reply.bin'), '192.168.1.10']]);

		expect(service.getLastScan().consoles).toHaveLength(1);

		const second = service.scan();

		expect(service.getLastScan()).toMatchObject({
			status: 'scanning',
			consoles: [],
			interfaces: [],
			otherUnifiDevices: 0,
		});
		expect(service.getLastScan().finishedAt).toBeNull();

		await jest.advanceTimersByTimeAsync(5000);
		await second;
	});

	it('onModuleDestroy closes sockets, clears timers and settles an in-flight scan without throwing', async () => {
		const { done: promise } = await start();

		expect(() => service.onModuleDestroy()).not.toThrow();

		const scan = await promise;

		expect(scan.status).toBe(ProtectDiscoveryStatus.FAILED);
		expect(sockets.every((s) => s.closed)).toBe(true);
		expect(jest.getTimerCount()).toBe(0);
		expect(() => service.onModuleDestroy()).not.toThrow();
	});

	it('onModuleDestroy settles a scan that is probing', async () => {
		probe.probe.mockImplementation(() => new Promise(() => undefined));

		const { done: promise } = await start();

		sockets[0].reply(fixture('discovery-reply.bin'), '192.168.1.10');
		await jest.advanceTimersByTimeAsync(5000);
		expect(probe.probe).toHaveBeenCalledTimes(1);

		service.onModuleDestroy();

		await expect(promise).resolves.toMatchObject({ status: 'failed' });
	});

	it('passes at most eight probes at a time', async () => {
		const pending: Array<() => void> = [];
		let inFlight = 0;
		let maxInFlight = 0;

		probe.probe.mockImplementation(async (target) => {
			inFlight += 1;
			maxInFlight = Math.max(maxInFlight, inFlight);
			await new Promise<void>((resolve) => pending.push(resolve));
			inFlight -= 1;

			return probeResult(target);
		});

		const { done: promise } = await start();

		for (let n = 0; n < 12; n++) {
			sockets[0].reply(consoleReply(n), `192.168.1.${100 + n}`);
		}

		await jest.advanceTimersByTimeAsync(5000);

		expect(inFlight).toBe(8);

		for (let i = 0; i < 10; i++) {
			pending.splice(0).forEach((resolve) => resolve());
			await jest.advanceTimersByTimeAsync(0);
		}

		const scan = await promise;

		expect(maxInFlight).toBe(8);
		expect(probe.probe).toHaveBeenCalledTimes(12);
		expect(scan.consoles.map((c) => c.hostname)).toEqual(Array.from({ length: 12 }, (_, n) => `console-${n}`));
	});

	it('logs no raw datagram, MAC or body', async () => {
		const spies = (['log', 'warn', 'debug', 'error', 'verbose'] as const).map((method) =>
			jest.spyOn(ExtensionLoggerService.prototype, method),
		);
		const reference = fixture('discovery-reply.bin');

		setup({ interfaces: EN0, onSend: () => errno('ENETUNREACH') });
		spies.forEach((spy) => spy.mockClear());

		await scanWith([
			[reference, '192.168.1.10'],
			[reference.subarray(0, 50), '192.168.1.10'],
			[fixture('discovery-reply-v0.bin'), '192.168.1.11'],
			[
				buildDiscoveryReply({
					version: 1,
					tlvs: [
						[0x01, macOf(7)],
						[0x0c, 'UNVR'],
					],
				}),
				'192.168.1.12',
			],
		]);

		const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls)).toLowerCase();

		expect(spies.flatMap((spy) => spy.mock.calls).length).toBeGreaterThan(0);

		for (const forbidden of [
			'0cea14',
			'0c:ea:14',
			'aa:bb:cc',
			'aabbcc',
			'dream-machine',
			'192.168.1',
			reference.toString('hex').slice(0, 24),
		]) {
			expect(logged).not.toContain(forbidden);
		}
	});
});
