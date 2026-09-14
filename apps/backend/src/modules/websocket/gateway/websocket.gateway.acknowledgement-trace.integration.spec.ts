import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { from } from 'rxjs';
import { Socket } from 'socket.io';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { IoAdapter } from '@nestjs/platform-socket.io';

import { ClientAddressService } from '../../api/services/client-address.service';
import { TokenOwnerType } from '../../auth/auth.constants';
import { UserRole } from '../../users/users.constants';
import {
	CommandAcknowledgementTraceConfig,
	CommandAcknowledgementTraceService,
} from '../services/command-acknowledgement-trace.service';
import { CommandEventRegistryService } from '../services/command-event-registry.service';
import { WsAuthService } from '../services/ws-auth.service';

import { WebsocketGateway } from './websocket.gateway';

const config: CommandAcknowledgementTraceConfig = {
	schemaVersion: 1,
	runId: '3ee8098a-25d0-4f18-9802-ae9c9238ee01',
	target: {
		deviceId: '3ee8098a-25d0-4f18-9802-ae9c9238ee02',
		channelId: '3ee8098a-25d0-4f18-9802-ae9c9238ee03',
		propertyId: '3ee8098a-25d0-4f18-9802-ae9c9238ee04',
	},
	requests: [
		{ phase: 'trial', requestId: '3ee8098a-25d0-4f18-9802-ae9c9238ee05', value: true },
		{ phase: 'restoration', requestId: '3ee8098a-25d0-4f18-9802-ae9c9238ee06', value: false },
	],
	exportPath: '/private/command-acknowledgement-trace.integration.json',
};

class LoopbackSocket extends EventEmitter {
	readonly id = 'loopback-socket';
	readonly data = {
		user: {
			id: null,
			role: UserRole.USER,
			type: 'token' as const,
			ownerType: TokenOwnerType.DISPLAY,
			tokenId: 'loopback-token',
		},
	};
	readonly handshake = { headers: {}, address: '127.0.0.1' };
	readonly request = { headers: {}, socket: { remoteAddress: '127.0.0.1' } };
	private readonly middleware: ((packet: unknown[], next: (error?: Error) => void) => void)[] = [];

	use(callback: (packet: unknown[], next: (error?: Error) => void) => void): this {
		this.middleware.push(callback);
		return this;
	}

	join(): Promise<void> {
		return Promise.resolve();
	}

	disconnect(): this {
		this.emit('disconnect', 'server namespace disconnect');
		return this;
	}

	dispatch(message: unknown, acknowledgement?: (...args: unknown[]) => unknown): void {
		const packet = acknowledgement === undefined ? ['command', message] : ['command', message, acknowledgement];
		let index = 0;
		const next = (): void => {
			const middleware = this.middleware[index++];
			if (middleware === undefined) {
				if (packet.length === 2) {
					this.emit('command', packet[1]);
				} else {
					this.emit('command', packet[1], packet[2]);
				}
				return;
			}
			middleware(packet, next);
		};
		next();
	}
}

