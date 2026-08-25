import { performance } from 'node:perf_hooks';

import { ConfigService } from '../src/modules/config/services/config.service';
import { HomeyConnectorFactory } from '../src/plugins/devices-homey/connectors/homey-connector.factory';
import { HomeyConnector } from '../src/plugins/devices-homey/connectors/homey-connector.interface';
import { HomeyEventListener, HomeyUnsubscribe } from '../src/plugins/devices-homey/connectors/homey-connector.types';
import {
	DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS,
	DEFAULT_HOMEY_RECONCILIATION_INTERVAL_MS,
} from '../src/plugins/devices-homey/devices-homey.constants';
import { HomeyConfigModel } from '../src/plugins/devices-homey/models/config.model';
import {
	HomeyCapabilityType,
	HomeyCapabilityValue,
	createHomeyCapability,
} from '../src/plugins/devices-homey/models/homey-capability.model';
import { HomeyDevice } from '../src/plugins/devices-homey/models/homey-device.model';
import { HomeyEvent, HomeyEventType } from '../src/plugins/devices-homey/models/homey-event.model';
import { HomeySystemInfo } from '../src/plugins/devices-homey/models/homey-system-info.model';
import { HomeyZone } from '../src/plugins/devices-homey/models/homey-zone.model';
import { HomeySynchronizerService } from '../src/plugins/devices-homey/services/homey-synchronizer.service';
import { HomeyService } from '../src/plugins/devices-homey/services/homey.service';

const SAMPLE_COUNT = 30;
const WARMUP_COUNT = 3;
const P95_DESIGN_TARGET_MS = 250;

const systemInfo: HomeySystemInfo = {
	id: 'performance-homey',
	name: 'Performance Homey',
	version: '13.4.0',
	tier: 'pro',
	model: 'Homey Pro',
};

const zones: readonly HomeyZone[] = [
	{ id: 'performance-zone', name: 'Performance zone', parentId: null, active: true, path: ['Performance zone'] },
];

const device: HomeyDevice = {
	id: 'performance-device',
	name: 'Performance device',
	class: 'light',
	zoneId: 'performance-zone',
	zoneName: 'Performance zone',
	zonePath: ['Performance zone'],
	available: true,
	availabilityMessage: null,
	driverId: 'homey:app:driver:performance-light',
	manufacturer: 'Performance fixture',
	model: 'Performance light',
	energy: null,
	capabilities: [
		createHomeyCapability({
			id: 'onoff',
			title: 'On/off',
			value: false,
			type: HomeyCapabilityType.BOOLEAN,
			unit: null,
			minimum: null,
			maximum: null,
			step: null,
			enumValues: [],
			readable: true,
			writable: true,
			available: true,
			lastUpdatedAt: null,
		}),
	],
};

const percentile = (samples: readonly number[], ratio: number): number => {
	const sorted = [...samples].sort((left, right) => left - right);
	const index = Math.max(0, Math.ceil(sorted.length * ratio) - 1);

	return sorted[index] ?? 0;
};

