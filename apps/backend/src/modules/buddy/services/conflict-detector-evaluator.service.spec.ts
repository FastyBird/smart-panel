/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { ConfigService } from '../../config/services/config.service';
import { DeviceCategory } from '../../devices/devices.constants';
import { CONFLICT_LIGHTS_UNOCCUPIED_MINUTES, SuggestionType } from '../buddy.constants';

import { BuddyContext } from './buddy-context.service';
import { ConflictDetectorEvaluator } from './conflict-detector-evaluator.service';

function makeContext(overrides: Partial<BuddyContext> = {}): BuddyContext {
	return {
		timestamp: new Date().toISOString(),
		spaces: overrides.spaces ?? [{ id: 'space-1', name: 'Living Room', category: 'living_room', deviceCount: 3 }],
		devices: overrides.devices ?? [],
		scenes: overrides.scenes ?? [],
		weather: overrides.weather ?? null,
		energy: overrides.energy ?? null,
		recentIntents: overrides.recentIntents ?? [],
	};
}

describe('ConflictDetectorEvaluator', () => {
	let service: ConflictDetectorEvaluator;
	let configService: { getModuleConfig: jest.Mock };

	beforeEach(() => {
		configService = {
			getModuleConfig: jest.fn().mockReturnValue({
				enabled: true,
				conflictLightsUnoccupiedMinutes: CONFLICT_LIGHTS_UNOCCUPIED_MINUTES,
			}),
		};

		service = new ConflictDetectorEvaluator(configService as unknown as ConfigService);
	});

	it('should have the name "ConflictDetector"', () => {
		expect(service.name).toBe('ConflictDetector');
	});

	it('should return empty results for empty context', async () => {
		const context = makeContext();
		const results = await service.evaluate(context);

		expect(results).toHaveLength(0);
	});

	// ──────────────────────────────────────────
	// Heating + open window conflict
	// ──────────────────────────────────────────

	describe('heating + open window', () => {
		it('should detect heating with open window conflict', async () => {
			const context = makeContext({
				devices: [
					{
						id: 'heater-1',
						name: 'Living Room Heater',
						space: 'space-1',
						category: DeviceCategory.THERMOSTAT,
						state: { 'heater.on': true, 'heater.status': true, 'thermostat.temperature': 24 },
					},
					{
						id: 'contact-1',
						name: 'Window Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'contact.detected': true },
					},
				],
			});

			const results = await service.evaluate(context);
			const conflictResults = results.filter((r) => r.type === SuggestionType.CONFLICT_HEATING_WINDOW);

			expect(conflictResults).toHaveLength(1);
			expect(conflictResults[0].title).toBe('Heating with open window');
			expect(conflictResults[0].reason).toContain('Living Room');
			expect(conflictResults[0].reason).toContain('window is open');
			expect(conflictResults[0].reason).toContain('heating is active');
			expect(conflictResults[0].reason).toContain('24°C');
			expect(conflictResults[0].spaceId).toBe('space-1');
			expect(conflictResults[0].metadata.contactDevice).toBe('Window Sensor');
			expect(conflictResults[0].metadata.setpoint).toBe(24);
		});

		it('should not detect conflict when window is closed', async () => {
			const context = makeContext({
				devices: [
					{
						id: 'heater-1',
						name: 'Heater',
						space: 'space-1',
						category: DeviceCategory.THERMOSTAT,
						state: { 'heater.on': true, 'heater.status': true, 'thermostat.temperature': 22 },
					},
					{
						id: 'contact-1',
						name: 'Window Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'contact.detected': false },
					},
				],
			});

			const results = await service.evaluate(context);
			const conflictResults = results.filter((r) => r.type === SuggestionType.CONFLICT_HEATING_WINDOW);

			expect(conflictResults).toHaveLength(0);
		});

		it('should not detect conflict when heating is off', async () => {
			const context = makeContext({
				devices: [
					{
						id: 'heater-1',
						name: 'Heater',
						space: 'space-1',
						category: DeviceCategory.THERMOSTAT,
						state: { 'heater.on': false, 'heater.status': false, 'thermostat.temperature': 22 },
					},
					{
						id: 'contact-1',
						name: 'Window Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'contact.detected': true },
					},
				],
			});

			const results = await service.evaluate(context);
			const conflictResults = results.filter((r) => r.type === SuggestionType.CONFLICT_HEATING_WINDOW);

			expect(conflictResults).toHaveLength(0);
		});

		it('should detect conflict with heating unit device category', async () => {
			const context = makeContext({
				devices: [
					{
						id: 'heater-1',
						name: 'Boiler',
						space: 'space-1',
						category: DeviceCategory.HEATING_UNIT,
						state: { 'heater.on': true },
					},
					{
						id: 'contact-1',
						name: 'Door Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'contact.detected': true },
					},
				],
			});

			const results = await service.evaluate(context);
			const conflictResults = results.filter((r) => r.type === SuggestionType.CONFLICT_HEATING_WINDOW);

			expect(conflictResults).toHaveLength(1);
		});

		it('should not detect cross-space conflicts', async () => {
			const context = makeContext({
				spaces: [
					{ id: 'space-1', name: 'Living Room', category: 'living_room', deviceCount: 1 },
					{ id: 'space-2', name: 'Bedroom', category: 'bedroom', deviceCount: 1 },
				],
				devices: [
					{
						id: 'heater-1',
						name: 'Heater',
						space: 'space-1',
						category: DeviceCategory.THERMOSTAT,
						state: { 'heater.on': true, 'heater.status': true },
					},
					{
						id: 'contact-1',
						name: 'Window Sensor',
						space: 'space-2',
						category: DeviceCategory.SENSOR,
						state: { 'contact.detected': true },
					},
				],
			});

			const results = await service.evaluate(context);
			const conflictResults = results.filter((r) => r.type === SuggestionType.CONFLICT_HEATING_WINDOW);

			expect(conflictResults).toHaveLength(0);
		});

		it('should include setpoint when thermostat has temperature', async () => {
			const context = makeContext({
				devices: [
					{
						id: 'thermo-1',
						name: 'Thermostat',
						space: 'space-1',
						category: DeviceCategory.THERMOSTAT,
						state: { 'heater.on': true, 'heater.status': true, 'thermostat.temperature': 25 },
					},
					{
						id: 'contact-1',
						name: 'Window',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'contact.detected': true },
					},
				],
			});

			const results = await service.evaluate(context);

			expect(results[0].reason).toContain('25°C');
		});

		it('should omit setpoint when no thermostat temperature available', async () => {
			const context = makeContext({
				devices: [
					{
						id: 'heater-1',
						name: 'Heater',
						space: 'space-1',
						category: DeviceCategory.LIGHTING,
						state: { 'heater.on': true, 'heater.status': true },
					},
					{
						id: 'contact-1',
						name: 'Window',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'contact.detected': true },
					},
				],
			});

			const results = await service.evaluate(context);
			const conflictResults = results.filter((r) => r.type === SuggestionType.CONFLICT_HEATING_WINDOW);

			expect(conflictResults).toHaveLength(1);
			expect(conflictResults[0].reason).not.toContain('°C');
		});
	});

	// ──────────────────────────────────────────
	// AC + open window conflict
	// ──────────────────────────────────────────

	describe('AC + open window', () => {
		it('should detect AC with open window conflict', async () => {
			const context = makeContext({
				devices: [
					{
						id: 'ac-1',
						name: 'AC Unit',
						space: 'space-1',
						category: DeviceCategory.AIR_CONDITIONER,
						state: { 'cooler.on': true, 'cooler.status': true },
					},
					{
						id: 'contact-1',
						name: 'Window Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'contact.detected': true },
					},
				],
			});

			const results = await service.evaluate(context);
			const conflictResults = results.filter((r) => r.type === SuggestionType.CONFLICT_AC_WINDOW);

			expect(conflictResults).toHaveLength(1);
			expect(conflictResults[0].title).toBe('AC with open window');
			expect(conflictResults[0].reason).toContain('Living Room');
			expect(conflictResults[0].reason).toContain('AC is active');
			expect(conflictResults[0].spaceId).toBe('space-1');
			expect(conflictResults[0].metadata.contactDevice).toBe('Window Sensor');
		});

		it('should not detect AC conflict when window is closed', async () => {
			const context = makeContext({
				devices: [
					{
						id: 'ac-1',
						name: 'AC Unit',
						space: 'space-1',
						category: DeviceCategory.AIR_CONDITIONER,
						state: { 'cooler.on': true, 'cooler.status': true },
					},
					{
						id: 'contact-1',
						name: 'Window Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'contact.detected': false },
					},
				],
			});

			const results = await service.evaluate(context);
			const conflictResults = results.filter((r) => r.type === SuggestionType.CONFLICT_AC_WINDOW);

			expect(conflictResults).toHaveLength(0);
		});

		it('should not detect conflict when AC is off', async () => {
			const context = makeContext({
				devices: [
					{
						id: 'ac-1',
						name: 'AC Unit',
						space: 'space-1',
						category: DeviceCategory.AIR_CONDITIONER,
						state: { 'cooler.on': false, 'cooler.status': false },
					},
					{
						id: 'contact-1',
						name: 'Window',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'contact.detected': true },
					},
				],
			});

			const results = await service.evaluate(context);
			const conflictResults = results.filter((r) => r.type === SuggestionType.CONFLICT_AC_WINDOW);

			expect(conflictResults).toHaveLength(0);
		});

		it('should detect AC conflict with only cooler.on for AC device category', async () => {
			const context = makeContext({
				devices: [
					{
						id: 'ac-1',
						name: 'AC Unit',
						space: 'space-1',
						category: DeviceCategory.AIR_CONDITIONER,
						state: { 'cooler.on': true },
					},
					{
						id: 'contact-1',
						name: 'Window',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'contact.detected': true },
					},
				],
			});

			const results = await service.evaluate(context);
			const conflictResults = results.filter((r) => r.type === SuggestionType.CONFLICT_AC_WINDOW);

			expect(conflictResults).toHaveLength(1);
		});
	});

	// ──────────────────────────────────────────
	// Lights on in unoccupied room
	// ──────────────────────────────────────────

	describe('lights on in unoccupied room', () => {
		it('should not detect on first evaluation (needs time to pass)', async () => {
			const context = makeContext({
				devices: [
					{
						id: 'light-1',
						name: 'Ceiling Light',
						space: 'space-1',
						category: DeviceCategory.LIGHTING,
						state: { 'light.on': true },
					},
					{
						id: 'occupancy-1',
						name: 'Motion Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'occupancy.detected': false },
					},
				],
			});

			const results = await service.evaluate(context);
			const conflictResults = results.filter((r) => r.type === SuggestionType.CONFLICT_LIGHTS_UNOCCUPIED);

			expect(conflictResults).toHaveLength(0);
		});

		it('should detect lights in unoccupied room after threshold time', async () => {
			const context = makeContext({
				devices: [
					{
						id: 'light-1',
						name: 'Ceiling Light',
						space: 'space-1',
						category: DeviceCategory.LIGHTING,
						state: { 'light.on': true },
					},
					{
						id: 'occupancy-1',
						name: 'Motion Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'occupancy.detected': false },
					},
				],
			});

			// First evaluation seeds the tracker
			await service.evaluate(context);

			// Simulate time passage by manipulating the tracker
			const tracker = (service as any).occupancyTracker as Map<string, number>;

			tracker.set(
				'space-1::lights_unoccupied',
				Date.now() - (CONFLICT_LIGHTS_UNOCCUPIED_MINUTES + 1) * 60 * 1000,
			);

			const results = await service.evaluate(context);
			const conflictResults = results.filter((r) => r.type === SuggestionType.CONFLICT_LIGHTS_UNOCCUPIED);

			expect(conflictResults).toHaveLength(1);
			expect(conflictResults[0].title).toBe('Lights on in unoccupied room');
			expect(conflictResults[0].reason).toContain('Living Room');
			expect(conflictResults[0].reason).toContain('unoccupied');
			expect(conflictResults[0].reason).toContain(`${CONFLICT_LIGHTS_UNOCCUPIED_MINUTES} minutes`);
			expect(conflictResults[0].spaceId).toBe('space-1');
		});

		it('should not detect before threshold time has passed', async () => {
			const context = makeContext({
				devices: [
					{
						id: 'light-1',
						name: 'Light',
						space: 'space-1',
						category: DeviceCategory.LIGHTING,
						state: { 'light.on': true },
					},
					{
						id: 'occupancy-1',
						name: 'Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'occupancy.detected': false },
					},
				],
			});

			await service.evaluate(context);

			// Set to 5 minutes ago (below 15 min threshold)
			const tracker = (service as any).occupancyTracker as Map<string, number>;

			tracker.set('space-1::lights_unoccupied', Date.now() - 5 * 60 * 1000);

			const results = await service.evaluate(context);
			const conflictResults = results.filter((r) => r.type === SuggestionType.CONFLICT_LIGHTS_UNOCCUPIED);

			expect(conflictResults).toHaveLength(0);
		});

		it('should not detect when room is occupied', async () => {
			const context = makeContext({
				devices: [
					{
						id: 'light-1',
						name: 'Light',
						space: 'space-1',
						category: DeviceCategory.LIGHTING,
						state: { 'light.on': true },
					},
					{
						id: 'occupancy-1',
						name: 'Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'occupancy.detected': true },
					},
				],
			});

			const results = await service.evaluate(context);
			const conflictResults = results.filter((r) => r.type === SuggestionType.CONFLICT_LIGHTS_UNOCCUPIED);

			expect(conflictResults).toHaveLength(0);
		});

		it('should not detect when lights are off', async () => {
			const context = makeContext({
				devices: [
					{
						id: 'light-1',
						name: 'Light',
						space: 'space-1',
						category: DeviceCategory.LIGHTING,
						state: { 'light.on': false },
					},
					{
						id: 'occupancy-1',
						name: 'Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'occupancy.detected': false },
					},
				],
			});

			const results = await service.evaluate(context);
			const conflictResults = results.filter((r) => r.type === SuggestionType.CONFLICT_LIGHTS_UNOCCUPIED);

			expect(conflictResults).toHaveLength(0);
		});

		it('should not detect when there is no occupancy sensor', async () => {
			const context = makeContext({
				devices: [
					{
						id: 'light-1',
						name: 'Light',
						space: 'space-1',
						category: DeviceCategory.LIGHTING,
						state: { 'light.on': true },
					},
				],
			});

			const results = await service.evaluate(context);
			const conflictResults = results.filter((r) => r.type === SuggestionType.CONFLICT_LIGHTS_UNOCCUPIED);

			expect(conflictResults).toHaveLength(0);
		});

		it('should respect configurable unoccupied duration', async () => {
			configService.getModuleConfig.mockReturnValue({
				enabled: true,
				conflictLightsUnoccupiedMinutes: 30,
			});

			const context = makeContext({
				devices: [
					{
						id: 'light-1',
						name: 'Light',
						space: 'space-1',
						category: DeviceCategory.LIGHTING,
						state: { 'light.on': true },
					},
					{
						id: 'occupancy-1',
						name: 'Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'occupancy.detected': false },
					},
				],
			});

			await service.evaluate(context);

			// Set to 20 minutes ago (below 30 min threshold)
			const tracker = (service as any).occupancyTracker as Map<string, number>;

			tracker.set('space-1::lights_unoccupied', Date.now() - 20 * 60 * 1000);

			const results = await service.evaluate(context);
			const conflictResults = results.filter((r) => r.type === SuggestionType.CONFLICT_LIGHTS_UNOCCUPIED);

			expect(conflictResults).toHaveLength(0);
		});

		it('should reset occupancy tracker via public method', async () => {
			const context = makeContext({
				devices: [
					{
						id: 'light-1',
						name: 'Light',
						space: 'space-1',
						category: DeviceCategory.LIGHTING,
						state: { 'light.on': true },
					},
					{
						id: 'occupancy-1',
						name: 'Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'occupancy.detected': false },
					},
				],
			});

			// Seed the tracker
			await service.evaluate(context);

			const tracker = (service as any).occupancyTracker as Map<string, number>;

			expect(tracker.has('space-1::lights_unoccupied')).toBe(true);

			// Reset
			service.resetOccupancyTracker('space-1');

			expect(tracker.has('space-1::lights_unoccupied')).toBe(false);
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

			const context = makeContext({
				devices: [
					{
						id: 'light-1',
						name: 'Light',
						space: 'space-1',
						category: DeviceCategory.LIGHTING,
						state: { 'light.on': true },
					},
					{
						id: 'occupancy-1',
						name: 'Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'occupancy.detected': false },
					},
				],
			});

			await service.evaluate(context);

			const tracker = (service as any).occupancyTracker as Map<string, number>;

			tracker.set(
				'space-1::lights_unoccupied',
				Date.now() - (CONFLICT_LIGHTS_UNOCCUPIED_MINUTES + 1) * 60 * 1000,
			);

			const results = await service.evaluate(context);
			const conflictResults = results.filter((r) => r.type === SuggestionType.CONFLICT_LIGHTS_UNOCCUPIED);

			// Should trigger with default threshold (15 min)
			expect(conflictResults).toHaveLength(1);
		});
	});

	// ──────────────────────────────────────────
	// Combined detection
	// ──────────────────────────────────────────

	describe('combined detection', () => {
		it('should detect multiple conflict types per space', async () => {
			const context = makeContext({
				devices: [
					{
						id: 'heater-1',
						name: 'Heater',
						space: 'space-1',
						category: DeviceCategory.THERMOSTAT,
						state: { 'heater.on': true, 'heater.status': true, 'thermostat.temperature': 24 },
					},
					{
						id: 'contact-1',
						name: 'Window Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'contact.detected': true },
					},
					{
						id: 'light-1',
						name: 'Light',
						space: 'space-1',
						category: DeviceCategory.LIGHTING,
						state: { 'light.on': true },
					},
					{
						id: 'occupancy-1',
						name: 'Motion Sensor',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'occupancy.detected': false },
					},
				],
			});

			// Seed occupancy tracker
			await service.evaluate(context);

			const tracker = (service as any).occupancyTracker as Map<string, number>;

			tracker.set(
				'space-1::lights_unoccupied',
				Date.now() - (CONFLICT_LIGHTS_UNOCCUPIED_MINUTES + 5) * 60 * 1000,
			);

			const results = await service.evaluate(context);
			const types = results.map((r) => r.type);

			expect(types).toContain(SuggestionType.CONFLICT_HEATING_WINDOW);
			expect(types).toContain(SuggestionType.CONFLICT_LIGHTS_UNOCCUPIED);
		});

		it('should detect conflicts independently per space', async () => {
			const context = makeContext({
				spaces: [
					{ id: 'space-1', name: 'Living Room', category: 'living_room', deviceCount: 2 },
					{ id: 'space-2', name: 'Bedroom', category: 'bedroom', deviceCount: 2 },
				],
				devices: [
					{
						id: 'heater-1',
						name: 'Heater',
						space: 'space-1',
						category: DeviceCategory.THERMOSTAT,
						state: { 'heater.on': true, 'heater.status': true },
					},
					{
						id: 'contact-1',
						name: 'Window',
						space: 'space-1',
						category: DeviceCategory.SENSOR,
						state: { 'contact.detected': true },
					},
					{
						id: 'ac-1',
						name: 'AC',
						space: 'space-2',
						category: DeviceCategory.AIR_CONDITIONER,
						state: { 'cooler.on': true, 'cooler.status': true },
					},
					{
						id: 'contact-2',
						name: 'Bedroom Window',
						space: 'space-2',
						category: DeviceCategory.SENSOR,
						state: { 'contact.detected': true },
					},
				],
			});

			const results = await service.evaluate(context);

			expect(results).toHaveLength(2);
			expect(results[0].type).toBe(SuggestionType.CONFLICT_HEATING_WINDOW);
			expect(results[0].spaceId).toBe('space-1');
			expect(results[1].type).toBe(SuggestionType.CONFLICT_AC_WINDOW);
			expect(results[1].spaceId).toBe('space-2');
		});
	});
});
