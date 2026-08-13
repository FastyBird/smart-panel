export const HOMEY_FIXTURE_NAMES = [
	'light',
	'switch',
	'climate',
	'cover',
	'sensor-air-quality',
	'sensor-safety',
	'energy-meter',
	'repeated-capabilities',
	'unavailable',
] as const;

export type HomeyFixtureName = (typeof HOMEY_FIXTURE_NAMES)[number];
export type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const capabilityIds = (device: JsonRecord): string[] =>
	Array.isArray(device.capabilities)
		? device.capabilities.filter((capability): capability is string => typeof capability === 'string')
		: [];

const capabilityBases = (device: JsonRecord): Set<string> =>
	new Set(capabilityIds(device).map((capability) => capability.split('.', 1)[0]));

const hasAllCapabilities = (device: JsonRecord, ...bases: string[]): boolean => {
	const available = capabilityBases(device);

	return bases.every((base) => available.has(base));
};

const suffixedCapabilityCount = (device: JsonRecord): number =>
	capabilityIds(device).filter((capability) => capability.includes('.')).length;

const repeatedBaseCount = (device: JsonRecord): number => {
	const bases = capabilityIds(device).map((capability) => capability.split('.', 1)[0]);

	return bases.length - new Set(bases).size;
};

interface FixtureSelector {
	name: HomeyFixtureName;
	matches(device: JsonRecord): boolean;
	score(device: JsonRecord): number;
}

const selectors: FixtureSelector[] = [
	{
		name: 'light',
		matches: (device) => device.class === 'light' && hasAllCapabilities(device, 'onoff', 'dim'),
		score: (device) =>
			['light_hue', 'light_saturation', 'light_temperature'].filter((capability) =>
				capabilityBases(device).has(capability),
			).length,
	},
	{
		name: 'switch',
		matches: (device) => device.class === 'socket' && hasAllCapabilities(device, 'onoff'),
		score: (device) => Number(hasAllCapabilities(device, 'measure_power', 'meter_power')),
	},
	{
		name: 'climate',
		matches: (device) => hasAllCapabilities(device, 'measure_temperature', 'measure_humidity'),
		score: (device) => capabilityIds(device).length,
	},
	{
		name: 'cover',
		matches: (device) =>
			device.class === 'windowcoverings' && hasAllCapabilities(device, 'windowcoverings_state', 'windowcoverings_set'),
		score: (device) => capabilityIds(device).length,
	},
	{
		name: 'sensor-air-quality',
		matches: (device) =>
			device.class === 'sensor' &&
			hasAllCapabilities(device, 'measure_temperature', 'measure_humidity', 'measure_luminance'),
		score: (device) => capabilityIds(device).length,
	},
	{
		name: 'sensor-safety',
		matches: (device) => hasAllCapabilities(device, 'alarm_motion') || hasAllCapabilities(device, 'alarm_battery'),
		score: (device) => capabilityIds(device).length,
	},
	{
		name: 'energy-meter',
		matches: (device) => hasAllCapabilities(device, 'measure_power', 'meter_power'),
		score: (device) => capabilityIds(device).length,
	},
	{
		name: 'repeated-capabilities',
		matches: (device) => repeatedBaseCount(device) > 0,
		score: (device) => repeatedBaseCount(device) * 100 + suffixedCapabilityCount(device),
	},
	{
		name: 'unavailable',
		matches: (device) => device.available === false,
		score: (device) => capabilityIds(device).length,
	},
];

interface Candidate {
	device: JsonRecord;
	id: string;
}

export const selectHomeyFixtures = (devices: JsonRecord): Map<HomeyFixtureName, JsonRecord> => {
	const entries = Object.entries(devices)
		.filter((entry): entry is [string, JsonRecord] => isRecord(entry[1]))
		.sort(([left], [right]) => left.localeCompare(right));
	const candidates = new Map(
		selectors.map((selector) => [
			selector.name,
			entries
				.filter(([, device]) => selector.matches(device))
				.map(([id, device]): Candidate => ({ id, device }))
				.sort(
					(left, right) =>
						selector.score(right.device) - selector.score(left.device) || left.id.localeCompare(right.id),
				),
		]),
	);
	const orderedSelectors = [...selectors].sort(
		(left, right) =>
			(candidates.get(left.name)?.length ?? 0) - (candidates.get(right.name)?.length ?? 0) ||
			left.name.localeCompare(right.name),
	);
	const assignment = new Map<HomeyFixtureName, Candidate>();
	const usedIds = new Set<string>();

	const assign = (index: number): boolean => {
		if (index === orderedSelectors.length) {
			return true;
		}

		const selector = orderedSelectors[index];

		for (const candidate of candidates.get(selector.name) ?? []) {
			if (usedIds.has(candidate.id)) {
				continue;
			}

			assignment.set(selector.name, candidate);
			usedIds.add(candidate.id);

			if (assign(index + 1)) {
				return true;
			}

			usedIds.delete(candidate.id);
			assignment.delete(selector.name);
		}

		return false;
	};

	if (!assign(0)) {
		throw new Error('Sanitized Homey capture has no distinct global fixture assignment');
	}

	return new Map(
		HOMEY_FIXTURE_NAMES.map((name) => {
			const candidate = assignment.get(name);

			if (!candidate) {
				throw new Error(`Sanitized Homey capture has no distinct candidate for fixture '${name}'`);
			}

			return [name, candidate.device];
		}),
	);
};
