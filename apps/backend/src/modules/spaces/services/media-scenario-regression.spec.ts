/**
 * Media Domain – Regression Test Suite
 *
 * Validates deterministic behavior across 4 simulator scenario templates:
 *   1. media_tv_only
 *   2. media_speaker_only
 *   3. media_tv_avr_console_streamer (the "Media Rig")
 *   4. media_multi_output (edge case)
 *
 * Sections:
 *   3.1 – Endpoints derivation
 *   3.2 – Default bindings quality (apply-defaults)
 *   3.3 – Activation behavior
 *   3.4 – Failure model
 *   3.5 – WS events
 */
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { DeviceCategory } from '../../devices/devices.constants';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { SpaceActiveMediaActivityEntity } from '../entities/space-active-media-activity.entity';
import { SpaceMediaActivityBindingEntity } from '../entities/space-media-activity-binding.entity';
import { DerivedMediaEndpointModel } from '../models/derived-media-endpoint.model';
import { MediaCapabilitySummaryModel } from '../models/media-routing.model';
import { EventType, MediaActivationState, MediaActivityKey, MediaEndpointType } from '../spaces.constants';

import {
	DEVICE_AVR,
	DEVICE_CONSOLE,
	DEVICE_PROJECTOR,
	DEVICE_SPEAKER,
	DEVICE_STREAMER,
	DEVICE_TV,
	MediaScenario,
	SPACE_ID,
	ScenarioDevice,
	mediaMultiOutput,
	mediaSpeakerOnly,
	mediaTvAvrConsoleStreamer,
	mediaTvOnly,
	resetIds,
} from './__fixtures__/media-scenario-templates';
import { MediaTestHarness } from './__fixtures__/media-test-harness';
import { DerivedMediaEndpointService } from './derived-media-endpoint.service';
import { MediaCapabilityService } from './media-capability.service';
import { SpaceMediaActivityBindingService } from './space-media-activity-binding.service';
import { SpaceMediaActivityService } from './space-media-activity.service';
import { SpacesService } from './spaces.service';

// ==========================================================================
// Shared helpers
// ==========================================================================

function buildSummaryFromDevice(d: ScenarioDevice): Record<string, unknown> {
	return {
		deviceId: d.deviceId,
		deviceName: d.deviceName,
		deviceCategory: d.deviceCategory,
		isOnline: d.isOnline,
		suggestedEndpointTypes: d.suggestedEndpointTypes,
		power: d.power,
		volume: d.volume,
		mute: d.mute,
		playback: d.playback,
		playbackState: d.playbackState,
		input: d.input,
		remote: d.remote,
		trackMetadata: d.trackMetadata,
	};
}

// ==========================================================================
// 3.1 – Endpoints derivation
// ==========================================================================

