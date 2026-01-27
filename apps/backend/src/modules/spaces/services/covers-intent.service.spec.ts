import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { ChannelCategory, ConnectionState, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { IntentTimeseriesService } from '../../intents/services/intent-timeseries.service';
import { IntentsService } from '../../intents/services/intents.service';
import { CoversIntentDto } from '../dto/covers-intent.dto';
import { CoversIntentType, CoversRole } from '../spaces.constants';

import { CoversIntentService } from './covers-intent.service';
import { SpaceContextSnapshotService } from './space-context-snapshot.service';
import { CoverDevice, SpaceCoversStateService } from './space-covers-state.service';
import { SpaceUndoHistoryService } from './space-undo-history.service';
import { SpacesService } from './spaces.service';

describe('CoversIntentService', () => {
	let service: CoversIntentService;
	let spacesService: jest.Mocked<SpacesService>;
	let coversStateService: jest.Mocked<SpaceCoversStateService>;

	const mockSpaceId = uuid();
	const mockIntentId = uuid();

	const createMockCoverDevice = (overrides: Partial<CoverDevice> = {}): CoverDevice => ({
		device: {
			id: uuid(),
			name: 'Test Cover',
			category: DeviceCategory.WINDOW_COVERING,
			type: 'test-cover',
			status: { online: true, status: ConnectionState.CONNECTED },
		} as DeviceEntity,
		coverChannel: {
			id: uuid(),
			category: ChannelCategory.WINDOW_COVERING,
		} as ChannelEntity,
		positionProperty: {
			id: uuid(),
			category: PropertyCategory.POSITION,
		} as ChannelPropertyEntity,
		commandProperty: null,
		tiltProperty: null,
		role: null,
		...overrides,
	});

	const mockPlatform = {
		getType: jest.fn().mockReturnValue('test-cover'),
		setPropertyValue: jest.fn().mockResolvedValue(true),
		processBatch: jest.fn().mockResolvedValue(true),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CoversIntentService,
				{
					provide: SpacesService,
					useValue: {
						findOne: jest.fn().mockResolvedValue({ id: mockSpaceId }),
					},
				},
				{
					provide: PlatformRegistryService,
					useValue: {
						get: jest.fn().mockReturnValue(mockPlatform),
					},
				},
				{
					provide: SpaceCoversStateService,
					useValue: {
						getCoversState: jest.fn().mockResolvedValue({
							hasCovers: true,
							coversCount: 1,
							position: 50,
						}),
						getCoversInSpace: jest.fn().mockResolvedValue([]),
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
						storeCoversPositionChange: jest.fn().mockResolvedValue(undefined),
					},
				},
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(),
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

		service = module.get<CoversIntentService>(CoversIntentService);
		spacesService = module.get(SpacesService);
		coversStateService = module.get(SpaceCoversStateService);

		// Reset mocks between tests
		jest.clearAllMocks();
		mockPlatform.processBatch.mockResolvedValue(true);
	});

	describe('offline device handling', () => {
		it('skips offline devices and reports them in result', async () => {
			const onlineDevice = createMockCoverDevice({
				device: {
					id: 'online-device',
					name: 'Online Cover',
					category: DeviceCategory.WINDOW_COVERING,
					type: 'test-cover',
					status: { online: true, status: ConnectionState.CONNECTED },
				} as DeviceEntity,
			});
			const offlineDevice = createMockCoverDevice({
				device: {
					id: 'offline-device',
					name: 'Offline Cover',
					category: DeviceCategory.WINDOW_COVERING,
					type: 'test-cover',
					status: { online: false, status: ConnectionState.DISCONNECTED },
				} as DeviceEntity,
			});

			coversStateService.getCoversInSpace.mockResolvedValue([onlineDevice, offlineDevice]);

			const intent: CoversIntentDto = {
				type: CoversIntentType.OPEN,
			};

			const result = await service.executeCoversIntent(mockSpaceId, intent);

			expect(result?.success).toBe(true);
			expect(result?.skippedOfflineDevices).toBe(1);
			expect(result?.offlineDeviceIds).toContain('offline-device');
		});

		it('returns early when all devices are offline', async () => {
			const offlineDevice = createMockCoverDevice({
				device: {
					id: 'offline-device',
					name: 'Offline Cover',
					category: DeviceCategory.WINDOW_COVERING,
					type: 'test-cover',
					status: { online: false, status: ConnectionState.DISCONNECTED },
				} as DeviceEntity,
			});

			coversStateService.getCoversInSpace.mockResolvedValue([offlineDevice]);

			const intent: CoversIntentDto = {
				type: CoversIntentType.OPEN,
			};

			const result = await service.executeCoversIntent(mockSpaceId, intent);

			expect(result?.success).toBe(false);
			expect(result?.affectedDevices).toBe(0);
			expect(result?.skippedOfflineDevices).toBe(1);
			expect(result?.offlineDeviceIds).toContain('offline-device');
		});

		it('treats UNKNOWN status as offline', async () => {
			const unknownStatusDevice = createMockCoverDevice({
				device: {
					id: 'unknown-device',
					name: 'Unknown Status Cover',
					category: DeviceCategory.WINDOW_COVERING,
					type: 'test-cover',
					status: { online: false, status: ConnectionState.UNKNOWN },
				} as DeviceEntity,
			});

			coversStateService.getCoversInSpace.mockResolvedValue([unknownStatusDevice]);

			const intent: CoversIntentDto = {
				type: CoversIntentType.OPEN,
			};

			const result = await service.executeCoversIntent(mockSpaceId, intent);

			// Device with UNKNOWN status should be treated as offline and skipped
			expect(result?.success).toBe(false);
			expect(result?.affectedDevices).toBe(0);
			expect(result?.skippedOfflineDevices).toBe(1);
			expect(result?.offlineDeviceIds).toContain('unknown-device');
		});

		it('filters offline devices by role for role-specific intents', async () => {
			const onlinePrimary = createMockCoverDevice({
				device: {
					id: 'online-primary',
					name: 'Online Primary',
					category: DeviceCategory.WINDOW_COVERING,
					type: 'test-cover',
					status: { online: true, status: ConnectionState.CONNECTED },
				} as DeviceEntity,
				role: CoversRole.PRIMARY,
			});
			const offlinePrimary = createMockCoverDevice({
				device: {
					id: 'offline-primary',
					name: 'Offline Primary',
					category: DeviceCategory.WINDOW_COVERING,
					type: 'test-cover',
					status: { online: false, status: ConnectionState.DISCONNECTED },
				} as DeviceEntity,
				role: CoversRole.PRIMARY,
			});
			const offlineBlackout = createMockCoverDevice({
				device: {
					id: 'offline-blackout',
					name: 'Offline Blackout',
					category: DeviceCategory.WINDOW_COVERING,
					type: 'test-cover',
					status: { online: false, status: ConnectionState.DISCONNECTED },
				} as DeviceEntity,
				role: CoversRole.BLACKOUT,
			});

			coversStateService.getCoversInSpace.mockResolvedValue([onlinePrimary, offlinePrimary, offlineBlackout]);

			const intent: CoversIntentDto = {
				type: CoversIntentType.ROLE_POSITION,
				role: CoversRole.PRIMARY,
				position: 75,
			};

			const result = await service.executeCoversIntent(mockSpaceId, intent);

			// Should only report offline-primary as skipped (not offline-blackout since it's not PRIMARY)
			expect(result?.skippedOfflineDevices).toBe(1);
			expect(result?.offlineDeviceIds).toContain('offline-primary');
			expect(result?.offlineDeviceIds).not.toContain('offline-blackout');
		});

		it('returns early when all targeted role devices are offline', async () => {
			const offlinePrimary = createMockCoverDevice({
				device: {
					id: 'offline-primary',
					name: 'Offline Primary',
					category: DeviceCategory.WINDOW_COVERING,
					type: 'test-cover',
					status: { online: false, status: ConnectionState.DISCONNECTED },
				} as DeviceEntity,
				role: CoversRole.PRIMARY,
			});
			const onlineBlackout = createMockCoverDevice({
				device: {
					id: 'online-blackout',
					name: 'Online Blackout',
					category: DeviceCategory.WINDOW_COVERING,
					type: 'test-cover',
					status: { online: true, status: ConnectionState.CONNECTED },
				} as DeviceEntity,
				role: CoversRole.BLACKOUT,
			});

			coversStateService.getCoversInSpace.mockResolvedValue([offlinePrimary, onlineBlackout]);

			const intent: CoversIntentDto = {
				type: CoversIntentType.ROLE_POSITION,
				role: CoversRole.PRIMARY,
				position: 75,
			};

			const result = await service.executeCoversIntent(mockSpaceId, intent);

			// All targeted (PRIMARY) devices are offline, should return early
			expect(result?.success).toBe(false);
			expect(result?.affectedDevices).toBe(0);
			expect(result?.skippedOfflineDevices).toBe(1);
			expect(result?.offlineDeviceIds).toContain('offline-primary');
		});

		it('deduplicates offline device IDs for multi-channel devices', async () => {
			const deviceId = 'multi-channel-device';
			const offlineDevice1 = createMockCoverDevice({
				device: {
					id: deviceId,
					name: 'Multi-Channel Cover',
					category: DeviceCategory.WINDOW_COVERING,
					type: 'test-cover',
					status: { online: false, status: ConnectionState.DISCONNECTED },
				} as DeviceEntity,
				coverChannel: { id: 'channel-1' } as ChannelEntity,
			});
			const offlineDevice2 = createMockCoverDevice({
				device: {
					id: deviceId,
					name: 'Multi-Channel Cover',
					category: DeviceCategory.WINDOW_COVERING,
					type: 'test-cover',
					status: { online: false, status: ConnectionState.DISCONNECTED },
				} as DeviceEntity,
				coverChannel: { id: 'channel-2' } as ChannelEntity,
			});

			coversStateService.getCoversInSpace.mockResolvedValue([offlineDevice1, offlineDevice2]);

			const intent: CoversIntentDto = {
				type: CoversIntentType.OPEN,
			};

			const result = await service.executeCoversIntent(mockSpaceId, intent);

			// Should only count the device once, not twice
			expect(result?.skippedOfflineDevices).toBe(1);
			expect(result?.offlineDeviceIds).toHaveLength(1);
			expect(result?.offlineDeviceIds).toContain(deviceId);
		});
	});

	describe('executeCoversIntent', () => {
		it('returns null when space does not exist', async () => {
			spacesService.findOne.mockResolvedValue(null);

			const intent: CoversIntentDto = {
				type: CoversIntentType.OPEN,
			};

			const result = await service.executeCoversIntent(mockSpaceId, intent);

			expect(result).toBeNull();
		});

		it('returns success with zero affected when no covers in space', async () => {
			coversStateService.getCoversInSpace.mockResolvedValue([]);

			const intent: CoversIntentDto = {
				type: CoversIntentType.OPEN,
			};

			const result = await service.executeCoversIntent(mockSpaceId, intent);

			expect(result).not.toBeNull();
			expect(result?.success).toBe(true);
			expect(result?.affectedDevices).toBe(0);
		});
	});
});
