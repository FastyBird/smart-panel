/**
 * Media Test Harness – helpers that wire up service mocks from a MediaScenario.
 *
 * Usage in a spec file:
 *   const harness = new MediaTestHarness();
 *   harness.loadScenario(mediaTvOnly());
 *   const endpoints = await harness.deriveEndpoints();
 */
import { v4 as uuid } from 'uuid';

import { DerivedMediaEndpointModel } from '../../models/derived-media-endpoint.model';
import { MediaCapabilitySummaryModel } from '../../models/media-routing.model';
import { MediaActivityKey, MediaEndpointType } from '../../spaces.constants';

import { MediaScenario, ScenarioDevice } from './media-scenario-templates';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

export class MediaTestHarness {
	scenario!: MediaScenario;

	// Mock stores
	mockSpacesService = {
		getOneOrThrow: jest.fn(),
		findDevicesByIds: jest.fn().mockResolvedValue([]),
	};

	mockMediaEndpointService = {
		getMediaCapabilitiesInSpace: jest.fn().mockResolvedValue([]),
	};

	mockDerivedEndpointService = {
		buildEndpointsForSpace: jest.fn(),
	};

	mockBindingService = {
		findBySpace: jest.fn().mockResolvedValue([]),
	};

	mockActiveRepository = {
		findOne: jest.fn().mockResolvedValue(null),
		create: jest.fn().mockImplementation((data: Record<string, unknown>) => ({ ...data, id: uuid() })),
		save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
	};

	mockPlatformRegistry = {
		get: jest.fn().mockReturnValue(null),
	};

	mockEventEmitter = {
		emit: jest.fn(),
	};

	/** Saved bindings accumulator (mirrors the pattern from existing binding spec). */
	savedBindings: Array<Record<string, unknown>> = [];

	mockBindingRepository = {
		find: jest.fn().mockImplementation(() => Promise.resolve(this.savedBindings)),
		findOne: jest.fn().mockResolvedValue(null),
		create: jest.fn().mockImplementation((data: Record<string, unknown>) => ({ ...data, id: uuid() })),
		save: jest.fn().mockImplementation((entity) => {
			this.savedBindings.push(entity as Record<string, unknown>);
			return Promise.resolve(entity);
		}),
		remove: jest.fn().mockResolvedValue(undefined),
	};

	// -----------------------------------------------------------------------
	// Setup
	// -----------------------------------------------------------------------

	loadScenario(scenario: MediaScenario): void {
		this.scenario = scenario;
		this.savedBindings = [];

		this.mockSpacesService.getOneOrThrow.mockResolvedValue({
			id: scenario.spaceId,
			name: 'Test Space',
		});

		// Wire up capability summaries
		const summaries = scenario.devices.map((d) => this.toSummary(d));
		this.mockMediaEndpointService.getMediaCapabilitiesInSpace.mockResolvedValue(summaries);
	}

	// -----------------------------------------------------------------------
	// Helpers – convert scenario devices to service-level structures
	// -----------------------------------------------------------------------

	private toSummary(d: ScenarioDevice): MediaCapabilitySummaryModel {
		const s = new MediaCapabilitySummaryModel();
		s.deviceId = d.deviceId;
		s.deviceName = d.deviceName;
		s.deviceCategory = d.deviceCategory;
		s.isOnline = d.isOnline;
		s.suggestedEndpointTypes = d.suggestedEndpointTypes;
		return s;
	}

	/**
	 * Build a DerivedMediaEndpointModel from inline data (mirrors the helpers
	 * in the existing spec files).
	 */
	buildEndpoint(
		type: MediaEndpointType,
		deviceId: string,
		name: string,
		caps: Partial<Record<string, boolean>>,
		links: Record<string, { propertyId: string } | { commands: Record<string, string> }> = {},
	): DerivedMediaEndpointModel {
		return {
			endpointId: `${this.scenario.spaceId}:${type}:${deviceId}`,
			spaceId: this.scenario.spaceId,
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

	buildBinding(activityKey: MediaActivityKey, overrides: Record<string, string | number | null> = {}) {
		return {
			id: uuid(),
			spaceId: this.scenario.spaceId,
			activityKey,
			displayEndpointId: (overrides.displayEndpointId as string) ?? null,
			audioEndpointId: (overrides.audioEndpointId as string) ?? null,
			sourceEndpointId: (overrides.sourceEndpointId as string) ?? null,
			remoteEndpointId: (overrides.remoteEndpointId as string) ?? null,
			displayInputId: (overrides.displayInputId as string) ?? null,
			audioVolumePreset: (overrides.audioVolumePreset as number) ?? null,
		};
	}

	/**
	 * Build a mock device object suitable for `findDevicesByIds` return value.
	 */
	buildMockDevice(deviceId: string, properties: Array<{ id: string; value: unknown }>) {
		return {
			id: deviceId,
			type: 'test-platform',
			channels: [
				{
					id: uuid(),
					properties,
				},
			],
		};
	}

	/**
	 * Get emitted events of a given type from the mock event emitter.
	 */
	getEmittedEvents(eventType: string): unknown[] {
		return this.mockEventEmitter.emit.mock.calls
			.filter(([type]: [string]) => type === eventType)
			.map(([, payload]: [string, unknown]) => payload);
	}
}
