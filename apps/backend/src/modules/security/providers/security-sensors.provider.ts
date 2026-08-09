import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { PropertyValueState } from '../../devices/models/property-value-state.model';
import { DevicesService } from '../../devices/services/devices.service';
import { PropertyValueSourceRegistryService } from '../../devices/services/property-value-source.registry.service';
import { SecurityAggregationContext } from '../contracts/security-aggregation-context.type';
import { SecurityAlert, SecuritySignal } from '../contracts/security-signal.type';
import { SecurityStateProviderInterface } from '../contracts/security-state-provider.interface';
import { ArmedState, SECURITY_MODULE_NAME, SEVERITY_RANK, SecurityAlertType, Severity } from '../security.constants';
import { DetectionRulesLoaderService } from '../spec/detection-rules-loader.service';
import { ResolvedPropertyCheck, ResolvedSensorRule } from '../spec/detection-rules.types';

/** One device's account of one triggered sensor, before duplicates of the same sensor are collapsed. */
interface SensorAlertCandidate {
	alert: SecurityAlert;
	device: DeviceEntity;
	/** The series the reading came from: the same for every device presenting one physical sensor. */
	sensorId: string;
	/** Whether this device is presenting somebody else's sensor rather than its own. */
	isProjection: boolean;
}

/** Alert types that represent intrusion/entry detection (not life-safety) */
const INTRUSION_ALERT_TYPES: Set<SecurityAlertType> = new Set([
	SecurityAlertType.INTRUSION,
	SecurityAlertType.ENTRY_OPEN,
]);

@Injectable()
export class SecuritySensorsProvider implements SecurityStateProviderInterface {
	private readonly logger = createExtensionLogger(SECURITY_MODULE_NAME, 'SecuritySensorsProvider');

	constructor(
		private readonly devicesService: DevicesService,
		private readonly detectionRulesLoader: DetectionRulesLoaderService,
		// Answers which series a property reads, which is what tells one sensor reported by two devices
		// apart from two sensors. See dedupeBySensor().
		private readonly valueSourceRegistry: PropertyValueSourceRegistryService,
	) {}

	getKey(): string {
		return 'security_sensors';
	}

	async getSignals(context?: SecurityAggregationContext): Promise<SecuritySignal> {
		try {
			return await this.buildSignals(context);
		} catch (error) {
			this.logger.warn(`Failed to build sensor signals: ${error}`);

			return {
				highestSeverity: Severity.INFO,
				activeAlertsCount: 0,
				hasCriticalAlert: false,
				activeAlerts: [],
			};
		}
	}

	private async buildSignals(context?: SecurityAggregationContext): Promise<SecuritySignal> {
		const devices: DeviceEntity[] = context?.devices ?? (await this.devicesService.findAll());
		const rules = this.detectionRulesLoader.getSensorRules();
		const armedState = context?.armedState ?? null;

		const candidates: SensorAlertCandidate[] = [];

		for (const device of devices) {
			const channels = device.channels ?? [];

			for (const channel of channels) {
				if (!(channel instanceof ChannelEntity)) {
					continue;
				}

				const rule = rules.get(channel.category);

				if (!rule) {
					continue;
				}

				const result = this.evaluateRule(channel, rule);

				if (result.triggered && result.property) {
					// Lower severity for intrusion/entry alerts when disarmed
					const severity = this.adjustSeverityForArmedState(rule.alertType, rule.severity, armedState);

					candidates.push({
						alert: {
							id: `sensor:${device.id}:${rule.alertType}`,
							type: rule.alertType,
							severity,
							sourceDeviceId: device.id,
							timestamp: result.lastUpdated ?? new Date().toISOString(),
							acknowledged: false,
						},
						device,
						// The series behind the reading, not the property that carried it here.
						sensorId: this.valueSourceRegistry.resolve(result.property),
						isProjection: this.valueSourceRegistry.isProjected(result.property),
					});
				}
			}
		}

		const alerts = this.dedupeBySensor(candidates);

		if (alerts.length === 0) {
			return {
				highestSeverity: Severity.INFO,
				activeAlertsCount: 0,
				hasCriticalAlert: false,
				activeAlerts: [],
			};
		}

		// Sort deterministically: highest severity first, then by device ID
		alerts.sort((a, b) => {
			const severityDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];

			if (severityDiff !== 0) {
				return severityDiff;
			}

			return a.id.localeCompare(b.id);
		});

		const highestSeverity = alerts[0].severity;
		const hasCriticalAlert = alerts.some((a) => a.severity === Severity.CRITICAL);
		const lastAlert = alerts[0];