describe('WebsocketGateway acknowledgement trace adapter loopback', () => {
	let directory: string;
	let traces: CommandAcknowledgementTraceService[];

	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), 'command-ack-trace-adapter-'));
		traces = [];
	});

	afterEach(async () => {
		for (const trace of traces) {
			trace.onModuleDestroy();
		}
		await Promise.all(traces.map((trace) => trace.waitForExports()));
		await rm(directory, { force: true, recursive: true });
	});

	const createTrace = (): CommandAcknowledgementTraceService => {
		const trace = new CommandAcknowledgementTraceService({ ...config, exportPath: join(directory, 'trace.json') });
		traces.push(trace);
		return trace;
	};

	const commandFor = (phase: 'trial' | 'restoration'): Record<string, unknown> => {
		const request = config.requests.find((candidate) => candidate.phase === phase);
		if (request === undefined) {
			throw new Error(`No configured ${phase} request.`);
		}
		return {
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
		};
	};

	it.each([
		['resolved handler', 'resolved'],
		['null handler', 'null'],
		['rejected handler', 'rejected'],
		['missing acknowledgement callback', 'missing-acknowledgement'],
		['unsupported command event', 'unsupported-event'],
		['socket close after a command', 'socket-close'],
	] as const)('preserves the real Nest automatic acknowledgement path for %s', async (_label, caseName) => {
		const trace = createTrace();
		const socket = new LoopbackSocket();
		const handler = jest.fn();
		const registry = {
			has: jest.fn().mockReturnValue(caseName !== 'unsupported-event'),
			get: jest.fn().mockReturnValue([
				{
					name: 'DevicesModule.Internal.SetPropertyValue',
					handler,
					requiredRoles: undefined,
				},
			]),
		};
		if (caseName === 'resolved' || caseName === 'socket-close') {
			handler.mockResolvedValue({ success: true });
		} else if (caseName === 'null') {
			handler.mockResolvedValue(null);
		} else if (caseName === 'rejected') {
			handler.mockRejectedValue(new Error('expected synthetic rejection'));
		}

		const gateway = new WebsocketGateway(
			registry as unknown as CommandEventRegistryService,
			new EventEmitter2(),
			{} as WsAuthService,
			{ resolve: () => ({ address: '127.0.0.1' }) } as unknown as ClientAddressService,
			trace,
		);
		await gateway.handleConnection(socket as unknown as Socket);

		const adapter = new IoAdapter();
		adapter.bindMessageHandlers(
			socket as unknown as Socket,
			[
				{
					message: 'command',
					methodName: 'handleCommand',
					callback: (message: unknown, _acknowledgement: unknown) =>
						gateway.handleCommand(message as never, socket as unknown as Socket),
					isAckHandledManually: false,
				},
			],
			(result) => from(Promise.resolve(result)),
		);

		const acknowledgement = jest.fn();
		socket.dispatch(commandFor('trial'), caseName === 'missing-acknowledgement' ? undefined : acknowledgement);
		await new Promise<void>((resolve) => setImmediate(resolve));
		await new Promise<void>((resolve) => setImmediate(resolve));

		if (caseName === 'socket-close') {
			socket.emit('disconnect', 'transport close');
		}

		const snapshot = trace.getSnapshot();
		expect(snapshot?.requests[0]).toMatchObject({ phase: 'trial', status: 'received' });
		if (caseName === 'missing-acknowledgement') {
			expect(snapshot?.requests[0]).toMatchObject({ acknowledgementCalls: 0 });
		} else {
			expect(acknowledgement).toHaveBeenCalledTimes(1);
			if (caseName === 'null') {
				expect(acknowledgement).toHaveBeenCalledWith({
					status: 'ok',
					message: 'Event handled successfully',
					results: [],
				});
			} else if (caseName === 'rejected') {
				expect(acknowledgement).toHaveBeenCalledWith({
					status: 'ok',
					message: 'Event handled successfully',
					results: [
						{
							handler: 'DevicesModule.Internal.SetPropertyValue',
							success: false,
							reason: 'Internal error',
						},
					],
				});
			} else if (caseName === 'unsupported-event') {
				expect(acknowledgement).toHaveBeenCalledWith({
					status: 'error',
					message: "Event 'DevicesModule.ChannelProperty.Set' is not supported.",
				});
			} else {
				expect(acknowledgement).toHaveBeenCalledWith({
					status: 'ok',
					message: 'Event handled successfully',
					results: [{ handler: 'DevicesModule.Internal.SetPropertyValue', success: true }],
				});
			}
			expect(snapshot?.requests[0]).toMatchObject({ acknowledgementCalls: 1 });
		}
		if (caseName === 'rejected') {
			expect(snapshot?.records).toEqual(
				expect.arrayContaining([expect.objectContaining({ stage: 'handler-settled' })]),
			);
		}
		if (caseName === 'socket-close') {
			expect(snapshot).toMatchObject({ state: 'closed', cutoffReason: 'socket-closed' });
		}
	});
});