describe('Media Regression – Endpoints Derivation', () => {
	let service: DerivedMediaEndpointService;
	let mockSpacesService: { getOneOrThrow: jest.Mock };
	let mockMediaCapabilityService: { getMediaCapabilitiesInSpace: jest.Mock };

	beforeEach(async () => {
		resetIds();
		mockSpacesService = {
			getOneOrThrow: jest.fn().mockResolvedValue({ id: SPACE_ID, name: 'Test Space' }),
		};
		mockMediaCapabilityService = {
			getMediaCapabilitiesInSpace: jest.fn().mockResolvedValue([]),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				DerivedMediaEndpointService,
				{ provide: SpacesService, useValue: mockSpacesService },
				{ provide: MediaCapabilityService, useValue: mockMediaCapabilityService },
			],
		}).compile();

		service = module.get<DerivedMediaEndpointService>(DerivedMediaEndpointService);
	});

	function loadScenario(scenario: MediaScenario) {
		const summaries = scenario.devices.map((d) => buildSummaryFromDevice(d));
		mockMediaCapabilityService.getMediaCapabilitiesInSpace.mockResolvedValue(summaries);
	}

	describe('media_tv_only (no volume)', () => {
		it('should produce 2 endpoints: DISPLAY + REMOTE_TARGET', async () => {
			loadScenario(mediaTvOnly());
			const result = await service.buildEndpointsForSpace(SPACE_ID);

			expect(result.endpoints.length).toBe(2);
			const types = result.endpoints.map((e) => e.type);
			expect(types).toContain(MediaEndpointType.DISPLAY);
			expect(types).toContain(MediaEndpointType.REMOTE_TARGET);
			expect(types).not.toContain(MediaEndpointType.AUDIO_OUTPUT);
		});

		it('should use deterministic endpointId format', async () => {
			loadScenario(mediaTvOnly());
			const result = await service.buildEndpointsForSpace(SPACE_ID);

			const display = result.endpoints.find((e) => e.type === MediaEndpointType.DISPLAY);
			expect(display?.endpointId).toBe(`${SPACE_ID}:display:${DEVICE_TV}`);
		});

		it('should have inputSelect + power on display', async () => {
			loadScenario(mediaTvOnly());
			const result = await service.buildEndpointsForSpace(SPACE_ID);

			const display = result.endpoints.find((e) => e.type === MediaEndpointType.DISPLAY);
			expect(display?.capabilities.power).toBe(true);
			expect(display?.capabilities.inputSelect).toBe(true);
			expect(display?.capabilities.volume).toBe(false);
		});
	});

	describe('media_tv_only (with volume)', () => {
		it('should produce 3 endpoints: DISPLAY + AUDIO_OUTPUT + REMOTE_TARGET', async () => {
			loadScenario(mediaTvOnly({ tvVolume: true }));
			const result = await service.buildEndpointsForSpace(SPACE_ID);

			expect(result.endpoints.length).toBe(3);
			const types = result.endpoints.map((e) => e.type);
			expect(types).toContain(MediaEndpointType.DISPLAY);
			expect(types).toContain(MediaEndpointType.AUDIO_OUTPUT);
			expect(types).toContain(MediaEndpointType.REMOTE_TARGET);
		});
	});

	describe('media_speaker_only', () => {
		it('should produce 2 endpoints: AUDIO_OUTPUT + SOURCE (playback present)', async () => {
			loadScenario(mediaSpeakerOnly());
			const result = await service.buildEndpointsForSpace(SPACE_ID);

			expect(result.endpoints.length).toBe(2);
			const types = result.endpoints.map((e) => e.type);
			expect(types).toContain(MediaEndpointType.AUDIO_OUTPUT);
			expect(types).toContain(MediaEndpointType.SOURCE);
		});

		it('AUDIO_OUTPUT should have playback + track capabilities', async () => {
			loadScenario(mediaSpeakerOnly());
			const result = await service.buildEndpointsForSpace(SPACE_ID);

			const audio = result.endpoints.find((e) => e.type === MediaEndpointType.AUDIO_OUTPUT);
			expect(audio?.capabilities.volume).toBe(true);
			expect(audio?.capabilities.playback).toBe(true);
		});
	});

	describe('media_tv_avr_console_streamer', () => {
		it('should produce correct endpoint counts per device', async () => {
			loadScenario(mediaTvAvrConsoleStreamer());
			const result = await service.buildEndpointsForSpace(SPACE_ID);

			// TV: display + remote_target (no volume = no audio_output)
			const tvEps = result.endpoints.filter((e) => e.deviceId === DEVICE_TV);
			expect(tvEps.map((e) => e.type)).toEqual(
				expect.arrayContaining([MediaEndpointType.DISPLAY, MediaEndpointType.REMOTE_TARGET]),
			);

			// AVR: audio_output + source (has input)
			const avrEps = result.endpoints.filter((e) => e.deviceId === DEVICE_AVR);
			expect(avrEps.map((e) => e.type)).toEqual(
				expect.arrayContaining([MediaEndpointType.AUDIO_OUTPUT, MediaEndpointType.SOURCE]),
			);
			const avrAudio = avrEps.find((e) => e.type === MediaEndpointType.AUDIO_OUTPUT);
			expect(avrAudio?.capabilities.volume).toBe(true);

			// Streamer: source + remote_target
			const strEps = result.endpoints.filter((e) => e.deviceId === DEVICE_STREAMER);
			expect(strEps.map((e) => e.type)).toEqual(
				expect.arrayContaining([MediaEndpointType.SOURCE, MediaEndpointType.REMOTE_TARGET]),
			);
			const strSource = strEps.find((e) => e.type === MediaEndpointType.SOURCE);
			expect(strSource?.capabilities.playback).toBe(true);
			expect(strSource?.capabilities.track).toBe(true);

			// Console: source only (power only, no volume/playback/remote)
			const conEps = result.endpoints.filter((e) => e.deviceId === DEVICE_CONSOLE);
			expect(conEps.length).toBe(1);
			expect(conEps[0].type).toBe(MediaEndpointType.SOURCE);
		});
	});

	describe('media_multi_output', () => {
		it('should produce endpoints for 2 displays and 2 audio outputs', async () => {
			loadScenario(mediaMultiOutput());
			const result = await service.buildEndpointsForSpace(SPACE_ID);

			const displays = result.endpoints.filter((e) => e.type === MediaEndpointType.DISPLAY);
			expect(displays.length).toBe(2);
			expect(displays.map((d) => d.deviceId)).toEqual(expect.arrayContaining([DEVICE_TV, DEVICE_PROJECTOR]));

			const audioOutputs = result.endpoints.filter((e) => e.type === MediaEndpointType.AUDIO_OUTPUT);
			expect(audioOutputs.length).toBe(2);
			expect(audioOutputs.map((a) => a.deviceId)).toEqual(expect.arrayContaining([DEVICE_AVR, DEVICE_SPEAKER]));
		});

		it('endpoint IDs should be stable across invocations', async () => {
			loadScenario(mediaMultiOutput());
			const r1 = await service.buildEndpointsForSpace(SPACE_ID);
			const r2 = await service.buildEndpointsForSpace(SPACE_ID);

			expect(r1.endpoints.map((e) => e.endpointId)).toEqual(r2.endpoints.map((e) => e.endpointId));
		});
	});
});

// ==========================================================================
// 3.2 – Default bindings quality (apply-defaults)
// ==========================================================================

