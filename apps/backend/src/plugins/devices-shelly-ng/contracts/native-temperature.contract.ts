import { createHash } from 'crypto';

import { PropertySampleEvidence } from '../../../modules/devices/models/property-sample.model';

export interface ShellyRawSample {
	readonly componentKey: string;
	readonly values: Readonly<Record<string, unknown>>;
	readonly evidence: PropertySampleEvidence;
}

export interface NativeTemperatureSnapshot {
	readonly componentKey: string;
	readonly fingerprint: string;
	readonly channelIdentifier: string;
	readonly attribute: 'xpercent' | 'xvoltage' | 'tC' | 'voltage';
	readonly unit: string;
	readonly expression: string | null;
	readonly configuration: {
		readonly enabled: boolean;
		readonly inverted: boolean;
		readonly rangeMap: readonly number[] | null;
		readonly inputRange: number | null;
		readonly reportThreshold: number | null;
		readonly offset: number | null;
	};
	readonly peripheral: {
		readonly kind: 'analog_in' | 'voltmeter' | 'ds18b20';
		readonly io: number;
		readonly address: string | null;
	};
}

/** Whitelisted sensor configuration only; expressions are metadata and are never evaluated. */
export function nativeTemperatureIdentity(
	componentKey: string,
	config: Readonly<Record<string, unknown>>,
	peripherals: Readonly<Record<string, unknown>>,
): NativeTemperatureSnapshot | null {
	const [type, id] = componentKey.split(':');
	if (!['input', 'voltmeter', 'temperature'].includes(type) || !/^\d+$/.test(id) || config.id !== Number(id))
		return null;
	if (!Number.isSafeInteger(Number(id))) return null;
	if (
		config.range_map !== undefined &&
		config.range_map !== null &&
		(!Array.isArray(config.range_map) ||
			!config.range_map.every((value: unknown) => typeof value === 'number' && Number.isFinite(value)))
	)
		return null;
	for (const field of ['invert', 'enable'])
		if (config[field] !== undefined && typeof config[field] !== 'boolean') return null;
	const thresholdField = type === 'temperature' ? 'report_thr_C' : 'report_thr';
	const offsetField = type === 'temperature' ? 'offset_C' : 'offset';
	for (const field of [offsetField, thresholdField])
		if (
			config[field] !== undefined &&
			config[field] !== null &&
			(typeof config[field] !== 'number' || !Number.isFinite(config[field]))
		)
			return null;
	if (
		config.range !== undefined &&
		config.range !== null &&
		(!Number.isInteger(config.range) || (config.range as number) < 0)
	)
		return null;
	const attribute = type === 'input' ? 'xpercent' : type === 'voltmeter' ? 'xvoltage' : 'tC';
	const kind = type === 'input' ? 'analog_in' : type === 'voltmeter' ? 'voltmeter' : 'ds18b20';
	const links = peripherals[kind] as Record<string, { io?: unknown; addr?: unknown }> | undefined;
	const link = links?.[componentKey];
	if (!link || typeof link !== 'object' || Array.isArray(link)) return null;
	// SensorAddon omits io for peripherals with one physical IO; the documented default is zero.
	const io = link.io === undefined ? 0 : link.io;
	if (!Number.isInteger(io) || (io as number) < 0) return null;
	let unit: string;
	let expression: string | null;
	if (type === 'temperature') {
		if (typeof link.addr !== 'string' || !link.addr.trim()) return null;
		unit = '°C';
		expression = null;
	} else {
		const helper = config[attribute] as { expr?: unknown; unit?: unknown } | undefined;
		if (
			!helper ||
			typeof helper.expr !== 'string' ||
			!helper.expr.trim() ||
			typeof helper.unit !== 'string' ||
			!['°C', 'C', 'Celsius', 'celsius'].includes(helper.unit)
		)
			return null;
		if (type === 'input' && (config.type !== 'analog' || config.enable === false)) return null;
		unit = helper.unit;
		expression = helper.expr;
	}
	const configuration: NativeTemperatureSnapshot['configuration'] = {
		enabled: config.enable !== false,
		inverted: config.invert === true,
		rangeMap:
			Array.isArray(config.range_map) &&
			config.range_map.every((value: unknown) => typeof value === 'number' && Number.isFinite(value))
				? [...(config.range_map as number[])]
				: null,
		inputRange: typeof config.range === 'number' ? config.range : null,
		reportThreshold:
			typeof config[thresholdField] === 'number' && Number.isFinite(config[thresholdField])
				? config[thresholdField]
				: null,
		offset:
			typeof config[offsetField] === 'number' && Number.isFinite(config[offsetField]) ? config[offsetField] : null,
	};
	const peripheral: NativeTemperatureSnapshot['peripheral'] = {
		kind,
		io: io as number,
		address: typeof link.addr === 'string' ? link.addr : null,
	};
	const fingerprint = createHash('sha256')
		.update(JSON.stringify({ componentKey, unit, expression, configuration, peripheral }))
		.digest('hex');
	return {
		componentKey,
		fingerprint,
		channelIdentifier: `${type === 'temperature' ? 'probe-temperature' : 'helper-temperature'}:${componentKey}:${fingerprint}`,
		attribute,
		unit,
		expression,
		configuration,
		peripheral,
	};
}

