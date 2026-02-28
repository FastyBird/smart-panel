import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import { DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import {
	ANOMALY_STUCK_SENSOR_HOURS,
	ANOMALY_TEMPERATURE_DRIFT_THRESHOLD,
	ANOMALY_UNUSUAL_ACTIVITY_THRESHOLD,
	ANOMALY_UNUSUAL_ACTIVITY_WINDOW_MINUTES,
	BUDDY_MODULE_NAME,
	SuggestionType,
} from '../buddy.constants';
import { BuddyConfigModel } from '../models/config.model';

import { ActionObserverService } from './action-observer.service';
import { BuddyContext } from './buddy-context.service';
import { EvaluatorResult, HeartbeatEvaluator } from './heartbeat.types';

interface StuckSensorEntry {
	value: unknown;
	since: number;
}

interface AnomalyThresholds {
	temperatureDrift: number;
	stuckSensorHours: number;
	unusualActivityThreshold: number;
	unusualActivityWindowMinutes: number;
}

@Injectable()
export class AnomalyDetectorEvaluator implements HeartbeatEvaluator {
	readonly name = 'AnomalyDetector';
	private readonly logger = new Logger(AnomalyDetectorEvaluator.name);
	private readonly stuckSensorTracker = new Map<string, StuckSensorEntry>();

	constructor(
		private readonly configService: ConfigService,
		private readonly actionObserver: ActionObserverService,
	) {}

	async evaluate(context: BuddyContext): Promise<EvaluatorResult[]> {
		const results: EvaluatorResult[] = [];
		const thresholds = this.getThresholds();

		results.push(...this.detectTemperatureDrift(context, thresholds));
		results.push(...this.detectStuckSensors(context, thresholds));
		results.push(...this.detectUnusualActivity(context, thresholds));

		return results;
	}

	/**
	 * Detect temperature drift: sensor reading deviates > threshold from thermostat setpoint in same space.
	 *
	 * Differentiates by device category:
	 * - Thermostat devices (DeviceCategory.THERMOSTAT): temperature values are setpoints
	 * - All other devices with temperature values: sensor readings
	 */
	private detectTemperatureDrift(context: BuddyContext, thresholds: AnomalyThresholds): EvaluatorResult[] {
		const results: EvaluatorResult[] = [];

		for (const space of context.spaces) {
			const spaceDevices = context.devices.filter((d) => d.space === space.id);

			const temperatures: { deviceName: string; value: number }[] = [];
			const setpoints: { deviceName: string; value: number }[] = [];

			for (const device of spaceDevices) {
				const isThermostat = device.category === DeviceCategory.THERMOSTAT;

				for (const [key, value] of Object.entries(device.state)) {
					if (value == null || typeof value !== 'number') {
						continue;
					}

					const propertyCategory = key.split('.').pop();

					if (propertyCategory !== PropertyCategory.TEMPERATURE) {
						continue;
					}

					if (isThermostat) {
						setpoints.push({ deviceName: device.name, value });
					} else {
						temperatures.push({ deviceName: device.name, value });
					}
				}
			}

			if (temperatures.length === 0 || setpoints.length === 0) {
				continue;
			}

			let driftFound = false;

			for (const sensor of temperatures) {
				if (driftFound) {
					break;
				}

				for (const setpoint of setpoints) {
					const diff = Math.abs(sensor.value - setpoint.value);

					if (diff > thresholds.temperatureDrift) {
						results.push({
							type: SuggestionType.ANOMALY_SENSOR_DRIFT,
							title: 'Temperature significantly off setpoint',
							reason: `${space.name} temperature (${sensor.value}°C) is significantly ${sensor.value > setpoint.value ? 'above' : 'below'} setpoint (${setpoint.value}°C). Check the thermostat or window.`,
							spaceId: space.id,
							metadata: {
								sensorDevice: sensor.deviceName,
								sensorValue: sensor.value,
								setpointDevice: setpoint.deviceName,
								setpointValue: setpoint.value,
								deviation: diff,
							},
						});

						driftFound = true;

						break;
					}
				}
			}
		}

		return results;
	}

	/**
	 * Detect stuck sensor: property value unchanged for > configured hours.
	 *
	 * Tracks previous values across heartbeat cycles using a simple Map.
	 * Only considers numeric sensor values.
	 */
	private detectStuckSensors(context: BuddyContext, thresholds: AnomalyThresholds): EvaluatorResult[] {
		const results: EvaluatorResult[] = [];
		const now = Date.now();
		const thresholdMs = thresholds.stuckSensorHours * 60 * 60 * 1000;
		const activePropertyKeys = new Set<string>();

		for (const device of context.devices) {
			for (const [key, value] of Object.entries(device.state)) {
				if (value == null || typeof value !== 'number') {
					continue;
				}

				const propertyKey = `${device.id}::${key}`;
				activePropertyKeys.add(propertyKey);

				const existing = this.stuckSensorTracker.get(propertyKey);

				if (!existing) {
					this.stuckSensorTracker.set(propertyKey, { value, since: now });

					continue;
				}

				if (existing.value === value) {
					const stuckDuration = now - existing.since;

					if (stuckDuration >= thresholdMs) {
						const stuckHours = Math.round((stuckDuration / (60 * 60 * 1000)) * 10) / 10;
						const spaceName =
							context.spaces.find((s) => s.id === device.space)?.name ?? 'unknown space';

						results.push({
							type: SuggestionType.ANOMALY_STUCK_SENSOR,
							title: 'Sensor value appears stuck',
							reason: `${device.name} in ${spaceName}: "${key}" has been ${value} for ${stuckHours} hours. The sensor may need attention.`,
							spaceId: device.space ?? context.spaces[0]?.id ?? 'unknown',
							metadata: {
								deviceId: device.id,
								deviceName: device.name,
								propertyKey: key,
								value,
								stuckSinceMs: existing.since,
								stuckDurationHours: stuckHours,
							},
						});
					}
				} else {
					// Value changed — reset tracker
					this.stuckSensorTracker.set(propertyKey, { value, since: now });
				}
			}
		}

		// Clean up entries for properties no longer in context
		for (const key of this.stuckSensorTracker.keys()) {
			if (!activePropertyKeys.has(key)) {
				this.stuckSensorTracker.delete(key);
			}
		}

		return results;
	}

	/**
	 * Detect unusual activity: intent count > threshold in time window for same device.
	 *
	 * Uses recent actions from the ActionObserverService to count how many intents
	 * target each device within the configured time window.
	 */
	private detectUnusualActivity(context: BuddyContext, thresholds: AnomalyThresholds): EvaluatorResult[] {
		const results: EvaluatorResult[] = [];
		const now = Date.now();
		const windowMs = thresholds.unusualActivityWindowMinutes * 60 * 1000;
		const cutoff = new Date(now - windowMs);

		const spaceIds = new Set(context.spaces.map((s) => s.id));
		const actions = this.actionObserver.getRecentActions();

		// Count actions per device within the window, filtered to context spaces
		const deviceActionCounts = new Map<string, number>();

		for (const action of actions) {
			if (action.timestamp < cutoff) {
				continue;
			}

			if (action.spaceId && !spaceIds.has(action.spaceId)) {
				continue;
			}

			for (const deviceId of action.deviceIds) {
				deviceActionCounts.set(deviceId, (deviceActionCounts.get(deviceId) ?? 0) + 1);
			}
		}

		for (const [deviceId, count] of deviceActionCounts) {
			if (count >= thresholds.unusualActivityThreshold) {
				const device = context.devices.find((d) => d.id === deviceId);
				const deviceName = device?.name ?? deviceId;
				const spaceName =
					context.spaces.find((s) => s.id === device?.space)?.name ?? 'unknown space';
				const spaceId = device?.space ?? context.spaces[0]?.id ?? 'unknown';

				results.push({
					type: SuggestionType.ANOMALY_UNUSUAL_ACTIVITY,
					title: 'Unusual device activity detected',
					reason: `${deviceName} in ${spaceName} has been triggered ${count} times in the last ${thresholds.unusualActivityWindowMinutes} minutes. This might indicate an issue.`,
					spaceId,
					metadata: {
						deviceId,
						deviceName,
						actionCount: count,
						windowMinutes: thresholds.unusualActivityWindowMinutes,
					},
				});
			}
		}

		return results;
	}

	private getThresholds(): AnomalyThresholds {
		try {
			const config = this.configService.getModuleConfig<BuddyConfigModel>(BUDDY_MODULE_NAME);

			return {
				temperatureDrift: config.anomalyTemperatureDriftThreshold ?? ANOMALY_TEMPERATURE_DRIFT_THRESHOLD,
				stuckSensorHours: config.anomalyStuckSensorHours ?? ANOMALY_STUCK_SENSOR_HOURS,
				unusualActivityThreshold:
					config.anomalyUnusualActivityThreshold ?? ANOMALY_UNUSUAL_ACTIVITY_THRESHOLD,
				unusualActivityWindowMinutes:
					config.anomalyUnusualActivityWindowMinutes ?? ANOMALY_UNUSUAL_ACTIVITY_WINDOW_MINUTES,
			};
		} catch {
			return {
				temperatureDrift: ANOMALY_TEMPERATURE_DRIFT_THRESHOLD,
				stuckSensorHours: ANOMALY_STUCK_SENSOR_HOURS,
				unusualActivityThreshold: ANOMALY_UNUSUAL_ACTIVITY_THRESHOLD,
				unusualActivityWindowMinutes: ANOMALY_UNUSUAL_ACTIVITY_WINDOW_MINUTES,
			};
		}
	}
}