describe('Media Regression – Default Bindings Quality', () => {
	let service: SpaceMediaActivityBindingService;
	let harness: MediaTestHarness;

	beforeEach(async () => {
		resetIds();
		harness = new MediaTestHarness();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SpaceMediaActivityBindingService,
				{ provide: getRepositoryToken(SpaceMediaActivityBindingEntity), useValue: harness.mockBindingRepository },
				{ provide: SpacesService, useValue: harness.mockSpacesService },
				{ provide: DerivedMediaEndpointService, useValue: harness.mockDerivedEndpointService },
				{ provide: MediaCapabilityService, useValue: harness.mockMediaCapabilityService },
				{ provide: EventEmitter2, useValue: harness.mockEventEmitter },
			],
		}).compile();

		service = module.get<SpaceMediaActivityBindingService>(SpaceMediaActivityBindingService);
	});

	function loadScenarioOnly(scenario: MediaScenario) {
		harness.loadScenario(scenario);
	}

	function setEndpoints(scenario: MediaScenario, endpoints: DerivedMediaEndpointModel[]) {
		harness.mockDerivedEndpointService.buildEndpointsForSpace.mockResolvedValue({
			spaceId: scenario.spaceId,
			endpoints,
		});
	}

	describe('media_tv_only', () => {
		it('Watch: display + audio should use TV', async () => {
			const scenario = mediaTvOnly({ tvVolume: true });
			loadScenarioOnly(scenario);
			setEndpoints(scenario, [
				harness.buildEndpoint(MediaEndpointType.DISPLAY, DEVICE_TV, 'TV (Display)', { power: true, inputSelect: true }),
				harness.buildEndpoint(MediaEndpointType.AUDIO_OUTPUT, DEVICE_TV, 'TV (Audio)', { power: true, volume: true }),
				harness.buildEndpoint(MediaEndpointType.REMOTE_TARGET, DEVICE_TV, 'TV (Remote)', { remoteCommands: true }),
			]);

			await service.applyDefaults(SPACE_ID);

			const watch = harness.savedBindings.find((b) => b.activityKey === MediaActivityKey.WATCH);
			expect(watch?.displayEndpointId).toBe(`${SPACE_ID}:display:${DEVICE_TV}`);
			expect(watch?.audioEndpointId).toBe(`${SPACE_ID}:audio_output:${DEVICE_TV}`);
			expect(watch?.remoteEndpointId).toBe(`${SPACE_ID}:remote_target:${DEVICE_TV}`);
		});
	});

	describe('media_tv_avr_console_streamer', () => {
		let endpoints: DerivedMediaEndpointModel[];

		beforeEach(() => {
			const scenario = mediaTvAvrConsoleStreamer();
			loadScenarioOnly(scenario);
			endpoints = [
				harness.buildEndpoint(MediaEndpointType.DISPLAY, DEVICE_TV, 'TV (Display)', { power: true, inputSelect: true }),
				harness.buildEndpoint(MediaEndpointType.REMOTE_TARGET, DEVICE_TV, 'TV (Remote)', {
					remoteCommands: true,
					power: true,
				}),
				harness.buildEndpoint(MediaEndpointType.AUDIO_OUTPUT, DEVICE_AVR, 'AVR (Audio)', {
					power: true,
					volume: true,
					mute: true,
				}),
				harness.buildEndpoint(MediaEndpointType.SOURCE, DEVICE_AVR, 'AVR (Source)', { inputSelect: true }),
				harness.buildEndpoint(MediaEndpointType.SOURCE, DEVICE_STREAMER, 'Streamer (Source)', {
					playback: true,
					track: true,
					power: true,
				}),
				harness.buildEndpoint(MediaEndpointType.REMOTE_TARGET, DEVICE_STREAMER, 'Streamer (Remote)', {
					remoteCommands: true,
				}),
				harness.buildEndpoint(MediaEndpointType.SOURCE, DEVICE_CONSOLE, 'Console (Source)', { power: true }),
				harness.buildEndpoint(MediaEndpointType.REMOTE_TARGET, DEVICE_CONSOLE, 'Console (Remote)', {
					remoteCommands: true,
				}),
			];
			setEndpoints(scenario, endpoints);
			harness.mockMediaCapabilityService.getMediaCapabilitiesInSpace.mockResolvedValue(
				scenario.devices.map((d) => {
					const s = new MediaCapabilitySummaryModel();
					s.deviceId = d.deviceId;
					s.deviceName = d.deviceName;
					s.deviceCategory = d.deviceCategory;
					s.isOnline = true;
					s.suggestedEndpointTypes = [];
					return s;
				}),
			);
		});

		it('Watch: audio prefers AVR over TV speaker', async () => {
			await service.applyDefaults(SPACE_ID);

			const watch = harness.savedBindings.find((b) => b.activityKey === MediaActivityKey.WATCH);
			expect(watch?.displayEndpointId).toBe(`${SPACE_ID}:display:${DEVICE_TV}`);
			expect(watch?.audioEndpointId).toBe(`${SPACE_ID}:audio_output:${DEVICE_AVR}`);
		});

		it('Watch: source prefers streamer', async () => {
			await service.applyDefaults(SPACE_ID);

			const watch = harness.savedBindings.find((b) => b.activityKey === MediaActivityKey.WATCH);
			expect(watch?.sourceEndpointId).toBe(`${SPACE_ID}:source:${DEVICE_STREAMER}`);
		});

		it('Gaming: source prefers console', async () => {
			await service.applyDefaults(SPACE_ID);

			const gaming = harness.savedBindings.find((b) => b.activityKey === MediaActivityKey.GAMING);
			expect(gaming?.sourceEndpointId).toBe(`${SPACE_ID}:source:${DEVICE_CONSOLE}`);
		});

		it('Gaming: display uses TV', async () => {
			await service.applyDefaults(SPACE_ID);

			const gaming = harness.savedBindings.find((b) => b.activityKey === MediaActivityKey.GAMING);
			expect(gaming?.displayEndpointId).toBe(`${SPACE_ID}:display:${DEVICE_TV}`);
		});

		it('Gaming: audio prefers AVR', async () => {
			await service.applyDefaults(SPACE_ID);

			const gaming = harness.savedBindings.find((b) => b.activityKey === MediaActivityKey.GAMING);
			expect(gaming?.audioEndpointId).toBe(`${SPACE_ID}:audio_output:${DEVICE_AVR}`);
		});

		it('should never overwrite existing bindings', async () => {
			const existing = {
				id: uuid(),
				spaceId: SPACE_ID,
				activityKey: MediaActivityKey.WATCH,
				displayEndpointId: 'custom-ep',
				audioEndpointId: null,
				sourceEndpointId: null,
				remoteEndpointId: null,
				displayInputId: null,
				audioInputId: null,
				sourceInputId: null,
				audioVolumePreset: null,
			};
			harness.savedBindings = [existing];
			harness.mockBindingRepository.find.mockResolvedValue([existing]);

			await service.applyDefaults(SPACE_ID);

			// Watch should not be re-created (3 new, not 4; off is excluded)
			expect(harness.mockBindingRepository.save).toHaveBeenCalledTimes(3);
			const watchBindings = harness.savedBindings.filter(
				(b) => b.activityKey === MediaActivityKey.WATCH && b.displayEndpointId === 'custom-ep',
			);
			expect(watchBindings).toHaveLength(1);
		});
	});

	describe('media_speaker_only', () => {
		it('Listen: prefers speaker with playback capability', async () => {
			const scenario = mediaSpeakerOnly();
			loadScenarioOnly(scenario);
			setEndpoints(scenario, [
				harness.buildEndpoint(MediaEndpointType.AUDIO_OUTPUT, DEVICE_SPEAKER, 'Speaker (Audio)', {
					power: true,
					volume: true,
					playback: true,
				}),
				harness.buildEndpoint(MediaEndpointType.SOURCE, DEVICE_SPEAKER, 'Speaker (Source)', {
					playback: true,
					track: true,
				}),
			]);
			harness.mockMediaCapabilityService.getMediaCapabilitiesInSpace.mockResolvedValue([
				(() => {
					const s = new MediaCapabilitySummaryModel();
					s.deviceId = DEVICE_SPEAKER;
					s.deviceName = 'Speaker';
					s.deviceCategory = DeviceCategory.SPEAKER;
					s.isOnline = true;
					s.suggestedEndpointTypes = [];
					return s;
				})(),
			]);

			await service.applyDefaults(SPACE_ID);

			const listen = harness.savedBindings.find((b) => b.activityKey === MediaActivityKey.LISTEN);
			expect(listen?.audioEndpointId).toBe(`${SPACE_ID}:audio_output:${DEVICE_SPEAKER}`);
			expect(listen?.sourceEndpointId).toBe(`${SPACE_ID}:source:${DEVICE_SPEAKER}`);
		});
	});

	describe('media_multi_output', () => {
		it('default selection is stable across repeated calls', async () => {
			const scenario = mediaMultiOutput();
			loadScenarioOnly(scenario);
			const eps = [
				harness.buildEndpoint(MediaEndpointType.DISPLAY, DEVICE_TV, 'TV (Display)', { power: true, inputSelect: true }),
				harness.buildEndpoint(MediaEndpointType.DISPLAY, DEVICE_PROJECTOR, 'Projector (Display)', {
					power: true,
					inputSelect: true,
				}),
				harness.buildEndpoint(MediaEndpointType.AUDIO_OUTPUT, DEVICE_AVR, 'AVR (Audio)', {
					power: true,
					volume: true,
					mute: true,
				}),
				harness.buildEndpoint(MediaEndpointType.AUDIO_OUTPUT, DEVICE_SPEAKER, 'Speaker (Audio)', {
					power: true,
					volume: true,
					playback: true,
				}),
				harness.buildEndpoint(MediaEndpointType.REMOTE_TARGET, DEVICE_TV, 'TV (Remote)', { remoteCommands: true }),
				harness.buildEndpoint(MediaEndpointType.SOURCE, DEVICE_SPEAKER, 'Speaker (Source)', {
					playback: true,
					track: true,
				}),
			];
			setEndpoints(scenario, eps);
			harness.mockMediaCapabilityService.getMediaCapabilitiesInSpace.mockResolvedValue(
				scenario.devices.map((d) => {
					const s = new MediaCapabilitySummaryModel();
					s.deviceId = d.deviceId;
					s.deviceName = d.deviceName;
					s.deviceCategory = d.deviceCategory;
					s.isOnline = true;
					s.suggestedEndpointTypes = [];
					return s;
				}),
			);

			await service.applyDefaults(SPACE_ID);
			const firstRun = [...harness.savedBindings];

			// Reset and run again
			harness.savedBindings = [];
			harness.mockBindingRepository.find.mockResolvedValue([]);

			await service.applyDefaults(SPACE_ID);
			const secondRun = [...harness.savedBindings];

			// Compare bindings for each activity key
			for (const key of [
				MediaActivityKey.WATCH,
				MediaActivityKey.LISTEN,
				MediaActivityKey.GAMING,
				MediaActivityKey.BACKGROUND,
				MediaActivityKey.OFF,
			]) {
				const first = firstRun.find((b) => b.activityKey === key);
				const second = secondRun.find((b) => b.activityKey === key);
				expect(first?.displayEndpointId).toBe(second?.displayEndpointId);
				expect(first?.audioEndpointId).toBe(second?.audioEndpointId);
				expect(first?.sourceEndpointId).toBe(second?.sourceEndpointId);
			}
		});
	});
});

