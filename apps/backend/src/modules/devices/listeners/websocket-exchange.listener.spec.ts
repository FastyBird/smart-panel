/*
eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment,
@typescript-eslint/no-unsafe-member-access
*/
import { Test, TestingModule } from '@nestjs/testing';

import { TokenOwnerType } from '../../auth/auth.constants';
import { UserRole } from '../../users/users.constants';
import { ClientUserDto } from '../../websocket/dto/client-user.dto';
import { CommandEventRegistryService } from '../../websocket/services/command-event-registry.service';
import { PropertyCommandService } from '../services/property-command.service';

import { DevicesWsEventType, DevicesWsHandlerName, WebsocketExchangeListener } from './websocket-exchange.listener';

describe('WebsocketExchangeListener (Devices)', () => {
	let listener: WebsocketExchangeListener;
	let commandEventRegistry: jest.Mocked<CommandEventRegistryService>;
	let propertyCommandService: jest.Mocked<PropertyCommandService>;

	const createMockUser = (overrides: Partial<ClientUserDto> = {}): ClientUserDto => ({
		id: 'user-123',
		role: UserRole.USER,
		type: 'token',
		ownerType: TokenOwnerType.DISPLAY,
		...overrides,
	});

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

		it('should return unauthorized for undefined user', async () => {
			const result = await handleSetProperty(undefined, { properties: [] });

			expect(result).toEqual({
				success: false,
				reason: 'Unauthorized: insufficient permissions',
			});
			expect(propertyCommandService.handleInternal).not.toHaveBeenCalled();
		});

		it('should return unauthorized for regular user', async () => {
			const user = createMockUser({ type: 'user', role: UserRole.USER, ownerType: undefined });

			const result = await handleSetProperty(user, { properties: [] });

			expect(result).toEqual({
				success: false,
				reason: 'Unauthorized: insufficient permissions',
			});
			expect(propertyCommandService.handleInternal).not.toHaveBeenCalled();
		});

		it('should allow display client', async () => {
			const user = createMockUser({ type: 'token', ownerType: TokenOwnerType.DISPLAY });
			const mockPayload = { properties: [] };

			propertyCommandService.handleInternal.mockResolvedValue({
				success: true,
				results: [],
			});

			const result = await handleSetProperty(user, mockPayload);

			expect(result.success).toBe(true);
			expect(propertyCommandService.handleInternal).toHaveBeenCalledWith(user, mockPayload);
		});

		it('should allow admin user', async () => {
			const user = createMockUser({ type: 'user', role: UserRole.ADMIN, ownerType: undefined });
			const mockPayload = { properties: [] };

			propertyCommandService.handleInternal.mockResolvedValue({
				success: true,
				results: [],
			});

			const result = await handleSetProperty(user, mockPayload);

			expect(result.success).toBe(true);
			expect(propertyCommandService.handleInternal).toHaveBeenCalledWith(user, mockPayload);
		});

		it('should allow owner user', async () => {
			const user = createMockUser({ type: 'user', role: UserRole.OWNER, ownerType: undefined });
			const mockPayload = { properties: [] };

			propertyCommandService.handleInternal.mockResolvedValue({
				success: true,
				results: [],
			});

			const result = await handleSetProperty(user, mockPayload);

			expect(result.success).toBe(true);
			expect(propertyCommandService.handleInternal).toHaveBeenCalledWith(user, mockPayload);
		});

		it('should return success with results data on successful command', async () => {
			const user = createMockUser();
			const mockPayload = {
				properties: [{ device: 'dev-1', channel: 'ch-1', property: 'prop-1', value: true }],
			};

			propertyCommandService.handleInternal.mockResolvedValue({
				success: true,
				results: [{ device: 'dev-1', success: true }],
			});

			const result = await handleSetProperty(user, mockPayload);

			expect(result).toEqual({
				success: true,
				reason: undefined,
				data: {
					results: [{ device: 'dev-1', success: true }],
				},
			});
			expect(propertyCommandService.handleInternal).toHaveBeenCalledWith(user, mockPayload);
		});

		it('should return error with reason when command fails with string result', async () => {
			const user = createMockUser();
			const mockPayload = { properties: [] };

			propertyCommandService.handleInternal.mockResolvedValue({
				success: false,
				results: 'Invalid payload',
			});

			const result = await handleSetProperty(user, mockPayload);

			expect(result).toEqual({
				success: false,
				reason: 'Invalid payload',
				data: undefined,
			});
		});

		it('should return error when service throws exception', async () => {
			const user = createMockUser();
			const mockPayload = { properties: [] };

			propertyCommandService.handleInternal.mockRejectedValue(new Error('Service error'));

			const result = await handleSetProperty(user, mockPayload);

			expect(result).toEqual({
				success: false,
				reason: 'Service error',
			});
		});

		it('should pass undefined payload to service', async () => {
			const user = createMockUser();

			propertyCommandService.handleInternal.mockResolvedValue({
				success: false,
				results: 'Invalid payload',
			});

			await handleSetProperty(user, undefined);

			expect(propertyCommandService.handleInternal).toHaveBeenCalledWith(user, undefined);
		});
	});
});
