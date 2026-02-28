import { Injectable } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import {
	BUDDY_MODULE_NAME,
	ENERGY_BATTERY_LOW_THRESHOLD_PERCENT,
	ENERGY_EXCESS_SOLAR_THRESHOLD_KW,
	ENERGY_GLOBAL_SPACE_ID,
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

		const energy = context.energy;
		const thresholds = this.getThresholds();
		const spaceId = ENERGY_GLOBAL_SPACE_ID;

		results.push(...this.detectExcessSolar(energy, spaceId, thresholds));
		results.push(...this.detectHighConsumption(energy, spaceId, thresholds));
		results.push(...this.detectBatteryLow(energy, spaceId, thresholds));

		return Promise.resolve(results);
	}

	private detectExcessSolar(
		energy: NonNullable<BuddyContext['energy']>,
		spaceId: string,
		thresholds: EnergyThresholds,
	): EvaluatorResult[] {
		if (energy.gridExport <= thresholds.excessSolarKw) {
			return [];
		}

		return [
			{
				type: SuggestionType.ENERGY_EXCESS_SOLAR,
				title: 'Excess solar energy available',
				reason: `Excess solar energy (${this.round1(energy.gridExport)}kW being exported). Good time for high-load appliances.`,
				spaceId,
				metadata: {
					solarProduction: this.round1(energy.solarProduction),
					gridExport: this.round1(energy.gridExport),
				},
			},
		];
	}

	private detectHighConsumption(
		energy: NonNullable<BuddyContext['energy']>,
		spaceId: string,
		thresholds: EnergyThresholds,
	): EvaluatorResult[] {
		if (energy.gridConsumption <= thresholds.highConsumptionKw) {
			return [];
		}

		return [
			{
				type: SuggestionType.ENERGY_HIGH_CONSUMPTION,
				title: 'High grid consumption',
				reason: `Grid consumption is high (${this.round1(energy.gridConsumption)}kW). Consider reducing load or shifting activities.`,
				spaceId,
				metadata: {
					gridConsumption: this.round1(energy.gridConsumption),
					threshold: thresholds.highConsumptionKw,
				},
			},
		];
	}

	private detectBatteryLow(
		energy: NonNullable<BuddyContext['energy']>,
		spaceId: string,
		thresholds: EnergyThresholds,
	): EvaluatorResult[] {
		if (
			energy.batteryLevel === null ||
			energy.batteryLevel >= thresholds.batteryLowPercent ||
			energy.solarProduction > 0
		) {
			return [];
		}

		return [
			{
				type: SuggestionType.ENERGY_BATTERY_LOW,
				title: 'Battery level low',
				reason: `Battery level is low (${this.round1(energy.batteryLevel)}%) with no solar production. Consider conserving energy.`,
				spaceId,
				metadata: {
					batteryLevel: this.round1(energy.batteryLevel),
					solarProduction: this.round1(energy.solarProduction),
					threshold: thresholds.batteryLowPercent,
				},
			},
		];
	}

	private round1(value: number): number {
		return Math.round(value * 10) / 10;
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