// ==========================================================================
// 3.3 – Activation behavior
// ==========================================================================

// Activation tests include inter-step delays (STEP_PRE_DELAY_MS + STEP_POST_DELAY_MS per step)
describe('Media Regression – Activation Behavior', () => {
	let service: SpaceMediaActivityService;
	let harness: MediaTestHarness;

	beforeEach(async () => {
		resetIds();
		harness = new MediaTestHarness();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SpaceMediaActivityService,
				{ provide: getRepositoryToken(SpaceActiveMediaActivityEntity), useValue: harness.mockActiveRepository },
				{ provide: SpacesService, useValue: harness.mockSpacesService },
				{ provide: SpaceMediaActivityBindingService, useValue: harness.mockBindingService },
				{ provide: DerivedMediaEndpointService, useValue: harness.mockDerivedEndpointService },
				{ provide: PlatformRegistryService, useValue: harness.mockPlatformRegistry },
				{ provide: EventEmitter2, useValue: harness.mockEventEmitter },
			],
		}).compile();

		service = module.get<SpaceMediaActivityService>(SpaceMediaActivityService);
	});

	describe('Watch activation with TV display', () => {
		it('should attempt power + input steps and reach ACTIVE state', async () => {
			const scenario = mediaTvOnly({ tvVolume: true });
			harness.loadScenario(scenario);

			const powerPropId = scenario.devices[0].power.propertyId;
			const inputPropId = scenario.devices[0].input.propertyId;
			const volumePropId = scenario.devices[0].volume.propertyId;

			const displayEndpointId = `${SPACE_ID}:display:${DEVICE_TV}`;
			const audioEndpointId = `${SPACE_ID}:audio_output:${DEVICE_TV}`;

			const binding = harness.buildBinding(MediaActivityKey.WATCH, {
				displayEndpointId,
				audioEndpointId,
				displayInputId: 'HDMI1',
				audioVolumePreset: 40,
			});
			harness.mockBindingService.findBySpace.mockResolvedValue([binding]);

			harness.mockDerivedEndpointService.buildEndpointsForSpace.mockResolvedValue({
				spaceId: SPACE_ID,
				endpoints: [
					harness.buildEndpoint(
						MediaEndpointType.DISPLAY,
						DEVICE_TV,
						'TV (Display)',
						{ power: true, inputSelect: true },
						{ power: { propertyId: powerPropId }, inputSelect: { propertyId: inputPropId } },
					),
					harness.buildEndpoint(
						MediaEndpointType.AUDIO_OUTPUT,
						DEVICE_TV,
						'TV (Audio)',
						{ power: true, volume: true },
						{ power: { propertyId: powerPropId }, volume: { propertyId: volumePropId } },
					),
				],
			});

			harness.mockSpacesService.findDevicesByIds.mockResolvedValue([
				harness.buildMockDevice(DEVICE_TV, [
					{ id: powerPropId, value: false },
					{ id: inputPropId, value: 'HDMI2' },
					{ id: volumePropId, value: 20 },
				]),
			]);

			const mockPlatform = { processBatch: jest.fn().mockResolvedValue(true) };
			harness.mockPlatformRegistry.get.mockReturnValue(mockPlatform);

			const result = await service.activate(SPACE_ID, MediaActivityKey.WATCH);

			expect(result.state).toBe(MediaActivationState.ACTIVE);
			expect(result.activityKey).toBe(MediaActivityKey.WATCH);
			expect(result.resolved?.displayDeviceId).toBe(DEVICE_TV);
			expect(result.summary?.stepsTotal).toBeGreaterThanOrEqual(2);
			expect(result.summary?.stepsSucceeded).toBeGreaterThanOrEqual(2);
		}, 15_000);
	});

	describe('Listen activation with speaker', () => {
		it('should derive volume/playback targets correctly', async () => {
			const scenario = mediaSpeakerOnly();
			harness.loadScenario(scenario);

			const powerPropId = scenario.devices[0].power.propertyId;
			const volumePropId = scenario.devices[0].volume.propertyId;

			const audioEndpointId = `${SPACE_ID}:audio_output:${DEVICE_SPEAKER}`;
			const sourceEndpointId = `${SPACE_ID}:source:${DEVICE_SPEAKER}`;

			const binding = harness.buildBinding(MediaActivityKey.LISTEN, {
				audioEndpointId,
				sourceEndpointId,
				audioVolumePreset: 30,
			});
			harness.mockBindingService.findBySpace.mockResolvedValue([binding]);

			harness.mockDerivedEndpointService.buildEndpointsForSpace.mockResolvedValue({
				spaceId: SPACE_ID,
				endpoints: [
					harness.buildEndpoint(
						MediaEndpointType.AUDIO_OUTPUT,
						DEVICE_SPEAKER,
						'Speaker (Audio)',
						{ power: true, volume: true, playback: true },
						{ power: { propertyId: powerPropId }, volume: { propertyId: volumePropId } },
					),
					harness.buildEndpoint(MediaEndpointType.SOURCE, DEVICE_SPEAKER, 'Speaker (Source)', {
						playback: true,
						track: true,
					}),
				],
			});

			harness.mockSpacesService.findDevicesByIds.mockResolvedValue([
				harness.buildMockDevice(DEVICE_SPEAKER, [
					{ id: powerPropId, value: false },
					{ id: volumePropId, value: 50 },
				]),
			]);

			const mockPlatform = { processBatch: jest.fn().mockResolvedValue(true) };
			harness.mockPlatformRegistry.get.mockReturnValue(mockPlatform);

			const result = await service.activate(SPACE_ID, MediaActivityKey.LISTEN);

			expect(result.state).toBe(MediaActivationState.ACTIVE);
			expect(result.activityKey).toBe(MediaActivityKey.LISTEN);
			expect(result.resolved?.audioDeviceId).toBe(DEVICE_SPEAKER);
		}, 15_000);
	});

	describe('Gaming activation with full rig', () => {
		it('should handle input selection chain when configured', async () => {
			const scenario = mediaTvAvrConsoleStreamer();
			harness.loadScenario(scenario);

			const tvPowerPropId = scenario.devices[0].power.propertyId;
			const tvInputPropId = scenario.devices[0].input.propertyId;
			const avrPowerPropId = scenario.devices[1].power.propertyId;
			const avrVolumePropId = scenario.devices[1].volume.propertyId;
			const avrInputPropId = scenario.devices[1].input.propertyId;
			const conPowerPropId = scenario.devices[3].power.propertyId;

			const binding = harness.buildBinding(MediaActivityKey.GAMING, {
				displayEndpointId: `${SPACE_ID}:display:${DEVICE_TV}`,
				audioEndpointId: `${SPACE_ID}:audio_output:${DEVICE_AVR}`,
				sourceEndpointId: `${SPACE_ID}:source:${DEVICE_CONSOLE}`,
				displayInputId: 'HDMI2',
			});
			harness.mockBindingService.findBySpace.mockResolvedValue([binding]);

			harness.mockDerivedEndpointService.buildEndpointsForSpace.mockResolvedValue({
				spaceId: SPACE_ID,
				endpoints: [
					harness.buildEndpoint(
						MediaEndpointType.DISPLAY,
						DEVICE_TV,
						'TV (Display)',
						{ power: true, inputSelect: true },
						{ power: { propertyId: tvPowerPropId }, inputSelect: { propertyId: tvInputPropId } },
					),
					harness.buildEndpoint(
						MediaEndpointType.AUDIO_OUTPUT,
						DEVICE_AVR,
						'AVR (Audio)',
						{ power: true, volume: true, mute: true, inputSelect: true },
						{
							power: { propertyId: avrPowerPropId },
							volume: { propertyId: avrVolumePropId },
							inputSelect: { propertyId: avrInputPropId },
						},
					),
					harness.buildEndpoint(MediaEndpointType.SOURCE, DEVICE_CONSOLE, 'Console (Source)', { power: true }),
				],
			});

			harness.mockSpacesService.findDevicesByIds.mockResolvedValue([
				harness.buildMockDevice(DEVICE_TV, [
					{ id: tvPowerPropId, value: false },
					{ id: tvInputPropId, value: 'HDMI1' },
				]),
				harness.buildMockDevice(DEVICE_AVR, [
					{ id: avrPowerPropId, value: false },
					{ id: avrVolumePropId, value: 30 },
					{ id: avrInputPropId, value: 'CD' },
				]),
				harness.buildMockDevice(DEVICE_CONSOLE, [{ id: conPowerPropId, value: false }]),
			]);

			const mockPlatform = { processBatch: jest.fn().mockResolvedValue(true) };
			harness.mockPlatformRegistry.get.mockReturnValue(mockPlatform);

			const result = await service.activate(SPACE_ID, MediaActivityKey.GAMING);

			expect(result.state).toBe(MediaActivationState.ACTIVE);
			expect(result.activityKey).toBe(MediaActivityKey.GAMING);
			expect(result.resolved?.displayDeviceId).toBe(DEVICE_TV);
			expect(result.resolved?.audioDeviceId).toBe(DEVICE_AVR);
		}, 15_000);
	});
});

