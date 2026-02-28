import { Injectable } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import {
	BUDDY_MODULE_NAME,
	ENERGY_BATTERY_LOW_THRESHOLD_PERCENT,
	ENERGY_EXCESS_SOLAR_THRESHOLD_KW,
	ENERGY_HIGH_CONSUMPTION_THRESHOLD_KW,
	SuggestionType,
} from '../buddy.constants';
import { BuddyConfigModel } from '../models/config.model';

import { BuddyContext } from './buddy-context.service';
import { EvaluatorResult, HeartbeatEvaluator } from './heartbeat.types';

interface EnergyThresholds {
	excessSolarKw: number;
	highConsumptionKw: number;
	batteryLowPercent: number;
}

@Injectable()
export class EnergyEvaluator implements HeartbeatEvaluator {
	readonly name = 'EnergyEvaluator';

	constructor(private readonly configService: ConfigService) {}

	evaluate(context: BuddyContext): Promise<EvaluatorResult[]> {
		const results: EvaluatorResult[] = [];

		if (!context.energy) {
			return Promise.resolve(results);
		}

		const thresholds = this.getThresholds();

		results.push(...this.detectExcessSolar(context, thresholds));
		results.push(...this.detectHighConsumption(context, thresholds));
		results.push(...this.detectBatteryLow(context, thresholds));

		return Promise.resolve(results);
	}

	private detectExcessSolar(context: BuddyContext, thresholds: EnergyThresholds): EvaluatorResult[] {
		const energy = context.energy!;
		const surplus = energy.solarProduction - energy.gridConsumption;

		if (surplus <= thresholds.excessSolarKw) {
			return [];
		}

		const surplusRounded = Math.round(surplus * 10) / 10;
		const spaceId = context.spaces[0]?.id ?? 'unknown';

		return [
			{
				type: SuggestionType.ENERGY_EXCESS_SOLAR,
				title: 'Excess solar energy available',
				reason: `Excess solar energy (${surplusRounded}kW available). Good time for high-load appliances.`,
				spaceId,
				metadata: {
					solarProduction: energy.solarProduction,
					gridConsumption: energy.gridConsumption,
					surplus: surplusRounded,
				},
			},
		];
	}

	private detectHighConsumption(context: BuddyContext, thresholds: EnergyThresholds): EvaluatorResult[] {
		const energy = context.energy!;

		if (energy.gridConsumption <= thresholds.highConsumptionKw) {
			return [];
		}

		const consumptionRounded = Math.round(energy.gridConsumption * 10) / 10;
		const spaceId = context.spaces[0]?.id ?? 'unknown';

		return [
			{
				type: SuggestionType.ENERGY_HIGH_CONSUMPTION,
				title: 'High grid consumption',
				reason: `Grid consumption is high (${consumptionRounded}kW). Consider reducing load or shifting activities.`,
				spaceId,
				metadata: {
					gridConsumption: consumptionRounded,
					threshold: thresholds.highConsumptionKw,
				},
			},
		];
	}

	private detectBatteryLow(context: BuddyContext, thresholds: EnergyThresholds): EvaluatorResult[] {
		const energy = context.energy!;

		if (energy.batteryLevel >= thresholds.batteryLowPercent || energy.solarProduction > 0) {
			return [];
		}

		const spaceId = context.spaces[0]?.id ?? 'unknown';

		return [
			{
				type: SuggestionType.ENERGY_BATTERY_LOW,
				title: 'Battery level low',
				reason: `Battery level is low (${energy.batteryLevel}%) with no solar production. Consider conserving energy.`,
				spaceId,
				metadata: {
					batteryLevel: energy.batteryLevel,
					solarProduction: energy.solarProduction,
					threshold: thresholds.batteryLowPercent,
				},
			},
		];
	}

	private getThresholds(): EnergyThresholds {
		try {
			const config = this.configService.getModuleConfig<BuddyConfigModel>(BUDDY_MODULE_NAME);

			return {
				excessSolarKw: config.energyExcessSolarThresholdKw ?? ENERGY_EXCESS_SOLAR_THRESHOLD_KW,
				highConsumptionKw: config.energyHighConsumptionThresholdKw ?? ENERGY_HIGH_CONSUMPTION_THRESHOLD_KW,
				batteryLowPercent: config.energyBatteryLowThresholdPercent ?? ENERGY_BATTERY_LOW_THRESHOLD_PERCENT,
			};
		} catch {
			return {
				excessSolarKw: ENERGY_EXCESS_SOLAR_THRESHOLD_KW,
				highConsumptionKw: ENERGY_HIGH_CONSUMPTION_THRESHOLD_KW,
				batteryLowPercent: ENERGY_BATTERY_LOW_THRESHOLD_PERCENT,
			};
		}
	}
}