describe('Homey event and command performance gate', () => {
	it('meets the event-handoff and command-start p95 targets without per-event inventory reads', async () => {
		let listener: HomeyEventListener | null = null;
		let sequence = 0;
		let resolveEventHandoff: ((latencyMs: number) => void) | null = null;
		let eventReceivedAt = 0;
		let resolveCommandStart: ((latencyMs: number) => void) | null = null;
		let commandReceivedAt = 0;
		const config = Object.assign(new HomeyConfigModel(), {
			enabled: true,
			url: 'http://127.0.0.1:4859',
			apiKey: 'performance-test-key',
			connectionTimeout: DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS,
			reconciliationInterval: DEFAULT_HOMEY_RECONCILIATION_INTERVAL_MS,
		});
		const configService = {
			getPluginConfig: jest.fn().mockReturnValue(config),
		};
		const connector: jest.Mocked<HomeyConnector> = {
			connect: jest.fn().mockResolvedValue(undefined),
			disconnect: jest.fn().mockResolvedValue(undefined),
			getSystemInfo: jest.fn().mockResolvedValue(systemInfo),
			getZones: jest.fn().mockResolvedValue(zones),
			getDevices: jest.fn().mockResolvedValue([device]),
			getDevice: jest.fn().mockResolvedValue(device),
			setCapabilityValue: jest.fn((deviceId: string, capabilityId: string, value: unknown): Promise<void> => {
				resolveCommandStart?.(performance.now() - commandReceivedAt);
				resolveCommandStart = null;
				sequence += 1;
				queueMicrotask(() => {
					void listener?.({
						type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
						deviceId,
						capabilityId,
						value: value as HomeyCapabilityValue,
						lastUpdatedAt: null,
						occurredAt: null,
						sequence,
					});
				});

				return Promise.resolve();
			}),
			subscribe: jest.fn((nextListener: HomeyEventListener): Promise<HomeyUnsubscribe> => {
				listener = nextListener;

				return Promise.resolve(() => undefined);
			}),
		};
		const connectorFactory: jest.Mocked<HomeyConnectorFactory> = {
			create: jest.fn().mockReturnValue(connector),
		};
		const synchronizer = {
			filterEvents: jest.fn((events: readonly HomeyEvent[]) => [...events]),
			getOperationalDiagnostics: jest.fn().mockResolvedValue({
				adopted: 1,
				adoptedDevices: [{ panelDeviceId: 'panel-device', homeyDeviceId: device.id }],
				missing: 0,
				unsupported: 0,
				unavailable: 0,
			}),
			hasReadableCapabilityBinding: jest.fn().mockResolvedValue(true),
			invalidateIndex: jest.fn(),
			synchronizeSnapshot: jest.fn().mockResolvedValue({
				updated: 0,
				ignored: 0,
				failed: 0,
				acceptedEvents: [],
				acceptedCapabilityValues: [{ deviceId: device.id, capabilityId: 'onoff', value: false }],
			}),
			synchronizeDevices: jest.fn().mockResolvedValue({
				updated: 0,
				ignored: 0,
				failed: 0,
				acceptedEvents: [],
				acceptedCapabilityValues: [],
			}),
			synchronizeEvents: jest.fn((events: readonly HomeyEvent[]) => {
				resolveEventHandoff?.(performance.now() - eventReceivedAt);
				resolveEventHandoff = null;

				return Promise.resolve({ updated: 0, ignored: 0, failed: 0, acceptedEvents: [...events] });
			}),
			reset: jest.fn(),
		};
		const service = new HomeyService(
			configService as unknown as ConfigService,
			synchronizer as unknown as HomeySynchronizerService,
			connectorFactory,
		);

		await service.start();
		connector.getDevice.mockClear();

		const measureEventHandoff = (value: boolean): Promise<number> => {
			const handoff = new Promise<number>((resolve) => {
				resolveEventHandoff = resolve;
			});
			sequence += 1;
			eventReceivedAt = performance.now();
			void listener?.({
				type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
				deviceId: device.id,
				capabilityId: 'onoff',
				value,
				lastUpdatedAt: null,
				occurredAt: null,
				sequence,
			});

			return handoff;
		};
		const measureCommandStart = async (value: boolean): Promise<number> => {
			const transportStarted = new Promise<number>((resolve) => {
				resolveCommandStart = resolve;
			});
			commandReceivedAt = performance.now();
			const command = service.executeCapabilityCommand(device.id, 'onoff', value);
			const latencyMs = await transportStarted;

			await expect(command).resolves.toBe(true);

			return latencyMs;
		};

		for (let index = 0; index < WARMUP_COUNT; index += 1) {
			await measureEventHandoff(index % 2 === 0);
		}

		const eventHandoffSamples: number[] = [];

		for (let index = 0; index < SAMPLE_COUNT; index += 1) {
			eventHandoffSamples.push(await measureEventHandoff(index % 2 === 0));
		}

		expect(connector.getDevices.mock.calls).toHaveLength(1);
		expect(connector.getDevice.mock.calls).toHaveLength(0);

		for (let index = 0; index < WARMUP_COUNT; index += 1) {
			await measureCommandStart(index % 2 === 0);
		}

		const commandStartSamples: number[] = [];

		for (let index = 0; index < SAMPLE_COUNT; index += 1) {
			commandStartSamples.push(await measureCommandStart(index % 2 === 0));
		}

		const eventP95Ms = percentile(eventHandoffSamples, 0.95);
		const commandP95Ms = percentile(commandStartSamples, 0.95);

		expect(eventP95Ms).toBeLessThan(P95_DESIGN_TARGET_MS);
		expect(commandP95Ms).toBeLessThan(P95_DESIGN_TARGET_MS);
		expect(connector.getDevices.mock.calls).toHaveLength(1);
		expect(connector.getDevice.mock.calls).toHaveLength(0);

		process.stdout.write(
			`Homey latency gate: event handoff p95=${eventP95Ms.toFixed(2)}ms, command start p95=${commandP95Ms.toFixed(2)}ms.\n`,
		);

		await service.stop();
	}, 45_000);
});
