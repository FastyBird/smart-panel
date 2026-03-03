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
import { interpolateTemplate } from '../buddy.utils';
import { BuddyConfigModel } from '../models/config.model';
import { EvaluatorRulesLoaderService } from '../spec/evaluator-rules-loader.service';

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

	constructor(
		private readonly configService: ConfigService,
		private readonly rulesLoader: EvaluatorRulesLoaderService,
	) {}

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
		const rule = this.rulesLoader.getEnergyRule('excess_solar');

		if (rule && !rule.enabled) {
			return [];
		}

		if (energy.gridExport <= thresholds.excessSolarKw) {
			return [];
		}

		const gridExport = this.round1(energy.gridExport);
		const solarProduction = this.round1(energy.solarProduction);

		return [
			{
				type: rule?.suggestionType ?? SuggestionType.ENERGY_EXCESS_SOLAR,
				title: rule?.messages.title ?? 'Excess solar energy available',
				reason: rule
					? interpolateTemplate(rule.messages.reason, { gridExport })
					: `Excess solar energy (${gridExport}kW being exported). Good time for high-load appliances.`,
				spaceId,
				metadata: {
					solarProduction,
					gridExport,
				},
			},
		];
	}

	private detectHighConsumption(
		energy: NonNullable<BuddyContext['energy']>,
		spaceId: string,
		thresholds: EnergyThresholds,
	): EvaluatorResult[] {
		const rule = this.rulesLoader.getEnergyRule('high_consumption');

		if (rule && !rule.enabled) {
			return [];
		}

		if (energy.gridConsumption <= thresholds.highConsumptionKw) {
			return [];
		}

		const gridConsumption = this.round1(energy.gridConsumption);

		return [
			{
				type: rule?.suggestionType ?? SuggestionType.ENERGY_HIGH_CONSUMPTION,
				title: rule?.messages.title ?? 'High grid consumption',
				reason: rule
					? interpolateTemplate(rule.messages.reason, { gridConsumption })
					: `Grid consumption is high (${gridConsumption}kW). Consider reducing load or shifting activities.`,
				spaceId,
				metadata: {
					gridConsumption,
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
		const rule = this.rulesLoader.getEnergyRule('battery_low');

		if (rule && !rule.enabled) {
			return [];
		}

		if (
			energy.batteryLevel == null ||
			energy.batteryLevel >= thresholds.batteryLowPercent ||
			energy.solarProduction > 0
		) {
			return [];
		}

		const batteryLevel = this.round1(energy.batteryLevel);
		const solarProduction = this.round1(energy.solarProduction);

		return [
			{
				type: rule?.suggestionType ?? SuggestionType.ENERGY_BATTERY_LOW,
				title: rule?.messages.title ?? 'Battery level low',
				reason: rule
					? interpolateTemplate(rule.messages.reason, { batteryLevel })
					: `Battery level is low (${batteryLevel}%) with no solar production. Consider conserving energy.`,
				spaceId,
				metadata: {
					batteryLevel,
					solarProduction,
					threshold: thresholds.batteryLowPercent,
				},
			},
		];
	}

	private round1(value: number): number {
		return Math.round(value * 10) / 10;
	}

	private getThresholds(): EnergyThresholds {
		const excessSolarRule = this.rulesLoader.getEnergyRule('excess_solar');
		const highConsumptionRule = this.rulesLoader.getEnergyRule('high_consumption');
		const batteryLowRule = this.rulesLoader.getEnergyRule('battery_low');

		const yamlDefaults = {
			excessSolarKw: excessSolarRule?.thresholds.kw ?? ENERGY_EXCESS_SOLAR_THRESHOLD_KW,
			highConsumptionKw: highConsumptionRule?.thresholds.kw ?? ENERGY_HIGH_CONSUMPTION_THRESHOLD_KW,
			batteryLowPercent: batteryLowRule?.thresholds.percent ?? ENERGY_BATTERY_LOW_THRESHOLD_PERCENT,
		};

		try {
			const config = this.configService.getModuleConfig<BuddyConfigModel>(BUDDY_MODULE_NAME);

			return {
				excessSolarKw: config.energyExcessSolarThresholdKw ?? yamlDefaults.excessSolarKw,
				highConsumptionKw: config.energyHighConsumptionThresholdKw ?? yamlDefaults.highConsumptionKw,
				batteryLowPercent: config.energyBatteryLowThresholdPercent ?? yamlDefaults.batteryLowPercent,
			};
		} catch {
			return yamlDefaults;
		}
	}
}
