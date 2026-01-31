/*
eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment,
@typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unnecessary-type-assertion
*/
import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';

import { TokenOwnerType } from '../../auth/auth.constants';
import { UserRole } from '../../users/users.constants';
import { ClientUserDto } from '../../websocket/dto/client-user.dto';
import { CommandEventRegistryService } from '../../websocket/services/command-event-registry.service';
import { SpaceEntity } from '../entities/space.entity';
import { SpaceIntentService } from '../services/space-intent.service';
import { SpaceUndoHistoryService } from '../services/space-undo-history.service';
import { SpacesService } from '../services/spaces.service';
import { ClimateMode, SpaceType } from '../spaces.constants';

import { SpacesWsEventType, SpacesWsHandlerName, WebsocketExchangeListener } from './websocket-exchange.listener';

describe('WebsocketExchangeListener (Spaces)', () => {
	let listener: WebsocketExchangeListener;
	let commandEventRegistry: jest.Mocked<CommandEventRegistryService>;
	let spacesService: jest.Mocked<SpacesService>;
	let spaceIntentService: jest.Mocked<SpaceIntentService>;
	let undoHistoryService: jest.Mocked<SpaceUndoHistoryService>;

	const mockSpace: Partial<SpaceEntity> = {
		id: uuid(),
		name: 'Living Room',
		type: SpaceType.ROOM,
	};

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
					provide: SpacesService,
					useValue: {
						findOne: jest.fn(),
					},
				},
				{
					provide: SpaceIntentService,
					useValue: {
						executeLightingIntent: jest.fn(),
						executeClimateIntent: jest.fn(),
						executeCoversIntent: jest.fn(),
					},
				},
				{
					provide: SpaceUndoHistoryService,
					useValue: {
						executeUndo: jest.fn(),
					},
				},
			],
		}).compile();

		listener = module.get<WebsocketExchangeListener>(WebsocketExchangeListener);
		commandEventRegistry = module.get(CommandEventRegistryService);
		spacesService = module.get(SpacesService);
		spaceIntentService = module.get(SpaceIntentService);
		undoHistoryService = module.get(SpaceUndoHistoryService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(listener).toBeDefined();
	});

	describe('onModuleInit', () => {
		it('should register all command handlers', () => {
			listener.onModuleInit();

			// Note: Media domain uses activity-based architecture via SpaceMediaActivityService
			expect(commandEventRegistry.register).toHaveBeenCalledTimes(4);
			expect(commandEventRegistry.register).toHaveBeenCalledWith(
				SpacesWsEventType.LIGHTING_INTENT,
				SpacesWsHandlerName.LIGHTING_INTENT,
				expect.any(Function),
			);
			expect(commandEventRegistry.register).toHaveBeenCalledWith(
				SpacesWsEventType.CLIMATE_INTENT,
				SpacesWsHandlerName.CLIMATE_INTENT,
				expect.any(Function),
			);
			expect(commandEventRegistry.register).toHaveBeenCalledWith(
				SpacesWsEventType.COVERS_INTENT,
				SpacesWsHandlerName.COVERS_INTENT,
				expect.any(Function),
			);
			expect(commandEventRegistry.register).toHaveBeenCalledWith(
				SpacesWsEventType.UNDO_INTENT,
				SpacesWsHandlerName.UNDO_INTENT,
				expect.any(Function),
			);
		});
	});

	describe('handleLightingIntent', () => {
		let handleLightingIntent: (user: any, payload: any) => Promise<any>;

		beforeEach(() => {
			listener.onModuleInit();
			// Find the lighting intent handler
			const call = commandEventRegistry.register.mock.calls.find((c) => c[0] === SpacesWsEventType.LIGHTING_INTENT);
			handleLightingIntent = call![2];
		});

		it('should return unauthorized for undefined user', async () => {
			const result = await handleLightingIntent(undefined, { spaceId: 'space-1', intent: { type: 'on' } });

			expect(result).toEqual({
				success: false,
				reason: 'Unauthorized: insufficient permissions',
			});
		});

		it('should return unauthorized for regular user', async () => {
			const user = createMockUser({ type: 'user', role: UserRole.USER, ownerType: undefined });

			const result = await handleLightingIntent(user, { spaceId: 'space-1', intent: { type: 'on' } });

			expect(result).toEqual({
				success: false,
				reason: 'Unauthorized: insufficient permissions',
			});
		});

		it('should allow display client', async () => {
			const user = createMockUser({ type: 'token', ownerType: TokenOwnerType.DISPLAY });

			spacesService.findOne.mockResolvedValue(mockSpace as SpaceEntity);
			spaceIntentService.executeLightingIntent.mockResolvedValue({
				success: true,
				affectedDevices: 2,
				failedDevices: 0,
			});

			const result = await handleLightingIntent(user, { spaceId: mockSpace.id, intent: { type: 'on' } });

			expect(result.success).toBe(true);
		});

		it('should allow admin user', async () => {
			const user = createMockUser({ type: 'user', role: UserRole.ADMIN, ownerType: undefined });

			spacesService.findOne.mockResolvedValue(mockSpace as SpaceEntity);
			spaceIntentService.executeLightingIntent.mockResolvedValue({
				success: true,
				affectedDevices: 1,
				failedDevices: 0,
			});

			const result = await handleLightingIntent(user, { spaceId: mockSpace.id, intent: { type: 'on' } });

			expect(result.success).toBe(true);
		});

		it('should allow owner user', async () => {
			const user = createMockUser({ type: 'user', role: UserRole.OWNER, ownerType: undefined });

			spacesService.findOne.mockResolvedValue(mockSpace as SpaceEntity);
			spaceIntentService.executeLightingIntent.mockResolvedValue({
				success: true,
				affectedDevices: 1,
				failedDevices: 0,
			});

			const result = await handleLightingIntent(user, { spaceId: mockSpace.id, intent: { type: 'on' } });

			expect(result.success).toBe(true);
		});

		it('should return error when spaceId is missing', async () => {
			const user = createMockUser();

			const result = await handleLightingIntent(user, { intent: { type: 'on' } });

			expect(result).toEqual({
				success: false,
				reason: 'Space ID is required',
			});
		});

		it('should return error when intent is missing', async () => {
			const user = createMockUser();

			const result = await handleLightingIntent(user, { spaceId: 'space-1' });

			expect(result).toEqual({
				success: false,
				reason: 'Intent with type is required',
			});
		});

		it('should return error when space not found', async () => {
			const user = createMockUser();

			spacesService.findOne.mockResolvedValue(null);

			const result = await handleLightingIntent(user, { spaceId: 'invalid-id', intent: { type: 'on' } });

			expect(result).toEqual({
				success: false,
				reason: 'Space with id=invalid-id was not found',
			});
		});

		it('should return success with data on successful execution', async () => {
			const user = createMockUser();

			spacesService.findOne.mockResolvedValue(mockSpace as SpaceEntity);
			spaceIntentService.executeLightingIntent.mockResolvedValue({
				success: true,
				affectedDevices: 3,
				failedDevices: 1,
				skippedOfflineDevices: 2,
				offlineDeviceIds: ['device-1', 'device-2'],
				failedTargets: ['device-3'],
			});

			const result = await handleLightingIntent(user, { spaceId: mockSpace.id, intent: { type: 'on' } });

			expect(result).toEqual({
				success: true,
				data: {
					success: true,
					affected_devices: 3,
					failed_devices: 1,
					skipped_offline_devices: 2,
					offline_device_ids: ['device-1', 'device-2'],
					failed_targets: ['device-3'],
				},
			});
		});

		it('should return error when execution fails', async () => {
			const user = createMockUser();

			spacesService.findOne.mockResolvedValue(mockSpace as SpaceEntity);
			spaceIntentService.executeLightingIntent.mockResolvedValue(null);

			const result = await handleLightingIntent(user, { spaceId: mockSpace.id, intent: { type: 'on' } });

			expect(result).toEqual({
				success: false,
				reason: 'Failed to execute lighting intent',
			});
		});

		it('should handle service exceptions', async () => {
			const user = createMockUser();

			spacesService.findOne.mockRejectedValue(new Error('Database error'));

			const result = await handleLightingIntent(user, { spaceId: mockSpace.id, intent: { type: 'on' } });

			expect(result).toEqual({
				success: false,
				reason: 'Database error',
			});
		});
	});

	describe('handleClimateIntent', () => {
		let handleClimateIntent: (user: any, payload: any) => Promise<any>;

		beforeEach(() => {
			listener.onModuleInit();
			const call = commandEventRegistry.register.mock.calls.find((c) => c[0] === SpacesWsEventType.CLIMATE_INTENT);
			handleClimateIntent = call![2];
		});

		it('should return unauthorized for undefined user', async () => {
			const result = await handleClimateIntent(undefined, { spaceId: 'space-1', intent: { type: 'setpoint' } });

			expect(result).toEqual({
				success: false,
				reason: 'Unauthorized: insufficient permissions',
			});
		});

		it('should return success with climate data', async () => {
			const user = createMockUser();

			spacesService.findOne.mockResolvedValue(mockSpace as SpaceEntity);
			spaceIntentService.executeClimateIntent.mockResolvedValue({
				success: true,
				affectedDevices: 2,
				failedDevices: 0,
				skippedOfflineDevices: 1,
				offlineDeviceIds: ['thermostat-1'],
				failedTargets: [],
				heatingSetpoint: 22,
				coolingSetpoint: 24,
				mode: ClimateMode.HEAT,
			});

			const result = await handleClimateIntent(user, { spaceId: mockSpace.id, intent: { type: 'setpoint' } });

			expect(result).toEqual({
				success: true,
				data: {
					success: true,
					affected_devices: 2,
					failed_devices: 0,
					skipped_offline_devices: 1,
					offline_device_ids: ['thermostat-1'],
					failed_targets: [],
					heating_setpoint: 22,
					cooling_setpoint: 24,
					mode: ClimateMode.HEAT,
				},
			});
		});
	});

	describe('handleCoversIntent', () => {
		let handleCoversIntent: (user: any, payload: any) => Promise<any>;

		beforeEach(() => {
			listener.onModuleInit();
			const call = commandEventRegistry.register.mock.calls.find((c) => c[0] === SpacesWsEventType.COVERS_INTENT);
			handleCoversIntent = call![2];
		});

		it('should return unauthorized for undefined user', async () => {
			const result = await handleCoversIntent(undefined, { spaceId: 'space-1', intent: { type: 'open' } });

			expect(result).toEqual({
				success: false,
				reason: 'Unauthorized: insufficient permissions',
			});
		});

		it('should return success with covers data', async () => {
			const user = createMockUser();

			spacesService.findOne.mockResolvedValue(mockSpace as SpaceEntity);
			spaceIntentService.executeCoversIntent.mockResolvedValue({
				success: true,
				affectedDevices: 1,
				failedDevices: 0,
				skippedOfflineDevices: 0,
				offlineDeviceIds: [],
				failedTargets: [],
				newPosition: 100,
			});

			const result = await handleCoversIntent(user, { spaceId: mockSpace.id, intent: { type: 'open' } });

			expect(result).toEqual({
				success: true,
				data: {
					success: true,
					affected_devices: 1,
					failed_devices: 0,
					skipped_offline_devices: 0,
					offline_device_ids: [],
					failed_targets: [],
					new_position: 100,
				},
			});
		});
	});

	// Note: Media domain now uses routing-based architecture via SpaceMediaRoutingService

	describe('handleUndoIntent', () => {
		let handleUndoIntent: (user: any, payload: any) => Promise<any>;

		beforeEach(() => {
			listener.onModuleInit();
			const call = commandEventRegistry.register.mock.calls.find((c) => c[0] === SpacesWsEventType.UNDO_INTENT);
			handleUndoIntent = call![2];
		});

		it('should return unauthorized for undefined user', async () => {
			const result = await handleUndoIntent(undefined, { spaceId: 'space-1' });

			expect(result).toEqual({
				success: false,
				reason: 'Unauthorized: insufficient permissions',
			});
		});

		it('should return success with undo data', async () => {
			const user = createMockUser();

			spacesService.findOne.mockResolvedValue(mockSpace as SpaceEntity);
			undoHistoryService.executeUndo.mockResolvedValue({
				success: true,
				restoredDevices: 2,
				failedDevices: 0,
				message: 'Undo successful',
			});

			const result = await handleUndoIntent(user, { spaceId: mockSpace.id });

			expect(result).toEqual({
				success: true,
				data: {
					success: true,
					restored_devices: 2,
					failed_devices: 0,
					message: 'Undo successful',
				},
			});
		});

		it('should return error when no undo available', async () => {
			const user = createMockUser();

			spacesService.findOne.mockResolvedValue(mockSpace as SpaceEntity);
			undoHistoryService.executeUndo.mockResolvedValue(null);

			const result = await handleUndoIntent(user, { spaceId: mockSpace.id });

			expect(result).toEqual({
				success: false,
				reason: 'No undo available or undo failed',
			});
		});
	});
});
