import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { DeviceCategory } from '../../devices/devices.constants';
import { SpaceMediaActivityBindingEntity } from '../entities/space-media-activity-binding.entity';
import { DerivedMediaEndpointModel } from '../models/derived-media-endpoint.model';
import { MediaCapabilitySummaryModel } from '../models/media-routing.model';
import { MediaActivityKey, MediaEndpointType } from '../spaces.constants';

import { DerivedMediaEndpointService } from './derived-media-endpoint.service';
import { MediaCapabilityService } from './media-capability.service';
import { SpaceMediaActivityBindingService } from './space-media-activity-binding.service';
import { SpacesService } from './spaces.service';

const spaceId = uuid();

// Device IDs
const tvDeviceId = uuid();
const avrDeviceId = uuid();
const speakerDeviceId = uuid();
const streamerDeviceId = uuid();
const consoleDeviceId = uuid();

function buildEndpoint(
	type: MediaEndpointType,
	deviceId: string,
	name: string,
	caps: Partial<Record<string, boolean>>,
	links: Record<string, { propertyId: string }> = {},
): DerivedMediaEndpointModel {
	return {
		endpointId: `${spaceId}:${type}:${deviceId}`,
		spaceId,
		deviceId,
		type,
		name,
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
	} as DerivedMediaEndpointModel;
}

function buildSummary(deviceId: string, deviceName: string, deviceCategory: string): MediaCapabilitySummaryModel {
	const s = new MediaCapabilitySummaryModel();
	s.deviceId = deviceId;
	s.deviceName = deviceName;
	s.deviceCategory = deviceCategory;
	s.isOnline = true;
	s.suggestedEndpointTypes = [];

	return s;
}