		return {
			highestSeverity,
			activeAlertsCount: alerts.length,
			hasCriticalAlert,
			activeAlerts: alerts,
			lastEvent: {
				type: lastAlert.type,
				timestamp: lastAlert.timestamp,
				sourceDeviceId: lastAlert.sourceDeviceId,
				severity: lastAlert.severity,
			},
		};
	}

	/**
	 * One alert per sensor, whatever number of devices are presenting it.
	 *
	 * A virtual device that projects a physical sensor has a channel of that category too, and the
	 * projection's value *is* the source's — `ChannelPropertyEntitySubscriber` populates it through the
	 * value-source registry — so the walk above reads the same live reading off both devices and files
	 * two alerts under different ids for one smoke detector. `activeAlertsCount` then counts it twice,
	 * and `SecurityAggregatorService.mergeAlerts()` cannot help: it de-duplicates by alert id, and the
	 * ids differ precisely because the devices do.
	 *
	 * Asked of the registry rather than guessed from the device type. "Two channels reading one series"
	 * is exactly what it answers, and it is the same seam the energy module bills a projected meter
	 * through — the alternative, skipping any channel whose properties are all projections, is wrong
	 * for the case virtual devices exist to serve, where the virtual device is the one the user thinks
	 * of as the sensor.
	 *
	 * Which device the survivor names is the part that is a judgement rather than a mechanism:
	 *
	 * - a device the user can see is preferred to a hidden one, since an alert naming a device that
	 *   does not appear anywhere is an alert nobody can act on. Splitting hides a source device once
	 *   nothing of it is left unprojected, which is exactly when its projection should speak for it;
	 * - between two visible devices, the projection wins. A partially split device stays visible for
	 *   the channels it kept, but the sensor in question is the one the operator deliberately moved
	 *   into a room device, and that room device is where they will look for it;
	 * - anything still tied is settled by device id, so the same state always produces the same alert.
	 *
	 * Nothing is dropped by this: every distinct sensor keeps its alert, including one on a hidden
	 * device that nothing projects. Suppressing a smoke alarm because somebody hid its device is not a
	 * de-duplication.
	 */
	private dedupeBySensor(candidates: SensorAlertCandidate[]): SecurityAlert[] {
		const bySensor = new Map<string, SensorAlertCandidate>();

		for (const candidate of candidates) {
			const key = `${candidate.sensorId}:${candidate.alert.type}`;
			const held = bySensor.get(key);

			if (!held || this.namesTheSensorBetter(candidate, held)) {
				bySensor.set(key, candidate);
			}
		}

		// And by alert id after that, because the id is what survives downstream: two sensors of one
		// category on one device share an id, so counting both here reports a number the merged list
		// never shows. The louder of the two wins, and their ids are identical by construction.
		const byId = new Map<string, SecurityAlert>();

		for (const { alert } of bySensor.values()) {
			const held = byId.get(alert.id);

			if (!held || SEVERITY_RANK[alert.severity] > SEVERITY_RANK[held.severity]) {
				byId.set(alert.id, alert);
			}
		}

		return Array.from(byId.values());
	}

	private namesTheSensorBetter(candidate: SensorAlertCandidate, held: SensorAlertCandidate): boolean {
		if (candidate.device.hidden !== held.device.hidden) {
			return !candidate.device.hidden;
		}

		if (candidate.isProjection !== held.isProjection) {
			return candidate.isProjection;
		}

		return candidate.device.id.localeCompare(held.device.id) < 0;
	}

	private evaluateRule(
		channel: ChannelEntity,
		rule: ResolvedSensorRule,
	): { triggered: boolean; lastUpdated: string | null; property: ChannelPropertyEntity | null } {
		for (const check of rule.properties) {
			const prop = this.findProperty(channel, check.property);

			if (!prop) {
				continue;
			}

			const valueState = prop.value;

			if (valueState == null) {
				continue;
			}

			const actual = valueState instanceof PropertyValueState ? valueState.value : valueState;
			let lastUpdated = valueState instanceof PropertyValueState ? (valueState.lastUpdated ?? null) : null;

			// Fall back to entity-level timestamp when InfluxDB timestamp is absent
			if (lastUpdated == null) {
				const entityTs = prop.updatedAt ?? prop.createdAt;

				if (entityTs != null) {
					lastUpdated = entityTs instanceof Date ? entityTs.toISOString() : entityTs;
				}
			}

			if (this.matchesCondition(actual, check)) {
				// The property is carried out with the verdict: which series it reads is what decides
				// whether another device's alert is the same sensor or a different one.
				return { triggered: true, lastUpdated, property: prop };
			}
		}

		return { triggered: false, lastUpdated: null, property: null };
	}

	private findProperty(channel: ChannelEntity, category: PropertyCategory): ChannelPropertyEntity | null {
		const properties = channel.properties ?? [];

		for (const property of properties) {
			if (!(property instanceof ChannelPropertyEntity)) {
				continue;
			}

			if (property.category === category) {
				return property;
			}
		}

		return null;
	}

	private matchesCondition(actual: unknown, check: ResolvedPropertyCheck): boolean {
		switch (check.operator) {
			case 'eq':
				if (typeof check.value === 'boolean') {
					const truthy = actual === true || actual === 'true' || actual === 1 || actual === '1';

					return check.value ? truthy : !truthy;
				}

				return actual === check.value || `${actual as string}` === `${check.value as string}`;
			case 'gt':
				return typeof actual === 'number' ? actual > (check.value as number) : Number(actual) > (check.value as number);
			case 'gte':
				return typeof actual === 'number'
					? actual >= (check.value as number)
					: Number(actual) >= (check.value as number);
			case 'in':
				return Array.isArray(check.value) && check.value.includes(`${actual as string}`);
			default:
				return false;
		}
	}

	/**
	 * Lower severity for intrusion/entry alerts when system is disarmed.
	 * Life-safety alerts (smoke, CO, gas, leak) always fire at configured severity.
	 */
	private adjustSeverityForArmedState(
		alertType: SecurityAlertType,
		configuredSeverity: Severity,
		armedState: ArmedState | null,
	): Severity {
		// Only downgrade on explicit DISARMED. When armedState is null
		// (alarm provider failed or not configured), keep configured severity
		// to avoid understating real armed conditions.
		if (armedState !== ArmedState.DISARMED) {
			return configuredSeverity;
		}

		// Only lower intrusion/entry alerts when disarmed
		if (INTRUSION_ALERT_TYPES.has(alertType) && configuredSeverity !== Severity.INFO) {
			return Severity.INFO;
		}

		return configuredSeverity;
	}
}
