import { Injectable } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import { DeviceCategory } from '../../devices/devices.constants';
import {
	BUDDY_MODULE_NAME,
	CONFLICT_LIGHTS_UNOCCUPIED_MINUTES,
	SuggestionType,
	TRACKER_MAX_SIZE,
	TRACKER_MAX_STALE_CYCLES,
} from '../buddy.constants';
import { interpolateTemplate } from '../buddy.utils';
import { BuddyConfigModel } from '../models/config.model';
import { EvaluatorRulesLoaderService } from '../spec/evaluator-rules-loader.service';
import { ResolvedConflictRule } from '../spec/evaluator-rules.types';

import { BuddyContext } from './buddy-context.service';
import { EvaluatorResult, HeartbeatEvaluator } from './heartbeat.types';

interface ConflictThresholds {
	lightsUnoccupiedMinutes: number;
}

@Injectable()
export class ConflictDetectorEvaluator implements HeartbeatEvaluator {
	readonly name = 'ConflictDetector';
	private readonly occupancyTracker = new Map<string, { firstSeen: number; lastSeenCycle: number }>();
	private evaluationCycle = 0;

	constructor(
		private readonly configService: ConfigService,
		private readonly rulesLoader: EvaluatorRulesLoaderService,
	) {}

	evaluate(context: BuddyContext): Promise<EvaluatorResult[]> {
		this.evaluationCycle++;

		const results: EvaluatorResult[] = [];
		const thresholds = this.getThresholds();
		const contextSpaceIds = new Set(context.spaces.map((s) => s.id));

		for (const space of context.spaces) {
			const spaceDevices = context.devices.filter((d) => d.space === space.id);

			results.push(...this.detectHeatingWindowConflict(space, spaceDevices));
			results.push(...this.detectAcWindowConflict(space, spaceDevices));
			results.push(...this.detectLightsUnoccupied(space, spaceDevices, thresholds));
		}

		// Prune tracker entries for spaces no longer in context
		for (const trackerKey of this.occupancyTracker.keys()) {
			const spaceId = trackerKey.split('::')[0];

			if (!contextSpaceIds.has(spaceId)) {
				this.occupancyTracker.delete(trackerKey);
			}
		}

		// Sweep stale entries and enforce size limit using configurable values
		let maxStaleCycles = TRACKER_MAX_STALE_CYCLES;
		let maxSize = TRACKER_MAX_SIZE;

		try {
			const config = this.configService.getModuleConfig<BuddyConfigModel>(BUDDY_MODULE_NAME);
			maxStaleCycles = config.trackerMaxStaleCycles;
			maxSize = config.trackerMaxSize;
		} catch (_) {
			// Use defaults if config is unavailable
		}

		for (const [key, entry] of this.occupancyTracker) {
			if (this.evaluationCycle - entry.lastSeenCycle > maxStaleCycles) {
				this.occupancyTracker.delete(key);
			}
		}

		// Enforce hard size limit using insertion-order (FIFO) eviction
		if (this.occupancyTracker.size > maxSize) {
			const keysToDelete: string[] = [];

			for (const key of this.occupancyTracker.keys()) {
				if (this.occupancyTracker.size - keysToDelete.length <= maxSize) {
					break;
				}

				keysToDelete.push(key);
			}

			for (const key of keysToDelete) {
				this.occupancyTracker.delete(key);
			}
		}

		return Promise.resolve(results);
	}

	private detectHeatingWindowConflict(
		space: BuddyContext['spaces'][number],
		devices: BuddyContext['devices'],
	): EvaluatorResult[] {
		const rule = this.rulesLoader.getConflictRule('heating_window');

		if (rule && !rule.enabled) {
			return [];
		}

		const heatingActive = this.isHeatingActive(devices, rule);
		const contactStateKey = rule?.detection.contactStateKey ?? 'contact.detected';
		const openContact = this.findOpenContact(devices, contactStateKey);

		if (!heatingActive || !openContact) {
			return [];
		}

		const setpoint = this.findThermostatSetpoint(devices);
		const setpointText = setpoint !== null ? ` (${setpoint}°C)` : '';

		return [
			{
				type: rule?.suggestionType ?? SuggestionType.CONFLICT_HEATING_WINDOW,
				title: rule?.messages.title ?? 'Heating with open window',
				reason: rule
					? interpolateTemplate(rule.messages.reason, { spaceName: space.name, setpointText })
					: `${space.name} window is open but heating is active${setpointText}. Close the window or lower the setpoint?`,
				spaceId: space.id,
				metadata: {
					contactDevice: openContact,
					setpoint,
				},
			},
		];
	}

	private detectAcWindowConflict(
		space: BuddyContext['spaces'][number],
		devices: BuddyContext['devices'],
	): EvaluatorResult[] {
		const rule = this.rulesLoader.getConflictRule('ac_window');

		if (rule && !rule.enabled) {
			return [];
		}

		const coolingActive = this.isCoolingActive(devices, rule);
		const contactStateKey = rule?.detection.contactStateKey ?? 'contact.detected';
		const openContact = this.findOpenContact(devices, contactStateKey);

		if (!coolingActive || !openContact) {
			return [];
		}

		return [
			{
				type: rule?.suggestionType ?? SuggestionType.CONFLICT_AC_WINDOW,
				title: rule?.messages.title ?? 'AC with open window',
				reason: rule
					? interpolateTemplate(rule.messages.reason, { spaceName: space.name })
					: `${space.name} window is open but AC is active. Close the window or turn off the AC?`,
				spaceId: space.id,
				metadata: {
					contactDevice: openContact,
				},
			},
		];
	}

