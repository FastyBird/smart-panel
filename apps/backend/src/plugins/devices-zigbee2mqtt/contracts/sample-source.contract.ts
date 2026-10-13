import { createHash } from 'crypto';

import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { Z2mDevice, Z2mExpose, Z2mRegisteredDevice } from '../interfaces/zigbee2mqtt.interface';

/** Public expose semantics only. Labels, descriptions, availability and device configuration are excluded. */
export interface ZigbeeFieldContract {
	readonly property: string;
	readonly type: string;
	readonly unit: string | null;
	readonly endpoint: string | null;
	readonly access: number;
	readonly minimum: number | null;
	readonly maximum: number | null;
	readonly step: number | null;
	readonly values: readonly (string | number | boolean)[];
	readonly children: readonly ZigbeeFieldContract[];
}

export interface ZigbeeSourceIdentity {
	readonly friendlyName: string;
	readonly ieeeAddress: string;
	readonly fields: readonly ZigbeeFieldContract[];
	readonly fingerprint: string;
	readonly observedAt: Date;
}

export interface ZigbeePropertyMapping {
	readonly field: string;
	readonly transformer: string | null;
}

export const sourceFingerprint = (value: unknown): string =>
	createHash('sha256').update(JSON.stringify(value)).digest('hex');

function fieldContract(expose: Z2mExpose): ZigbeeFieldContract | null {
	if (!expose || typeof expose.property !== 'string' || !expose.property || typeof expose.type !== 'string')
		return null;
	if (
		!['numeric', 'binary', 'enum', 'text', 'composite'].includes(expose.type) ||
		!Number.isSafeInteger(expose.access) ||
		expose.access < 0 ||
		(expose.endpoint !== undefined && typeof expose.endpoint !== 'string')
	)
		return null;
	const numeric = expose as { value_min?: unknown; value_max?: unknown; value_step?: unknown; unit?: unknown };
	if (
		[numeric.value_min, numeric.value_max, numeric.value_step].some(
			(value) => value !== undefined && (typeof value !== 'number' || !Number.isFinite(value)),
		) ||
		(numeric.unit !== undefined && typeof numeric.unit !== 'string')
	)
		return null;
	const enumeration = expose as { values?: unknown; value_on?: unknown; value_off?: unknown };
	const primitive = (value: unknown): value is string | number | boolean =>
		typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
	if (
		(expose.type === 'binary' && (!primitive(enumeration.value_on) || !primitive(enumeration.value_off))) ||
		(expose.type === 'enum' && (!Array.isArray(enumeration.values) || !enumeration.values.every(primitive)))
	)
		return null;
	const values = Array.isArray(enumeration.values)
		? enumeration.values.filter(primitive)
		: [enumeration.value_on, enumeration.value_off].filter(primitive);
	const children =
		'features' in expose && Array.isArray(expose.features)
			? expose.features.map(fieldContract).filter((value): value is ZigbeeFieldContract => value !== null)
			: [];
	const numberOrNull = (value: unknown): number | null =>
		typeof value === 'number' && Number.isFinite(value) ? value : null;
	return Object.freeze({
		property: expose.property,
		type: expose.type,
		unit: typeof numeric.unit === 'string' ? numeric.unit : null,
		endpoint: typeof expose.endpoint === 'string' ? expose.endpoint : null,
		access: Number.isSafeInteger(expose.access) ? expose.access : 0,
		minimum: numberOrNull(numeric.value_min),
		maximum: numberOrNull(numeric.value_max),
		step: numberOrNull(numeric.value_step),
		values: Object.freeze(values),
		children: Object.freeze(children.sort((a, b) => a.property.localeCompare(b.property))),
	});
}

export function zigbeeSourceIdentity(
	device: Z2mDevice | Z2mRegisteredDevice,
	observedAt = new Date(),
): ZigbeeSourceIdentity | null {
	const ieee = 'ieee_address' in device ? device.ieee_address : device.ieeeAddress;
	const name = 'friendly_name' in device ? device.friendly_name : device.friendlyName;
	if (
		typeof ieee !== 'string' ||
		!/^0x[\da-f]{16}$/i.test(ieee) ||
		typeof name !== 'string' ||
		!name ||
		device.disabled ||
		!device.supported ||
		!Array.isArray(device.definition?.exposes)
	)
		return null;
	const fields: ZigbeeFieldContract[] = [];
	const collect = (exposes: Z2mExpose[]): void => {
		for (const expose of exposes) {
			const field = fieldContract(expose);
			if (field) fields.push(field);
			else if ('features' in expose && Array.isArray(expose.features)) collect(expose.features);
		}
	};
	collect(device.definition.exposes);
	const counts = new Map<string, number>();
	for (const field of fields) counts.set(field.property, (counts.get(field.property) ?? 0) + 1);
	// Ambiguous fields cannot bind; independent fields keep the physical identity usable.
	const uniqueFields = fields.filter((field) => counts.get(field.property) === 1);
	uniqueFields.sort((a, b) => a.property.localeCompare(b.property));
	const ieeeAddress = ieee.toLowerCase();
	return Object.freeze({
		friendlyName: name,
		ieeeAddress,
		fields: Object.freeze(uniqueFields),
		fingerprint: sourceFingerprint({ ieeeAddress, fields: uniqueFields }),
		observedAt: new Date(observedAt),
	});
}

export function propertySourceContract(property: ChannelPropertyEntity, mapping: ZigbeePropertyMapping) {
	return {
		field: mapping.field,
		transformer: mapping.transformer,
		category: property.category,
		dataType: property.dataType,
		unit: property.unit ?? null,
		format: property.format ?? null,
		step: property.step ?? null,
		invalid: property.invalid ?? null,
		permissions: [...(property.permissions ?? [])].sort(),
	};
}
