import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { ChannelCategory, ConnectionState, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { IntentTimeseriesService } from '../../intents/services/intent-timeseries.service';
import { IntentsService } from '../../intents/services/intents.service';
import { LightingIntentDto } from '../dto/lighting-intent.dto';
import { LightingIntentType, LightingRole } from '../spaces.constants';
import { IntentSpecLoaderService } from '../spec';

import { LightingIntentService } from './lighting-intent.service';
import { SpaceContextSnapshotService } from './space-context-snapshot.service';
import { SpaceLightingRoleService } from './space-lighting-role.service';
import { SpaceLightingStateService } from './space-lighting-state.service';
import { SpaceUndoHistoryService } from './space-undo-history.service';
import { SpacesService } from './spaces.service';

describe('LightingIntentService', () => {
	let service: LightingIntentService;
	let spacesService: jest.Mocked<SpacesService>;
	let lightingRoleService: jest.Mocked<SpaceLightingRoleService>;

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
					{ id: `on-prop-${id}`, category: PropertyCategory.ON, value: false },
					{ id: `brightness-prop-${id}`, category: PropertyCategory.BRIGHTNESS, value: 100 },
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
		lightingRoleService = module.get(SpaceLightingRoleService);

		// Reset mocks between tests
		jest.clearAllMocks();
		mockPlatform.processBatch.mockResolvedValue(true);
	});

	describe('offline device handling', () => {
		it('skips offline devices and reports them in result', async () => {
			const onlineDevice = createMockDeviceWithLightChannel('online-device', true, ConnectionState.CONNECTED);
			const offlineDevice = createMockDeviceWithLightChannel('offline-device', false, ConnectionState.DISCONNECTED);

			spacesService.findDevicesBySpace.mockResolvedValue([onlineDevice, offlineDevice] as any);

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

			spacesService.findDevicesBySpace.mockResolvedValue([offlineDevice] as any);

			const intent: LightingIntentDto = {
				type: LightingIntentType.ON,
			};

			const result = await service.executeLightingIntent(mockSpaceId, intent);

			expect(result?.success).toBe(false);
			expect(result?.affectedDevices).toBe(0);
			expect(result?.skippedOfflineDevices).toBe(1);
			expect(result?.offlineDeviceIds).toContain('offline-device');
		});

		it('treats UNKNOWN status as potentially online', async () => {
			const unknownStatusDevice = createMockDeviceWithLightChannel('unknown-device', false, ConnectionState.UNKNOWN);

			spacesService.findDevicesBySpace.mockResolvedValue([unknownStatusDevice] as any);

			const intent: LightingIntentDto = {
				type: LightingIntentType.ON,
			};

			const result = await service.executeLightingIntent(mockSpaceId, intent);

			// Device with UNKNOWN status should be treated as potentially online
			expect(result?.skippedOfflineDevices).toBe(0);
			expect(result?.offlineDeviceIds).toBeUndefined();
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

			spacesService.findDevicesBySpace.mockResolvedValue([onlineMain, offlineMain, offlineAccent] as any);

			// Set up role map (key format: deviceId:channelId, value: entity with role property)
			lightingRoleService.getRoleMap.mockResolvedValue(
				new Map([
					[`online-main:channel-online-main`, { role: LightingRole.MAIN }],
					[`offline-main:channel-offline-main`, { role: LightingRole.MAIN }],
					[`offline-accent:channel-offline-accent`, { role: LightingRole.ACCENT }],
				]) as any,
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

			spacesService.findDevicesBySpace.mockResolvedValue([offlineMain, onlineAccent] as any);

			// Set up role map (key format: deviceId:channelId, value: entity with role property)
			lightingRoleService.getRoleMap.mockResolvedValue(
				new Map([
					[`offline-main:channel-offline-main`, { role: LightingRole.MAIN }],
					[`online-accent:channel-online-accent`, { role: LightingRole.ACCENT }],
				]) as any,
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
							{ id: 'on-1', category: PropertyCategory.ON, value: false },
							{ id: 'brightness-1', category: PropertyCategory.BRIGHTNESS, value: 100 },
						],
					},
					{
						id: 'channel-2',
						category: ChannelCategory.LIGHT,
						properties: [
							{ id: 'on-2', category: PropertyCategory.ON, value: false },
							{ id: 'brightness-2', category: PropertyCategory.BRIGHTNESS, value: 100 },
						],
					},
				],
			};

			spacesService.findDevicesBySpace.mockResolvedValue([multiChannelDevice] as any);

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
