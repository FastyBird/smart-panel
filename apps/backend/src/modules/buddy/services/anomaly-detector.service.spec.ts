/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { ConfigService } from '../../config/services/config.service';
import { DeviceCategory } from '../../devices/devices.constants';
import { IntentType } from '../../intents/intents.constants';
import {
	ANOMALY_STUCK_SENSOR_HOURS,
	ANOMALY_TEMPERATURE_DRIFT_THRESHOLD,
	ANOMALY_UNUSUAL_ACTIVITY_THRESHOLD,
	ANOMALY_UNUSUAL_ACTIVITY_WINDOW_MINUTES,
	SuggestionType,
} from '../buddy.constants';
import { EvaluatorRulesLoaderService } from '../spec/evaluator-rules-loader.service';
import { ResolvedAnomalyRule } from '../spec/evaluator-rules.types';

import { ActionObserverService, ActionRecord } from './action-observer.service';
import { AnomalyDetectorEvaluator } from './anomaly-detector.service';
import { BuddyContext } from './buddy-context.service';

function makeContext(overrides: Partial<BuddyContext> = {}): BuddyContext {
	return {
		timestamp: new Date().toISOString(),
		timezone: 'UTC',
		spaces: overrides.spaces ?? [{ id: 'space-1', name: 'Living Room', category: 'living_room', deviceCount: 3 }],
		devices: overrides.devices ?? [],
		scenes: overrides.scenes ?? [],
		weather: overrides.weather ?? null,
		energy: overrides.energy ?? null,
		recentIntents: overrides.recentIntents ?? [],
	};
}

function makeAction(overrides: Partial<ActionRecord> = {}): ActionRecord {
	return {
		intentId: overrides.intentId ?? `intent-${Math.random().toString(36).slice(2)}`,
		type: overrides.type ?? IntentType.LIGHT_TOGGLE,
		spaceId: 'spaceId' in overrides ? overrides.spaceId : 'space-1',
		deviceIds: overrides.deviceIds ?? ['dev-1'],
		timestamp: overrides.timestamp ?? new Date(),
	};
}

const defaultAnomalyRules: Record<string, ResolvedAnomalyRule> = {
	temperature_drift: {
		enabled: true,
		suggestionType: SuggestionType.ANOMALY_SENSOR_DRIFT,
		thresholds: { degrees: ANOMALY_TEMPERATURE_DRIFT_THRESHOLD },
		filters: {
			setpointDeviceCategories: ['thermostat'],
			readingPropertyCategory: 'temperature',
			deviceCategories: [],
			valueTypes: ['number'],
			excludeProperties: [],
		},
		messages: {
			title: 'Temperature significantly off setpoint',
			reason:
				'${spaceName} temperature (${sensorValue}°C) is significantly ${direction} setpoint (${setpointValue}°C). Check the thermostat or window.',
		},
	},
	stuck_sensor: {
		enabled: true,
		suggestionType: SuggestionType.ANOMALY_STUCK_SENSOR,
		thresholds: { hours: ANOMALY_STUCK_SENSOR_HOURS },
		filters: {
			setpointDeviceCategories: [],
			readingPropertyCategory: null,
			deviceCategories: ['sensor'],
			valueTypes: ['number'],
			excludeProperties: ['battery_level', 'link_quality', 'signal_strength'],
		},
		messages: {
			title: 'Sensor value appears stuck',
			reason:
				'${deviceName} in ${spaceName}: "${propertyKey}" has been ${value} for ${stuckHours} hours. The sensor may need attention.',
		},
	},
	unusual_activity: {
		enabled: true,
		suggestionType: SuggestionType.ANOMALY_UNUSUAL_ACTIVITY,
		thresholds: { count: ANOMALY_UNUSUAL_ACTIVITY_THRESHOLD, window_minutes: ANOMALY_UNUSUAL_ACTIVITY_WINDOW_MINUTES },
		filters: {
			setpointDeviceCategories: [],
			readingPropertyCategory: null,
			deviceCategories: [],
			valueTypes: [],
			excludeProperties: [],
		},
		messages: {
			title: 'Unusual device activity detected',
			reason:
				'${deviceName} in ${spaceName} has been triggered ${actionCount} times in the last ${windowMinutes} minutes. This might indicate an issue.',
		},
	},
};

function makeRulesLoader(overrides: Partial<Record<string, ResolvedAnomalyRule>> = {}): EvaluatorRulesLoaderService {
	const rules = { ...defaultAnomalyRules, ...overrides };

	return {
		getAnomalyRule: jest.fn((key: string) => rules[key]),
		getEnergyRule: jest.fn(),
		getConflictRule: jest.fn(),
		getPatternRule: jest.fn(),
		onModuleInit: jest.fn(),
		loadAllRules: jest.fn(),
	} as unknown as EvaluatorRulesLoaderService;
}

