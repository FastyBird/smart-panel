/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import {
	ChannelCategory,
	ConnectionState,
	DeviceCategory,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { PropertyCommandDispatchService } from '../../../modules/devices/services/property-command-dispatch.service';
import { DEFAULT_TTL_SPACE_COMMAND } from '../../../modules/intents/intents.constants';
import { IntentTimeseriesService } from '../../../modules/intents/services/intent-timeseries.service';
import { IntentsService } from '../../../modules/intents/services/intents.service';
import { SpacesService } from '../../../modules/spaces/services/spaces.service';
import { CoversIntentDto } from '../dto/covers-intent.dto';
import { CoversIntentType, CoversMode, CoversRole } from '../spaces-home-control.constants';

import { CoverGroupIntentPort } from './cover-group-intent.port';
import { CoversIntentService } from './covers-intent.service';
import { SpaceContextSnapshotService } from './space-context-snapshot.service';
import { CoverDevice, SpaceCoversStateService } from './space-covers-state.service';
import { SpaceUndoHistoryService } from './space-undo-history.service';

describe('CoversIntentService', () => {
	let module: TestingModule | undefined;
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
		module = await Test.createTestingModule({
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
						getCommandTtlMs: jest.fn().mockReturnValue(DEFAULT_TTL_SPACE_COMMAND),
					},
				},
				{
					provide: PropertyCommandDispatchService,
					useValue: {
						dispatchBatch: jest.fn(async (updates: IDevicePropertyData[]) => ({
							success: await mockPlatform.processBatch(updates),
						})),
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

	it('runs the public room service through the native group port under its original deadline and retains partial outcomes', async () => {
		const cover = createMockCoverDevice({
			commandProperty: { id: uuid(), category: PropertyCategory.COMMAND } as ChannelPropertyEntity,
		});
		Object.assign(cover.device, { type: 'virtual', mode: 'actuator_group' });
		coversStateService.getCoversInSpace.mockResolvedValue([cover]);
		const intents = module.get<jest.Mocked<IntentsService>>(IntentsService);
		const expiresAt = new Date(Date.now() + 30000);
		intents.createIntent.mockReturnValue({ id: mockIntentId, expiresAt } as never);
		const dispatch = module.get<jest.Mocked<PropertyCommandDispatchService>>(PropertyCommandDispatchService);
		const dispatchBatch = jest.spyOn(dispatch, 'dispatchBatch');
		const completeIntent = jest.spyOn(intents, 'completeIntent');
		const storeModeValidity = jest.spyOn(
			module.get<IntentTimeseriesService>(IntentTimeseriesService),
			'storeModeValidity',
		);
		const composite = {
			id: 'parent',
			status: 'partial',
			children: [
				{ memberId: 'a', memberIdentity: 'a', propertyId: null, status: 'confirmed' },
				{ memberId: 'b', memberIdentity: 'b', propertyId: null, status: 'unavailable', reason: 'tag_unavailable' },
			],
		};
		dispatch.dispatchBatch.mockResolvedValue({ success: false, composite } as never);
		const entry = {},
			releaseCommandEntry = jest.fn();
		const port = new CoverGroupIntentPort(
			{ captureCommandEntry: () => entry, releaseCommandEntry } as never,
			dispatch,
			{
				plan: (targets: unknown[]) =>
					Promise.resolve({
						targets,
						excludedRawChannels: [],
						coverage: new Map([[cover.coverChannel.id, { leaves: ['a', 'b'] }]]),
						isCurrent: () => true,
					}),
			} as never,
		);
		const grouped = new CoversIntentService(
			spacesService,
			module.get(PlatformRegistryService),
			dispatch,
			coversStateService,
			module.get(EventEmitter2),
			module.get(SpaceContextSnapshotService),
			module.get(SpaceUndoHistoryService),
			module.get(IntentTimeseriesService),
			intents,
			port,
		);
		const result = await grouped.executeCoversIntent(mockSpaceId, { type: CoversIntentType.OPEN });
		expect(result).toMatchObject({
			success: false,
			affectedDevices: 0,
			failedDevices: 1,
			newPosition: null,
			composites: [composite],
		});
		expect(dispatchBatch).toHaveBeenCalledTimes(1);
		expect(dispatchBatch).toHaveBeenCalledWith(
			[expect.objectContaining({ property: expect.objectContaining({ id: cover.commandProperty.id }), value: 'open' })],
			expect.objectContaining({ commandEntry: entry, deadlineAt: expiresAt.getTime() - 100 }),
		);
		expect(completeIntent).toHaveBeenCalledWith(mockIntentId, expect.any(Array), [composite]);
		expect(releaseCommandEntry).toHaveBeenCalledWith(entry);
		dispatchBatch.mockClear();
		const mode = await grouped.executeCoversIntent(mockSpaceId, {
			type: CoversIntentType.SET_MODE,
			mode: CoversMode.OPEN,
		});
		expect(mode.success).toBe(false);
		expect(dispatchBatch).not.toHaveBeenCalled();
		expect(storeModeValidity).not.toHaveBeenCalled();
	});

	it.each([CoversIntentType.POSITION_DELTA, CoversIntentType.SET_MODE])(
		'preserves ordinary physical-only %s position-first room behavior',
		async (type) => {
			const cover = createMockCoverDevice({
				positionProperty: {
					id: uuid(),
					category: PropertyCategory.POSITION,
					unit: '%',
					format: [0, 100],
					value: { value: 50 },
				} as ChannelPropertyEntity,
				commandProperty: { id: uuid(), category: PropertyCategory.COMMAND } as ChannelPropertyEntity,
			});
			coversStateService.getCoversInSpace.mockResolvedValue([cover]);
			const result = await service.executeCoversIntent(mockSpaceId, { type, mode: CoversMode.OPEN });
			expect(result).toMatchObject({ success: true, affectedDevices: 1, failedDevices: 0 });
			expect(mockPlatform.processBatch).toHaveBeenCalledWith([
				expect.objectContaining({
					property: cover.positionProperty,
					value: type === CoversIntentType.POSITION_DELTA ? 75 : 100,
				}),
			]);
		},
	);

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

	describe('position-capable covers', () => {
		it('sends SET_POSITION command to covers with position property', async () => {
			const device = createMockCoverDevice({
				positionProperty: {
					id: 'pos-prop-1',
					category: PropertyCategory.POSITION,
				} as ChannelPropertyEntity,
			});

			coversStateService.getCoversInSpace.mockResolvedValue([device]);

			const intent: CoversIntentDto = {
				type: CoversIntentType.SET_POSITION,
				position: 75,
			};

			const result = await service.executeCoversIntent(mockSpaceId, intent);

			expect(result?.success).toBe(true);
			expect(result?.affectedDevices).toBe(1);
			expect(mockPlatform.processBatch).toHaveBeenCalled();
		});

		it('clamps position to 0-100 range', async () => {
			const device = createMockCoverDevice({
				positionProperty: {
					id: 'pos-prop-1',
					category: PropertyCategory.POSITION,
				} as ChannelPropertyEntity,
			});

			coversStateService.getCoversInSpace.mockResolvedValue([device]);

			const intent: CoversIntentDto = {
				type: CoversIntentType.SET_POSITION,
				position: 150,
			};

			const result = await service.executeCoversIntent(mockSpaceId, intent);

			expect(result?.success).toBe(true);

			// The position should be clamped, so processBatch should still be called
			expect(mockPlatform.processBatch).toHaveBeenCalled();
		});
	});

	describe('command-only covers', () => {
		it('sends OPEN command to covers without position property', async () => {
			const device = createMockCoverDevice({
				positionProperty: null,
				commandProperty: {
					id: 'cmd-prop-1',
					category: PropertyCategory.COMMAND,
				} as ChannelPropertyEntity,
			});

			coversStateService.getCoversInSpace.mockResolvedValue([device]);

			const intent: CoversIntentDto = {
				type: CoversIntentType.OPEN,
			};

			const result = await service.executeCoversIntent(mockSpaceId, intent);

			expect(result?.success).toBe(true);
			expect(result?.affectedDevices).toBe(1);
			expect(mockPlatform.processBatch).toHaveBeenCalled();
		});

		it('sends CLOSE command to command-only covers', async () => {
			const device = createMockCoverDevice({
				positionProperty: null,
				commandProperty: {
					id: 'cmd-prop-1',
					category: PropertyCategory.COMMAND,
				} as ChannelPropertyEntity,
			});

			coversStateService.getCoversInSpace.mockResolvedValue([device]);

			const intent: CoversIntentDto = {
				type: CoversIntentType.CLOSE,
			};

			const result = await service.executeCoversIntent(mockSpaceId, intent);

			expect(result?.success).toBe(true);
			expect(result?.affectedDevices).toBe(1);
			expect(mockPlatform.processBatch).toHaveBeenCalled();
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

	afterEach(async () => {
		const moduleToClose = module;
		module = undefined;
		await moduleToClose?.close();
	});
});
