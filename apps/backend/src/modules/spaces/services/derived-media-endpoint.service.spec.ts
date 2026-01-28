import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';

import { DeviceCategory } from '../../devices/devices.constants';
import { MediaCapabilityPermission, MediaEndpointType } from '../spaces.constants';

import { DerivedMediaEndpointService } from './derived-media-endpoint.service';
import { SpaceMediaEndpointService } from './space-media-endpoint.service';
import { SpacesService } from './spaces.service';

// Helper to build a capability summary
function buildSummary(overrides: Record<string, unknown> = {}) {
	return {
		deviceId: overrides.deviceId ?? uuid(),
		deviceName: (overrides.deviceName as string) ?? 'Test Device',
		deviceCategory: (overrides.deviceCategory as string) ?? DeviceCategory.TELEVISION,
		isOnline: (overrides.isOnline as boolean) ?? true,
		suggestedEndpointTypes: (overrides.suggestedEndpointTypes as MediaEndpointType[]) ?? [],
		power: overrides.power !== undefined ? overrides.power : undefined,
		volume: overrides.volume !== undefined ? overrides.volume : undefined,
		mute: overrides.mute !== undefined ? overrides.mute : undefined,
		playback: overrides.playback !== undefined ? overrides.playback : undefined,
		playbackState: overrides.playbackState !== undefined ? overrides.playbackState : undefined,
		input: overrides.input !== undefined ? overrides.input : undefined,
		remote: overrides.remote !== undefined ? overrides.remote : undefined,
		trackMetadata: overrides.trackMetadata !== undefined ? overrides.trackMetadata : undefined,
	};
}

function capMapping(propertyId?: string) {
	return {
		propertyId: propertyId ?? uuid(),
		channelId: uuid(),
		permission: MediaCapabilityPermission.READ_WRITE,
	};
}

