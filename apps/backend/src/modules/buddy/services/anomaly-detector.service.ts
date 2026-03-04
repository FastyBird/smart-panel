import { Injectable } from '@nestjs/common';

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
import { interpolateTemplate } from '../buddy.utils';
import { BuddyConfigModel } from '../models/config.model';
import { EvaluatorRulesLoaderService } from '../spec/evaluator-rules-loader.service';

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
	private readonly stuckSensorTracker = new Map<string, StuckSensorEntry>();

	constructor(
		private readonly configService: ConfigService,
		private readonly actionObserver: ActionObserverService,
		private readonly rulesLoader: EvaluatorRulesLoaderService,
	) {}

	evaluate(context: BuddyContext): Promise<EvaluatorResult[]> {
		const results: EvaluatorResult[] = [];
		const thresholds = this.getThresholds();

		results.push(...this.detectTemperatureDrift(context, thresholds));
		results.push(...this.detectStuckSensors(context, thresholds));
		results.push(...this.detectUnusualActivity(context, thresholds));

		return Promise.resolve(results);
	}

	/**
	 * Detect temperature drift: sensor reading deviates > threshold from thermostat setpoint in same space.
	 *
	 * Differentiates by device category:
	 * - Thermostat devices (DeviceCategory.THERMOSTAT): temperature values are setpoints
	 * - All other devices with temperature values: sensor readings
	 */
	private detectTemperatureDrift(context: BuddyContext, thresholds: AnomalyThresholds): EvaluatorResult[] {
		const rule = this.rulesLoader.getAnomalyRule('temperature_drift');

		if (rule && !rule.enabled) {
			return [];
		}

		const setpointCategories = rule?.filters.setpointDeviceCategories ?? [DeviceCategory.THERMOSTAT as string];
		const readingPropertyCategory = rule?.filters.readingPropertyCategory ?? (PropertyCategory.TEMPERATURE as string);

		const results: EvaluatorResult[] = [];

		for (const space of context.spaces) {
			const spaceDevices = context.devices.filter((d) => d.space === space.id);

			const temperatures: { deviceName: string; value: number }[] = [];
			const setpoints: { deviceName: string; value: number }[] = [];

			for (const device of spaceDevices) {
				const isSetpointDevice = setpointCategories.includes(device.category);

				for (const [key, value] of Object.entries(device.state)) {
					if (value == null || typeof value !== 'number') {
						continue;
					}

					const propertyCategory = key.split('.').pop();

					if (propertyCategory !== readingPropertyCategory) {
						continue;
					}

					if (isSetpointDevice) {
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
						const direction = sensor.value > setpoint.value ? 'above' : 'below';

						results.push({
							type: rule?.suggestionType ?? SuggestionType.ANOMALY_SENSOR_DRIFT,
							title: rule?.messages.title ?? 'Temperature significantly off setpoint',
							reason: rule
								? interpolateTemplate(rule.messages.reason, {
										spaceName: space.name,
										sensorValue: sensor.value,
										direction,
										setpointValue: setpoint.value,
									})
								: `${space.name} temperature (${sensor.value}°C) is significantly ${direction} setpoint (${setpoint.value}°C). Check the thermostat or window.`,
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
	 * Only considers numeric values on SENSOR devices.
	 * Excludes properties listed in the YAML exclude_properties filter
	 * (e.g. battery_level, link_quality, signal_strength).
	 *
	 * Cleanup is scoped to the spaces present in the current context so that
	 * per-space evaluation (the heartbeat calls evaluate() once per space)
	 * does not wipe tracker entries belonging to other spaces.
	 */
	private detectStuckSensors(context: BuddyContext, thresholds: AnomalyThresholds): EvaluatorResult[] {
		const rule = this.rulesLoader.getAnomalyRule('stuck_sensor');

		if (rule && !rule.enabled) {
			return [];
		}

		const deviceCategories = rule?.filters.deviceCategories ?? [DeviceCategory.SENSOR as string];
		const excludeProperties = rule?.filters.excludeProperties ?? [];

		const results: EvaluatorResult[] = [];
		const now = Date.now();
		const thresholdMs = thresholds.stuckSensorHours * 60 * 60 * 1000;
		const contextSpaceIds = new Set(context.spaces.map((s) => s.id));
		const activePropertyKeys = new Set<string>();

		const sensorDevices = context.devices.filter((d) => deviceCategories.includes(d.category));

		for (const device of sensorDevices) {
			for (const [key, value] of Object.entries(device.state)) {
				if (value == null || typeof value !== 'number') {
					continue;
				}

				// Check if this property should be excluded
				const propertyCategory = key.split('.').pop() ?? '';

				if (excludeProperties.includes(propertyCategory)) {
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
						const spaceName = context.spaces.find((s) => s.id === device.space)?.name ?? 'unknown space';

						results.push({
							type: rule?.suggestionType ?? SuggestionType.ANOMALY_STUCK_SENSOR,
							title: rule?.messages.title ?? 'Sensor value appears stuck',
							reason: rule
								? interpolateTemplate(rule.messages.reason, {
										deviceName: device.name,
										spaceName,
										propertyKey: key,
										value,
										stuckHours,
									})
								: `${device.name} in ${spaceName}: "${key}" has been ${value} for ${stuckHours} hours. The sensor may need attention.`,
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

		// Only clean up entries whose device belongs to one of the current context's
		// spaces.  This prevents per-space evaluation from wiping tracker entries
		// that belong to other spaces (which would reset their `since` timestamps).
		for (const trackerKey of this.stuckSensorTracker.keys()) {
			if (activePropertyKeys.has(trackerKey)) {
				continue;
			}

			// Extract device ID from the tracker key ("deviceId::propertyKey")
			const deviceId = trackerKey.split('::')[0];
			const trackedDevice = context.devices.find((d) => d.id === deviceId);

			// Only delete if the device belongs to a space we evaluated
			if (trackedDevice && trackedDevice.space && contextSpaceIds.has(trackedDevice.space)) {
				this.stuckSensorTracker.delete(trackerKey);
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
		const rule = this.rulesLoader.getAnomalyRule('unusual_activity');

		if (rule && !rule.enabled) {
			return [];
		}

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
				const spaceName = context.spaces.find((s) => s.id === device?.space)?.name ?? 'unknown space';
				const spaceId = device?.space ?? context.spaces[0]?.id ?? 'unknown';

				results.push({
					type: rule?.suggestionType ?? SuggestionType.ANOMALY_UNUSUAL_ACTIVITY,
					title: rule?.messages.title ?? 'Unusual device activity detected',
					reason: rule
						? interpolateTemplate(rule.messages.reason, {
								deviceName,
								spaceName,
								actionCount: count,
								windowMinutes: thresholds.unusualActivityWindowMinutes,
							})
						: `${deviceName} in ${spaceName} has been triggered ${count} times in the last ${thresholds.unusualActivityWindowMinutes} minutes. This might indicate an issue.`,
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
		const driftRule = this.rulesLoader.getAnomalyRule('temperature_drift');
		const stuckRule = this.rulesLoader.getAnomalyRule('stuck_sensor');
		const activityRule = this.rulesLoader.getAnomalyRule('unusual_activity');

		const yamlDefaults = {
			temperatureDrift: driftRule?.thresholds.degrees ?? ANOMALY_TEMPERATURE_DRIFT_THRESHOLD,
			stuckSensorHours: stuckRule?.thresholds.hours ?? ANOMALY_STUCK_SENSOR_HOURS,
			unusualActivityThreshold: activityRule?.thresholds.count ?? ANOMALY_UNUSUAL_ACTIVITY_THRESHOLD,
			unusualActivityWindowMinutes: activityRule?.thresholds.window_minutes ?? ANOMALY_UNUSUAL_ACTIVITY_WINDOW_MINUTES,
		};

		try {
			const config = this.configService.getModuleConfig<BuddyConfigModel>(BUDDY_MODULE_NAME);

			return {
				temperatureDrift: config.anomalyTemperatureDriftThreshold ?? yamlDefaults.temperatureDrift,
				stuckSensorHours: config.anomalyStuckSensorHours ?? yamlDefaults.stuckSensorHours,
				unusualActivityThreshold: config.anomalyUnusualActivityThreshold ?? yamlDefaults.unusualActivityThreshold,
				unusualActivityWindowMinutes:
					config.anomalyUnusualActivityWindowMinutes ?? yamlDefaults.unusualActivityWindowMinutes,
			};
		} catch {
			return yamlDefaults;
		}
	}
}