	private detectLightsUnoccupied(
		space: BuddyContext['spaces'][number],
		devices: BuddyContext['devices'],
		thresholds: ConflictThresholds,
	): EvaluatorResult[] {
		const rule = this.rulesLoader.getConflictRule('lights_unoccupied');

		if (rule && !rule.enabled) {
			return [];
		}

		const lightStateKey = rule?.detection.lightStateKey ?? 'light.on';
		const lightDeviceCategory = rule?.detection.lightDeviceCategory ?? (DeviceCategory.LIGHTING as string);
		const occupancyStateKey = rule?.detection.occupancyStateKey ?? 'occupancy.detected';

		const lightsOn = this.areLightsOn(devices, lightDeviceCategory, lightStateKey);
		const hasOccupancySensor = this.hasOccupancySensor(devices, occupancyStateKey);
		const isOccupied = this.isOccupied(devices, occupancyStateKey);
		const trackerKey = `${space.id}::lights_unoccupied`;

		if (!lightsOn || !hasOccupancySensor || isOccupied) {
			this.occupancyTracker.delete(trackerKey);

			return [];
		}

		const now = Date.now();
		const existing = this.occupancyTracker.get(trackerKey);

		if (!existing) {
			this.occupancyTracker.set(trackerKey, { firstSeen: now, lastSeenCycle: this.evaluationCycle });

			return [];
		}

		existing.lastSeenCycle = this.evaluationCycle;

		const elapsedMinutes = (now - existing.firstSeen) / (60 * 1000);

		if (elapsedMinutes < thresholds.lightsUnoccupiedMinutes) {
			return [];
		}

		return [
			{
				type: rule?.suggestionType ?? SuggestionType.CONFLICT_LIGHTS_UNOCCUPIED,
				title: rule?.messages.title ?? 'Lights on in unoccupied room',
				reason: rule
					? interpolateTemplate(rule.messages.reason, {
							spaceName: space.name,
							minutes: thresholds.lightsUnoccupiedMinutes,
						})
					: `${space.name} lights are on but the room appears unoccupied for over ${thresholds.lightsUnoccupiedMinutes} minutes. Turn off the lights?`,
				spaceId: space.id,
				metadata: {
					unoccupiedMinutes: Math.round(elapsedMinutes),
				},
			},
		];
	}

	private isHeatingActive(devices: BuddyContext['devices'], rule: ResolvedConflictRule | undefined): boolean {
		const stateKeys = rule?.detection.heatingStateKeys ?? ['heater.on', 'heater.status'];
		const deviceCategories = rule?.detection.heatingDeviceCategories ?? [
			DeviceCategory.THERMOSTAT as string,
			DeviceCategory.HEATING_UNIT as string,
		];

		return devices.some((d) => {
			const stateValues = stateKeys.map((key) => d.state[key] === true);
			const allTrue = stateValues.every(Boolean);

			if (allTrue && stateValues.length > 0) {
				return true;
			}

			if (deviceCategories.includes(d.category)) {
				return stateValues.some(Boolean);
			}

			return false;
		});
	}

	private isCoolingActive(devices: BuddyContext['devices'], rule: ResolvedConflictRule | undefined): boolean {
		const stateKeys = rule?.detection.coolingStateKeys ?? ['cooler.on', 'cooler.status'];
		const deviceCategories = rule?.detection.coolingDeviceCategories ?? [DeviceCategory.AIR_CONDITIONER as string];

		return devices.some((d) => {
			const stateValues = stateKeys.map((key) => d.state[key] === true);
			const allTrue = stateValues.every(Boolean);

			if (allTrue && stateValues.length > 0) {
				return true;
			}

			if (deviceCategories.includes(d.category)) {
				return stateValues.some(Boolean);
			}

			return false;
		});
	}

	private findOpenContact(devices: BuddyContext['devices'], contactStateKey: string): string | null {
		const device = devices.find((d) => d.state[contactStateKey] === true);

		return device?.name ?? null;
	}

	private areLightsOn(devices: BuddyContext['devices'], lightDeviceCategory: string, lightStateKey: string): boolean {
		return devices.some((d) => d.category === lightDeviceCategory && d.state[lightStateKey] === true);
	}

	private hasOccupancySensor(devices: BuddyContext['devices'], occupancyStateKey: string): boolean {
		return devices.some((d) => occupancyStateKey in d.state);
	}

	private isOccupied(devices: BuddyContext['devices'], occupancyStateKey: string): boolean {
		return devices.some((d) => d.state[occupancyStateKey] === true);
	}

	private findThermostatSetpoint(devices: BuddyContext['devices']): number | null {
		for (const device of devices) {
			for (const [key, value] of Object.entries(device.state)) {
				if (key.endsWith('.temperature') && typeof value === 'number') {
					if (
						device.category === (DeviceCategory.THERMOSTAT as string) ||
						device.category === (DeviceCategory.HEATING_UNIT as string)
					) {
						return value;
					}
				}
			}
		}

		return null;
	}

	resetOccupancyTracker(spaceId: string): void {
		this.occupancyTracker.delete(`${spaceId}::lights_unoccupied`);
	}

	private getThresholds(): ConflictThresholds {
		const lightsRule = this.rulesLoader.getConflictRule('lights_unoccupied');

		const yamlDefault = lightsRule?.thresholds.minutes ?? CONFLICT_LIGHTS_UNOCCUPIED_MINUTES;

		try {
			const config = this.configService.getModuleConfig<BuddyConfigModel>(BUDDY_MODULE_NAME);

			return {
				lightsUnoccupiedMinutes: config.conflictLightsUnoccupiedMinutes ?? yamlDefault,
			};
		} catch {
			return {
				lightsUnoccupiedMinutes: yamlDefault,
			};
		}
	}
}
