const TRACKED_CAPABILITY_COVERAGE = [
	'target_temperature',
	'alarm_contact',
	'alarm_smoke',
	'alarm_co',
	'measure_co2',
	'windowcoverings_tilt_set',
	'measure_pressure',
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const capabilityBases = (device: Record<string, unknown>): string[] =>
	Array.isArray(device.capabilities)
		? device.capabilities
				.filter((capability): capability is string => typeof capability === 'string')
				.map((capability) => capability.split('.', 1)[0])
		: [];

export const deriveKnownCoverageGaps = (devices: Record<string, unknown>): string[] => {
	const capturedCapabilityBases = new Set(Object.values(devices).filter(isRecord).flatMap(capabilityBases));

	return TRACKED_CAPABILITY_COVERAGE.filter((capability) => !capturedCapabilityBases.has(capability));
};
