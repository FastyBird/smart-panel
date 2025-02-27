/*
eslint-disable @typescript-eslint/unbound-method,
@typescript-eslint/no-unsafe-member-access,
@typescript-eslint/no-unsafe-assignment
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Server, Socket } from 'socket.io';

import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { UserRole } from '../../users/users.constants';
import { ClientUserDto } from '../dto/client-user.dto';
import { CommandMessageDto } from '../dto/command-message.dto';
import { CommandEventRegistryService } from '../services/command-event-registry.service';
import { WsAuthService } from '../services/ws-auth.service';

import { WebsocketGateway } from './websocket.gateway';

describe('WebsocketGateway', () => {
	let gateway: WebsocketGateway;
	let eventRegistry: CommandEventRegistryService;

	const mockServer = {
		emit: jest.fn(),
	} as unknown as Server;

	const mockClientUser: ClientUserDto = {
		id: null,
		role: UserRole.DISPLAY,
	};

	const mockSocket = {
		id: 'test-socket-id',
		join: jest.fn().mockResolvedValue(undefined),
		emit: jest.fn(),
		disconnect: jest.fn(),
		data: {
			user: mockClientUser,
		},
	} as unknown as Socket;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				WebsocketGateway,
				{
					provide: CommandEventRegistryService,
					useValue: {
						has: jest.fn(),
						get: jest.fn(),
					},
				},
				{
					provide: EventEmitter2,
					useValue: {
						onAny: jest.fn(),
					},
				},
				{
					provide: WsAuthService,
					useValue: {
						validateClient: jest.fn(),
					},
				},
			],
		}).compile();

		gateway = module.get<WebsocketGateway>(WebsocketGateway);
		eventRegistry = module.get<CommandEventRegistryService>(CommandEventRegistryService);

		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

		// Assign mock server
		(gateway as any).server = mockServer;

		// Enable gateway
		gateway.enable();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(gateway).toBeDefined();
		expect(eventRegistry).toBeDefined();
	});

	describe('afterInit', () => {
		it('should log when the gateway starts', () => {
			const logSpy = jest.spyOn(Logger.prototype, 'debug');

			gateway.afterInit();

			expect(logSpy).toHaveBeenCalledWith('[WS GATEWAY] Websockets gateway started');
		});
	});

	describe('handleConnection', () => {
		it('should log when a client connects and join the default room', async () => {
			const logSpy = jest.spyOn(Logger.prototype, 'log');

			await gateway.handleConnection(mockSocket);

			expect(logSpy).toHaveBeenCalledWith(`[WS GATEWAY] Client connected: ${mockSocket.id}`);
			expect(mockSocket.join).toHaveBeenCalledWith('default-room');
		});
	});

	describe('handleDisconnect', () => {
		it('should log when a client disconnects', () => {
			const logSpy = jest.spyOn(Logger.prototype, 'log');

			gateway.handleDisconnect(mockSocket);

			expect(logSpy).toHaveBeenCalledWith(`[WS GATEWAY] Client disconnected: ${mockSocket.id}`);
		});
	});

	describe('handleCommand', () => {
		it('should warn and emit an error if no handlers exist for the event', async () => {
			jest.spyOn(eventRegistry, 'has').mockReturnValue(false);

			const mockMessage: CommandMessageDto = { event: 'unknown.event', payload: {} };

			const result = await gateway.handleCommand(mockMessage, mockSocket);

			expect(eventRegistry.has).toHaveBeenCalledWith(mockMessage.event);
			expect(result).toEqual({
				status: 'error',
				message: `Event '${mockMessage.event}' is not supported.`,
			});
		});

		it('should call all registered handlers and emit a success response', async () => {
			const mockHandler = {
				name: 'HandlerName',
				handler: jest.fn().mockResolvedValue({ success: true, result: 'handler result' }),
			};
			jest.spyOn(eventRegistry, 'has').mockReturnValue(true);
			jest.spyOn(eventRegistry, 'get').mockReturnValue([mockHandler]);

			const mockMessage: CommandMessageDto = { event: 'DevicesModule.Property.Updated', payload: { id: '1' } };

			const result = await gateway.handleCommand(mockMessage, mockSocket);

			expect(eventRegistry.get).toHaveBeenCalledWith(mockMessage.event);
			expect(mockHandler.handler).toHaveBeenCalledWith(mockClientUser, mockMessage.payload);
			expect(result).toEqual({
				status: 'ok',
				message: 'Event handled successfully',
				results: [{ handler: mockHandler.name, success: true, result: 'handler result' }],
			});
		});

		it('should log an error and emit an error response if a handler throws', async () => {
			const mockHandler = { name: 'HandlerName', handler: jest.fn().mockRejectedValue(new Error('Handler error')) };
			jest.spyOn(eventRegistry, 'has').mockReturnValue(true);
			jest.spyOn(eventRegistry, 'get').mockReturnValue([mockHandler]);

			const mockMessage: CommandMessageDto = { event: 'DevicesModule.Property.Updated', payload: { id: '1' } };

			const result = await gateway.handleCommand(mockMessage, mockSocket);

			expect(result).toEqual({
				status: 'ok',
				message: 'Event handled successfully',
				results: [
					{
						handler: mockHandler.name,
						reason: 'Internal error',
						success: false,
					},
				],
			});
		});
	});

	describe('sendMessage', () => {
		it('should log and emit a message to the clients', () => {
			const logSpy = jest.spyOn(Logger.prototype, 'debug');
			const event = 'DevicesModule.Property.Updated';
			const payload = { id: '1', value: 'test' };

			gateway.sendMessage(event, payload);

			const logMessage = logSpy.mock.calls[0][0]; // Capture the logged message

			// Check that the log message contains the correct structure
			expect(logMessage).toContain(`"event":"${event}"`);
			expect(logMessage).toContain(`"payload":${JSON.stringify(payload)}`);
			expect(logMessage).toMatch(/"timestamp":"[^"]+"/); // Ensure timestamp is present and properly formatted

			// Check that the emit call was made correctly
			expect(mockServer.emit).toHaveBeenCalledWith('event', {
				event,
				payload,
				metadata: { timestamp: expect.any(String) },
			});
		});
	});
});