describe('SpaceMediaActivityBindingService', () => {
	let service: SpaceMediaActivityBindingService;
	let mockRepository: {
		find: jest.Mock;
		findOne: jest.Mock;
		create: jest.Mock;
		save: jest.Mock;
		remove: jest.Mock;
	};
	let mockSpacesService: { getOneOrThrow: jest.Mock };
	let mockDerivedEndpointService: { buildEndpointsForSpace: jest.Mock };
	let mockMediaCapabilityService: { getMediaCapabilitiesInSpace: jest.Mock };

	let savedBindings: SpaceMediaActivityBindingEntity[];

	beforeEach(async () => {
		savedBindings = [];

		mockRepository = {
			find: jest.fn().mockImplementation(() => Promise.resolve(savedBindings)),
			findOne: jest.fn().mockResolvedValue(null),
			create: jest.fn().mockImplementation((data: Record<string, unknown>) => ({ ...data, id: uuid() })),
			save: jest.fn().mockImplementation((entity) => {
				savedBindings.push(entity as SpaceMediaActivityBindingEntity);

				return Promise.resolve(entity);
			}),
			remove: jest.fn().mockResolvedValue(undefined),
		};

		mockSpacesService = {
			getOneOrThrow: jest.fn().mockResolvedValue({ id: spaceId }),
		};

		mockDerivedEndpointService = {
			buildEndpointsForSpace: jest.fn().mockResolvedValue({ spaceId, endpoints: [] }),
		};

		mockMediaCapabilityService = {
			getMediaCapabilitiesInSpace: jest.fn().mockResolvedValue([]),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SpaceMediaActivityBindingService,
				{ provide: getRepositoryToken(SpaceMediaActivityBindingEntity), useValue: mockRepository },
				{ provide: SpacesService, useValue: mockSpacesService },
				{ provide: DerivedMediaEndpointService, useValue: mockDerivedEndpointService },
				{ provide: MediaCapabilityService, useValue: mockMediaCapabilityService },
			],
		}).compile();

		service = module.get<SpaceMediaActivityBindingService>(SpaceMediaActivityBindingService);
	});

	describe('applyDefaults', () => {
		describe('TV-only setup', () => {
			beforeEach(() => {
				const endpoints = [
					buildEndpoint(MediaEndpointType.DISPLAY, tvDeviceId, 'TV (Display)', {
						power: true,
						inputSelect: true,
					}),
					buildEndpoint(MediaEndpointType.AUDIO_OUTPUT, tvDeviceId, 'TV (Audio Output)', {
						power: true,
						volume: true,
					}),
					buildEndpoint(MediaEndpointType.REMOTE_TARGET, tvDeviceId, 'TV (Remote Target)', {
						remoteCommands: true,
					}),
				];

				mockDerivedEndpointService.buildEndpointsForSpace.mockResolvedValue({ spaceId, endpoints });
				mockMediaCapabilityService.getMediaCapabilitiesInSpace.mockResolvedValue([
					buildSummary(tvDeviceId, 'TV', DeviceCategory.TELEVISION),
				]);
			});

			it('should create bindings for all 4 configurable activity keys (off excluded)', async () => {
				await service.applyDefaults(spaceId);

				expect(mockRepository.save).toHaveBeenCalledTimes(4);
			});

			it('should assign TV display for Watch', async () => {
				await service.applyDefaults(spaceId);

				const watchBinding = savedBindings.find((b) => b.activityKey === MediaActivityKey.WATCH);

				expect(watchBinding).toBeDefined();
				expect(watchBinding.displayEndpointId).toBe(`${spaceId}:display:${tvDeviceId}`);
				expect(watchBinding.audioEndpointId).toBe(`${spaceId}:audio_output:${tvDeviceId}`);
				expect(watchBinding.remoteEndpointId).toBe(`${spaceId}:remote_target:${tvDeviceId}`);
			});

			it('should leave Listen without display', async () => {
				await service.applyDefaults(spaceId);

				const listenBinding = savedBindings.find((b) => b.activityKey === MediaActivityKey.LISTEN);

				expect(listenBinding).toBeDefined();
				expect(listenBinding.displayEndpointId).toBeNull();
				expect(listenBinding.audioEndpointId).toBe(`${spaceId}:audio_output:${tvDeviceId}`);
			});

			it('should not create a binding for off', async () => {
				await service.applyDefaults(spaceId);

				const offBinding = savedBindings.find((b) => b.activityKey === MediaActivityKey.OFF);

				expect(offBinding).toBeUndefined();
			});
		});

		describe('Speaker-only setup', () => {
			beforeEach(() => {
				const endpoints = [
					buildEndpoint(MediaEndpointType.AUDIO_OUTPUT, speakerDeviceId, 'Speaker (Audio Output)', {
						power: true,
						volume: true,
						playback: true,
					}),
					buildEndpoint(MediaEndpointType.SOURCE, speakerDeviceId, 'Speaker (Source)', {
						playback: true,
						track: true,
					}),
				];

				mockDerivedEndpointService.buildEndpointsForSpace.mockResolvedValue({ spaceId, endpoints });
				mockMediaCapabilityService.getMediaCapabilitiesInSpace.mockResolvedValue([
					buildSummary(speakerDeviceId, 'Speaker', DeviceCategory.SPEAKER),
				]);
			});

			it('should prefer playback-capable audio for Listen', async () => {
				await service.applyDefaults(spaceId);

				const listenBinding = savedBindings.find((b) => b.activityKey === MediaActivityKey.LISTEN);

				expect(listenBinding.audioEndpointId).toBe(`${spaceId}:audio_output:${speakerDeviceId}`);
				expect(listenBinding.sourceEndpointId).toBe(`${spaceId}:source:${speakerDeviceId}`);
			});

			it('should set volume preset 20 for Background', async () => {
				await service.applyDefaults(spaceId);

				const bgBinding = savedBindings.find((b) => b.activityKey === MediaActivityKey.BACKGROUND);

				expect(bgBinding.audioEndpointId).toBe(`${spaceId}:audio_output:${speakerDeviceId}`);
				expect(bgBinding.audioVolumePreset).toBe(20);
			});

			it('should have no display for any activity', async () => {
				await service.applyDefaults(spaceId);

				for (const binding of savedBindings) {
					expect(binding.displayEndpointId).toBeNull();
				}
			});
		});

		describe('Full media rig (TV + AVR + Speaker + Streamer + Console)', () => {
			beforeEach(() => {
				const endpoints = [
					// TV endpoints
					buildEndpoint(MediaEndpointType.DISPLAY, tvDeviceId, 'TV (Display)', {
						power: true,
						inputSelect: true,
					}),
					buildEndpoint(MediaEndpointType.AUDIO_OUTPUT, tvDeviceId, 'TV (Audio Output)', {
						power: true,
						volume: true,
					}),
					buildEndpoint(MediaEndpointType.REMOTE_TARGET, tvDeviceId, 'TV (Remote Target)', {
						remoteCommands: true,
						power: true,
					}),
					// AVR endpoints
					buildEndpoint(MediaEndpointType.AUDIO_OUTPUT, avrDeviceId, 'AVR (Audio Output)', {
						power: true,
						volume: true,
						mute: true,
					}),
					buildEndpoint(MediaEndpointType.SOURCE, avrDeviceId, 'AVR (Source)', {
						inputSelect: true,
					}),
					// Speaker endpoints
					buildEndpoint(MediaEndpointType.AUDIO_OUTPUT, speakerDeviceId, 'Speaker (Audio Output)', {
						power: true,
						volume: true,
						playback: true,
					}),
					buildEndpoint(MediaEndpointType.SOURCE, speakerDeviceId, 'Speaker (Source)', {
						playback: true,
						track: true,
					}),
					// Streamer endpoints
					buildEndpoint(MediaEndpointType.SOURCE, streamerDeviceId, 'Streamer (Source)', {
						playback: true,
						track: true,
						power: true,
					}),
					buildEndpoint(MediaEndpointType.REMOTE_TARGET, streamerDeviceId, 'Streamer (Remote Target)', {
						remoteCommands: true,
					}),
					// Console endpoints
					buildEndpoint(MediaEndpointType.SOURCE, consoleDeviceId, 'Console (Source)', {
						power: true,
					}),
					buildEndpoint(MediaEndpointType.REMOTE_TARGET, consoleDeviceId, 'Console (Remote Target)', {
						remoteCommands: true,
					}),
				];

				mockDerivedEndpointService.buildEndpointsForSpace.mockResolvedValue({ spaceId, endpoints });
				mockMediaCapabilityService.getMediaCapabilitiesInSpace.mockResolvedValue([
					buildSummary(tvDeviceId, 'TV', DeviceCategory.TELEVISION),
					buildSummary(avrDeviceId, 'AVR', DeviceCategory.AV_RECEIVER),
					buildSummary(speakerDeviceId, 'Speaker', DeviceCategory.SPEAKER),
					buildSummary(streamerDeviceId, 'Streamer', DeviceCategory.STREAMING_SERVICE),
					buildSummary(consoleDeviceId, 'Console', DeviceCategory.GAME_CONSOLE),
				]);
			});

			it('Watch: should prefer AVR audio over TV speaker', async () => {
				await service.applyDefaults(spaceId);

				const watchBinding = savedBindings.find((b) => b.activityKey === MediaActivityKey.WATCH);

				expect(watchBinding.displayEndpointId).toBe(`${spaceId}:display:${tvDeviceId}`);
				expect(watchBinding.audioEndpointId).toBe(`${spaceId}:audio_output:${avrDeviceId}`);
			});

			it('Watch: should prefer streamer as source', async () => {
				await service.applyDefaults(spaceId);

				const watchBinding = savedBindings.find((b) => b.activityKey === MediaActivityKey.WATCH);

				expect(watchBinding.sourceEndpointId).toBe(`${spaceId}:source:${streamerDeviceId}`);
			});

			it('Watch: should use TV remote target', async () => {
				await service.applyDefaults(spaceId);

				const watchBinding = savedBindings.find((b) => b.activityKey === MediaActivityKey.WATCH);

				expect(watchBinding.remoteEndpointId).toBe(`${spaceId}:remote_target:${tvDeviceId}`);
			});

			it('Listen: should prefer speaker (playback-capable) over AVR', async () => {
				await service.applyDefaults(spaceId);

				const listenBinding = savedBindings.find((b) => b.activityKey === MediaActivityKey.LISTEN);

				expect(listenBinding.audioEndpointId).toBe(`${spaceId}:audio_output:${speakerDeviceId}`);
			});

			it('Listen: should pick playback-capable source', async () => {
				await service.applyDefaults(spaceId);

				const listenBinding = savedBindings.find((b) => b.activityKey === MediaActivityKey.LISTEN);

				// Speaker source or streamer source (both have playback)
				expect(listenBinding.sourceEndpointId).toBeTruthy();
			});

			it('Gaming: should prefer console as source', async () => {
				await service.applyDefaults(spaceId);

				const gamingBinding = savedBindings.find((b) => b.activityKey === MediaActivityKey.GAMING);

				expect(gamingBinding.sourceEndpointId).toBe(`${spaceId}:source:${consoleDeviceId}`);
			});

			it('Gaming: should prefer AVR audio', async () => {
				await service.applyDefaults(spaceId);

				const gamingBinding = savedBindings.find((b) => b.activityKey === MediaActivityKey.GAMING);

				expect(gamingBinding.audioEndpointId).toBe(`${spaceId}:audio_output:${avrDeviceId}`);
			});

			it('Gaming: should use TV display and remote', async () => {
				await service.applyDefaults(spaceId);

				const gamingBinding = savedBindings.find((b) => b.activityKey === MediaActivityKey.GAMING);

				expect(gamingBinding.displayEndpointId).toBe(`${spaceId}:display:${tvDeviceId}`);
				expect(gamingBinding.remoteEndpointId).toBe(`${spaceId}:remote_target:${tvDeviceId}`);
			});

			it('Background: should prefer playback speaker with volume preset 20', async () => {
				await service.applyDefaults(spaceId);

				const bgBinding = savedBindings.find((b) => b.activityKey === MediaActivityKey.BACKGROUND);

				expect(bgBinding.audioEndpointId).toBe(`${spaceId}:audio_output:${speakerDeviceId}`);
				expect(bgBinding.audioVolumePreset).toBe(20);
				expect(bgBinding.displayEndpointId).toBeNull();
				expect(bgBinding.sourceEndpointId).toBeNull();
			});
		});

		it('should not overwrite existing bindings', async () => {
			const existingBinding = {
				id: uuid(),
				spaceId,
				activityKey: MediaActivityKey.WATCH,
				displayEndpointId: 'custom-display',
				audioEndpointId: 'custom-audio',
				sourceEndpointId: null,
				remoteEndpointId: null,
				displayInputId: null,
				audioInputId: null,
				sourceInputId: null,
				audioVolumePreset: null,
			} as unknown as SpaceMediaActivityBindingEntity;

			savedBindings = [existingBinding];
			mockRepository.find.mockResolvedValue([existingBinding]);

			const endpoints = [buildEndpoint(MediaEndpointType.DISPLAY, tvDeviceId, 'TV', { power: true })];

			mockDerivedEndpointService.buildEndpointsForSpace.mockResolvedValue({ spaceId, endpoints });
			mockMediaCapabilityService.getMediaCapabilitiesInSpace.mockResolvedValue([
				buildSummary(tvDeviceId, 'TV', DeviceCategory.TELEVISION),
			]);

			await service.applyDefaults(spaceId);

			// Should create 3 (not 4) since WATCH already exists, and OFF is excluded
			expect(mockRepository.save).toHaveBeenCalledTimes(3);

			// The existing watch binding should not be touched
			const watchSaves = savedBindings.filter(
				(b) => b.activityKey === MediaActivityKey.WATCH && b.displayEndpointId === 'custom-display',
			);

			expect(watchSaves).toHaveLength(1);
		});
	});

	describe('validateBindings', () => {
		it('should report missing bindings', async () => {
			mockRepository.find.mockResolvedValue([]);
			mockDerivedEndpointService.buildEndpointsForSpace.mockResolvedValue({ spaceId, endpoints: [] });

			const reports = await service.validateBindings(spaceId);

			expect(reports).toHaveLength(4); // One per configurable activity key (off excluded)
			expect(reports.every((r) => r.bindingId === null)).toBe(true);
			expect(reports.every((r) => r.valid)).toBe(true); // Missing is info, not error
		});

		it('should report endpoint not found', async () => {
			const binding = {
				id: uuid(),
				spaceId,
				activityKey: MediaActivityKey.WATCH,
				displayEndpointId: 'nonexistent',
				audioEndpointId: null,
				sourceEndpointId: null,
				remoteEndpointId: null,
				displayInputId: null,
				audioInputId: null,
				sourceInputId: null,
				audioVolumePreset: null,
			};

			mockRepository.find.mockResolvedValue([binding]);
			mockDerivedEndpointService.buildEndpointsForSpace.mockResolvedValue({ spaceId, endpoints: [] });

			const reports = await service.validateBindings(spaceId);

			const watchReport = reports.find((r) => r.activityKey === MediaActivityKey.WATCH);

			expect(watchReport.valid).toBe(false);
			expect(watchReport.issues.some((i) => i.severity === 'error' && i.message.includes('not found'))).toBe(true);
		});

		it('should report missing slots as warnings for video activities', async () => {
			const binding = {
				id: uuid(),
				spaceId,
				activityKey: MediaActivityKey.WATCH,
				displayEndpointId: null,
				audioEndpointId: null,
				sourceEndpointId: null,
				remoteEndpointId: null,
				displayInputId: null,
				audioInputId: null,
				sourceInputId: null,
				audioVolumePreset: null,
			};

			mockRepository.find.mockResolvedValue([binding]);
			mockDerivedEndpointService.buildEndpointsForSpace.mockResolvedValue({ spaceId, endpoints: [] });

			const reports = await service.validateBindings(spaceId);

			const watchReport = reports.find((r) => r.activityKey === MediaActivityKey.WATCH);

			expect(watchReport.issues.filter((i) => i.severity === 'warning')).toHaveLength(2); // display + audio
		});
	});
});
