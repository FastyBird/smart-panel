const TRACKED_CAPABILITY_COVERAGE = [
	'target_temperature',
	'alarm_contact',
	'alarm_smoke',
	'alarm_co',
	'measure_co2',
	'windowcoverings_tilt_set',
	'measure_pressure',
] as const;

const TRACKED_DEVICE_CLASS_COVERAGE = ['lock'] as const;

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

export const deriveKnownDeviceClassGaps = (devices: Record<string, unknown>): string[] => {
	const capturedClasses = new Set(
		Object.values(devices)
			.filter(isRecord)
			.map((device) => device.class)
			.filter((deviceClass): deviceClass is string => typeof deviceClass === 'string'),
	);

	return TRACKED_DEVICE_CLASS_COVERAGE.filter((deviceClass) => !capturedClasses.has(deviceClass));
};

const homeyCapabilityEntries = (devices: Record<string, unknown>): Record<string, unknown>[] =>
	Object.values(devices)
		.filter(isRecord)
		.flatMap((device) => [device.capabilitiesObj, device.capabilityOptions])
		.filter(isRecord)
		.flatMap((capabilityMap) => Object.values(capabilityMap).filter(isRecord));

export const deriveKnownMetadataGaps = (devices: Record<string, unknown>): string[] =>
	homeyCapabilityEntries(devices).some(
		(capability) => capability.type === 'enum' && Array.isArray(capability.values) && capability.values.length > 0,
	)
		? []
		: ['live_enum_option_ids'];

export const assertDistinctHomeyEnumCapabilityOptionIds = (capability: unknown): void => {
	if (!isRecord(capability) || capability.type !== 'enum' || !Array.isArray(capability.values)) {
		return;
	}

	const optionIds = capability.values.map((option) => (isRecord(option) ? option.id : undefined));
	const validOptionIds = optionIds.every(
		(optionId): optionId is string =>
			typeof optionId === 'string' && optionId.length > 0 && !/^\[~\d+~\]$/.test(optionId),
	);

	if (!validOptionIds || new Set(optionIds).size !== optionIds.length) {
		throw new Error('Sanitized Homey capture has missing, redacted, or duplicate enum option IDs');
	}
};

export const assertDistinctHomeyEnumOptionIds = (devices: Record<string, unknown>): void =>
	homeyCapabilityEntries(devices).forEach(assertDistinctHomeyEnumCapabilityOptionIds);