// ==========================================================================
// 3.4 – Failure model
// ==========================================================================

describe('Media Regression – Failure Model', () => {
	let service: SpaceMediaActivityService;
	let harness: MediaTestHarness;

	beforeEach(async () => {
		resetIds();
		harness = new MediaTestHarness();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SpaceMediaActivityService,
				{ provide: getRepositoryToken(SpaceActiveMediaActivityEntity), useValue: harness.mockActiveRepository },
				{ provide: SpacesService, useValue: harness.mockSpacesService },
				{ provide: SpaceMediaActivityBindingService, useValue: harness.mockBindingService },
				{ provide: DerivedMediaEndpointService, useValue: harness.mockDerivedEndpointService },
				{ provide: PlatformRegistryService, useValue: harness.mockPlatformRegistry },
				{ provide: EventEmitter2, useValue: harness.mockEventEmitter },
			],
		}).compile();

		service = module.get<SpaceMediaActivityService>(SpaceMediaActivityService);
	});

	it('non-critical failure (volume preset fails) → state remains ACTIVE with warnings', async () => {
		const scenario = mediaSpeakerOnly();
		harness.loadScenario(scenario);

		const powerPropId = scenario.devices[0].power.propertyId;
		const volumePropId = scenario.devices[0].volume.propertyId;

		const binding = harness.buildBinding(MediaActivityKey.LISTEN, {
			audioEndpointId: `${SPACE_ID}:audio_output:${DEVICE_SPEAKER}`,
			audioVolumePreset: 30,
		});
		harness.mockBindingService.findBySpace.mockResolvedValue([binding]);

		harness.mockDerivedEndpointService.buildEndpointsForSpace.mockResolvedValue({
			spaceId: SPACE_ID,
			endpoints: [
				harness.buildEndpoint(
					MediaEndpointType.AUDIO_OUTPUT,
					DEVICE_SPEAKER,
					'Speaker (Audio)',
					{ power: true, volume: true },
					{ power: { propertyId: powerPropId }, volume: { propertyId: volumePropId } },
				),
			],
		});

		harness.mockSpacesService.findDevicesByIds.mockResolvedValue([
			harness.buildMockDevice(DEVICE_SPEAKER, [
				{ id: powerPropId, value: false },
				{ id: volumePropId, value: 50 },
			]),
		]);

		const mockPlatform = {
			processBatch: jest
				.fn()
				.mockResolvedValueOnce(true) // power succeeds
				.mockResolvedValueOnce(false), // volume fails
		};
		harness.mockPlatformRegistry.get.mockReturnValue(mockPlatform);

		const result = await service.activate(SPACE_ID, MediaActivityKey.LISTEN);

		expect(result.state).toBe(MediaActivationState.ACTIVE);
		expect(result.summary?.stepsFailed).toBeGreaterThan(0);
		expect(result.warnings).toBeDefined();
	}, 15_000);

	it('critical failure (display device not found) → state becomes FAILED', async () => {
		const scenario = mediaTvOnly();
		harness.loadScenario(scenario);

		const powerPropId = scenario.devices[0].power.propertyId;

		const binding = harness.buildBinding(MediaActivityKey.WATCH, {
			displayEndpointId: `${SPACE_ID}:display:${DEVICE_TV}`,
		});
		harness.mockBindingService.findBySpace.mockResolvedValue([binding]);

		harness.mockDerivedEndpointService.buildEndpointsForSpace.mockResolvedValue({
			spaceId: SPACE_ID,
			endpoints: [
				harness.buildEndpoint(
					MediaEndpointType.DISPLAY,
					DEVICE_TV,
					'TV (Display)',
					{ power: true },
					{ power: { propertyId: powerPropId } },
				),
			],
		});

		// Device not found → critical failure
		harness.mockSpacesService.findDevicesByIds.mockResolvedValue([]);

		const result = await service.activate(SPACE_ID, MediaActivityKey.WATCH);

		expect(result.state).toBe(MediaActivationState.FAILED);
		expect(result.summary?.stepsFailed).toBeGreaterThan(0);
		expect(result.summary?.failures?.[0].reason).toContain('not found');
	}, 15_000);
});

