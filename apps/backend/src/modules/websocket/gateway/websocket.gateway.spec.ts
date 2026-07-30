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

import { TokenOwnerType } from '../../auth/auth.constants';
import { UserRole } from '../../users/users.constants';
import { ClientUserDto } from '../dto/client-user.dto';
import { CommandMessageDto } from '../dto/command-message.dto';
import { CommandEventRegistryService } from '../services/command-event-registry.service';
import { WsAuthService } from '../services/ws-auth.service';
import { WebsocketNotAllowedException } from '../websocket.exceptions';

import { WebsocketGateway } from './websocket.gateway';

describe('WebsocketGateway', () => {
	let gateway: WebsocketGateway;
	let eventRegistry: CommandEventRegistryService;
	let wsAuthService: WsAuthService;
	let eventEmitter: EventEmitter2;

	const mockServer = {
		emit: jest.fn(),
		use: jest.fn(),
	} as unknown as Server;

	/** Runs the handshake middleware the gateway registered and reports what it passed to next(). */
	const runHandshakeMiddleware = async (socket: Socket): Promise<Error | undefined> => {
		gateway.afterInit();

		const middleware = (mockServer.use as jest.Mock).mock.calls[0][0] as (
			socket: Socket,
			next: (err?: Error) => void,
		) => void;

		return new Promise<Error | undefined>((resolve) => {
			middleware(socket, (err?: Error) => resolve(err));
		});
	};

	const mockClientUser: ClientUserDto = {
		id: null,
		role: UserRole.USER,
		type: 'token',
		ownerType: TokenOwnerType.DISPLAY,
		tokenId: 'mock-token-id',
	};

	const mockSocket = {
		id: 'test-socket-id',
		join: jest.fn().mockResolvedValue(undefined),
		emit: jest.fn(),
		disconnect: jest.fn(),
		data: {
			user: mockClientUser,
		},
		request: {
			headers: {},
			socket: {
				remoteAddress: '127.0.0.1',
			},
		},
		handshake: {
			headers: {},
			address: '127.0.0.1',
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
						emit: jest.fn(),
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
		wsAuthService = module.get<WsAuthService>(WsAuthService);
		eventEmitter = module.get<EventEmitter2>(EventEmitter2);

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
		it('should not throw when the gateway starts', () => {
			expect(() => gateway.afterInit()).not.toThrow();
		});

		it('should register a handshake middleware', () => {
			gateway.afterInit();

			expect(mockServer.use).toHaveBeenCalledTimes(1);
		});
	});

	describe('handshake authentication', () => {
		it('should admit a client with valid credentials', async () => {
			jest.spyOn(wsAuthService, 'validateClient').mockResolvedValue(true);

			await expect(runHandshakeMiddleware(mockSocket)).resolves.toBeUndefined();

			expect(mockSocket.disconnect).not.toHaveBeenCalled();
		});

		it('should refuse a client with no credentials before it is admitted', async () => {
			jest.spyOn(wsAuthService, 'validateClient').mockResolvedValue(false);

			const error = await runHandshakeMiddleware(mockSocket);

			expect(error).toBeInstanceOf(Error);
			// The panel classifies an auth failure by matching the message, so the wording is
			// part of the contract rather than cosmetic.
			expect(error?.message.toLowerCase()).toContain('unauthorized');

			// Refusing during the handshake means the socket is never admitted, so there is
			// nothing to disconnect and no room to leave.
			expect(mockSocket.disconnect).not.toHaveBeenCalled();
			expect(mockSocket.join).not.toHaveBeenCalled();
		});

		it('should refuse a client whose token validation throws', async () => {
			jest
				.spyOn(wsAuthService, 'validateClient')
				.mockRejectedValue(new WebsocketNotAllowedException('Invalid or expired token'));

			const error = await runHandshakeMiddleware(mockSocket);

			expect(error).toBeInstanceOf(Error);
			expect(mockSocket.join).not.toHaveBeenCalled();
		});
	});

	describe('handleConnection', () => {
		it('should log when a client connects and join the default room', async () => {
			const logSpy = jest.spyOn(Logger.prototype, 'log');

			await gateway.handleConnection(mockSocket);

			expect(logSpy).toHaveBeenCalledWith(
				`[WebsocketGateway] Client connected: ${mockSocket.id}`,
				expect.objectContaining({ tag: 'websocket-module' }),
			);
			expect(mockSocket.join).toHaveBeenCalledWith('default-room');
		});

		it('should not re-authenticate a client the handshake already cleared', async () => {
			const validateSpy = jest.spyOn(wsAuthService, 'validateClient');

			await gateway.handleConnection(mockSocket);

			expect(validateSpy).not.toHaveBeenCalled();
			expect(eventEmitter.emit).toHaveBeenCalled();
		});
	});

	describe('handleDisconnect', () => {
		it('should log when a client disconnects', () => {
			const logSpy = jest.spyOn(Logger.prototype, 'log');

			gateway.handleDisconnect(mockSocket);

			expect(logSpy).toHaveBeenCalledWith(
				`[WebsocketGateway] Client disconnected: ${mockSocket.id}`,
				expect.objectContaining({ tag: 'websocket-module' }),
			);
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
		it('should emit a message to the clients', () => {
			const event = 'DevicesModule.Property.Updated';
			const payload = { id: '1', value: 'test' };

			gateway.sendMessage(event, payload);

			// Check that the emit call was made correctly
			expect(mockServer.emit).toHaveBeenCalledWith('event', {
				event,
				payload,
				metadata: { timestamp: expect.any(String) },
			});
		});
	});
});
