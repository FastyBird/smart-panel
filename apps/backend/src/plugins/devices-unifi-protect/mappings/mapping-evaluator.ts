import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DeviceDataInput } from '../../../modules/devices/services/device-validation.service';
import { ProtectRtspsStreams } from '../client/protect-api.types';
import { PROTECT_ID_PATTERN } from '../client/protect-endpoints';
import { normalizeMacString } from '../services/protect-discovery-text';

import {
	ProtectCondition,
	ProtectMappingScalar,
	ProtectModelKey,
	ProtectResolvedMappings,
	ProtectTransform,
	ResolvedProtectChannelMapping,
	ResolvedProtectDeviceMapping,
	ResolvedProtectPropertyMapping,
} from './mapping.types';

export interface ProtectStreamAvailability {
	high: boolean;
	medium: boolean;
	low: boolean;
	package: boolean;
}

export interface ProtectMappingInput {
	nvr: { id: string; macKey: string };
	modelKey: string;
	device: Readonly<Record<string, unknown>>; // the console object (`raw`)
	streams: ProtectStreamAvailability | null; // null: not read, read failed, or not a camera
}

export interface ProtectMappedProperty {
	identifier: string;
	category: PropertyCategory;
	name: string;
	dataType: DataTypeType;
	permissions: PermissionType[];
	unit: string | null;
	format: (string | number)[] | null;
	step: number | null;
	value: ProtectMappingScalar;
	mappingName: string;
}

export interface ProtectMappedChannel {
	identifier: string;
	category: ChannelCategory;
	name: string;
	mappingName: string;
	properties: ProtectMappedProperty[];
}

export interface ProtectMappedDevice {
	mappingName: string;
	category: DeviceCategory;
	identifier: string;
	name: string;
	protectNvrId: string;
	protectDeviceId: string;
	protectModelKey: ProtectModelKey;
	channels: ProtectMappedChannel[];
}

export enum ProtectMappingWarningCode {
	UNSUPPORTED_DETECTION_TYPE = 'unsupported_detection_type',
}

export interface ProtectMappingWarning {
	code: ProtectMappingWarningCode;
	identifier: string | null; // the Protect value if it matches ^[A-Za-z0-9_]{1,64}$, else null
}

export type ProtectMappingResult =
	| { ok: true; device: ProtectMappedDevice; warnings: ProtectMappingWarning[] }
	| { ok: false; reason: 'unsupported_model' | 'invalid_device' };

const WARNING_IDENTIFIER_PATTERN = /^[A-Za-z0-9_]{1,64}$/;
const MAX_NAME_LENGTH = 255;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;

const NUMERIC_DATA_TYPES: readonly DataTypeType[] = [
	DataTypeType.CHAR,
	DataTypeType.UCHAR,
	DataTypeType.SHORT,
	DataTypeType.USHORT,
	DataTypeType.INT,
	DataTypeType.UINT,
	DataTypeType.FLOAT,
];

/** The NVR MAC as 12 lowercase hex digits without separators; null when absent or not a MAC. Never throws. */
export const toNvrMacKey = (mac: string | null): string | null =>
	mac === null || typeof mac !== 'string' ? null : (normalizeMacString(mac)?.replace(/:/g, '') ?? null);

