import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { SpaceActiveMediaActivityEntity } from '../entities/space-active-media-activity.entity';
import { EventType, MediaActivationState, MediaActivityKey, MediaEndpointType } from '../spaces.constants';

import { DerivedMediaEndpointService } from './derived-media-endpoint.service';
import { SpaceMediaActivityBindingService } from './space-media-activity-binding.service';
import { SpaceMediaActivityService } from './space-media-activity.service';
import { SpacesService } from './spaces.service';

const spaceId = uuid();
const deviceTvId = uuid();
const deviceSpeakerId = uuid();
const powerPropertyId = uuid();
const inputPropertyId = uuid();
const volumePropertyId = uuid();

function buildEndpoint(type: MediaEndpointType, deviceId: string, caps: Record<string, boolean>, links: Record<string, any> = {}) {
	return {
		endpointId: `${spaceId}:${type}:${deviceId}`,
		spaceId,
		deviceId,
		type,
		name: `Device (${type})`,
		capabilities: {
			power: caps.power ?? false,
			volume: caps.volume ?? false,
			mute: caps.mute ?? false,
			playback: caps.playback ?? false,
			track: caps.track ?? false,
			inputSelect: caps.inputSelect ?? false,
			remoteCommands: caps.remoteCommands ?? false,
		},
		links,
	};
}

function buildBinding(activityKey: MediaActivityKey, overrides: Record<string, any> = {}) {
	return {
		id: uuid(),
		spaceId,
		activityKey,
		displayEndpointId: overrides.displayEndpointId ?? null,
		audioEndpointId: overrides.audioEndpointId ?? null,
		sourceEndpointId: overrides.sourceEndpointId ?? null,
		remoteEndpointId: overrides.remoteEndpointId ?? null,
		displayInputId: overrides.displayInputId ?? null,
		audioVolumePreset: overrides.audioVolumePreset ?? null,
	};
}