describe('DerivedMediaEndpointService', () => {
	let service: DerivedMediaEndpointService;
	let mockSpacesService: { getOneOrThrow: jest.Mock };
	let mockMediaEndpointService: { getMediaCapabilitiesInSpace: jest.Mock };

	const spaceId = uuid();

	beforeEach(async () => {
		mockSpacesService = {
			getOneOrThrow: jest.fn().mockResolvedValue({ id: spaceId, name: 'Living Room' }),
		};
		mockMediaEndpointService = {
			getMediaCapabilitiesInSpace: jest.fn().mockResolvedValue([]),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				DerivedMediaEndpointService,
				{ provide: SpacesService, useValue: mockSpacesService },
				{ provide: SpaceMediaEndpointService, useValue: mockMediaEndpointService },
			],
		}).compile();

		service = module.get<DerivedMediaEndpointService>(DerivedMediaEndpointService);
	});

	describe('endpointId determinism', () => {
		it('should produce stable deterministic endpoint IDs', async () => {
			const deviceId = uuid();
			const summary = buildSummary({
				deviceId,
				deviceName: 'TV',
				deviceCategory: DeviceCategory.TELEVISION,
				power: capMapping(),
				remote: capMapping(),
			});
			mockMediaEndpointService.getMediaCapabilitiesInSpace.mockResolvedValue([summary]);

			const result1 = await service.buildEndpointsForSpace(spaceId);
			const result2 = await service.buildEndpointsForSpace(spaceId);

			expect(result1.endpoints.length).toBeGreaterThan(0);
			expect(result1.endpoints.map((e) => e.endpointId)).toEqual(result2.endpoints.map((e) => e.endpointId));
		});

		it('should use format spaceId:type:deviceId', async () => {
			const deviceId = uuid();
			const summary = buildSummary({
				deviceId,
				deviceCategory: DeviceCategory.SPEAKER,
				volume: capMapping(),
			});
			mockMediaEndpointService.getMediaCapabilitiesInSpace.mockResolvedValue([summary]);

			const result = await service.buildEndpointsForSpace(spaceId);

			expect(result.endpoints[0].endpointId).toBe(`${spaceId}:audio_output:${deviceId}`);
		});
	});

	describe('TV-only space', () => {
		it('should produce display + remote_target endpoints for TV with remote', async () => {
			const deviceId = uuid();
			const summary = buildSummary({
				deviceId,
				deviceName: 'Living Room TV',
				deviceCategory: DeviceCategory.TELEVISION,
				power: capMapping(),
				input: capMapping(),
				remote: capMapping(),
			});
			mockMediaEndpointService.getMediaCapabilitiesInSpace.mockResolvedValue([summary]);

			const result = await service.buildEndpointsForSpace(spaceId);

			expect(result.spaceId).toBe(spaceId);

			const types = result.endpoints.map((e) => e.type);
			expect(types).toContain(MediaEndpointType.DISPLAY);
			expect(types).toContain(MediaEndpointType.REMOTE_TARGET);
			// No audio_output without volume
			expect(types).not.toContain(MediaEndpointType.AUDIO_OUTPUT);

			// All endpoints share the same deviceId
			for (const ep of result.endpoints) {
				expect(ep.deviceId).toBe(deviceId);
			}
		});

		it('should produce display + audio_output + remote_target for TV with volume and remote', async () => {
			const deviceId = uuid();
			const summary = buildSummary({
				deviceId,
				deviceName: 'TV with Speaker',
				deviceCategory: DeviceCategory.TELEVISION,
				power: capMapping(),
				volume: capMapping(),
				mute: capMapping(),
				remote: capMapping(),
			});
			mockMediaEndpointService.getMediaCapabilitiesInSpace.mockResolvedValue([summary]);

			const result = await service.buildEndpointsForSpace(spaceId);

			const types = result.endpoints.map((e) => e.type);
			expect(types).toContain(MediaEndpointType.DISPLAY);
			expect(types).toContain(MediaEndpointType.AUDIO_OUTPUT);
			expect(types).toContain(MediaEndpointType.REMOTE_TARGET);
			expect(result.endpoints.length).toBe(3);
		});

		it('should set correct capabilities on display endpoint', async () => {
			const powerPropId = uuid();
			const inputPropId = uuid();
			const summary = buildSummary({
				deviceCategory: DeviceCategory.TELEVISION,
				power: capMapping(powerPropId),
				input: capMapping(inputPropId),
			});
			mockMediaEndpointService.getMediaCapabilitiesInSpace.mockResolvedValue([summary]);

			const result = await service.buildEndpointsForSpace(spaceId);
			const display = result.endpoints.find((e) => e.type === MediaEndpointType.DISPLAY)!;

			expect(display.capabilities.power).toBe(true);
			expect(display.capabilities.inputSelect).toBe(true);
			expect(display.capabilities.volume).toBe(false);
			expect(display.capabilities.mute).toBe(false);
			expect(display.capabilities.playback).toBe(false);
			expect(display.capabilities.track).toBe(false);
			expect(display.capabilities.remoteCommands).toBe(false);

			// Links should only have power and inputSelect
			expect(display.links.power).toBeDefined();
			expect(display.links.power!.propertyId).toBe(powerPropId);
			expect(display.links.inputSelect).toBeDefined();
			expect(display.links.inputSelect!.propertyId).toBe(inputPropId);
			expect(display.links.volume).toBeUndefined();
		});
	});

	describe('Speaker-only space', () => {
		it('should produce audio_output endpoint', async () => {
			const summary = buildSummary({
				deviceName: 'Sonos Speaker',
				deviceCategory: DeviceCategory.SPEAKER,
				volume: capMapping(),
				mute: capMapping(),
			});
			mockMediaEndpointService.getMediaCapabilitiesInSpace.mockResolvedValue([summary]);

			const result = await service.buildEndpointsForSpace(spaceId);

			expect(result.endpoints.length).toBe(1);
			expect(result.endpoints[0].type).toBe(MediaEndpointType.AUDIO_OUTPUT);
			expect(result.endpoints[0].name).toBe('Sonos Speaker (Audio Output)');
		});

		it('should produce audio_output + source when playback available', async () => {
			const summary = buildSummary({
				deviceCategory: DeviceCategory.SPEAKER,
				volume: capMapping(),
				playback: capMapping(),
			});
			mockMediaEndpointService.getMediaCapabilitiesInSpace.mockResolvedValue([summary]);

			const result = await service.buildEndpointsForSpace(spaceId);

			const types = result.endpoints.map((e) => e.type);
			expect(types).toContain(MediaEndpointType.AUDIO_OUTPUT);
			expect(types).toContain(MediaEndpointType.SOURCE);
		});
	});

	describe('Multi-device space (TV + Receiver + Speaker + Streamer)', () => {
		it('should produce correct endpoints for a full media setup', async () => {
			const tvId = uuid();
			const receiverId = uuid();
			const speakerId = uuid();
			const streamerId = uuid();

			const summaries = [
				buildSummary({
					deviceId: tvId,
					deviceName: 'Samsung TV',
					deviceCategory: DeviceCategory.TELEVISION,
					power: capMapping(),
					input: capMapping(),
					remote: capMapping(),
				}),
				buildSummary({
					deviceId: receiverId,
					deviceName: 'Denon AVR',
					deviceCategory: DeviceCategory.AV_RECEIVER,
					power: capMapping(),
					volume: capMapping(),
					mute: capMapping(),
					input: capMapping(),
				}),
				buildSummary({
					deviceId: speakerId,
					deviceName: 'Sonos One',
					deviceCategory: DeviceCategory.SPEAKER,
					volume: capMapping(),
					mute: capMapping(),
				}),
				buildSummary({
					deviceId: streamerId,
					deviceName: 'Chromecast',
					deviceCategory: DeviceCategory.STREAMING_SERVICE,
					playback: capMapping(),
				}),
			];
			mockMediaEndpointService.getMediaCapabilitiesInSpace.mockResolvedValue(summaries);

			const result = await service.buildEndpointsForSpace(spaceId);

			// TV: display + remote_target (no volume = no audio_output)
			const tvEndpoints = result.endpoints.filter((e) => e.deviceId === tvId);
			expect(tvEndpoints.map((e) => e.type)).toEqual(
				expect.arrayContaining([MediaEndpointType.DISPLAY, MediaEndpointType.REMOTE_TARGET]),
			);

			// Receiver: audio_output + source (has input)
			const receiverEndpoints = result.endpoints.filter((e) => e.deviceId === receiverId);
			expect(receiverEndpoints.map((e) => e.type)).toEqual(
				expect.arrayContaining([MediaEndpointType.AUDIO_OUTPUT, MediaEndpointType.SOURCE]),
			);

			// Speaker: audio_output only (no playback)
			const speakerEndpoints = result.endpoints.filter((e) => e.deviceId === speakerId);
			expect(speakerEndpoints.length).toBe(1);
			expect(speakerEndpoints[0].type).toBe(MediaEndpointType.AUDIO_OUTPUT);

			// Streamer: source only (no remote)
			const streamerEndpoints = result.endpoints.filter((e) => e.deviceId === streamerId);
			expect(streamerEndpoints.length).toBe(1);
			expect(streamerEndpoints[0].type).toBe(MediaEndpointType.SOURCE);

			// Total: 2 + 2 + 1 + 1 = 6 endpoints
			expect(result.endpoints.length).toBe(6);
		});
	});

	describe('missing capabilities', () => {
		it('should not infer capabilities that are absent', async () => {
			const summary = buildSummary({
				deviceCategory: DeviceCategory.TELEVISION,
				power: capMapping(),
				// No volume, no mute, no input, no remote
			});
			mockMediaEndpointService.getMediaCapabilitiesInSpace.mockResolvedValue([summary]);

			const result = await service.buildEndpointsForSpace(spaceId);

			// Only display (no audio_output without volume, no remote_target without remote)
			expect(result.endpoints.length).toBe(1);
			expect(result.endpoints[0].type).toBe(MediaEndpointType.DISPLAY);

			const caps = result.endpoints[0].capabilities;
			expect(caps.power).toBe(true);
			expect(caps.volume).toBe(false);
			expect(caps.mute).toBe(false);
			expect(caps.inputSelect).toBe(false);
			expect(caps.remoteCommands).toBe(false);
		});

		it('should produce no endpoints for device with no media capabilities', async () => {
			mockMediaEndpointService.getMediaCapabilitiesInSpace.mockResolvedValue([]);

			const result = await service.buildEndpointsForSpace(spaceId);

			expect(result.endpoints).toEqual([]);
		});
	});

	describe('link presence/absence', () => {
		it('should include links only for present capabilities', async () => {
			const volumePropId = uuid();
			const summary = buildSummary({
				deviceCategory: DeviceCategory.SPEAKER,
				volume: capMapping(volumePropId),
			});
			mockMediaEndpointService.getMediaCapabilitiesInSpace.mockResolvedValue([summary]);

			const result = await service.buildEndpointsForSpace(spaceId);
			const audioEndpoint = result.endpoints.find((e) => e.type === MediaEndpointType.AUDIO_OUTPUT)!;

			expect(audioEndpoint.links.volume).toBeDefined();
			expect(audioEndpoint.links.volume!.propertyId).toBe(volumePropId);
			// No power, no mute = no links
			expect(audioEndpoint.links.power).toBeUndefined();
			expect(audioEndpoint.links.mute).toBeUndefined();
		});

		it('should include remote links with command mapping', async () => {
			const remotePropId = uuid();
			const summary = buildSummary({
				deviceCategory: DeviceCategory.TELEVISION,
				power: capMapping(),
				remote: capMapping(remotePropId),
			});
			mockMediaEndpointService.getMediaCapabilitiesInSpace.mockResolvedValue([summary]);

			const result = await service.buildEndpointsForSpace(spaceId);
			const remoteEndpoint = result.endpoints.find((e) => e.type === MediaEndpointType.REMOTE_TARGET)!;

			expect(remoteEndpoint.links.remote).toBeDefined();
			expect(remoteEndpoint.links.remote!.commands.remoteKey).toBe(remotePropId);
		});
	});

	describe('endpoint naming', () => {
		it('should generate name with device name and type label', async () => {
			const summary = buildSummary({
				deviceName: 'Living Room TV',
				deviceCategory: DeviceCategory.TELEVISION,
				power: capMapping(),
			});
			mockMediaEndpointService.getMediaCapabilitiesInSpace.mockResolvedValue([summary]);

			const result = await service.buildEndpointsForSpace(spaceId);

			expect(result.endpoints[0].name).toBe('Living Room TV (Display)');
		});
	});
});