// ==========================================================================
// 3.5 – WS events
// ==========================================================================

describe('Media Regression – WS Events', () => {
	let service: SpaceMediaActivityService;
	let harness: MediaTestHarness;

	beforeEach(async () => {
		resetIds();
		harness = new MediaTestHarness();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SpaceMediaActivityService,
				{ provide: getRepositoryToken(SpaceActiveMediaActivityEntity), useValue: harness.mockActiveRepository },
				{ provide: SpacesService, useValue: harness.mockSpacesService },
				{ provide: SpaceMediaActivityBindingService, useValue: harness.mockBindingService },
				{ provide: DerivedMediaEndpointService, useValue: harness.mockDerivedEndpointService },
				{ provide: PlatformRegistryService, useValue: harness.mockPlatformRegistry },
				{ provide: EventEmitter2, useValue: harness.mockEventEmitter },
			],
		}).compile();

		service = module.get<SpaceMediaActivityService>(SpaceMediaActivityService);
	});

	it('successful activation emits: activating → activated', async () => {
		const scenario = mediaTvOnly({ tvVolume: true });
		harness.loadScenario(scenario);

		const powerPropId = scenario.devices[0].power.propertyId;
		const inputPropId = scenario.devices[0].input.propertyId;

		const binding = harness.buildBinding(MediaActivityKey.WATCH, {
			displayEndpointId: `${SPACE_ID}:display:${DEVICE_TV}`,
			displayInputId: 'HDMI1',
		});
		harness.mockBindingService.findBySpace.mockResolvedValue([binding]);

		harness.mockDerivedEndpointService.buildEndpointsForSpace.mockResolvedValue({
			spaceId: SPACE_ID,
			endpoints: [
				harness.buildEndpoint(
					MediaEndpointType.DISPLAY,
					DEVICE_TV,
					'TV (Display)',
					{ power: true, inputSelect: true },
					{ power: { propertyId: powerPropId }, inputSelect: { propertyId: inputPropId } },
				),
			],
		});

		harness.mockSpacesService.findDevicesByIds.mockResolvedValue([
			harness.buildMockDevice(DEVICE_TV, [
				{ id: powerPropId, value: false },
				{ id: inputPropId, value: 'HDMI2' },
			]),
		]);

		const mockPlatform = { processBatch: jest.fn().mockResolvedValue(true) };
		harness.mockPlatformRegistry.get.mockReturnValue(mockPlatform);

		await service.activate(SPACE_ID, MediaActivityKey.WATCH);

		// Verify activating event
		const activatingEvents = harness.getEmittedEvents(EventType.MEDIA_ACTIVITY_ACTIVATING);
		expect(activatingEvents.length).toBe(1);
		expect(activatingEvents[0]).toEqual(
			expect.objectContaining({ space_id: SPACE_ID, activity_key: MediaActivityKey.WATCH }),
		);

		// Verify activated event
		const activatedEvents = harness.getEmittedEvents(EventType.MEDIA_ACTIVITY_ACTIVATED);
		expect(activatedEvents.length).toBe(1);
		expect(activatedEvents[0]).toEqual(
			expect.objectContaining({ space_id: SPACE_ID, activity_key: MediaActivityKey.WATCH }),
		);
	}, 15_000);

	it('failed activation emits: activating → failed', async () => {
		const scenario = mediaTvOnly();
		harness.loadScenario(scenario);

		const powerPropId = scenario.devices[0].power.propertyId;

		const binding = harness.buildBinding(MediaActivityKey.WATCH, {
			displayEndpointId: `${SPACE_ID}:display:${DEVICE_TV}`,
		});
		harness.mockBindingService.findBySpace.mockResolvedValue([binding]);

		harness.mockDerivedEndpointService.buildEndpointsForSpace.mockResolvedValue({
			spaceId: SPACE_ID,
			endpoints: [
				harness.buildEndpoint(
					MediaEndpointType.DISPLAY,
					DEVICE_TV,
					'TV (Display)',
					{ power: true },
					{ power: { propertyId: powerPropId } },
				),
			],
		});

		// Device not found → triggers failure
		harness.mockSpacesService.findDevicesByIds.mockResolvedValue([]);

		await service.activate(SPACE_ID, MediaActivityKey.WATCH);

		// Verify activating event was emitted
		const activatingEvents = harness.getEmittedEvents(EventType.MEDIA_ACTIVITY_ACTIVATING);
		expect(activatingEvents.length).toBe(1);

		// Verify failed event (not activated)
		const failedEvents = harness.getEmittedEvents(EventType.MEDIA_ACTIVITY_FAILED);
		expect(failedEvents.length).toBe(1);
		expect(failedEvents[0]).toEqual(expect.objectContaining({ space_id: SPACE_ID }));

		// No activated event
		const activatedEvents = harness.getEmittedEvents(EventType.MEDIA_ACTIVITY_ACTIVATED);
		expect(activatedEvents.length).toBe(0);
	}, 15_000);

	it('deactivation emits deactivated event', async () => {
		harness.loadScenario(mediaTvOnly());

		const existingRecord = {
			id: uuid(),
			spaceId: SPACE_ID,
			activityKey: MediaActivityKey.WATCH,
			state: MediaActivationState.ACTIVE,
		};
		harness.mockActiveRepository.findOne.mockResolvedValue(existingRecord);

		await service.deactivate(SPACE_ID);

		const deactivatedEvents = harness.getEmittedEvents(EventType.MEDIA_ACTIVITY_DEACTIVATED);
		expect(deactivatedEvents.length).toBe(1);
		expect(deactivatedEvents[0]).toEqual(expect.objectContaining({ space_id: SPACE_ID, activity_key: null }));
	});

	it('full lifecycle: activating → activated → deactivated', async () => {
		const scenario = mediaTvOnly({ tvVolume: true });
		harness.loadScenario(scenario);

		const powerPropId = scenario.devices[0].power.propertyId;
		const inputPropId = scenario.devices[0].input.propertyId;

		const binding = harness.buildBinding(MediaActivityKey.WATCH, {
			displayEndpointId: `${SPACE_ID}:display:${DEVICE_TV}`,
			displayInputId: 'HDMI1',
		});
		harness.mockBindingService.findBySpace.mockResolvedValue([binding]);

		harness.mockDerivedEndpointService.buildEndpointsForSpace.mockResolvedValue({
			spaceId: SPACE_ID,
			endpoints: [
				harness.buildEndpoint(
					MediaEndpointType.DISPLAY,
					DEVICE_TV,
					'TV (Display)',
					{ power: true, inputSelect: true },
					{ power: { propertyId: powerPropId }, inputSelect: { propertyId: inputPropId } },
				),
			],
		});

		harness.mockSpacesService.findDevicesByIds.mockResolvedValue([
			harness.buildMockDevice(DEVICE_TV, [
				{ id: powerPropId, value: false },
				{ id: inputPropId, value: 'HDMI2' },
			]),
		]);

		const mockPlatform = { processBatch: jest.fn().mockResolvedValue(true) };
		harness.mockPlatformRegistry.get.mockReturnValue(mockPlatform);

		// Activate
		const activateResult = await service.activate(SPACE_ID, MediaActivityKey.WATCH);
		expect(activateResult.state).toBe(MediaActivationState.ACTIVE);

		// Deactivate – need to set up mock for findOne to return the active record
		harness.mockActiveRepository.findOne.mockResolvedValue({
			id: uuid(),
			spaceId: SPACE_ID,
			activityKey: MediaActivityKey.WATCH,
			state: MediaActivationState.ACTIVE,
		});

		const deactivateResult = await service.deactivate(SPACE_ID);
		expect(deactivateResult.state).toBe(MediaActivationState.DEACTIVATED);

		// Verify full event sequence
		const allCalls = harness.mockEventEmitter.emit.mock.calls.map(([type]: [string]) => type);
		expect(allCalls).toContain(EventType.MEDIA_ACTIVITY_ACTIVATING);
		expect(allCalls).toContain(EventType.MEDIA_ACTIVITY_ACTIVATED);
		expect(allCalls).toContain(EventType.MEDIA_ACTIVITY_DEACTIVATED);

		// Order check
		const activatingIdx = allCalls.indexOf(EventType.MEDIA_ACTIVITY_ACTIVATING);
		const activatedIdx = allCalls.indexOf(EventType.MEDIA_ACTIVITY_ACTIVATED);
		const deactivatedIdx = allCalls.indexOf(EventType.MEDIA_ACTIVITY_DEACTIVATED);
		expect(activatingIdx).toBeLessThan(activatedIdx);
		expect(activatedIdx).toBeLessThan(deactivatedIdx);
	}, 15_000);
});