/** Stream URLs are bearer secrets: only their presence survives. */
export const toStreamAvailability = (streams: ProtectRtspsStreams): ProtectStreamAvailability => ({
	high: streams.high !== null && streams.high !== undefined,
	medium: streams.medium !== null && streams.medium !== undefined,
	low: streams.low !== null && streams.low !== undefined,
	package: streams.package !== null && streams.package !== undefined,
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Walks plain objects only; arrays and primitives are leaves. */
const readPath = (source: unknown, path: string): unknown => {
	let current: unknown = source;

	for (const segment of path.split('.')) {
		if (!isPlainObject(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
			return undefined;
		}

		current = current[segment];
	}

	return current;
};

const holds = (condition: ProtectCondition, device: Readonly<Record<string, unknown>>): boolean => {
	if ('any' in condition) {
		return condition.any.some((nested) => holds(nested, device));
	}

	const value = readPath(device, condition.path);

	if ('equals' in condition) {
		return value === condition.equals;
	}

	if ('in' in condition) {
		return condition.in.some((candidate) => candidate === value);
	}

	if ('contains' in condition) {
		return Array.isArray(value) && value.includes(condition.contains);
	}

	if ('matches' in condition) {
		return typeof value === 'string' && new RegExp(condition.matches, 'i').test(value);
	}

	return value !== undefined && value !== null;
};

const allHold = (conditions: readonly ProtectCondition[], device: Readonly<Record<string, unknown>>): boolean =>
	conditions.every((condition) => holds(condition, device));

const applyTransform = (transform: ProtectTransform, value: unknown): ProtectMappingScalar => {
	switch (transform.type) {
		case 'map': {
			if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
				return transform.default ?? null;
			}

			const key = String(value);

			return Object.prototype.hasOwnProperty.call(transform.table, key)
				? transform.table[key]
				: (transform.default ?? null);
		}
		case 'thresholds': {
			if (!isFiniteNumber(value)) {
				return null;
			}

			const match = transform.thresholds.find((entry) => value >= entry.minimum);

			return match === undefined ? transform.default : match.value;
		}
		case 'scale': {
			if (!isFiniteNumber(value)) {
				return null;
			}

			const [inputStart, inputEnd] = transform.input_range;
			const [outputStart, outputEnd] = transform.output_range;
			const scaled = outputStart + ((value - inputStart) / (inputEnd - inputStart)) * (outputEnd - outputStart);

			return transform.round === true ? Math.round(scaled) : scaled;
		}
		case 'round': {
			if (!isFiniteNumber(value)) {
				return null;
			}

			const factor = 10 ** (transform.precision ?? 0);

			return Math.round(value * factor) / factor;
		}
	}
};

const fitsDataType = (value: ProtectMappingScalar, dataType: DataTypeType): boolean => {
	if (value === null) {
		return true;
	}

	if (dataType === DataTypeType.BOOL) {
		return typeof value === 'boolean';
	}

	if (dataType === DataTypeType.ENUM || dataType === DataTypeType.STRING) {
		return typeof value === 'string';
	}

	if (NUMERIC_DATA_TYPES.includes(dataType)) {
		return isFiniteNumber(value);
	}

	return false;
};

/** A numeric value must lie in the spec range `[min, max]`; an enum value must be listed in the spec format. */
const withinFormat = (value: ProtectMappingScalar, mapping: ResolvedProtectPropertyMapping): boolean => {
	const format = mapping.format;

	if (value === null || format === null) {
		return true;
	}

	if (mapping.dataType === DataTypeType.ENUM) {
		return format.includes(value as string | number);
	}

	if (NUMERIC_DATA_TYPES.includes(mapping.dataType) && format.length === 2) {
		const [minimum, maximum] = format;

		if (typeof minimum === 'number' && typeof maximum === 'number' && typeof value === 'number') {
			return value >= minimum && value <= maximum;
		}
	}

	return true;
};

const streamStatus = (
	kind: 'main' | 'package',
	device: Readonly<Record<string, unknown>>,
	streams: ProtectStreamAvailability | null,
): string => {
	const state = device.state;

	if (state === 'CONNECTING') {
		return 'initializing';
	}

	if (state === 'DISCONNECTED') {
		return 'offline';
	}

	if (state === 'CONNECTED') {
		const available =
			streams !== null && (kind === 'main' ? streams.high || streams.medium || streams.low : streams.package);

		return available ? 'available' : 'unavailable';
	}

	return 'unavailable';
};

const evaluateValue = (
	mapping: ResolvedProtectPropertyMapping,
	device: Readonly<Record<string, unknown>>,
	context: { id: string; key: string | null; streams: ProtectStreamAvailability | null },
): ProtectMappingScalar => {
	const source = mapping.value;
	let result: ProtectMappingScalar = null;

	if (source === null) {
		return null;
	}

	if ('constant' in source) {
		result = source.constant;
	} else if ('template' in source) {
		result = source.template.replaceAll('{id}', context.id).replaceAll('{key}', context.key ?? '');
	} else if ('path' in source) {
		const raw = readPath(device, source.path);

		if (raw === undefined || raw === null) {
			result = source.default ?? null;
		} else if (source.transform !== undefined) {
			result = applyTransform(source.transform, raw);
		} else if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
			result = raw;
		}
	} else {
		result = streamStatus(source.stream_status, device, context.streams);
	}

	return fitsDataType(result, mapping.dataType) && withinFormat(result, mapping) ? result : null;
};

const toDeviceName = (device: Readonly<Record<string, unknown>>, modelKey: string, id: string): string => {
	const name = typeof device.name === 'string' ? device.name.trim() : '';

	return name.length > 0 && name.length <= MAX_NAME_LENGTH && !CONTROL_CHARACTERS.test(name)
		? name
		: `UniFi Protect ${modelKey} ${id}`;
};

const fillTemplate = (template: string, entry: { key: string; name: string }): string =>
	template.replaceAll('{key}', entry.key).replaceAll('{name}', entry.name);

interface ChannelInstance {
	identifier: string;
	name: string;
	key: string | null;
}

const expandChannel = (
	mapping: ResolvedProtectChannelMapping,
	device: Readonly<Record<string, unknown>>,
	warnings: ProtectMappingWarning[],
): ChannelInstance[] => {
	if (mapping.forEach === null) {
		return [{ identifier: mapping.identifier, name: mapping.channelName, key: null }];
	}

	const list = readPath(device, mapping.forEach.path);

	if (!Array.isArray(list)) {
		return [];
	}

	const instances: ChannelInstance[] = [];
	const seen = new Set<string>();

	for (const value of list) {
		if (typeof value !== 'string' || seen.has(value)) {
			continue;
		}

		seen.add(value);

		if (mapping.forEach.ignore.includes(value)) {
			continue;
		}

		const entry = Object.prototype.hasOwnProperty.call(mapping.forEach.values, value)
			? mapping.forEach.values[value]
			: undefined;

		if (entry === undefined) {
			warnings.push({
				code: ProtectMappingWarningCode.UNSUPPORTED_DETECTION_TYPE,
				identifier: WARNING_IDENTIFIER_PATTERN.test(value) ? value : null,
			});
			continue;
		}

		instances.push({
			identifier: fillTemplate(mapping.identifier, entry),
			name: fillTemplate(mapping.channelName, entry),
			key: entry.key,
		});
	}

	return instances;
};

const findDeviceMapping = (
	mappings: ProtectResolvedMappings,
	input: ProtectMappingInput,
): ResolvedProtectDeviceMapping | undefined =>
	mappings.devices.find((mapping) => mapping.modelKey === input.modelKey && allHold(mapping.when, input.device));

/** Evaluates the resolved mappings against one console device. Never throws. */
export const evaluateProtectMapping = (
	mappings: ProtectResolvedMappings,
	input: ProtectMappingInput,
): ProtectMappingResult => {
	try {
		const id = input.device.id;

		if (typeof id !== 'string' || !PROTECT_ID_PATTERN.test(id)) {
			return { ok: false, reason: 'invalid_device' };
		}

		const deviceMapping = findDeviceMapping(mappings, input);

		if (deviceMapping === undefined) {
			return { ok: false, reason: 'unsupported_model' };
		}

		const warnings: ProtectMappingWarning[] = [];
		const channels: ProtectMappedChannel[] = [];

		for (const channelMapping of mappings.channels) {
			if (!channelMapping.devices.includes(deviceMapping.name) || !allHold(channelMapping.when, input.device)) {
				continue;
			}

			const propertyMappings = mappings.properties.filter(
				(property) =>
					property.channel === channelMapping.name &&
					(property.devices === null || property.devices.includes(deviceMapping.name)),
			);

			for (const instance of expandChannel(channelMapping, input.device, warnings)) {
				channels.push({
					identifier: instance.identifier,
					category: channelMapping.category,
					name: instance.name,
					mappingName: channelMapping.name,
					properties: propertyMappings.map((property) => ({
						identifier: property.identifier,
						category: property.category,
						name: property.displayName,
						dataType: property.dataType,
						permissions: [...property.permissions],
						unit: property.unit,
						format: property.format === null ? null : [...property.format],
						step: property.step,
						value: evaluateValue(property, input.device, { id, key: instance.key, streams: input.streams }),
						mappingName: property.name,
					})),
				});
			}
		}

		return {
			ok: true,
			device: {
				mappingName: deviceMapping.name,
				category: deviceMapping.category,
				identifier: `${input.nvr.macKey}:${id}`,
				name: toDeviceName(input.device, input.modelKey, id),
				protectNvrId: input.nvr.id,
				protectDeviceId: id,
				protectModelKey: deviceMapping.modelKey,
				channels,
			},
			warnings,
		};
	} catch {
		return { ok: false, reason: 'invalid_device' };
	}
};

/** The shape `DeviceValidationService.validateDeviceStructure` takes. */
export const toValidationInput = (device: ProtectMappedDevice): DeviceDataInput => ({
	category: device.category,
	channels: device.channels.map((channel) => ({
		category: channel.category,
		properties: channel.properties.map((property) => ({
			category: property.category,
			dataType: property.dataType,
			permissions: property.permissions,
		})),
	})),
});
