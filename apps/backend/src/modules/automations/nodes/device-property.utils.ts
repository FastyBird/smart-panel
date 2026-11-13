/**
 * What the three device cards share: the way a card points at a property, the kinds of value a property
 * can hold, and the checks of a configured value against the property it is meant for.
 */
import { IsUUID, ValidateBy, ValidationOptions } from 'class-validator';

import { DataTypeType, PermissionType } from '../../devices/devices.constants';
import { validatePropertyCommandValue } from '../../devices/utils/property-command-value.utils';
import { AutomationNodeConfigProblem, AutomationNodeReference } from '../graph/node-type';
import { TrackedValue } from '../tracker/state-tracker';

/**
 * A card points at a property by its device, channel and property ids. The three are stored together so
 * the automation can be marked invalid when any of them is removed, and so the editor can show the picker
 * (device, then channel, then property) without looking anything up.
 */
export class DevicePropertyTargetDto {
	@IsUUID('4', { message: '[{"field":"device_id","reason":"A device must be chosen."}]' })
	device_id: string;

	@IsUUID('4', { message: '[{"field":"channel_id","reason":"A channel must be chosen."}]' })
	channel_id: string;

	@IsUUID('4', { message: '[{"field":"property_id","reason":"A property must be chosen."}]' })
	property_id: string;
}

export const DEVICE_PROPERTY_TARGET_SCHEMA = {
	device_id: { type: 'string', format: 'uuid', description: 'The device the property belongs to.' },
	channel_id: { type: 'string', format: 'uuid', description: 'The channel the property belongs to.' },
	property_id: { type: 'string', format: 'uuid', description: 'The property.' },
} as const;

/** JSON Schema of a single property value */
export const PROPERTY_VALUE_SCHEMA = { type: ['string', 'number', 'boolean'] } as const;

export const devicePropertyReferences = (config: Partial<DevicePropertyTargetDto>): AutomationNodeReference[] => {
	const references: AutomationNodeReference[] = [];

	if (typeof config.device_id === 'string') references.push({ kind: 'device', id: config.device_id });
	if (typeof config.channel_id === 'string') references.push({ kind: 'channel', id: config.channel_id });
	if (typeof config.property_id === 'string') references.push({ kind: 'property', id: config.property_id });

	return references;
};

export const isPropertyValue = (value: unknown): value is TrackedValue =>
	typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));

/** A text, a finite number or a yes/no value */
export const IsPropertyValue = (options?: ValidationOptions): PropertyDecorator =>
	ValidateBy(
		{
			name: 'isPropertyValue',
			validator: {
				validate: (value: unknown): boolean => isPropertyValue(value),
				defaultMessage: (): string => 'The value must be a text, a number or a yes/no value.',
			},
		},
		options,
	);

export const PROPERTY_VALUE_KINDS = ['number', 'boolean', 'string', 'enum', 'unknown'] as const;

export type PropertyValueKind = (typeof PROPERTY_VALUE_KINDS)[number];

const NUMERIC_DATA_TYPES: readonly DataTypeType[] = [
	DataTypeType.CHAR,
	DataTypeType.UCHAR,
	DataTypeType.SHORT,
	DataTypeType.USHORT,
	DataTypeType.INT,
	DataTypeType.UINT,
	DataTypeType.FLOAT,
];

export const propertyValueKind = (dataType: DataTypeType | null | undefined): PropertyValueKind => {
	if (dataType === null || dataType === undefined) return 'unknown';
	if (NUMERIC_DATA_TYPES.includes(dataType)) return 'number';
	if (dataType === DataTypeType.BOOL) return 'boolean';
	if (dataType === DataTypeType.STRING) return 'string';
	if (dataType === DataTypeType.ENUM) return 'enum';

	return 'unknown';
};

/** What a card needs to know about the property it points at */
export interface DevicePropertyInfo {
	id: string;
	channelId: string | null;
	deviceId: string | null;
	dataType: DataTypeType;
	format: string[] | number[] | null;
	/** The value that stands for "no reading"; it can not be set */
	invalid: string | number | boolean | null;
	step: number | null;
	permissions: PermissionType[];
	/** The category of the property, when it is known */
	category?: string | null;
	/** The category of the channel the property belongs to, when it is known */
	channelCategory?: string | null;
}

/** Finds a property; null when it does not exist. May throw when the lookup itself fails. */
export type DevicePropertyLookup = (propertyId: string) => Promise<DevicePropertyInfo | null>;

/**
 * Looks a property up for a configuration check. A property that does not exist, or a lookup that fails,
 * answers null: a missing reference marks the automation invalid in the engine, with the node named, and a
 * check that can not be made must not refuse a save.
 */
export const findPropertyForCheck = async (
	lookup: DevicePropertyLookup,
	propertyId: unknown,
): Promise<DevicePropertyInfo | null> => {
	if (typeof propertyId !== 'string' || propertyId === '') return null;

	try {
		return await lookup(propertyId);
	} catch {
		return null;
	}
};

/** The property must be the one of the channel and of the device the card names */
export const checkPropertyTarget = (
	property: DevicePropertyInfo,
	config: Partial<DevicePropertyTargetDto>,
	prefix = '',
): AutomationNodeConfigProblem[] => {
	const problems: AutomationNodeConfigProblem[] = [];

	if (property.channelId !== null && property.channelId !== config.channel_id) {
		problems.push({ field: `${prefix}channel_id`, reason: 'The property does not belong to this channel.' });
	}

	if (property.deviceId !== null && property.deviceId !== config.device_id) {
		problems.push({ field: `${prefix}device_id`, reason: 'The property does not belong to this device.' });
	}

	return problems;
};

/**
 * Whether a configured value is one the property can hold. Returns the reason it is not, or null. A
 * property whose data type is unknown takes any value.
 */
export const describeValueMismatch = (property: DevicePropertyInfo, value: unknown): string | null => {
	switch (propertyValueKind(property.dataType)) {
		case 'number':
			return typeof value === 'number' ? null : 'This property holds a number.';
		case 'boolean':
			return typeof value === 'boolean' ? null : 'This property holds a yes/no value.';
		case 'string':
			return typeof value === 'string' ? null : 'This property holds a text.';
		case 'enum': {
			if (typeof value !== 'string') return 'This property holds one of a list of texts.';

			const allowed = Array.isArray(property.format) ? property.format.map((item) => String(item)) : [];

			return allowed.length === 0 || allowed.includes(value) ? null : 'This value is not one the property can hold.';
		}
		default:
			return null;
	}
};

/**
 * Whether a value of the right kind is one the device module takes as a command for the property: a whole
 * number in the range of an integer data type, inside the limits and on the step of the property. Returns
 * the reason it is not, or null. The check is the one `PropertyCommandService` makes when the action runs,
 * where a refused value fails every value of the same device with it.
 */
export const describeCommandValueProblem = (property: DevicePropertyInfo, value: unknown): string | null => {
	const validation = validatePropertyCommandValue(property, value);

	return validation.valid ? null : `The device does not take this value: ${validation.reason ?? 'it is not valid'}.`;
};

export const isWritable = (property: DevicePropertyInfo): boolean =>
	property.permissions.includes(PermissionType.READ_WRITE) || property.permissions.includes(PermissionType.WRITE_ONLY);
