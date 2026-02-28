import { Injectable } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import { DeviceCategory } from '../../devices/devices.constants';
import {
	BUDDY_MODULE_NAME,
	CONFLICT_LIGHTS_UNOCCUPIED_MINUTES,
	SuggestionType,
} from '../buddy.constants';
import { BuddyConfigModel } from '../models/config.model';

import { BuddyContext } from './buddy-context.service';
import { EvaluatorResult, HeartbeatEvaluator } from './heartbeat.types';

interface ConflictThresholds {
	lightsUnoccupiedMinutes: number;
}

@Injectable()
export class ConflictDetectorEvaluator implements HeartbeatEvaluator {
	readonly name = 'ConflictDetector';
	private readonly occupancyTracker = new Map<string, number>();

	constructor(private readonly configService: ConfigService) {}

	evaluate(context: BuddyContext): Promise<EvaluatorResult[]> {
		const results: EvaluatorResult[] = [];
		const thresholds = this.getThresholds();

		for (const space of context.spaces) {
			const spaceDevices = context.devices.filter((d) => d.space === space.id);

			results.push(...this.detectHeatingWindowConflict(space, spaceDevices));
			results.push(...this.detectAcWindowConflict(space, spaceDevices));
			results.push(...this.detectLightsUnoccupied(space, spaceDevices, thresholds));
		}

		return Promise.resolve(results);
	}

	private detectHeatingWindowConflict(
		space: BuddyContext['spaces'][number],
		devices: BuddyContext['devices'],
	): EvaluatorResult[] {
		const heatingActive = this.isHeatingActive(devices);
		const openContact = this.findOpenContact(devices);

		if (!heatingActive || !openContact) {
			return [];
		}

		const setpoint = this.findThermostatSetpoint(devices);
		const setpointText = setpoint !== null ? ` (${setpoint}°C)` : '';

		return [
			{
				type: SuggestionType.CONFLICT_HEATING_WINDOW,
				title: 'Heating with open window',
				reason: `${space.name} window is open but heating is active${setpointText}. Close the window or lower the setpoint?`,
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
		const coolingActive = this.isCoolingActive(devices);
		const openContact = this.findOpenContact(devices);

		if (!coolingActive || !openContact) {
			return [];
		}

		return [
			{
				type: SuggestionType.CONFLICT_AC_WINDOW,
				title: 'AC with open window',
				reason: `${space.name} window is open but AC is active. Close the window or turn off the AC?`,
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
		const lightsOn = this.areLightsOn(devices);
		const hasOccupancySensor = this.hasOccupancySensor(devices);
		const isOccupied = this.isOccupied(devices);

		if (!lightsOn || !hasOccupancySensor || isOccupied) {
			return [];
		}

		const now = Date.now();
		const trackerKey = `${space.id}::lights_unoccupied`;
		const firstSeen = this.occupancyTracker.get(trackerKey);

		if (!firstSeen) {
			this.occupancyTracker.set(trackerKey, now);

			return [];
		}

		const elapsedMinutes = (now - firstSeen) / (60 * 1000);

		if (elapsedMinutes < thresholds.lightsUnoccupiedMinutes) {
			return [];
		}

		return [
			{
				type: SuggestionType.CONFLICT_LIGHTS_UNOCCUPIED,
				title: 'Lights on in unoccupied room',
				reason: `${space.name} lights are on but the room appears unoccupied for over ${thresholds.lightsUnoccupiedMinutes} minutes. Turn off the lights?`,
				spaceId: space.id,
				metadata: {
					unoccupiedMinutes: Math.round(elapsedMinutes),
				},
			},
		];
	}

	private isHeatingActive(devices: BuddyContext['devices']): boolean {
		return devices.some((d) => {
			const heaterOn = d.state['heater.on'] === true;
			const heaterStatus = d.state['heater.status'] === true;

			if (heaterOn && heaterStatus) {
				return true;
			}

			if (
				d.category === (DeviceCategory.THERMOSTAT as string) ||
				d.category === (DeviceCategory.HEATING_UNIT as string)
			) {
				return heaterOn || heaterStatus;
			}

			return false;
		});
	}

	private isCoolingActive(devices: BuddyContext['devices']): boolean {
		return devices.some((d) => {
			const coolerOn = d.state['cooler.on'] === true;
			const coolerStatus = d.state['cooler.status'] === true;

			if (coolerOn && coolerStatus) {
				return true;
			}

			if (d.category === (DeviceCategory.AIR_CONDITIONER as string)) {
				return coolerOn || coolerStatus;
			}

			return false;
		});
	}

	private findOpenContact(devices: BuddyContext['devices']): string | null {
		const device = devices.find((d) => d.state['contact.detected'] === true);

		return device?.name ?? null;
	}

	private areLightsOn(devices: BuddyContext['devices']): boolean {
		return devices.some(
			(d) => d.category === (DeviceCategory.LIGHTING as string) && d.state['light.on'] === true,
		);
	}

	private hasOccupancySensor(devices: BuddyContext['devices']): boolean {
		return devices.some((d) => 'occupancy.detected' in d.state);
	}

	private isOccupied(devices: BuddyContext['devices']): boolean {
		return devices.some((d) => d.state['occupancy.detected'] === true);
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
		try {
			const config = this.configService.getModuleConfig<BuddyConfigModel>(BUDDY_MODULE_NAME);

			return {
				lightsUnoccupiedMinutes: config.conflictLightsUnoccupiedMinutes ?? CONFLICT_LIGHTS_UNOCCUPIED_MINUTES,
			};
		} catch {
			return {
				lightsUnoccupiedMinutes: CONFLICT_LIGHTS_UNOCCUPIED_MINUTES,
			};
		}
	}
}