describe('AnomalyDetectorEvaluator', () => {
	let service: AnomalyDetectorEvaluator;
	let actionObserver: ActionObserverService;
	let configService: { getModuleConfig: jest.Mock };

	beforeEach(() => {
		configService = {
			getModuleConfig: jest.fn().mockReturnValue({
				enabled: true,
				anomalyTemperatureDriftThreshold: ANOMALY_TEMPERATURE_DRIFT_THRESHOLD,
				anomalyStuckSensorHours: ANOMALY_STUCK_SENSOR_HOURS,
				anomalyUnusualActivityThreshold: ANOMALY_UNUSUAL_ACTIVITY_THRESHOLD,
				anomalyUnusualActivityWindowMinutes: ANOMALY_UNUSUAL_ACTIVITY_WINDOW_MINUTES,
			}),
		};

		actionObserver = new ActionObserverService();
		service = new AnomalyDetectorEvaluator(
			configService as unknown as ConfigService,
			actionObserver,
			makeRulesLoader(),
		);
	});

	it('should have the name "AnomalyDetector"', () => {
		expect(service.name).toBe('AnomalyDetector');
	});

	it('should return no results for empty context', async () => {
		const context = makeContext();
		const results = await service.evaluate(context);

		expect(results).toHaveLength(0);
	});

	// ──────────────────────────────────────────
	// Temperature drift detection
	// ──────────────────────────────────────────

	describe('temperature drift', () => {
		it('should detect drift when sensor temperature exceeds setpoint by more than threshold', async () => {
			const context = makeContext({
				spaces: [{ id: 'space-1', name: 'Bedroom', category: 'bedroom', deviceCount: 2 }],
				devices: [
					{
						id: 'sensor-1',
						name: 'Temp Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 28 },
					},
					{
						id: 'thermo-1',
						name: 'Thermostat',
						space: 'space-1',
						category: DeviceCategory.THERMOSTAT,
						state: { 'thermostat.temperature': 22 },
					},
				],
			});

			const results = await service.evaluate(context);

			expect(results).toHaveLength(1);
			expect(results[0].type).toBe(SuggestionType.ANOMALY_SENSOR_DRIFT);
			expect(results[0].spaceId).toBe('space-1');
			expect(results[0].reason).toContain('28°C');
			expect(results[0].reason).toContain('22°C');
			expect(results[0].reason).toContain('above');
			expect(results[0].metadata.deviation).toBe(6);
		});

		it('should detect drift when sensor temperature is below setpoint by more than threshold', async () => {
			const context = makeContext({
				spaces: [{ id: 'space-1', name: 'Bedroom', category: 'bedroom', deviceCount: 2 }],
				devices: [
					{
						id: 'sensor-1',
						name: 'Temp Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 15 },
					},
					{
						id: 'thermo-1',
						name: 'Thermostat',
						space: 'space-1',
						category: DeviceCategory.THERMOSTAT,
						state: { 'thermostat.temperature': 22 },
					},
				],
			});

			const results = await service.evaluate(context);

			expect(results).toHaveLength(1);
			expect(results[0].reason).toContain('below');
		});

		it('should not detect drift when temperature is within threshold', async () => {
			const context = makeContext({
				spaces: [{ id: 'space-1', name: 'Bedroom', category: 'bedroom', deviceCount: 2 }],
				devices: [
					{
						id: 'sensor-1',
						name: 'Temp Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 23 },
					},
					{
						id: 'thermo-1',
						name: 'Thermostat',
						space: 'space-1',
						category: DeviceCategory.THERMOSTAT,
						state: { 'thermostat.temperature': 22 },
					},
				],
			});

			const results = await service.evaluate(context);

			expect(results).toHaveLength(0);
		});

		it('should not detect drift when exactly at threshold boundary', async () => {
			const context = makeContext({
				spaces: [{ id: 'space-1', name: 'Bedroom', category: 'bedroom', deviceCount: 2 }],
				devices: [
					{
						id: 'sensor-1',
						name: 'Temp Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 27 },
					},
					{
						id: 'thermo-1',
						name: 'Thermostat',
						space: 'space-1',
						category: DeviceCategory.THERMOSTAT,
						state: { 'thermostat.temperature': 22 },
					},
				],
			});

			const results = await service.evaluate(context);

			// diff = 5, threshold = 5, need > 5 to trigger
			expect(results).toHaveLength(0);
		});

		it('should only create one drift suggestion per space', async () => {
			const context = makeContext({
				spaces: [{ id: 'space-1', name: 'Bedroom', category: 'bedroom', deviceCount: 3 }],
				devices: [
					{
						id: 'sensor-1',
						name: 'Temp Sensor A',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 30 },
					},
					{
						id: 'sensor-2',
						name: 'Temp Sensor B',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 29 },
					},
					{
						id: 'thermo-1',
						name: 'Thermostat',
						space: 'space-1',
						category: DeviceCategory.THERMOSTAT,
						state: { 'thermostat.temperature': 22 },
					},
				],
			});

			const results = await service.evaluate(context);

			const driftResults = results.filter((r) => r.type === SuggestionType.ANOMALY_SENSOR_DRIFT);

			expect(driftResults).toHaveLength(1);
		});

		it('should not detect drift when there is no thermostat in the space', async () => {
			const context = makeContext({
				spaces: [{ id: 'space-1', name: 'Bedroom', category: 'bedroom', deviceCount: 1 }],
				devices: [
					{
						id: 'sensor-1',
						name: 'Temp Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 30 },
					},
				],
			});

			const results = await service.evaluate(context);

			expect(results).toHaveLength(0);
		});

		it('should not detect drift when there is no temperature sensor in the space', async () => {
			const context = makeContext({
				spaces: [{ id: 'space-1', name: 'Bedroom', category: 'bedroom', deviceCount: 1 }],
				devices: [
					{
						id: 'thermo-1',
						name: 'Thermostat',
						space: 'space-1',
						category: DeviceCategory.THERMOSTAT,
						state: { 'thermostat.temperature': 22 },
					},
				],
			});

			const results = await service.evaluate(context);

			expect(results).toHaveLength(0);
		});

		it('should detect drift per space independently', async () => {
			const context = makeContext({
				spaces: [
					{ id: 'space-1', name: 'Bedroom', category: 'bedroom', deviceCount: 2 },
					{ id: 'space-2', name: 'Kitchen', category: 'kitchen', deviceCount: 2 },
				],
				devices: [
					{
						id: 'sensor-1',
						name: 'Sensor Bedroom',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 30 },
					},
					{
						id: 'thermo-1',
						name: 'Thermostat Bedroom',
						space: 'space-1',
						category: DeviceCategory.THERMOSTAT,
						state: { 'thermostat.temperature': 22 },
					},
					{
						id: 'sensor-2',
						name: 'Sensor Kitchen',
						space: 'space-2',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 35 },
					},
					{
						id: 'thermo-2',
						name: 'Thermostat Kitchen',
						space: 'space-2',
						category: DeviceCategory.THERMOSTAT,
						state: { 'thermostat.temperature': 22 },
					},
				],
			});

			const results = await service.evaluate(context);

			const driftResults = results.filter((r) => r.type === SuggestionType.ANOMALY_SENSOR_DRIFT);

			expect(driftResults).toHaveLength(2);
			expect(driftResults.map((r) => r.spaceId).sort()).toEqual(['space-1', 'space-2']);
		});

		it('should skip non-numeric temperature values', async () => {
			const context = makeContext({
				spaces: [{ id: 'space-1', name: 'Bedroom', category: 'bedroom', deviceCount: 2 }],
				devices: [
					{
						id: 'sensor-1',
						name: 'Temp Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 'error' },
					},
					{
						id: 'thermo-1',
						name: 'Thermostat',
						space: 'space-1',
						category: DeviceCategory.THERMOSTAT,
						state: { 'thermostat.temperature': 22 },
					},
				],
			});

			const results = await service.evaluate(context);

			expect(results).toHaveLength(0);
		});

		it('should respect configurable drift threshold', async () => {
			configService.getModuleConfig.mockReturnValue({
				enabled: true,
				anomalyTemperatureDriftThreshold: 10,
				anomalyStuckSensorHours: ANOMALY_STUCK_SENSOR_HOURS,
				anomalyUnusualActivityThreshold: ANOMALY_UNUSUAL_ACTIVITY_THRESHOLD,
				anomalyUnusualActivityWindowMinutes: ANOMALY_UNUSUAL_ACTIVITY_WINDOW_MINUTES,
			});

			const context = makeContext({
				spaces: [{ id: 'space-1', name: 'Bedroom', category: 'bedroom', deviceCount: 2 }],
				devices: [
					{
						id: 'sensor-1',
						name: 'Temp Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 28 },
					},
					{
						id: 'thermo-1',
						name: 'Thermostat',
						space: 'space-1',
						category: DeviceCategory.THERMOSTAT,
						state: { 'thermostat.temperature': 22 },
					},
				],
			});

			const results = await service.evaluate(context);

			// diff = 6, threshold = 10, should not trigger
			expect(results).toHaveLength(0);
		});

		it('should return empty results when temperature_drift rule is disabled', async () => {
			service = new AnomalyDetectorEvaluator(
				configService as unknown as ConfigService,
				actionObserver,
				makeRulesLoader({
					temperature_drift: { ...defaultAnomalyRules.temperature_drift, enabled: false },
				}),
			);

			const context = makeContext({
				spaces: [{ id: 'space-1', name: 'Bedroom', category: 'bedroom', deviceCount: 2 }],
				devices: [
					{
						id: 'sensor-1',
						name: 'Temp Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 30 },
					},
					{
						id: 'thermo-1',
						name: 'Thermostat',
						space: 'space-1',
						category: DeviceCategory.THERMOSTAT,
						state: { 'thermostat.temperature': 22 },
					},
				],
			});

			const results = await service.evaluate(context);
			const driftResults = results.filter((r) => r.type === SuggestionType.ANOMALY_SENSOR_DRIFT);

			expect(driftResults).toHaveLength(0);
		});
	});

	// ──────────────────────────────────────────
	// Stuck sensor detection
	// ──────────────────────────────────────────

	describe('stuck sensor', () => {
		it('should not report stuck sensor on first evaluation (no history)', async () => {
			const context = makeContext({
				devices: [
					{
						id: 'sensor-1',
						name: 'Temp Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 21.5 },
					},
				],
			});

			const results = await service.evaluate(context);

			expect(results.filter((r) => r.type === SuggestionType.ANOMALY_STUCK_SENSOR)).toHaveLength(0);
		});

		it('should not report stuck sensor when value changes between evaluations', async () => {
			const context1 = makeContext({
				devices: [
					{
						id: 'sensor-1',
						name: 'Temp Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 21.5 },
					},
				],
			});

			await service.evaluate(context1);

			const context2 = makeContext({
				devices: [
					{
						id: 'sensor-1',
						name: 'Temp Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 22.0 },
					},
				],
			});

			const results = await service.evaluate(context2);

			expect(results.filter((r) => r.type === SuggestionType.ANOMALY_STUCK_SENSOR)).toHaveLength(0);
		});

		it('should detect stuck sensor when value unchanged for longer than threshold', async () => {
			const context = makeContext({
				devices: [
					{
						id: 'sensor-1',
						name: 'Temp Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 21.5 },
					},
				],
			});

			// First evaluation — records the value
			await service.evaluate(context);

			// Simulate time passage beyond the threshold by manipulating the tracker
			const tracker = (service as any).stuckSensorTracker as Map<string, { value: unknown; since: number }>;
			const key = 'sensor-1::temperature.temperature';

			tracker.set(key, {
				value: 21.5,
				since: Date.now() - (ANOMALY_STUCK_SENSOR_HOURS + 0.5) * 60 * 60 * 1000,
			});

			// Second evaluation — same value, should detect as stuck
			const results = await service.evaluate(context);
			const stuckResults = results.filter((r) => r.type === SuggestionType.ANOMALY_STUCK_SENSOR);

			expect(stuckResults).toHaveLength(1);
			expect(stuckResults[0].reason).toContain('Temp Sensor');
			expect(stuckResults[0].reason).toContain('21.5');
			expect(stuckResults[0].metadata.deviceId).toBe('sensor-1');
			expect(stuckResults[0].metadata.value).toBe(21.5);
		});

		it('should not detect stuck sensor before threshold time', async () => {
			const context = makeContext({
				devices: [
					{
						id: 'sensor-1',
						name: 'Temp Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 21.5 },
					},
				],
			});

			await service.evaluate(context);

			// Set time to just before threshold
			const tracker = (service as any).stuckSensorTracker as Map<string, { value: unknown; since: number }>;
			const key = 'sensor-1::temperature.temperature';

			tracker.set(key, {
				value: 21.5,
				since: Date.now() - (ANOMALY_STUCK_SENSOR_HOURS - 0.5) * 60 * 60 * 1000,
			});

			const results = await service.evaluate(context);

			expect(results.filter((r) => r.type === SuggestionType.ANOMALY_STUCK_SENSOR)).toHaveLength(0);
		});

		it('should skip null and non-numeric property values', async () => {
			const context = makeContext({
				devices: [
					{
						id: 'sensor-1',
						name: 'Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: {
							'temperature.temperature': null,
							'generic.status': 'online',
						},
					},
				],
			});

			await service.evaluate(context);

			// Tracker should be empty for these non-numeric values
			const tracker = (service as any).stuckSensorTracker as Map<string, unknown>;

			expect(tracker.size).toBe(0);
		});

		it('should reset tracker when value changes and not report as stuck', async () => {
			const context1 = makeContext({
				devices: [
					{
						id: 'sensor-1',
						name: 'Temp Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 21.5 },
					},
				],
			});

			await service.evaluate(context1);

			// Make it look stuck
			const tracker = (service as any).stuckSensorTracker as Map<string, { value: unknown; since: number }>;
			const key = 'sensor-1::temperature.temperature';

			tracker.set(key, { value: 21.5, since: Date.now() - 10 * 60 * 60 * 1000 });

			// Now value changes
			const context2 = makeContext({
				devices: [
					{
						id: 'sensor-1',
						name: 'Temp Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 22.0 },
					},
				],
			});

			const results = await service.evaluate(context2);

			expect(results.filter((r) => r.type === SuggestionType.ANOMALY_STUCK_SENSOR)).toHaveLength(0);

			// Tracker should be reset with new value
			const entry = tracker.get(key);

			expect(entry?.value).toBe(22.0);
		});

		it('should clean up tracker entries when a sensor property is removed but device still exists', async () => {
			const context1 = makeContext({
				devices: [
					{
						id: 'sensor-1',
						name: 'Temp Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 21.5, 'humidity.humidity': 45 },
					},
				],
			});

			await service.evaluate(context1);

			const tracker = (service as any).stuckSensorTracker as Map<string, unknown>;

			expect(tracker.size).toBe(2);

			// Device still exists but lost the humidity property
			const context2 = makeContext({
				devices: [
					{
						id: 'sensor-1',
						name: 'Temp Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 21.5 },
					},
				],
			});

			await service.evaluate(context2);

			// Humidity entry cleaned up because sensor-1 belongs to space-1 (in context)
			expect(tracker.size).toBe(1);
			expect(tracker.has('sensor-1::temperature.temperature')).toBe(true);
		});

		it('should not clean up tracker entries for devices in other spaces during per-space evaluation', async () => {
			// Evaluate space-1 context — seeds tracker for sensor-1
			const contextSpaceA = makeContext({
				spaces: [{ id: 'space-1', name: 'Living Room', category: 'living_room', deviceCount: 1 }],
				devices: [
					{
						id: 'sensor-1',
						name: 'Sensor A',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 21.5 },
					},
				],
			});

			await service.evaluate(contextSpaceA);

			const tracker = (service as any).stuckSensorTracker as Map<string, { value: unknown; since: number }>;

			expect(tracker.size).toBe(1);

			// Backdate sensor-1's entry so it would trigger if preserved
			tracker.set('sensor-1::temperature.temperature', {
				value: 21.5,
				since: Date.now() - (ANOMALY_STUCK_SENSOR_HOURS + 1) * 60 * 60 * 1000,
			});

			// Now evaluate space-2 context (different space, no sensor-1)
			const contextSpaceB = makeContext({
				spaces: [{ id: 'space-2', name: 'Bedroom', category: 'bedroom', deviceCount: 1 }],
				devices: [
					{
						id: 'sensor-2',
						name: 'Sensor B',
						space: 'space-2',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 19.0 },
					},
				],
			});

			await service.evaluate(contextSpaceB);

			// sensor-1's entry must NOT have been deleted by space-2 evaluation
			expect(tracker.has('sensor-1::temperature.temperature')).toBe(true);
			expect(tracker.get('sensor-1::temperature.temperature')?.value).toBe(21.5);

			// sensor-2 should also be tracked now
			expect(tracker.has('sensor-2::temperature.temperature')).toBe(true);
			expect(tracker.size).toBe(2);

			// Re-evaluate space-1 — sensor-1 should trigger stuck detection
			const results = await service.evaluate(contextSpaceA);
			const stuckResults = results.filter((r) => r.type === SuggestionType.ANOMALY_STUCK_SENSOR);

			expect(stuckResults).toHaveLength(1);
			expect(stuckResults[0].metadata.deviceId).toBe('sensor-1');
		});

		it('should not track non-sensor devices', async () => {
			const context = makeContext({
				devices: [
					{
						id: 'thermo-1',
						name: 'Thermostat',
						space: 'space-1',
						category: DeviceCategory.THERMOSTAT,
						state: { 'thermostat.temperature': 22 },
					},
					{
						id: 'light-1',
						name: 'Light',
						space: 'space-1',
						category: DeviceCategory.LIGHTING,
						state: { 'light.brightness': 80 },
					},
					{
						id: 'lock-1',
						name: 'Door Lock',
						space: 'space-1',
						category: DeviceCategory.LOCK,
						state: { 'lock.locked': 1 },
					},
				],
			});

			await service.evaluate(context);

			const tracker = (service as any).stuckSensorTracker as Map<string, unknown>;

			// None of these device categories should be tracked
			expect(tracker.size).toBe(0);
		});

		it('should respect configurable stuck sensor hours', async () => {
			configService.getModuleConfig.mockReturnValue({
				enabled: true,
				anomalyTemperatureDriftThreshold: ANOMALY_TEMPERATURE_DRIFT_THRESHOLD,
				anomalyStuckSensorHours: 6, // 6 hours instead of 2
				anomalyUnusualActivityThreshold: ANOMALY_UNUSUAL_ACTIVITY_THRESHOLD,
				anomalyUnusualActivityWindowMinutes: ANOMALY_UNUSUAL_ACTIVITY_WINDOW_MINUTES,
			});

			const context = makeContext({
				devices: [
					{
						id: 'sensor-1',
						name: 'Temp Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 21.5 },
					},
				],
			});

			await service.evaluate(context);

			// Set to 3 hours ago — should NOT trigger at 6h threshold
			const tracker = (service as any).stuckSensorTracker as Map<string, { value: unknown; since: number }>;
			const key = 'sensor-1::temperature.temperature';

			tracker.set(key, { value: 21.5, since: Date.now() - 3 * 60 * 60 * 1000 });

			const results = await service.evaluate(context);

			expect(results.filter((r) => r.type === SuggestionType.ANOMALY_STUCK_SENSOR)).toHaveLength(0);
		});

		it('should exclude properties listed in exclude_properties filter', async () => {
			const context = makeContext({
				devices: [
					{
						id: 'sensor-1',
						name: 'Multi Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: {
							'temperature.temperature': 21.5,
							'battery.battery_level': 95,
							'signal.link_quality': 100,
						},
					},
				],
			});

			await service.evaluate(context);

			const tracker = (service as any).stuckSensorTracker as Map<string, unknown>;

			// Only temperature should be tracked, battery_level and link_quality should be excluded
			expect(tracker.size).toBe(1);
			expect(tracker.has('sensor-1::temperature.temperature')).toBe(true);
			expect(tracker.has('sensor-1::battery.battery_level')).toBe(false);
			expect(tracker.has('sensor-1::signal.link_quality')).toBe(false);
		});

		it('should return empty results when stuck_sensor rule is disabled', async () => {
			service = new AnomalyDetectorEvaluator(
				configService as unknown as ConfigService,
				actionObserver,
				makeRulesLoader({
					stuck_sensor: { ...defaultAnomalyRules.stuck_sensor, enabled: false },
				}),
			);

			const context = makeContext({
				devices: [
					{
						id: 'sensor-1',
						name: 'Temp Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 21.5 },
					},
				],
			});

			await service.evaluate(context);

			const tracker = (service as any).stuckSensorTracker as Map<string, unknown>;

			// Tracker should remain empty when rule is disabled
			expect(tracker.size).toBe(0);

			const results = await service.evaluate(context);

			expect(results.filter((r) => r.type === SuggestionType.ANOMALY_STUCK_SENSOR)).toHaveLength(0);
		});
	});

	// ──────────────────────────────────────────
	// Unusual activity detection
	// ──────────────────────────────────────────

	describe('unusual activity', () => {
		it('should detect unusual activity when device is triggered more than threshold times', async () => {
			// Record 11 actions for the same device within the time window
			for (let i = 0; i < 11; i++) {
				actionObserver.recordAction(
					makeAction({
						type: IntentType.LIGHT_TOGGLE,
						spaceId: 'space-1',
						deviceIds: ['dev-1'],
						timestamp: new Date(Date.now() - i * 60 * 1000), // 1 min apart
					}),
				);
			}

			const context = makeContext({
				devices: [
					{
						id: 'dev-1',
						name: 'Kitchen Light',
						space: 'space-1',
						category: DeviceCategory.LIGHTING,
						state: { 'light.on': true },
					},
				],
			});

			const results = await service.evaluate(context);
			const activityResults = results.filter((r) => r.type === SuggestionType.ANOMALY_UNUSUAL_ACTIVITY);

			expect(activityResults).toHaveLength(1);
			expect(activityResults[0].reason).toContain('Kitchen Light');
			expect(activityResults[0].reason).toContain('11 times');
			expect(activityResults[0].metadata.actionCount).toBe(11);
			expect(activityResults[0].metadata.deviceId).toBe('dev-1');
		});

		it('should not detect unusual activity below threshold', async () => {
			// Record 9 actions (below default threshold of 10)
			for (let i = 0; i < 9; i++) {
				actionObserver.recordAction(
					makeAction({
						type: IntentType.LIGHT_TOGGLE,
						spaceId: 'space-1',
						deviceIds: ['dev-1'],
						timestamp: new Date(Date.now() - i * 60 * 1000),
					}),
				);
			}

			const context = makeContext({
				devices: [
					{
						id: 'dev-1',
						name: 'Kitchen Light',
						space: 'space-1',
						category: DeviceCategory.LIGHTING,
						state: { 'light.on': true },
					},
				],
			});

			const results = await service.evaluate(context);

			expect(results.filter((r) => r.type === SuggestionType.ANOMALY_UNUSUAL_ACTIVITY)).toHaveLength(0);
		});

		it('should not count actions outside the time window', async () => {
			// Record 11 actions all outside the 15-minute window
			for (let i = 0; i < 11; i++) {
				actionObserver.recordAction(
					makeAction({
						type: IntentType.LIGHT_TOGGLE,
						spaceId: 'space-1',
						deviceIds: ['dev-1'],
						timestamp: new Date(Date.now() - (20 + i) * 60 * 1000), // 20+ min ago
					}),
				);
			}

			const context = makeContext({
				devices: [
					{
						id: 'dev-1',
						name: 'Kitchen Light',
						space: 'space-1',
						category: DeviceCategory.LIGHTING,
						state: { 'light.on': true },
					},
				],
			});

			const results = await service.evaluate(context);

			expect(results.filter((r) => r.type === SuggestionType.ANOMALY_UNUSUAL_ACTIVITY)).toHaveLength(0);
		});

		it('should only count actions for devices in context spaces', async () => {
			// Record 11 actions for a device in a different space
			for (let i = 0; i < 11; i++) {
				actionObserver.recordAction(
					makeAction({
						type: IntentType.LIGHT_TOGGLE,
						spaceId: 'space-2', // Different space
						deviceIds: ['dev-1'],
						timestamp: new Date(Date.now() - i * 60 * 1000),
					}),
				);
			}

			const context = makeContext({
				spaces: [{ id: 'space-1', name: 'Living Room', category: 'living_room', deviceCount: 1 }],
				devices: [
					{
						id: 'dev-1',
						name: 'Kitchen Light',
						space: 'space-1',
						category: DeviceCategory.LIGHTING,
						state: { 'light.on': true },
					},
				],
			});

			const results = await service.evaluate(context);

			expect(results.filter((r) => r.type === SuggestionType.ANOMALY_UNUSUAL_ACTIVITY)).toHaveLength(0);
		});

		it('should count actions separately per device', async () => {
			// 6 actions for dev-1, 6 actions for dev-2 (neither exceeds threshold of 10)
			for (let i = 0; i < 6; i++) {
				actionObserver.recordAction(
					makeAction({
						spaceId: 'space-1',
						deviceIds: ['dev-1'],
						timestamp: new Date(Date.now() - i * 60 * 1000),
					}),
				);
				actionObserver.recordAction(
					makeAction({
						spaceId: 'space-1',
						deviceIds: ['dev-2'],
						timestamp: new Date(Date.now() - i * 60 * 1000),
					}),
				);
			}

			const context = makeContext({
				devices: [
					{
						id: 'dev-1',
						name: 'Light A',
						space: 'space-1',
						category: DeviceCategory.LIGHTING,
						state: {},
					},
					{
						id: 'dev-2',
						name: 'Light B',
						space: 'space-1',
						category: DeviceCategory.LIGHTING,
						state: {},
					},
				],
			});

			const results = await service.evaluate(context);

			expect(results.filter((r) => r.type === SuggestionType.ANOMALY_UNUSUAL_ACTIVITY)).toHaveLength(0);
		});

		it('should detect at exactly the threshold count', async () => {
			// Record exactly 10 actions (threshold)
			for (let i = 0; i < 10; i++) {
				actionObserver.recordAction(
					makeAction({
						spaceId: 'space-1',
						deviceIds: ['dev-1'],
						timestamp: new Date(Date.now() - i * 60 * 1000),
					}),
				);
			}

			const context = makeContext({
				devices: [
					{
						id: 'dev-1',
						name: 'Light',
						space: 'space-1',
						category: DeviceCategory.LIGHTING,
						state: {},
					},
				],
			});

			const results = await service.evaluate(context);

			// >= threshold
			expect(results.filter((r) => r.type === SuggestionType.ANOMALY_UNUSUAL_ACTIVITY)).toHaveLength(1);
		});

		it('should respect configurable activity threshold and window', async () => {
			configService.getModuleConfig.mockReturnValue({
				enabled: true,
				anomalyTemperatureDriftThreshold: ANOMALY_TEMPERATURE_DRIFT_THRESHOLD,
				anomalyStuckSensorHours: ANOMALY_STUCK_SENSOR_HOURS,
				anomalyUnusualActivityThreshold: 5, // Lower threshold
				anomalyUnusualActivityWindowMinutes: 5, // Shorter window
			});

			// Record 5 actions within 5 minutes
			for (let i = 0; i < 5; i++) {
				actionObserver.recordAction(
					makeAction({
						spaceId: 'space-1',
						deviceIds: ['dev-1'],
						timestamp: new Date(Date.now() - i * 30 * 1000), // 30s apart
					}),
				);
			}

			const context = makeContext({
				devices: [
					{
						id: 'dev-1',
						name: 'Light',
						space: 'space-1',
						category: DeviceCategory.LIGHTING,
						state: {},
					},
				],
			});

			const results = await service.evaluate(context);

			expect(results.filter((r) => r.type === SuggestionType.ANOMALY_UNUSUAL_ACTIVITY)).toHaveLength(1);
		});

		it('should use device ID as name fallback when device not in context', async () => {
			for (let i = 0; i < 11; i++) {
				actionObserver.recordAction(
					makeAction({
						spaceId: 'space-1',
						deviceIds: ['unknown-dev'],
						timestamp: new Date(Date.now() - i * 60 * 1000),
					}),
				);
			}

			const context = makeContext({ devices: [] });
			const results = await service.evaluate(context);
			const activityResults = results.filter((r) => r.type === SuggestionType.ANOMALY_UNUSUAL_ACTIVITY);

			expect(activityResults).toHaveLength(1);
			expect(activityResults[0].metadata.deviceName).toBe('unknown-dev');
		});
	});

	// ──────────────────────────────────────────
	// Config fallback
	// ──────────────────────────────────────────

	describe('config fallback', () => {
		it('should use default thresholds when config service throws', async () => {
			configService.getModuleConfig.mockImplementation(() => {
				throw new Error('Config not found');
			});

			// Record enough actions to trigger with default threshold
			for (let i = 0; i < 11; i++) {
				actionObserver.recordAction(
					makeAction({
						spaceId: 'space-1',
						deviceIds: ['dev-1'],
						timestamp: new Date(Date.now() - i * 60 * 1000),
					}),
				);
			}

			const context = makeContext({
				devices: [
					{
						id: 'dev-1',
						name: 'Light',
						space: 'space-1',
						category: DeviceCategory.LIGHTING,
						state: {},
					},
				],
			});

			const results = await service.evaluate(context);

			// Should still work with defaults
			expect(results.filter((r) => r.type === SuggestionType.ANOMALY_UNUSUAL_ACTIVITY)).toHaveLength(1);
		});
	});

	// ──────────────────────────────────────────
	// Combined detection
	// ──────────────────────────────────────────

	describe('combined detection', () => {
		it('should detect multiple anomaly types simultaneously', async () => {
			// Set up stuck sensor tracker
			const context = makeContext({
				spaces: [{ id: 'space-1', name: 'Bedroom', category: 'bedroom', deviceCount: 3 }],
				devices: [
					{
						id: 'sensor-1',
						name: 'Temp Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'temperature.temperature': 30 },
					},
					{
						id: 'thermo-1',
						name: 'Thermostat',
						space: 'space-1',
						category: DeviceCategory.THERMOSTAT,
						state: { 'thermostat.temperature': 22 },
					},
					{
						id: 'humidity-1',
						name: 'Humidity Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'humidity.humidity': 45 },
					},
				],
			});

			// First evaluation to seed the stuck sensor tracker
			await service.evaluate(context);

			// Backdate the stuck sensor entry
			const tracker = (service as any).stuckSensorTracker as Map<string, { value: unknown; since: number }>;

			tracker.set('humidity-1::humidity.humidity', {
				value: 45,
				since: Date.now() - 5 * 60 * 60 * 1000, // 5 hours ago
			});

			// Add unusual activity
			for (let i = 0; i < 12; i++) {
				actionObserver.recordAction(
					makeAction({
						spaceId: 'space-1',
						deviceIds: ['sensor-1'],
						timestamp: new Date(Date.now() - i * 60 * 1000),
					}),
				);
			}

			const results = await service.evaluate(context);

			const types = results.map((r) => r.type);

			expect(types).toContain(SuggestionType.ANOMALY_SENSOR_DRIFT);
			expect(types).toContain(SuggestionType.ANOMALY_STUCK_SENSOR);
			expect(types).toContain(SuggestionType.ANOMALY_UNUSUAL_ACTIVITY);
		});
	});
});
