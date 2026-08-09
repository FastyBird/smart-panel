import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { PropertyValueState } from '../../devices/models/property-value-state.model';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
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
		// Reads back a source property this pass never saw — see identifySensor(), and
		// `aggregateBounded()` for how a pass comes to be missing one.
		private readonly channelsPropertiesService: ChannelsPropertiesService,
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

		// Where every property in this pass lives, so a projected one can be traced back to the channel
		// it reads rather than to the property that happened to carry it.
		const channelOfProperty = this.mapPropertiesToChannels(devices);

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

				if (result.triggered) {
					// Lower severity for intrusion/entry alerts when disarmed
					const severity = this.adjustSeverityForArmedState(rule.alertType, rule.severity, armedState);

					const sensor = await this.identifySensor(channel, rule, channelOfProperty);

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
						sensorId: sensor.id,
						isProjection: sensor.isProjection,
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

	/** Every property in this pass, by the channel it belongs to. */
	private mapPropertiesToChannels(devices: DeviceEntity[]): Map<string, string> {
		const channelOfProperty = new Map<string, string>();

		for (const device of devices) {
			for (const channel of device.channels ?? []) {
				if (!(channel instanceof ChannelEntity)) {
					continue;
				}

				for (const property of channel.properties ?? []) {
					if (property instanceof ChannelPropertyEntity) {
						channelOfProperty.set(property.id, channel.id);
					}
				}
			}
		}

		return channelOfProperty;
	}

	/**
	 * Which sensor this channel is reporting, as an identity two devices can agree on.
	 *
	 * Asked of the channel rather than of the property that happened to satisfy the rule first, because
	 * that property is not a stable answer: a rule may list alternatives — the built-in carbon monoxide
	 * rule checks `detected` before `concentration` — so which one matches depends on the readings at
	 * that instant. A physical channel matching on `detected` and a projection of it matching on
	 * `concentration` would then be keyed differently and both survive, and the same pair would
	 * de-duplicate correctly a moment later. An identity that moves with the values is not an identity.
	 *
	 * So the sensor is the *channel* the readings come from: every rule-relevant property that reads
	 * somebody else's series is traced back to the channel that owns that series, and the channel's own
	 * id stands in when it projects nothing. A projection sharing one source channel therefore agrees
	 * with the source however either of them triggered, and however much of the channel was projected —
	 * the case that matters, since a partly-projected channel keeps local properties of its own.
	 *
	 * A channel assembled from *several* sources is a distinct thing the operator built, and keeps its
	 * own identity: it names them all, so it matches another channel assembled the same way and nothing
	 * else. Rare enough to be worth stating rather than special-casing.
	 */
	private async identifySensor(
		channel: ChannelEntity,
		rule: ResolvedSensorRule,
		channelOfProperty: Map<string, string>,
	): Promise<{ id: string; isProjection: boolean }> {
		const sourceChannels = new Set<string>();

		for (const check of rule.properties) {
			const property = this.findProperty(channel, check.property);

			if (!property) {
				continue;
			}

			const storageKey = this.valueSourceRegistry.resolve(property);

			if (storageKey === property.id) {
				continue;
			}

			sourceChannels.add((await this.resolveOwningChannel(storageKey, channelOfProperty)) ?? storageKey);
		}

		if (sourceChannels.size === 0) {
			return { id: channel.id, isProjection: false };
		}

		return { id: Array.from(sourceChannels).sort().join('+'), isProjection: true };
	}

	/**
	 * The channel a source property belongs to, whether or not this pass happened to walk it.
	 *
	 * The in-pass map answers most of it for nothing. It cannot answer all of it: `aggregateBounded()`
	 * hands the provider a scoped device set, and a hidden or out-of-scope source device is simply not
	 * in it — so two virtual devices projecting *different properties of one hidden channel* would fall
	 * back to two different property ids and be counted twice, while the same pair counts once in the
	 * full-home pass. A sensor's identity cannot depend on which pass is asking.
	 *
	 * Read back one property at a time, cached for the pass, and only ever for a property that is
	 * projected and whose channel is outside it — bounded by the projections in scope, which is a
	 * handful. A read that fails leaves the caller with the series key, which is what it had before:
	 * still stable, still shared by everything projecting that exact property.
	 */
	private async resolveOwningChannel(
		propertyId: string,
		channelOfProperty: Map<string, string>,
	): Promise<string | null> {
		const known = channelOfProperty.get(propertyId);

		if (known !== undefined) {
			return known;
		}

		try {
			const property = await this.channelsPropertiesService.findOne(propertyId);
			const channelId = typeof property?.channel === 'string' ? property.channel : property?.channel?.id;

			// Cached either way: a source that does not resolve is not worth asking about twice in one
			// pass, and `null` is a different answer from "not looked up yet".
			channelOfProperty.set(propertyId, channelId ?? '');

			return channelId ?? null;
		} catch (error) {
			this.logger.warn(`Failed to resolve the channel of source property ${propertyId}: ${error}`);

			return null;
		}
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
	 * Asked of the registry rather than guessed from the device type — see identifySensor() for what
	 * "the same sensor" resolves to. It is the same seam the energy module bills a projected meter
	 * through; the alternative, skipping any channel whose properties are all projections, is wrong for
	 * the case virtual devices exist to serve, where the virtual device is the one the user thinks of
	 * as the sensor.
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
		const bySensor = new Map<string, { representative: SensorAlertCandidate; alert: SecurityAlert }>();

		for (const candidate of candidates) {
			const key = `${candidate.sensorId}:${candidate.alert.type}`;
			const held = bySensor.get(key);

			if (!held) {
				bySensor.set(key, { representative: candidate, alert: candidate.alert });

				continue;
			}

			// Two separate questions, and answering them together got the second one wrong. *Who* names
			// the sensor is the judgement below; *when it happened* is the newest of what the devices
			// reported, whichever of them won the naming. A rule with alternatives lets one device
			// trigger on a fresh reading while another still matches on a stale one — the physical
			// channel's `detected` going true now, beside a projection matching an old above-threshold
			// concentration — and carrying the winner's stale timestamp leaves
			// `SecurityStateListener.syncAckRecords()` treating a new life-safety event as the
			// acknowledged one.
			const representative = this.namesTheSensorBetter(candidate, held.representative)
				? candidate
				: held.representative;

			bySensor.set(key, {
				representative,
				alert: {
					...representative.alert,
					timestamp: this.newerTimestamp(held.alert.timestamp, candidate.alert.timestamp),
					severity:
						SEVERITY_RANK[candidate.alert.severity] > SEVERITY_RANK[held.alert.severity]
							? candidate.alert.severity
							: held.alert.severity,
				},
			});
		}

		// And by alert id after that, because the id is what survives downstream: two sensors of one
		// category on one device share an id, so counting both here reports a number the merged list
		// never shows.
		//
		// The louder wins, and at equal volume — which is the ordinary case, since both came from the
		// same rule — the *newer* does, matching `SecurityAggregatorService.mergeAlerts()`. The
		// timestamp is not decoration on a life-safety path: `SecurityStateListener.syncAckRecords()`
		// reads it to decide whether an alert is a new occurrence, so keeping the older of two smoke
		// alerts leaves the second one showing as acknowledged because the first was.
		const byId = new Map<string, SecurityAlert>();

		for (const { alert } of bySensor.values()) {
			const held = byId.get(alert.id);

			if (!held || this.speaksForTheAlertId(alert, held)) {
				byId.set(alert.id, alert);
			}
		}

		return Array.from(byId.values());
	}

	private speaksForTheAlertId(alert: SecurityAlert, held: SecurityAlert): boolean {
		const severityDiff = SEVERITY_RANK[alert.severity] - SEVERITY_RANK[held.severity];

		if (severityDiff !== 0) {
			return severityDiff > 0;
		}

		return this.newerTimestamp(held.timestamp, alert.timestamp) === alert.timestamp;
	}

	/** The later of two reported times, preferring one that parses over one that does not. */
	private newerTimestamp(held: string, candidate: string): string {
		const heldTime = new Date(held).getTime();
		const candidateTime = new Date(candidate).getTime();

		if (Number.isNaN(candidateTime)) {
			return held;
		}

		return Number.isNaN(heldTime) || candidateTime > heldTime ? candidate : held;
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
