import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Socket } from 'socket.io';

import {
	CommandAcknowledgementTraceConfig,
	CommandAcknowledgementTraceService,
} from './command-acknowledgement-trace.service';

describe('CommandAcknowledgementTraceService', () => {
	const baseConfig: CommandAcknowledgementTraceConfig = {
		schemaVersion: 1,
		runId: '1f09f46e-fd03-4d0d-a1d0-83d261d3e201',
		target: {
			deviceId: '1f09f46e-fd03-4d0d-a1d0-83d261d3e202',
			channelId: '1f09f46e-fd03-4d0d-a1d0-83d261d3e203',
			propertyId: '1f09f46e-fd03-4d0d-a1d0-83d261d3e204',
		},
		requests: [
			{ phase: 'trial', requestId: '1f09f46e-fd03-4d0d-a1d0-83d261d3e205', value: true },
			{ phase: 'restoration', requestId: '1f09f46e-fd03-4d0d-a1d0-83d261d3e206', value: false },
		],
		exportPath: '/private/command-acknowledgement-trace.json',
	};
	let config: CommandAcknowledgementTraceConfig;
	let directory: string;
	let services: CommandAcknowledgementTraceService[];

	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), 'command-ack-trace-'));
		config = { ...baseConfig, exportPath: join(directory, 'trace.json') };
		services = [];
	});

	afterEach(async () => {
		for (const service of services) {
			service.onModuleDestroy();
		}
		await Promise.all(services.map((service) => service.waitForExports()));
		await rm(directory, { force: true, recursive: true });
	});

	const createService = (options: CommandAcknowledgementTraceConfig = config): CommandAcknowledgementTraceService => {
		const service = new CommandAcknowledgementTraceService(options);
		services.push(service);
		return service;
	};

	interface FakeSocket extends Pick<Socket, 'off' | 'on' | 'use'> {
		readonly id: string;
		readonly middleware: ((packet: unknown[], next: (error?: Error) => void) => void)[];
		readonly listeners: Map<string, (reason: unknown) => void>;
	}

	const createSocket = (id: string): FakeSocket => {
		const middleware: ((packet: unknown[], next: (error?: Error) => void) => void)[] = [];
		const listeners = new Map<string, (reason: unknown) => void>();
		return {
			id,
			middleware,
			listeners,
			use: (callback) => {
				middleware.push(callback as (packet: unknown[], next: (error?: Error) => void) => void);
				return undefined as unknown as Socket;
			},
			on: (event, callback) => {
				listeners.set(event, callback as (reason: unknown) => void);
				return undefined as unknown as Socket;
			},
			off: (event) => {
				listeners.delete(String(event));
				return undefined as unknown as Socket;
			},
		};
	};

	const packetFor = (phase: 'trial' | 'restoration', acknowledgement?: (...args: unknown[]) => unknown): unknown[] => {
		const request = config.requests.find((candidate) => candidate.phase === phase);
		if (request === undefined) {
			throw new Error(`No request configured for ${phase}`);
		}
		const packet: unknown[] = [
			'command',
			{
				event: 'DevicesModule.ChannelProperty.Set',
				payload: {
					request_id: request.requestId,
					properties: [
						{
							device: config.target.deviceId,
							channel: config.target.channelId,
							property: config.target.propertyId,
							value: request.value,
						},
					],
				},
			},
		];
		if (acknowledgement !== undefined) {
			packet.push(acknowledgement);
		}
		return packet;
	};

	const runPacket = (socket: FakeSocket, packet: unknown[]): void => {
		expect(socket.middleware).toHaveLength(1);
		const next = jest.fn();
		socket.middleware[0]?.(packet, next);
		expect(next).toHaveBeenCalledTimes(1);
		expect(next).toHaveBeenCalledWith();
	};

	it('is disabled by default and leaves ordinary Socket.IO packets untouched', () => {
		const service = new CommandAcknowledgementTraceService();
		const socket = createSocket('socket-a');
		const acknowledgement = jest.fn();
		const packet = packetFor('trial', acknowledgement);

		service.attachSocket(socket as unknown as Socket);

		expect(service.isEnabled()).toBe(false);
		expect(socket.middleware).toHaveLength(0);
		expect(packet.at(-1)).toBe(acknowledgement);
		expect(service.getSnapshot()).toBeNull();
	});

	it('retains receipt, gateway, handler, and automatic acknowledgement marks for both preallocated requests', () => {
		const service = createService();
		const socket = createSocket('socket-a');
		service.attachSocket(socket as unknown as Socket);

		for (const phase of ['trial', 'restoration'] as const) {
			const acknowledgement = jest.fn(function acknowledgement(this: { marker: string }, response: unknown) {
				return { marker: this.marker, response };
			});
			const packet = packetFor(phase, acknowledgement);
			runPacket(socket, packet);
			const message = packet[1];
			service.recordGatewayEntry(socket as unknown as Socket, message);
			service.recordHandlerStart(socket as unknown as Socket, message, 'DevicesModule.Internal.SetPropertyValue');
			service.recordHandlerSettled(
				socket as unknown as Socket,
				message,
				'DevicesModule.Internal.SetPropertyValue',
				'resolved',
			);
			service.recordGatewayReturn(socket as unknown as Socket, message, 'ok');

			const wrappedAcknowledgement = packet.at(-1) as (this: { marker: string }, response: unknown) => unknown;
			expect(wrappedAcknowledgement.call({ marker: phase }, { status: 'ok' })).toEqual({
				marker: phase,
				response: { status: 'ok' },
			});
			expect(acknowledgement).toHaveBeenCalledTimes(1);
		}

		const snapshot = service.getSnapshot();
		expect(snapshot).toMatchObject({ state: 'recording', cutoffReason: null });
		expect(service.getSnapshot()?.snapshotSequence).toBeGreaterThan(snapshot?.snapshotSequence ?? 0);
		expect(snapshot?.requests).toEqual([
			expect.objectContaining({ phase: 'trial', status: 'received', acknowledgementCalls: 1 }),
			expect.objectContaining({ phase: 'restoration', status: 'received', acknowledgementCalls: 1 }),
		]);
		expect(snapshot?.records.map((record) => record.stage)).toEqual([
			'socket-receipt',
			'gateway-entry',
			'handler-start',
			'handler-settled',
			'gateway-return',
			'ack-invoked',
			'ack-returned',
			'socket-receipt',
			'gateway-entry',
			'handler-start',
			'handler-settled',
			'gateway-return',
			'ack-invoked',
			'ack-returned',
		]);
	});

	it('does not reject a malformed eligible packet, but invalidates only its diagnostic evidence', () => {
		const service = createService();
		const socket = createSocket('socket-a');
		service.attachSocket(socket as unknown as Socket);
		const packet = packetFor('trial');
		((packet[1] as { payload: { properties: unknown[] } }).payload.properties[0] as { value: boolean }).value = false;

		runPacket(socket, packet);

		expect(service.getSnapshot()).toMatchObject({ state: 'invalid', cutoffReason: 'scope-mismatch' });
	});

	it('invalidates an allowlisted request ID on the wrong inner event without forwarding a middleware error', () => {
		const service = createService();
		const socket = createSocket('socket-a');
		service.attachSocket(socket as unknown as Socket);
		const packet = packetFor('trial');
		(packet[1] as { event: string }).event = 'OtherModule.Command';

		runPacket(socket, packet);

		expect(service.getSnapshot()).toMatchObject({ state: 'invalid', cutoffReason: 'scope-mismatch' });
	});

	it('invalidates duplicate and cross-socket observations without changing the command packet path', () => {
		const service = createService();
		const firstSocket = createSocket('socket-a');
		const secondSocket = createSocket('socket-b');
		service.attachSocket(firstSocket as unknown as Socket);
		service.attachSocket(secondSocket as unknown as Socket);

		runPacket(firstSocket, packetFor('trial'));
		runPacket(secondSocket, packetFor('restoration'));
		expect(service.getSnapshot()).toMatchObject({ state: 'invalid', cutoffReason: 'socket-mismatch' });

		const duplicate = createService({ ...config, exportPath: join(directory, 'duplicate.json') });
		const duplicateSocket = createSocket('socket-c');
		duplicate.attachSocket(duplicateSocket as unknown as Socket);
		runPacket(duplicateSocket, packetFor('trial'));
		runPacket(duplicateSocket, packetFor('trial'));
		expect(duplicate.getSnapshot()).toMatchObject({ state: 'invalid', cutoffReason: 'duplicate-request' });
	});

	it('closes observation at its finite deadline without treating missing marks as a product error', () => {
		jest.useFakeTimers();
		try {
			const service = createService({ ...config, captureDurationMs: 1_500 });
			const socket = createSocket('socket-a');
			service.attachSocket(socket as unknown as Socket);
			runPacket(socket, packetFor('trial'));

			jest.advanceTimersByTime(1_500);

			expect(service.getSnapshot()).toMatchObject({ state: 'closed', cutoffReason: 'capture-duration-elapsed' });
			expect(service.getSnapshot()?.requests).toEqual([
				expect.objectContaining({ phase: 'trial', status: 'received' }),
				expect.objectContaining({ phase: 'restoration', status: 'not-observed' }),
			]);
		} finally {
			jest.useRealTimers();
		}
	});

	it('preserves a terminal cutoff when a late eligible packet arrives', () => {
		const service = createService();
		const socket = createSocket('socket-a');
		service.attachSocket(socket as unknown as Socket);
		runPacket(socket, packetFor('trial'));

		service.onModuleDestroy();
		runPacket(socket, packetFor('trial'));

		expect(service.getSnapshot()).toMatchObject({ state: 'closed', cutoffReason: 'backend-shutdown' });
	});

	it('preserves the retained prefix and invalidates diagnostic evidence at the configured record limit', () => {
		const service = createService({ ...config, maxRecords: 1 });
		const socket = createSocket('socket-a');
		service.attachSocket(socket as unknown as Socket);
		const packet = packetFor('trial');
		runPacket(socket, packet);
		service.recordGatewayEntry(socket as unknown as Socket, packet[1]);

		const snapshot = service.getSnapshot();
		expect(snapshot).toMatchObject({ state: 'invalid', cutoffReason: 'record-limit-exceeded' });
		expect(snapshot?.records).toHaveLength(1);
		expect(snapshot?.records[0]).toMatchObject({ stage: 'socket-receipt' });
	});

	it('does not arm a trace for malformed configuration or create its snapshot timer', () => {
		const service = createService({ ...config, maxRecords: 257 });
		const socket = createSocket('socket-a');
		service.attachSocket(socket as unknown as Socket);

		expect(service.isEnabled()).toBe(false);
		expect(socket.middleware).toHaveLength(0);
		expect(service.getSnapshot()).toBeNull();
	});

	it.each([
		['a non-string export path', 'export-path'],
		['a null request entry', 'request-entry'],
	] as const)('disables tracing for %s without throwing during startup', (_label, malformedPart) => {
		const malformedConfig =
			malformedPart === 'export-path'
				? { ...config, exportPath: null }
				: { ...config, requests: [null, config.requests[1]] };
		const service = createService(malformedConfig as unknown as CommandAcknowledgementTraceConfig);

		expect(service.isEnabled()).toBe(false);
		expect(service.getSnapshot()).toBeNull();
	});

	it('removes its observed disconnect listener during teardown without changing command state', () => {
		const service = createService();
		const socket = createSocket('socket-a');
		service.attachSocket(socket as unknown as Socket);
		runPacket(socket, packetFor('trial'));

		service.onModuleDestroy();

		expect(socket.listeners.has('disconnect')).toBe(false);
		expect(service.getSnapshot()).toMatchObject({ state: 'closed', cutoffReason: 'backend-shutdown' });
	});

	it('writes an owner-only atomic private snapshot and refuses a stale destination', async () => {
		const service = createService();
		service.onModuleInit();
		await service.waitForExports();
		const stored = JSON.parse(await readFile(config.exportPath, 'utf8')) as { state: string };
		expect(stored.state).toBe('armed');
		expect((await stat(config.exportPath)).mode & 0o777).toBe(0o600);

		const stale = createService({ ...config, exportPath: config.exportPath });
		stale.onModuleInit();
		await stale.waitForExports();
		expect(stale.getSnapshot()).toMatchObject({ state: 'invalid', cutoffReason: 'export-failed' });
	});

	it('allows only one concurrent initial writer to acquire a private destination', async () => {
		const first = createService();
		const second = createService({ ...config, exportPath: config.exportPath });

		first.onModuleInit();
		second.onModuleInit();
		await Promise.all([first.waitForExports(), second.waitForExports()]);

		expect([first.getSnapshot(), second.getSnapshot()]).toEqual(
			expect.arrayContaining([expect.objectContaining({ state: 'invalid', cutoffReason: 'export-failed' })]),
		);
		expect(JSON.parse(await readFile(config.exportPath, 'utf8'))).toMatchObject({ state: 'armed' });
	});
});
