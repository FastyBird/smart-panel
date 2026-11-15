import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';

export const PROTECT_MODEL_KEYS = ['camera', 'sensor', 'light'] as const;

export type ProtectModelKey = (typeof PROTECT_MODEL_KEYS)[number];

export type ProtectMappingKind = 'devices' | 'channels' | 'properties';

export type ProtectMappingScalar = string | number | boolean | null;

export type ProtectCondition =
	| { path: string; equals: ProtectMappingScalar }
	| { path: string; in: ProtectMappingScalar[] }
	| { path: string; contains: string } // array of strings contains the value
	| { path: string; matches: string } // case-insensitive regular expression over a string
	| { path: string; exists: true } // value is neither undefined nor null
	| { any: ProtectCondition[] };

export type ProtectTransform =
	| { type: 'map'; table: Record<string, ProtectMappingScalar>; default?: ProtectMappingScalar } // key = String(value)
	| {
			type: 'thresholds';
			thresholds: { minimum: number; value: ProtectMappingScalar }[];
			default: ProtectMappingScalar;
	  }
	| { type: 'scale'; input_range: [number, number]; output_range: [number, number]; round?: boolean }
	| { type: 'round'; precision?: number };

export type ProtectValueSource =
	| { constant: ProtectMappingScalar }
	| { template: string } // placeholders {id}, {key}
	| { path: string; default?: ProtectMappingScalar; transform?: ProtectTransform }
	| { stream_status: 'main' | 'package' };

// Definition shapes as written in the YAML files.

export interface ProtectDeviceMappingDefinition {
	name: string;
	priority?: number;
	match: { model_key: ProtectModelKey; when?: ProtectCondition[] };
	device: { category: string };
}

export interface ProtectChannelMappingDefinition {
	name: string;
	devices: string[];
	when?: ProtectCondition[];
	for_each?: {
		path: string;
		values: Record<string, { key: string; name: string }>;
		ignore?: string[];
	};
	channel: { identifier: string; category: string; name: string };
}

export interface ProtectPropertyMappingDefinition {
	name: string;
	channel: string;
	devices?: string[];
	property: { identifier: string; category: string; name?: string; variant?: string };
	value?: ProtectValueSource;
}

export type ProtectMappingDefinition =
	| ProtectDeviceMappingDefinition
	| ProtectChannelMappingDefinition
	| ProtectPropertyMappingDefinition;

export interface ProtectMappingFile {
	version: number;
	kind: ProtectMappingKind;
	mappings: ProtectMappingDefinition[];
}

// Resolved shapes.

export interface ResolvedProtectDeviceMapping {
	name: string;
	priority: number;
	modelKey: ProtectModelKey;
	when: ProtectCondition[];
	category: DeviceCategory;
}

export interface ResolvedProtectChannelMapping {
	name: string;
	devices: string[];
	when: ProtectCondition[];
	forEach: { path: string; values: Record<string, { key: string; name: string }>; ignore: string[] } | null;
	identifier: string; // may hold {key}
	category: ChannelCategory;
	channelName: string; // may hold {name}
}

export interface ResolvedProtectPropertyMapping {
	name: string;
	channel: string;
	devices: string[] | null;
	identifier: string;
	category: PropertyCategory;
	displayName: string;
	dataType: DataTypeType;
	permissions: PermissionType[];
	unit: string | null;
	format: (string | number)[] | null;
	step: number | null;
	value: ProtectValueSource | null; // null = the property gets no initial value
}

export interface ProtectResolvedMappings {
	devices: readonly ResolvedProtectDeviceMapping[]; // priority desc, then name asc
	channels: readonly ResolvedProtectChannelMapping[]; // file order
	properties: readonly ResolvedProtectPropertyMapping[]; // file order
}