describe('SpaceMediaActivityService', () => {
	let service: SpaceMediaActivityService;
	let mockActiveRepository: {
		findOne: jest.Mock;
		create: jest.Mock;
		save: jest.Mock;
	};
	let mockSpacesService: { getOneOrThrow: jest.Mock; findDevicesByIds: jest.Mock };
	let mockBindingService: { findBySpace: jest.Mock };
	let mockDerivedEndpointService: { buildEndpointsForSpace: jest.Mock };
	let mockPlatformRegistry: { get: jest.Mock };
	let mockEventEmitter: { emit: jest.Mock };

	beforeEach(async () => {
		mockActiveRepository = {
			findOne: jest.fn().mockResolvedValue(null),
			create: jest.fn().mockImplementation((data) => ({ ...data, id: uuid() })),
			save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
		};

		mockSpacesService = {
			getOneOrThrow: jest.fn().mockResolvedValue({ id: spaceId }),
			findDevicesByIds: jest.fn().mockResolvedValue([]),
		};

		mockBindingService = {
			findBySpace: jest.fn().mockResolvedValue([]),
		};

		mockDerivedEndpointService = {
			buildEndpointsForSpace: jest.fn().mockResolvedValue({ spaceId, endpoints: [] }),
		};

		mockPlatformRegistry = {
			get: jest.fn().mockReturnValue(null),
		};

		mockEventEmitter = {
			emit: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SpaceMediaActivityService,
				{ provide: getRepositoryToken(SpaceActiveMediaActivityEntity), useValue: mockActiveRepository },
				{ provide: SpacesService, useValue: mockSpacesService },
				{ provide: SpaceMediaActivityBindingService, useValue: mockBindingService },
				{ provide: DerivedMediaEndpointService, useValue: mockDerivedEndpointService },
				{ provide: PlatformRegistryService, useValue: mockPlatformRegistry },
				{ provide: EventEmitter2, useValue: mockEventEmitter },
			],
		}).compile();

		service = module.get<SpaceMediaActivityService>(SpaceMediaActivityService);
	});

	describe('getActive', () => {
		it('should return null when no active record exists', async () => {
			const result = await service.getActive(spaceId);

			expect(result).toBeNull();
			expect(mockSpacesService.getOneOrThrow).toHaveBeenCalledWith(spaceId);
		});

		it('should return the active record when it exists', async () => {
			const record = {
				id: uuid(),
				spaceId,
				activityKey: MediaActivityKey.WATCH,
				state: MediaActivationState.ACTIVE,
			};

			mockActiveRepository.findOne.mockResolvedValue(record);

			const result = await service.getActive(spaceId);

			expect(result).toBe(record);
		});
	});

	describe('activate', () => {
		it('should throw when no binding exists for activity key', async () => {
			mockBindingService.findBySpace.mockResolvedValue([]);

			await expect(service.activate(spaceId, MediaActivityKey.WATCH)).rejects.toThrow(
				/No binding found/,
			);
		});

		it('should return current state if same activity is already active (idempotent)', async () => {
			const existingRecord = {
				id: uuid(),
				spaceId,
				activityKey: MediaActivityKey.WATCH,
				state: MediaActivationState.ACTIVE,
				resolved: JSON.stringify({ displayDeviceId: deviceTvId }),
				lastResult: JSON.stringify({ stepsTotal: 1, stepsSucceeded: 1, stepsFailed: 0 }),
			};

			mockActiveRepository.findOne.mockResolvedValue(existingRecord);

			const result = await service.activate(spaceId, MediaActivityKey.WATCH);

			expect(result.state).toBe(MediaActivationState.ACTIVE);
			expect(result.activityKey).toBe(MediaActivityKey.WATCH);
			// Should not have emitted activating event
			expect(mockEventEmitter.emit).not.toHaveBeenCalledWith(
				EventType.MEDIA_ACTIVITY_ACTIVATING,
				expect.anything(),
			);
		});

		it('should treat "off" activity as deactivation', async () => {
			const result = await service.activate(spaceId, MediaActivityKey.OFF);

			expect(result.state).toBe(MediaActivationState.DEACTIVATED);
			expect(result.activityKey).toBeNull();
		});

		it('should build plan and execute for watch activity with TV endpoint', async () => {
			const displayEndpointId = `${spaceId}:display:${deviceTvId}`;
			const binding = buildBinding(MediaActivityKey.WATCH, {
				displayEndpointId,
				displayInputId: 'HDMI1',
			});

			mockBindingService.findBySpace.mockResolvedValue([binding]);

			const displayEndpoint = buildEndpoint(
				MediaEndpointType.DISPLAY,
				deviceTvId,
				{ power: true, inputSelect: true },
				{
					power: { propertyId: powerPropertyId },
					inputSelect: { propertyId: inputPropertyId },
				},
			);

			mockDerivedEndpointService.buildEndpointsForSpace.mockResolvedValue({
				spaceId,
				endpoints: [displayEndpoint],
			});

			const mockDevice = {
				id: deviceTvId,
				type: 'test-platform',
				channels: [
					{
						id: uuid(),
						properties: [
							{ id: powerPropertyId, value: false },
							{ id: inputPropertyId, value: 'HDMI2' },
						],
					},
				],
			};

			mockSpacesService.findDevicesByIds.mockResolvedValue([mockDevice]);

			const mockPlatform = {
				processBatch: jest.fn().mockResolvedValue(true),
			};

			mockPlatformRegistry.get.mockReturnValue(mockPlatform);

			const result = await service.activate(spaceId, MediaActivityKey.WATCH);

			expect(result.state).toBe(MediaActivationState.ACTIVE);
			expect(result.activityKey).toBe(MediaActivityKey.WATCH);
			expect(result.resolved?.displayDeviceId).toBe(deviceTvId);
			expect(result.summary?.stepsTotal).toBe(2); // power + input
			expect(result.summary?.stepsSucceeded).toBe(2);
			expect(result.summary?.stepsFailed).toBe(0);

			// Should have emitted activating and activated events
			expect(mockEventEmitter.emit).toHaveBeenCalledWith(
				EventType.MEDIA_ACTIVITY_ACTIVATING,
				expect.objectContaining({ space_id: spaceId, activity_key: MediaActivityKey.WATCH }),
			);
			expect(mockEventEmitter.emit).toHaveBeenCalledWith(
				EventType.MEDIA_ACTIVITY_ACTIVATED,
				expect.objectContaining({ space_id: spaceId, activity_key: MediaActivityKey.WATCH }),
			);
		});

		it('should report failed state when critical step fails', async () => {
			const displayEndpointId = `${spaceId}:display:${deviceTvId}`;
			const binding = buildBinding(MediaActivityKey.WATCH, { displayEndpointId });

			mockBindingService.findBySpace.mockResolvedValue([binding]);

			const displayEndpoint = buildEndpoint(
				MediaEndpointType.DISPLAY,
				deviceTvId,
				{ power: true },
				{ power: { propertyId: powerPropertyId } },
			);

			mockDerivedEndpointService.buildEndpointsForSpace.mockResolvedValue({
				spaceId,
				endpoints: [displayEndpoint],
			});

			// Device not found → critical failure
			mockSpacesService.findDevicesByIds.mockResolvedValue([]);

			const result = await service.activate(spaceId, MediaActivityKey.WATCH);

			expect(result.state).toBe(MediaActivationState.FAILED);
			expect(result.summary?.stepsFailed).toBeGreaterThan(0);
			expect(result.summary?.failures).toBeDefined();
			expect(result.summary!.failures![0].reason).toContain('not found');

			expect(mockEventEmitter.emit).toHaveBeenCalledWith(
				EventType.MEDIA_ACTIVITY_FAILED,
				expect.objectContaining({ space_id: spaceId }),
			);
		});

		it('should allow partial success for non-critical step failure', async () => {
			const displayEndpointId = `${spaceId}:display:${deviceTvId}`;
			const audioEndpointId = `${spaceId}:audio_output:${deviceSpeakerId}`;
			const binding = buildBinding(MediaActivityKey.LISTEN, {
				audioEndpointId,
				audioVolumePreset: 30,
			});

			mockBindingService.findBySpace.mockResolvedValue([binding]);

			const audioEndpoint = buildEndpoint(
				MediaEndpointType.AUDIO_OUTPUT,
				deviceSpeakerId,
				{ power: true, volume: true },
				{
					power: { propertyId: powerPropertyId },
					volume: { propertyId: volumePropertyId },
				},
			);

			mockDerivedEndpointService.buildEndpointsForSpace.mockResolvedValue({
				spaceId,
				endpoints: [audioEndpoint],
			});

			const mockDevice = {
				id: deviceSpeakerId,
				type: 'test-platform',
				channels: [
					{
						id: uuid(),
						properties: [
							{ id: powerPropertyId, value: false },
							{ id: volumePropertyId, value: 50 },
						],
					},
				],
			};

			mockSpacesService.findDevicesByIds.mockResolvedValue([mockDevice]);

			const mockPlatform = {
				processBatch: jest
					.fn()
					// First call (power) succeeds
					.mockResolvedValueOnce(true)
					// Second call (volume) fails
					.mockResolvedValueOnce(false),
			};

			mockPlatformRegistry.get.mockReturnValue(mockPlatform);

			const result = await service.activate(spaceId, MediaActivityKey.LISTEN);

			// listen activity: power is non-critical, volume is non-critical
			// So even if volume fails, overall can be active
			expect(result.state).toBe(MediaActivationState.ACTIVE);
			expect(result.summary?.stepsSucceeded).toBe(1);
			expect(result.summary?.stepsFailed).toBe(1);
			expect(result.warnings).toBeDefined();
		});
	});

	describe('deactivate', () => {
		it('should deactivate and emit event', async () => {
			const existingRecord = {
				id: uuid(),
				spaceId,
				activityKey: MediaActivityKey.WATCH,
				state: MediaActivationState.ACTIVE,
			};

			mockActiveRepository.findOne.mockResolvedValue(existingRecord);

			const result = await service.deactivate(spaceId);

			expect(result.state).toBe(MediaActivationState.DEACTIVATED);
			expect(result.activityKey).toBeNull();
			expect(mockActiveRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					activityKey: null,
					state: MediaActivationState.DEACTIVATED,
				}),
			);
			expect(mockEventEmitter.emit).toHaveBeenCalledWith(
				EventType.MEDIA_ACTIVITY_DEACTIVATED,
				expect.objectContaining({ space_id: spaceId, activity_key: null }),
			);
		});

		it('should succeed even when no active record exists', async () => {
			const result = await service.deactivate(spaceId);

			expect(result.state).toBe(MediaActivationState.DEACTIVATED);
		});
	});
});