/** The unconverted voltage is qualified independently of any optional device-side Celsius helper. */
export function nativeVoltmeterVoltageIdentity(
	componentKey: string,
	config: Readonly<Record<string, unknown>>,
	peripherals: Readonly<Record<string, unknown>>,
	canonicalMac: string | null | undefined,
): NativeTemperatureSnapshot | null {
	const match = /^voltmeter:(\d+)$/.exec(componentKey);
	if (!match || !Number.isSafeInteger(Number(match[1])) || config.id !== Number(match[1])) return null;
	if (!canonicalMac || !/^[\da-f]{12}$/i.test(canonicalMac)) return null;
	if (!Number.isInteger(config.range) || (config.range as number) < 0) return null;
	if (
		config.report_thr !== undefined &&
		config.report_thr !== null &&
		(typeof config.report_thr !== 'number' || !Number.isFinite(config.report_thr))
	)
		return null;
	const links = peripherals.voltmeter as Record<string, { io?: unknown }> | undefined;
	const link = links?.[componentKey];
	if (!link || typeof link !== 'object' || Array.isArray(link)) return null;
	const io = link.io === undefined ? 0 : link.io;
	if (!Number.isInteger(io) || (io as number) < 0) return null;
	const configuration: NativeTemperatureSnapshot['configuration'] = {
		enabled: true,
		inverted: false,
		rangeMap: null,
		inputRange: config.range as number,
		reportThreshold: typeof config.report_thr === 'number' ? config.report_thr : null,
		offset: null,
	};
	const peripheral: NativeTemperatureSnapshot['peripheral'] = { kind: 'voltmeter', io: io as number, address: null };
	const fingerprint = createHash('sha256')
		.update(
			JSON.stringify({ canonicalMac: canonicalMac.toUpperCase(), componentKey, unit: 'V', configuration, peripheral }),
		)
		.digest('hex');
	return {
		componentKey,
		fingerprint,
		channelIdentifier: `raw-voltage:${componentKey}:${fingerprint}`,
		attribute: 'voltage',
		unit: 'V',
		expression: null,
		configuration,
		peripheral,
	};
}

export function shellySampleEvidence(ts: unknown, observedAt: Date, receivedAt = new Date()): PropertySampleEvidence {
	// Missing timestamps use verified live capture; malformed timestamps must retain invalid evidence.
	const sourceTime =
		ts === undefined ? observedAt : new Date(typeof ts === 'number' && Number.isFinite(ts) ? ts * 1000 : Number.NaN);
	return { sampledAt: sourceTime, receivedAt, observedAt, provenance: 'live' };
}

/** A live scalar by itself does not qualify a floor probe identity. */
export function hasQualifiedFloorSourceIdentity(channelIdentifier: string): boolean {
	return /^(helper-temperature:(input|voltmeter)|probe-temperature:temperature):\d+:[a-f0-9]{64}$/.test(
		channelIdentifier,
	);
}

export function hasQualifiedRawVoltageIdentity(channelIdentifier: string): boolean {
	return /^raw-voltage:voltmeter:\d+:[a-f0-9]{64}$/.test(channelIdentifier);
}
