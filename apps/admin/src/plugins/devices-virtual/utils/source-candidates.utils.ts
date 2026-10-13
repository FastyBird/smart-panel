/** Keep the UI policy narrow; backend compatibility preview remains authoritative. */
export const isVirtualSourceDeviceCandidate = (device: { type: string; mode?: unknown }): boolean =>
	device.type !== 'virtual' || device.mode === 'sensor_aggregate';

export const isVirtualSourcePropertyCandidate = (
	device: { type: string; mode?: unknown } | null | undefined,
	channel: { category: string } | null | undefined,
	property: { category: string; dataType: string; permissions: string[]; valueOrigin?: unknown; sourceProperty?: unknown }
): boolean =>
	device?.type !== 'virtual' ||
	(device.mode === 'sensor_aggregate' &&
		channel?.category === 'temperature' &&
		property.category === 'temperature' &&
		property.dataType === 'float' &&
		property.valueOrigin === 'derived' &&
		!property.sourceProperty &&
		property.permissions.includes('ro') &&
		!property.permissions.some((permission) => permission === 'rw' || permission === 'wo'));
