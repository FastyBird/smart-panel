import { createHash } from 'crypto';

import { PropertySampleEvidence } from '../../../modules/devices/models/property-sample.model';

export interface ShellyRawSample {
	readonly componentKey: string;
	readonly values: Readonly<Record<string, unknown>>;
	readonly evidence: PropertySampleEvidence;
}

function canonical(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonical);
	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([key, item]) => [key, canonical(item)]),
		);
	}
	return value;
}

/** Config/peripheral identity, never executable code or a thermistor conversion. */
export function nativeTemperatureIdentity(
	componentKey: string,
	config: Readonly<Record<string, unknown>>,
	peripherals: Readonly<Record<string, unknown>>,
): { channelIdentifier: string; attribute: 'xpercent' | 'xvoltage' | 'tC'; unit: string } | null {
	const [type, id] = componentKey.split(':');
	if (type === 'temperature' && /^\d+$/.test(id)) {
		const links = peripherals.ds18b20 as Record<string, { addr?: unknown }> | undefined;
		const peripheral = links?.[componentKey];
		if (!peripheral || typeof peripheral.addr !== 'string' || !peripheral.addr.trim()) return null;
		const digest = createHash('sha256')
			.update(JSON.stringify(canonical({ componentKey, config, peripheral })))
			.digest('hex');
		return { channelIdentifier: `probe-temperature:${componentKey}:${digest}`, attribute: 'tC', unit: '°C' };
	}
	if (!['input', 'voltmeter'].includes(type) || !/^\d+$/.test(id)) return null;
	const attribute = type === 'input' ? 'xpercent' : 'xvoltage';
	const helper = config[attribute] as { expr?: unknown; unit?: unknown } | undefined;
	const links = peripherals[type === 'input' ? 'analog_in' : 'voltmeter'] as Record<string, unknown> | undefined;
	if (
		!links ||
		!Object.hasOwn(links, componentKey) ||
		!helper ||
		typeof helper.expr !== 'string' ||
		!helper.expr.trim() ||
		typeof helper.unit !== 'string' ||
		!['°C', 'C', 'Celsius', 'celsius'].includes(helper.unit)
	)
		return null;
	if (type === 'input' && (config.type !== 'analog' || config.enable === false)) return null;
	const digest = createHash('sha256')
		.update(JSON.stringify(canonical({ componentKey, config, peripheral: links[componentKey] })))
		.digest('hex');
	return { channelIdentifier: `helper-temperature:${componentKey}:${digest}`, attribute, unit: helper.unit };
}

export function shellySampleEvidence(ts: unknown, observedAt: Date, receivedAt = new Date()): PropertySampleEvidence {
	const sourceTime = typeof ts === 'number' && Number.isFinite(ts) ? new Date(ts * 1000) : observedAt;
	return { sampledAt: sourceTime, receivedAt, observedAt, provenance: 'live' };
}

/** A live scalar by itself does not qualify a floor probe identity. */
export function hasQualifiedFloorSourceIdentity(channelIdentifier: string): boolean {
	return /^(helper-temperature:(input|voltmeter)|probe-temperature:temperature):\d+:[a-f0-9]{64}$/.test(
		channelIdentifier,
	);
}
