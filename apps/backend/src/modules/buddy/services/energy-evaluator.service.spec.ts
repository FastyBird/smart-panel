import { ConfigService } from '../../config/services/config.service';
import {
	ENERGY_BATTERY_LOW_THRESHOLD_PERCENT,
	ENERGY_EXCESS_SOLAR_THRESHOLD_KW,
	ENERGY_GLOBAL_SPACE_ID,
	ENERGY_HIGH_CONSUMPTION_THRESHOLD_KW,
	SuggestionType,
} from '../buddy.constants';

import { BuddyContext } from './buddy-context.service';
import { EnergyEvaluator } from './energy-evaluator.service';

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

describe('EnergyEvaluator', () => {
	let service: EnergyEvaluator;
	let configService: { getModuleConfig: jest.Mock };

	beforeEach(() => {
		configService = {
			getModuleConfig: jest.fn().mockReturnValue({
				enabled: true,
				energyExcessSolarThresholdKw: ENERGY_EXCESS_SOLAR_THRESHOLD_KW,
				energyHighConsumptionThresholdKw: ENERGY_HIGH_CONSUMPTION_THRESHOLD_KW,
				energyBatteryLowThresholdPercent: ENERGY_BATTERY_LOW_THRESHOLD_PERCENT,
			}),
		};

		service = new EnergyEvaluator(configService as unknown as ConfigService);
	});

	it('should have the name "EnergyEvaluator"', () => {
		expect(service.name).toBe('EnergyEvaluator');
	});

	it('should return empty results when energy data is null', async () => {
		const context = makeContext({ energy: null });
		const results = await service.evaluate(context);

		expect(results).toHaveLength(0);
	});

	// ──────────────────────────────────────────
	// Excess solar detection (based on gridExport)
	// ──────────────────────────────────────────

	describe('excess solar', () => {
		it('should detect excess solar when grid export exceeds threshold', async () => {
			const context = makeContext({
				energy: { solarProduction: 4.5, gridConsumption: 0, gridExport: 2.5, batteryLevel: 80 },
			});

			const results = await service.evaluate(context);
			const solarResults = results.filter((r) => r.type === SuggestionType.ENERGY_EXCESS_SOLAR);

			expect(solarResults).toHaveLength(1);
			expect(solarResults[0].title).toBe('Excess solar energy available');
			expect(solarResults[0].reason).toContain('2.5kW');
			expect(solarResults[0].reason).toContain('high-load appliances');
			expect(solarResults[0].metadata.gridExport).toBe(2.5);
			expect(solarResults[0].metadata.solarProduction).toBe(4.5);
		});

		it('should not detect excess solar when grid export is below threshold', async () => {
			const context = makeContext({
				energy: { solarProduction: 2.5, gridConsumption: 2, gridExport: 0.5, batteryLevel: 80 },
			});

			const results = await service.evaluate(context);
			const solarResults = results.filter((r) => r.type === SuggestionType.ENERGY_EXCESS_SOLAR);

			expect(solarResults).toHaveLength(0);
		});

		it('should not detect excess solar when grid export equals threshold', async () => {
			const context = makeContext({
				energy: { solarProduction: 3, gridConsumption: 0, gridExport: 1, batteryLevel: 80 },
			});

			const results = await service.evaluate(context);
			const solarResults = results.filter((r) => r.type === SuggestionType.ENERGY_EXCESS_SOLAR);

			// gridExport = 1, threshold = 1, need > 1 to trigger
			expect(solarResults).toHaveLength(0);
		});

		it('should not detect excess solar when there is no grid export', async () => {
			const context = makeContext({
				energy: { solarProduction: 1, gridConsumption: 3, gridExport: 0, batteryLevel: 80 },
			});

			const results = await service.evaluate(context);
			const solarResults = results.filter((r) => r.type === SuggestionType.ENERGY_EXCESS_SOLAR);

			expect(solarResults).toHaveLength(0);
		});

		it('should not detect excess solar when there is no solar production', async () => {
			const context = makeContext({
				energy: { solarProduction: 0, gridConsumption: 3, gridExport: 0, batteryLevel: 80 },
			});

			const results = await service.evaluate(context);
			const solarResults = results.filter((r) => r.type === SuggestionType.ENERGY_EXCESS_SOLAR);

			expect(solarResults).toHaveLength(0);
		});

		it('should respect configurable excess solar threshold', async () => {
			configService.getModuleConfig.mockReturnValue({
				enabled: true,
				energyExcessSolarThresholdKw: 3,
				energyHighConsumptionThresholdKw: ENERGY_HIGH_CONSUMPTION_THRESHOLD_KW,
				energyBatteryLowThresholdPercent: ENERGY_BATTERY_LOW_THRESHOLD_PERCENT,
			});

			const context = makeContext({
				energy: { solarProduction: 5, gridConsumption: 0, gridExport: 2.5, batteryLevel: 80 },
			});

			const results = await service.evaluate(context);
			const solarResults = results.filter((r) => r.type === SuggestionType.ENERGY_EXCESS_SOLAR);

			// gridExport = 2.5, threshold = 3, should not trigger
			expect(solarResults).toHaveLength(0);
		});

		it('should round all metadata values to one decimal place', async () => {
			const context = makeContext({
				energy: { solarProduction: 4.567, gridConsumption: 0, gridExport: 2.444, batteryLevel: 80 },
			});

			const results = await service.evaluate(context);
			const solarResults = results.filter((r) => r.type === SuggestionType.ENERGY_EXCESS_SOLAR);

			expect(solarResults).toHaveLength(1);
			expect(solarResults[0].metadata.gridExport).toBe(2.4);
			expect(solarResults[0].metadata.solarProduction).toBe(4.6);
		});
	});

	// ──────────────────────────────────────────
	// High consumption detection
	// ──────────────────────────────────────────

	describe('high consumption', () => {
		it('should detect high consumption when grid draw exceeds threshold', async () => {
			const context = makeContext({
				energy: { solarProduction: 0, gridConsumption: 6.5, gridExport: 0, batteryLevel: 80 },
			});

			const results = await service.evaluate(context);
			const consumptionResults = results.filter((r) => r.type === SuggestionType.ENERGY_HIGH_CONSUMPTION);

			expect(consumptionResults).toHaveLength(1);
			expect(consumptionResults[0].title).toBe('High grid consumption');
			expect(consumptionResults[0].reason).toContain('6.5kW');
			expect(consumptionResults[0].reason).toContain('reducing load');
			expect(consumptionResults[0].metadata.gridConsumption).toBe(6.5);
			expect(consumptionResults[0].metadata.threshold).toBe(5);
		});

		it('should not detect high consumption when grid draw is below threshold', async () => {
			const context = makeContext({
				energy: { solarProduction: 0, gridConsumption: 3, gridExport: 0, batteryLevel: 80 },
			});

			const results = await service.evaluate(context);
			const consumptionResults = results.filter((r) => r.type === SuggestionType.ENERGY_HIGH_CONSUMPTION);

			expect(consumptionResults).toHaveLength(0);
		});

		it('should not detect high consumption when grid draw equals threshold', async () => {
			const context = makeContext({
				energy: { solarProduction: 0, gridConsumption: 5, gridExport: 0, batteryLevel: 80 },
			});

			const results = await service.evaluate(context);
			const consumptionResults = results.filter((r) => r.type === SuggestionType.ENERGY_HIGH_CONSUMPTION);

			// consumption = 5, threshold = 5, need > 5 to trigger
			expect(consumptionResults).toHaveLength(0);
		});

		it('should respect configurable high consumption threshold', async () => {
			configService.getModuleConfig.mockReturnValue({
				enabled: true,
				energyExcessSolarThresholdKw: ENERGY_EXCESS_SOLAR_THRESHOLD_KW,
				energyHighConsumptionThresholdKw: 10,
				energyBatteryLowThresholdPercent: ENERGY_BATTERY_LOW_THRESHOLD_PERCENT,
			});

			const context = makeContext({
				energy: { solarProduction: 0, gridConsumption: 8, gridExport: 0, batteryLevel: 80 },
			});

			const results = await service.evaluate(context);
			const consumptionResults = results.filter((r) => r.type === SuggestionType.ENERGY_HIGH_CONSUMPTION);

			// consumption = 8, threshold = 10, should not trigger
			expect(consumptionResults).toHaveLength(0);
		});
	});

	// ──────────────────────────────────────────
	// Battery low detection
	// ──────────────────────────────────────────

	describe('battery low', () => {
		it('should detect low battery when below threshold with no solar', async () => {
			const context = makeContext({
				energy: { solarProduction: 0, gridConsumption: 2, gridExport: 0, batteryLevel: 15 },
			});

			const results = await service.evaluate(context);
			const batteryResults = results.filter((r) => r.type === SuggestionType.ENERGY_BATTERY_LOW);

			expect(batteryResults).toHaveLength(1);
			expect(batteryResults[0].title).toBe('Battery level low');
			expect(batteryResults[0].reason).toContain('15%');
			expect(batteryResults[0].reason).toContain('no solar production');
			expect(batteryResults[0].metadata.batteryLevel).toBe(15);
			expect(batteryResults[0].metadata.solarProduction).toBe(0);
		});

		it('should not detect low battery when battery is above threshold', async () => {
			const context = makeContext({
				energy: { solarProduction: 0, gridConsumption: 2, gridExport: 0, batteryLevel: 50 },
			});

			const results = await service.evaluate(context);
			const batteryResults = results.filter((r) => r.type === SuggestionType.ENERGY_BATTERY_LOW);

			expect(batteryResults).toHaveLength(0);
		});

		it('should not detect low battery when battery is at threshold', async () => {
			const context = makeContext({
				energy: { solarProduction: 0, gridConsumption: 2, gridExport: 0, batteryLevel: 20 },
			});

			const results = await service.evaluate(context);
			const batteryResults = results.filter((r) => r.type === SuggestionType.ENERGY_BATTERY_LOW);

			// battery = 20, threshold = 20, need < 20 to trigger
			expect(batteryResults).toHaveLength(0);
		});

		it('should not detect low battery when there is solar production', async () => {
			const context = makeContext({
				energy: { solarProduction: 1.5, gridConsumption: 2, gridExport: 0, batteryLevel: 10 },
			});

			const results = await service.evaluate(context);
			const batteryResults = results.filter((r) => r.type === SuggestionType.ENERGY_BATTERY_LOW);

			expect(batteryResults).toHaveLength(0);
		});

		it('should detect low battery at 1% with no solar', async () => {
			const context = makeContext({
				energy: { solarProduction: 0, gridConsumption: 2, gridExport: 0, batteryLevel: 1 },
			});

			const results = await service.evaluate(context);
			const batteryResults = results.filter((r) => r.type === SuggestionType.ENERGY_BATTERY_LOW);

			expect(batteryResults).toHaveLength(1);
			expect(batteryResults[0].metadata.batteryLevel).toBe(1);
		});

		it('should not detect low battery when batteryLevel is null (no battery installed)', async () => {
			const context = makeContext({
				energy: { solarProduction: 0, gridConsumption: 2, gridExport: 0, batteryLevel: null },
			});

			const results = await service.evaluate(context);
			const batteryResults = results.filter((r) => r.type === SuggestionType.ENERGY_BATTERY_LOW);

			expect(batteryResults).toHaveLength(0);
		});

		it('should respect configurable battery low threshold', async () => {
			configService.getModuleConfig.mockReturnValue({
				enabled: true,
				energyExcessSolarThresholdKw: ENERGY_EXCESS_SOLAR_THRESHOLD_KW,
				energyHighConsumptionThresholdKw: ENERGY_HIGH_CONSUMPTION_THRESHOLD_KW,
				energyBatteryLowThresholdPercent: 10,
			});

			const context = makeContext({
				energy: { solarProduction: 0, gridConsumption: 2, gridExport: 0, batteryLevel: 15 },
			});

			const results = await service.evaluate(context);
			const batteryResults = results.filter((r) => r.type === SuggestionType.ENERGY_BATTERY_LOW);

			// battery = 15, threshold = 10, should not trigger
			expect(batteryResults).toHaveLength(0);
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
				energy: { solarProduction: 5, gridConsumption: 0, gridExport: 3, batteryLevel: 80 },
			});

			const results = await service.evaluate(context);
			const solarResults = results.filter((r) => r.type === SuggestionType.ENERGY_EXCESS_SOLAR);

			// gridExport = 3, default threshold = 1, should trigger
			expect(solarResults).toHaveLength(1);
		});
	});

	// ──────────────────────────────────────────
	// Combined detection
	// ──────────────────────────────────────────

	describe('combined detection', () => {
		it('should detect multiple energy issues simultaneously', async () => {
			const context = makeContext({
				energy: { solarProduction: 0, gridConsumption: 7, gridExport: 0, batteryLevel: 5 },
			});

			const results = await service.evaluate(context);

			const types = results.map((r) => r.type);

			expect(types).toContain(SuggestionType.ENERGY_HIGH_CONSUMPTION);
			expect(types).toContain(SuggestionType.ENERGY_BATTERY_LOW);
			expect(types).not.toContain(SuggestionType.ENERGY_EXCESS_SOLAR);
		});

		it('should use global spaceId for energy results regardless of context spaces', async () => {
			const context = makeContext({
				spaces: [
					{ id: 'space-1', name: 'Living Room', category: 'living_room', deviceCount: 1 },
					{ id: 'space-2', name: 'Kitchen', category: 'kitchen', deviceCount: 1 },
				],
				energy: { solarProduction: 5, gridConsumption: 0, gridExport: 3, batteryLevel: 80 },
			});

			const results = await service.evaluate(context);

			expect(results).toHaveLength(1);
			expect(results[0].spaceId).toBe(ENERGY_GLOBAL_SPACE_ID);
		});

		it('should use global spaceId even when no spaces in context', async () => {
			const context = makeContext({
				spaces: [],
				energy: { solarProduction: 5, gridConsumption: 0, gridExport: 3, batteryLevel: 80 },
			});

			const results = await service.evaluate(context);

			expect(results).toHaveLength(1);
			expect(results[0].spaceId).toBe(ENERGY_GLOBAL_SPACE_ID);
		});
	});
});
