/*
eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment
*/
import { Test, TestingModule } from '@nestjs/testing';

import { CommandEventRegistryService } from '../../websocket/services/command-event-registry.service';
import { PropertyCommandService } from '../services/property-command.service';

import { DevicesWsEventType, DevicesWsHandlerName, WebsocketExchangeListener } from './websocket-exchange.listener';

describe('WebsocketExchangeListener (Devices)', () => {
	let listener: WebsocketExchangeListener;
	let commandEventRegistry: jest.Mocked<CommandEventRegistryService>;
	let propertyCommandService: jest.Mocked<PropertyCommandService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				WebsocketExchangeListener,
				{
					provide: CommandEventRegistryService,
					useValue: {
						register: jest.fn(),
					},
				},
				{
					provide: PropertyCommandService,
					useValue: {
						handleInternal: jest.fn(),
					},
				},
			],
		}).compile();

		listener = module.get<WebsocketExchangeListener>(WebsocketExchangeListener);
		commandEventRegistry = module.get(CommandEventRegistryService);
		propertyCommandService = module.get(PropertyCommandService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(listener).toBeDefined();
	});

	describe('onModuleInit', () => {
		it('should register command handler for set property', () => {
			listener.onModuleInit();

			expect(commandEventRegistry.register).toHaveBeenCalledWith(
				DevicesWsEventType.SET_PROPERTY,
				DevicesWsHandlerName.SET_PROPERTY,
				expect.any(Function),
			);
		});
	});

	describe('handleSetProperty', () => {
		let handleSetProperty: (user: any, payload: any) => Promise<any>;

		beforeEach(() => {
			listener.onModuleInit();
			// Extract the registered handler
			handleSetProperty = commandEventRegistry.register.mock.calls[0][2];
		});

		it('should return success with results data on successful command', async () => {
			const mockUser = { id: 'user-123', type: 'token', ownerType: 'display' };
			const mockPayload = {
				properties: [{ device: 'dev-1', channel: 'ch-1', property: 'prop-1', value: true }],
			};

			propertyCommandService.handleInternal.mockResolvedValue({
				success: true,
				results: [{ device: 'dev-1', success: true }],
			});

			const result = await handleSetProperty(mockUser, mockPayload);

			expect(result).toEqual({
				success: true,
				reason: undefined,
				data: {
					results: [{ device: 'dev-1', success: true }],
				},
			});
			expect(propertyCommandService.handleInternal).toHaveBeenCalledWith(mockUser, mockPayload);
		});

		it('should return error with reason when command fails with string result', async () => {
			const mockUser = { id: 'user-123', type: 'token', ownerType: 'display' };
			const mockPayload = { properties: [] };

			propertyCommandService.handleInternal.mockResolvedValue({
				success: false,
				results: 'Invalid payload',
			});

			const result = await handleSetProperty(mockUser, mockPayload);

			expect(result).toEqual({
				success: false,
				reason: 'Invalid payload',
				data: undefined,
			});
		});

		it('should return error when service throws exception', async () => {
			const mockUser = { id: 'user-123', type: 'token', ownerType: 'display' };
			const mockPayload = { properties: [] };

			propertyCommandService.handleInternal.mockRejectedValue(new Error('Service error'));

			const result = await handleSetProperty(mockUser, mockPayload);

			expect(result).toEqual({
				success: false,
				reason: 'Service error',
			});
		});

		it('should pass undefined payload to service', async () => {
			const mockUser = { id: 'user-123', type: 'token', ownerType: 'display' };

			propertyCommandService.handleInternal.mockResolvedValue({
				success: false,
				results: 'Invalid payload',
			});

			await handleSetProperty(mockUser, undefined);

			expect(propertyCommandService.handleInternal).toHaveBeenCalledWith(mockUser, undefined);
		});
	});
});
