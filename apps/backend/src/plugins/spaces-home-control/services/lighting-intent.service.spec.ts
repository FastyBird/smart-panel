import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import {
	ChannelCategory,
	ConnectionState,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { DEFAULT_TTL_SPACE_COMMAND } from '../../../modules/intents/intents.constants';
import { IntentTimeseriesService } from '../../../modules/intents/services/intent-timeseries.service';
import { IntentsService } from '../../../modules/intents/services/intents.service';
import { SpacesService } from '../../../modules/spaces/services/spaces.service';
import { LightingIntentDto } from '../dto/lighting-intent.dto';
import { SpaceLightingRoleEntity } from '../entities/space-lighting-role.entity';
import { LightingIntentType, LightingRole } from '../spaces-home-control.constants';
import { IntentSpecLoaderService } from '../spec';

import { LightingIntentService } from './lighting-intent.service';
import { SpaceContextSnapshotService } from './space-context-snapshot.service';
import { SpaceLightingRoleService } from './space-lighting-role.service';
import { SpaceLightingStateService } from './space-lighting-state.service';
import { SpaceUndoHistoryService } from './space-undo-history.service';

describe('LightingIntentService', () => {
	let service: LightingIntentService;
	let spacesService: jest.Mocked<SpacesService>;
	let platformRegistryService: {
		get: jest.Mock;
		getCommandTtlMs: jest.MockedFunction<PlatformRegistryService['getCommandTtlMs']>;
	};
	let lightingRoleService: jest.Mocked<SpaceLightingRoleService>;
	let intentsService: jest.Mocked<IntentsService>;

	const mockSpaceId = uuid();
	const mockIntentId = uuid();

	// Create a mock device with light channels
	const createMockDeviceWithLightChannel = (
		id: string,
		online: boolean,
		status: ConnectionState,
		role: LightingRole | null = null,
	) => ({
		id,
		name: `Light ${id}`,
		category: DeviceCategory.LIGHTING,
		type: 'test-light',
		status: { online, status },
		channels: [
			{
				id: `channel-${id}`,
				category: ChannelCategory.LIGHT,
				properties: [
					{
						id: `on-prop-${id}`,
						category: PropertyCategory.ON,
						value: false,
						permissions: [PermissionType.READ_WRITE],
					},
					{
						id: `brightness-prop-${id}`,
						category: PropertyCategory.BRIGHTNESS,
						value: 100,
						permissions: [PermissionType.READ_WRITE],
					},
				],
			},
		],
		_role: role, // Used for role map setup
	});

	const mockPlatform = {
		getType: jest.fn().mockReturnValue('test-light'),
		setPropertyValue: jest.fn().mockResolvedValue(true),
		processBatch: jest.fn().mockResolvedValue(true),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				LightingIntentService,
				{
					provide: SpacesService,
					useValue: {
						findOne: jest.fn().mockResolvedValue({ id: mockSpaceId }),
						findDevicesBySpace: jest.fn().mockResolvedValue([]),
					},
				},
				{
					provide: PlatformRegistryService,
					useValue: {
						get: jest.fn().mockReturnValue(mockPlatform),
						getCommandTtlMs: jest.fn().mockReturnValue(DEFAULT_TTL_SPACE_COMMAND),
					},
				},
				{
					provide: SpaceLightingRoleService,
					useValue: {
						getRoleMap: jest.fn().mockResolvedValue(new Map()),
					},
				},
				{
					provide: SpaceLightingStateService,
					useValue: {
						getLightingState: jest.fn().mockResolvedValue({
							hasLighting: true,
							lightsCount: 1,
							onCount: 0,
							brightness: null,
						}),
					},
				},
				{
					provide: SpaceContextSnapshotService,
					useValue: {
						captureSnapshot: jest.fn().mockResolvedValue(null),
					},
				},
				{
					provide: SpaceUndoHistoryService,
					useValue: {
						pushSnapshot: jest.fn(),
					},
				},
				{
					provide: IntentTimeseriesService,
					useValue: {
						storeLightingModeChange: jest.fn().mockResolvedValue(undefined),
						storeModeValidity: jest.fn().mockResolvedValue(undefined),
					},
				},
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(),
					},
				},
				{
					provide: IntentSpecLoaderService,
					useValue: {
						getLightingSpec: jest.fn().mockReturnValue(null),
						resolveModeOrchestration: jest.fn().mockReturnValue({
							mvpBrightness: 100,
							roleRules: new Map(),
							fallbackRule: { on: true, brightness: 100 },
						}),
						getBrightnessDeltaStep: jest.fn().mockReturnValue(null),
					},
				},
				{
					provide: IntentsService,
					useValue: {
						createIntent: jest.fn().mockReturnValue({ id: mockIntentId }),
						completeIntent: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get<LightingIntentService>(LightingIntentService);
		spacesService = module.get(SpacesService);
		platformRegistryService = module.get(PlatformRegistryService);
		lightingRoleService = module.get(SpaceLightingRoleService);
		intentsService = module.get(IntentsService);

		// Reset mocks between tests
		jest.clearAllMocks();
		mockPlatform.processBatch.mockResolvedValue(true);
	});

	it('records a supplied agent execution context while keeping the authoritative space', async () => {
		const onlineDevice = createMockDeviceWithLightChannel('online-device', true, ConnectionState.CONNECTED);

		spacesService.findDevicesBySpace.mockResolvedValue([onlineDevice] as unknown as DeviceEntity[]);
		jest.spyOn(platformRegistryService, 'getCommandTtlMs').mockReturnValueOnce(47500);

		await service.executeLightingIntent(
			mockSpaceId,
			{ type: LightingIntentType.ON },
			{ origin: 'api', extra: { source: 'mcp', actorId: 'client-1' } },
		);

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(intentsService.createIntent).toHaveBeenCalledWith(
			expect.objectContaining({
				context: {
					origin: 'api',
					spaceId: mockSpaceId,
					roleKey: undefined,
					extra: { source: 'mcp', actorId: 'client-1' },
				},
				ttlMs: 47500,
			}),
		);
		const [budgets, defaultTtlMs] = platformRegistryService.getCommandTtlMs.mock.calls[0];
		expect(budgets).toHaveLength(1);
		expect(budgets[0]?.device.id).toBe('online-device');
		expect(budgets[0]?.commandCount).toBeGreaterThan(0);
		expect(defaultTtlMs).toBe(DEFAULT_TTL_SPACE_COMMAND);
	});

	it('does not control hidden or disabled lighting devices', async () => {
		const visibleDevice = createMockDeviceWithLightChannel('visible-device', true, ConnectionState.CONNECTED);
		const hiddenDevice = createMockDeviceWithLightChannel('hidden-device', true, ConnectionState.CONNECTED);
		const disabledDevice = createMockDeviceWithLightChannel('disabled-device', true, ConnectionState.CONNECTED);
		Object.assign(visibleDevice, { enabled: true, hidden: false });
		Object.assign(hiddenDevice, { enabled: true, hidden: true });
		Object.assign(disabledDevice, { enabled: false, hidden: false });
		spacesService.findDevicesBySpace.mockResolvedValue([
			visibleDevice,
			hiddenDevice,
			disabledDevice,
		] as unknown as DeviceEntity[]);

		const result = await service.executeLightingIntent(mockSpaceId, { type: LightingIntentType.ON });

		expect(result?.affectedDevices).toBe(1);
		expect(mockPlatform.processBatch).toHaveBeenCalledTimes(1);
	});

	it('does not control lighting devices without a registered platform', async () => {
		const unsupportedDevice = createMockDeviceWithLightChannel('unsupported-device', true, ConnectionState.CONNECTED);
		spacesService.findDevicesBySpace.mockResolvedValue([unsupportedDevice] as unknown as DeviceEntity[]);
		platformRegistryService.get.mockReturnValue(null);

		const result = await service.executeLightingIntent(mockSpaceId, { type: LightingIntentType.ON });

		expect(result?.affectedDevices).toBe(0);
		expect(mockPlatform.processBatch).not.toHaveBeenCalled();
	});

	it('does not send commands for read-only lighting properties', async () => {
		const readOnlyBrightnessDevice = createMockDeviceWithLightChannel(
			'read-only-brightness',
			true,
			ConnectionState.CONNECTED,
		);
		const readOnlyOnDevice = createMockDeviceWithLightChannel('read-only-on', true, ConnectionState.CONNECTED);
		const readOnlyBrightnessProperties = readOnlyBrightnessDevice.channels[0].properties;
		const readOnlyOnProperties = readOnlyOnDevice.channels[0].properties;

		readOnlyBrightnessProperties[1].permissions = [PermissionType.READ_ONLY];
		readOnlyOnProperties[0].permissions = [PermissionType.READ_ONLY];
		spacesService.findDevicesBySpace.mockResolvedValue([
			readOnlyBrightnessDevice,
			readOnlyOnDevice,
		] as unknown as DeviceEntity[]);

		const result = await service.executeLightingIntent(mockSpaceId, {
			type: LightingIntentType.ROLE_SET,
			role: LightingRole.OTHER,
			on: true,
			brightness: 50,
		});

		expect(result?.affectedDevices).toBe(1);
		expect(mockPlatform.processBatch).toHaveBeenCalledTimes(1);
		const processBatchCall = mockPlatform.processBatch.mock.calls[0] as unknown as [IDevicePropertyData[]];
		expect(processBatchCall[0]).toHaveLength(1);
		expect(processBatchCall[0][0].property.id).toBe('on-prop-read-only-brightness');
		expect(processBatchCall[0][0].value).toBe(true);
	});

	describe('offline device handling', () => {
		it('skips offline devices and reports them in result', async () => {
			const onlineDevice = createMockDeviceWithLightChannel('online-device', true, ConnectionState.CONNECTED);
			const offlineDevice = createMockDeviceWithLightChannel('offline-device', false, ConnectionState.DISCONNECTED);

			spacesService.findDevicesBySpace.mockResolvedValue([onlineDevice, offlineDevice] as unknown as DeviceEntity[]);

			const intent: LightingIntentDto = {
				type: LightingIntentType.ON,
			};

			const result = await service.executeLightingIntent(mockSpaceId, intent);

			expect(result?.success).toBe(true);
			expect(result?.skippedOfflineDevices).toBe(1);
			expect(result?.offlineDeviceIds).toContain('offline-device');
		});

		it('returns early when all devices are offline', async () => {
			const offlineDevice = createMockDeviceWithLightChannel('offline-device', false, ConnectionState.DISCONNECTED);

			spacesService.findDevicesBySpace.mockResolvedValue([offlineDevice] as unknown as DeviceEntity[]);

			const intent: LightingIntentDto = {
				type: LightingIntentType.ON,
			};

			const result = await service.executeLightingIntent(mockSpaceId, intent);

			expect(result?.success).toBe(false);
			expect(result?.affectedDevices).toBe(0);
			expect(result?.skippedOfflineDevices).toBe(1);
			expect(result?.offlineDeviceIds).toContain('offline-device');
		});

		it('treats UNKNOWN status as offline', async () => {
			const unknownStatusDevice = createMockDeviceWithLightChannel('unknown-device', false, ConnectionState.UNKNOWN);

			spacesService.findDevicesBySpace.mockResolvedValue([unknownStatusDevice] as unknown as DeviceEntity[]);

			const intent: LightingIntentDto = {
				type: LightingIntentType.ON,
			};

			const result = await service.executeLightingIntent(mockSpaceId, intent);

			// Device with UNKNOWN status should be treated as offline and skipped
			expect(result?.success).toBe(false);
			expect(result?.affectedDevices).toBe(0);
			expect(result?.skippedOfflineDevices).toBe(1);
			expect(result?.offlineDeviceIds).toContain('unknown-device');
		});

		it('filters offline devices by role for role-specific intents', async () => {
			const onlineMain = createMockDeviceWithLightChannel(
				'online-main',
				true,
				ConnectionState.CONNECTED,
				LightingRole.MAIN,
			);
			const offlineMain = createMockDeviceWithLightChannel(
				'offline-main',
				false,
				ConnectionState.DISCONNECTED,
				LightingRole.MAIN,
			);
			const offlineAccent = createMockDeviceWithLightChannel(
				'offline-accent',
				false,
				ConnectionState.DISCONNECTED,
				LightingRole.ACCENT,
			);

			spacesService.findDevicesBySpace.mockResolvedValue([
				onlineMain,
				offlineMain,
				offlineAccent,
			] as unknown as DeviceEntity[]);

			// Set up role map (key format: deviceId:channelId, value: entity with role property)
			lightingRoleService.getRoleMap.mockResolvedValue(
				new Map([
					[`online-main:channel-online-main`, { role: LightingRole.MAIN }],
					[`offline-main:channel-offline-main`, { role: LightingRole.MAIN }],
					[`offline-accent:channel-offline-accent`, { role: LightingRole.ACCENT }],
				]) as Map<string, SpaceLightingRoleEntity>,
			);

			const intent: LightingIntentDto = {
				type: LightingIntentType.ROLE_ON,
				role: LightingRole.MAIN,
			};

			const result = await service.executeLightingIntent(mockSpaceId, intent);

			// Should only report offline-main as skipped (not offline-accent since it's not MAIN)
			expect(result?.skippedOfflineDevices).toBe(1);
			expect(result?.offlineDeviceIds).toContain('offline-main');
			expect(result?.offlineDeviceIds).not.toContain('offline-accent');
		});

		it('returns early when all targeted role devices are offline', async () => {
			const offlineMain = createMockDeviceWithLightChannel(
				'offline-main',
				false,
				ConnectionState.DISCONNECTED,
				LightingRole.MAIN,
			);
			const onlineAccent = createMockDeviceWithLightChannel(
				'online-accent',
				true,
				ConnectionState.CONNECTED,
				LightingRole.ACCENT,
			);

			spacesService.findDevicesBySpace.mockResolvedValue([offlineMain, onlineAccent] as unknown as DeviceEntity[]);

			// Set up role map (key format: deviceId:channelId, value: entity with role property)
			lightingRoleService.getRoleMap.mockResolvedValue(
				new Map([
					[`offline-main:channel-offline-main`, { role: LightingRole.MAIN }],
					[`online-accent:channel-online-accent`, { role: LightingRole.ACCENT }],
				]) as Map<string, SpaceLightingRoleEntity>,
			);

			const intent: LightingIntentDto = {
				type: LightingIntentType.ROLE_ON,
				role: LightingRole.MAIN,
			};

			const result = await service.executeLightingIntent(mockSpaceId, intent);

			// All targeted (MAIN) devices are offline, should return early
			expect(result?.success).toBe(false);
			expect(result?.affectedDevices).toBe(0);
			expect(result?.skippedOfflineDevices).toBe(1);
			expect(result?.offlineDeviceIds).toContain('offline-main');
		});

		it('deduplicates offline device IDs for multi-channel devices', async () => {
			const deviceId = 'multi-channel-device';
			// Create a device with two light channels
			const multiChannelDevice = {
				id: deviceId,
				name: 'Multi-Channel Light',
				category: DeviceCategory.LIGHTING,
				type: 'test-light',
				status: { online: false, status: ConnectionState.DISCONNECTED },
				channels: [
					{
						id: 'channel-1',
						category: ChannelCategory.LIGHT,
						properties: [
							{
								id: 'on-1',
								category: PropertyCategory.ON,
								value: false,
								permissions: [PermissionType.READ_WRITE],
							},
							{
								id: 'brightness-1',
								category: PropertyCategory.BRIGHTNESS,
								value: 100,
								permissions: [PermissionType.READ_WRITE],
							},
						],
					},
					{
						id: 'channel-2',
						category: ChannelCategory.LIGHT,
						properties: [
							{
								id: 'on-2',
								category: PropertyCategory.ON,
								value: false,
								permissions: [PermissionType.READ_WRITE],
							},
							{
								id: 'brightness-2',
								category: PropertyCategory.BRIGHTNESS,
								value: 100,
								permissions: [PermissionType.READ_WRITE],
							},
						],
					},
				],
			};

			spacesService.findDevicesBySpace.mockResolvedValue([multiChannelDevice] as unknown as DeviceEntity[]);

			const intent: LightingIntentDto = {
				type: LightingIntentType.ON,
			};

			const result = await service.executeLightingIntent(mockSpaceId, intent);

			// Should only count the device once, not twice
			expect(result?.skippedOfflineDevices).toBe(1);
			expect(result?.offlineDeviceIds).toHaveLength(1);
			expect(result?.offlineDeviceIds).toContain(deviceId);
		});
	});

	describe('executeLightingIntent', () => {
		it('returns null when space does not exist', async () => {
			spacesService.findOne.mockResolvedValue(null);

			const intent: LightingIntentDto = {
				type: LightingIntentType.ON,
			};

			const result = await service.executeLightingIntent(mockSpaceId, intent);

			expect(result).toBeNull();
		});

		it('returns success with zero affected when no lights in space', async () => {
			spacesService.findDevicesBySpace.mockResolvedValue([]);

			const intent: LightingIntentDto = {
				type: LightingIntentType.ON,
			};

			const result = await service.executeLightingIntent(mockSpaceId, intent);

			expect(result).not.toBeNull();
			expect(result?.success).toBe(true);
			expect(result?.affectedDevices).toBe(0);
		});
	});
});
