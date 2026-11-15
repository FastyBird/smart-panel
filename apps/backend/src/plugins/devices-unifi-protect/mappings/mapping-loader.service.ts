import Ajv, { ErrorObject, ValidateFunction } from 'ajv';
import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';

import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import {
	getPropertyMetadata,
	getRequiredChannels,
	getRequiredProperties,
	isChannelAllowed,
	isChannelMultiple,
} from '../../../modules/devices/utils/schema.utils';

import { PROTECT_MAPPING_FILE_NAMES, PROTECT_MAPPING_LOADER_OPTIONS } from './mapping.constants';
import {
	PROTECT_MODEL_KEYS,
	ProtectChannelMappingDefinition,
	ProtectCondition,
	ProtectDeviceMappingDefinition,
	ProtectMappingFile,
	ProtectMappingKind,
	ProtectMappingScalar,
	ProtectPropertyMappingDefinition,
	ProtectResolvedMappings,
	ProtectTransform,
	ProtectValueSource,
	ResolvedProtectChannelMapping,
	ResolvedProtectDeviceMapping,
	ResolvedProtectPropertyMapping,
} from './mapping.types';
import { ProtectMappingConfigurationError } from './protect-mapping.error';

export interface ProtectMappingLoaderOptions {
	definitionsPath?: string;
	schemaPath?: string;
}

const KIND_ORDER: readonly ProtectMappingKind[] = ['devices', 'channels', 'properties'];

const MAX_MAPPING_FILE_BYTES = 1024 * 1024;

const CHANNEL_IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+|\.\{key\})?$/;
const FOR_EACH_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
const PATH_PATTERN = /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/;
const FORBIDDEN_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const TEMPLATE_PLACEHOLDERS = new Set(['id', 'key']);

interface Failure {
	file: string;
	message: string;
}

@Injectable()
export class ProtectMappingLoaderService implements OnModuleInit {
	private readonly definitionsPath: string;
	private readonly schemaPath: string;

	private validateSchema: ValidateFunction | null = null;
	private cached: ProtectResolvedMappings | null = null;

	constructor(
		@Optional()
		@Inject(PROTECT_MAPPING_LOADER_OPTIONS)
		options: ProtectMappingLoaderOptions = {},
	) {
		this.definitionsPath = options.definitionsPath ?? join(__dirname, 'definitions');
		this.schemaPath = options.schemaPath ?? join(__dirname, 'schema', 'mapping-schema.json');
	}

	onModuleInit(): void {
		this.getMappings();
	}

	getMappings(): ProtectResolvedMappings {
		this.cached ??= this.load();

		return this.cached;
	}

	load(): ProtectResolvedMappings {
		const failures: Failure[] = [];
		const files = new Map<ProtectMappingKind, { path: string; name: string; config: ProtectMappingFile }>();

		for (const kind of KIND_ORDER) {
			const name = PROTECT_MAPPING_FILE_NAMES[kind];
			const path = join(this.definitionsPath, name);
			const result = this.readFile(path, name, kind);

			if (Array.isArray(result)) {
				failures.push(...result.map((message) => ({ file: path, message })));
			} else {
				files.set(kind, { path, name, config: result });
			}
		}

		if (failures.length > 0) {
			this.fail(failures);
		}

		const devices = files.get('devices');
		const channels = files.get('channels');
		const properties = files.get('properties');

		const resolved = this.validateSemantics(devices, channels, properties, failures);

		if (failures.length > 0) {
			this.fail(failures);
		}

		return resolved;
	}

	private fail(failures: readonly Failure[]): never {
		throw new ProtectMappingConfigurationError(
			failures[0].file,
			failures.map((failure) => failure.message),
		);
	}

	private getValidator(): ValidateFunction {
		if (this.validateSchema === null) {
			const schema = JSON.parse(readFileSync(this.schemaPath, 'utf8')) as Record<string, unknown>;
			this.validateSchema = new Ajv({ allErrors: true, strict: false }).compile(schema);
		}

		return this.validateSchema;
	}

	/** Reads, parses and schema-validates one file (rules 1 and 2); returns the config or its errors. */
	private readFile(path: string, name: string, expectedKind: ProtectMappingKind): ProtectMappingFile | string[] {
		let parsed: unknown;

		try {
			if (statSync(path).size > MAX_MAPPING_FILE_BYTES) {
				return [`${name}: mapping file exceeds the 1 MiB limit`];
			}

			parsed = parseYaml(readFileSync(path, 'utf8'), { maxAliasCount: 0 }) as unknown;
		} catch {
			return [`${name}: unable to read or parse the mapping file`];
		}

		const validate = this.getValidator();

		if (!validate(parsed)) {
			return this.formatSchemaErrors(name, validate.errors);
		}

		const config = parsed as ProtectMappingFile;

		if (config.version !== 1) {
			return [`${name}: unsupported version ${String(config.version)}, expected 1`];
		}

		if (config.kind !== expectedKind) {
			return [`${name}: kind '${String(config.kind)}' does not match the file kind '${expectedKind}'`];
		}

		return config;
	}

	private formatSchemaErrors(name: string, errors: ErrorObject[] | null | undefined): string[] {
		const formatted = new Set(
			(errors ?? []).map((error) => `${name}: ${error.instancePath || '/'} ${error.message ?? 'is invalid'}`),
		);

		return formatted.size > 0 ? [...formatted] : [`${name}: schema validation failed`];
	}

	private validateSemantics(
		devicesFile: { path: string; name: string; config: ProtectMappingFile },
		channelsFile: { path: string; name: string; config: ProtectMappingFile },
		propertiesFile: { path: string; name: string; config: ProtectMappingFile },
		failures: Failure[],
	): ProtectResolvedMappings {
		const report = (file: { path: string; name: string }, mapping: string, message: string): void => {
			failures.push({ file: file.path, message: `${file.name}: mapping '${mapping}': ${message}` });
		};

		const deviceDefinitions = devicesFile.config.mappings as ProtectDeviceMappingDefinition[];
		const channelDefinitions = channelsFile.config.mappings as ProtectChannelMappingDefinition[];
		const propertyDefinitions = propertiesFile.config.mappings as ProtectPropertyMappingDefinition[];

		// Rule 3: unique names per file.
		for (const [file, definitions] of [
			[devicesFile, deviceDefinitions],
			[channelsFile, channelDefinitions],
			[propertiesFile, propertyDefinitions],
		] as const) {
			const seen = new Set<string>();
			const reported = new Set<string>();

			for (const definition of definitions) {
				if (seen.has(definition.name) && !reported.has(definition.name)) {
					reported.add(definition.name);
					report(file, definition.name, 'duplicate mapping name');
				}
				seen.add(definition.name);
			}
		}

		const deviceCategories = new Map<string, DeviceCategory>();
		const channelCategories = new Map<string, ChannelCategory>();

		// Rule 4: device categories.
		for (const definition of deviceDefinitions) {
			const category: string = definition.device.category;

			if (category === String(DeviceCategory.GENERIC)) {
				report(devicesFile, definition.name, 'the generic category is not allowed');
			} else if (!this.isEnumValue(DeviceCategory, category)) {
				report(devicesFile, definition.name, `unknown device category '${category}'`);
			} else {
				deviceCategories.set(definition.name, category as DeviceCategory);
			}

			this.validateConditions(definition.match.when ?? [], (message) => report(devicesFile, definition.name, message));
		}

		const channelsByName = new Map(channelDefinitions.map((definition) => [definition.name, definition]));

		// Rules 5 and 6: channel mappings.
		for (const definition of channelDefinitions) {
			const fail = (message: string): void => report(channelsFile, definition.name, message);
			const category = definition.channel.category;
			const isKnownCategory = this.isEnumValue(ChannelCategory, category);

			if (!isKnownCategory) {
				fail(`unknown channel category '${category}'`);
			} else {
				channelCategories.set(definition.name, category as ChannelCategory);
			}

			for (const deviceName of definition.devices) {
				const deviceCategory = deviceCategories.get(deviceName);

				if (!deviceDefinitions.some((device) => device.name === deviceName)) {
					fail(`unknown device mapping '${deviceName}'`);
				} else if (
					deviceCategory !== undefined &&
					isKnownCategory &&
					!isChannelAllowed(deviceCategory, category as ChannelCategory)
				) {
					fail(`channel category '${category}' is not allowed on device category '${deviceCategory}'`);
				}
			}

			const identifier = definition.channel.identifier;

			if (!CHANNEL_IDENTIFIER_PATTERN.test(identifier)) {
				fail(`invalid channel identifier '${identifier}'`);
			}

			const hasKeyPlaceholder = identifier.includes('{key}');

			if (hasKeyPlaceholder && definition.for_each === undefined) {
				fail('the identifier uses {key} but the mapping has no for_each');
			} else if (!hasKeyPlaceholder && definition.for_each !== undefined) {
				fail('a for_each mapping needs {key} in its identifier');
			}

			if (definition.for_each !== undefined) {
				this.validatePath(definition.for_each.path, fail);

				for (const entry of Object.values(definition.for_each.values)) {
					if (!FOR_EACH_KEY_PATTERN.test(entry.key)) {
						fail(`invalid for_each key '${entry.key}'`);
					}
				}
			}

			this.validateConditions(definition.when ?? [], fail);
		}

		// Rule 6: a category used twice on one device, or by a for_each mapping, must be multiple there.
		const usage = new Map<string, number>();

		for (const definition of channelDefinitions) {
			const category = channelCategories.get(definition.name);

			if (category === undefined) {
				continue;
			}

			for (const deviceName of definition.devices) {
				const deviceCategory = deviceCategories.get(deviceName);

				if (deviceCategory === undefined || !isChannelAllowed(deviceCategory, category)) {
					continue;
				}

				const key = `${deviceName}\u0000${category}`;
				const count = (usage.get(key) ?? 0) + 1;
				usage.set(key, count);

				if ((count > 1 || definition.for_each !== undefined) && !isChannelMultiple(deviceCategory, category)) {
					report(
						channelsFile,
						definition.name,
						`channel category '${category}' must be multiple on device category '${deviceCategory}'`,
					);
				}
			}
		}

		// Rule 6b: no two channel mappings of one device mapping may yield the same channel identifier.
		for (const device of deviceDefinitions) {
			const onDevice = channelDefinitions.filter((definition) => definition.devices.includes(device.name));

			for (let second = 1; second < onDevice.length; second++) {
				for (let first = 0; first < second; first++) {
					if (this.identifiersCollide(onDevice[first], onDevice[second])) {
						report(
							channelsFile,
							onDevice[second].name,
							`duplicate channel identifier: '${onDevice[second].channel.identifier}' can collide with '${onDevice[first].channel.identifier}' of channel mapping '${onDevice[first].name}' on device mapping '${device.name}'`,
						);
					}
				}
			}
		}

		// Rules 7, 8 and 11: property mappings.
		const resolvedProperties: ResolvedProtectPropertyMapping[] = [];
		const identifiers = new Map<string, string>();

		for (const definition of propertyDefinitions) {
			const fail = (message: string): void => report(propertiesFile, definition.name, message);
			const channel = channelsByName.get(definition.channel);

			if (channel === undefined) {
				fail(`unknown channel mapping '${definition.channel}'`);
				continue;
			}

			for (const deviceName of definition.devices ?? []) {
				if (!channel.devices.includes(deviceName)) {
					fail(`device mapping '${deviceName}' is not a device of channel mapping '${channel.name}'`);
				}
			}

			const effectiveDevices = definition.devices ?? channel.devices;

			for (const deviceName of effectiveDevices) {
				const key = `${channel.name}\u0000${deviceName}\u0000${definition.property.identifier}`;
				const existing = identifiers.get(key);

				if (existing !== undefined) {
					fail(
						`duplicate property identifier '${definition.property.identifier}' on channel mapping ` +
							`'${channel.name}' (also used by '${existing}')`,
					);
				} else {
					identifiers.set(key, definition.name);
				}
			}

			const channelCategory = channelCategories.get(channel.name);
			const propertyCategory = definition.property.category;

			if (!this.isEnumValue(PropertyCategory, propertyCategory)) {
				fail(`unknown property category '${propertyCategory}'`);
				continue;
			}

			if (channelCategory === undefined) {
				continue;
			}

			const metadata = getPropertyMetadata(channelCategory, propertyCategory as PropertyCategory);

			if (metadata === null) {
				fail(`property category '${propertyCategory}' is not defined by the spec for channel '${channelCategory}'`);
				continue;
			}

			let attributes = {
				dataType: metadata.data_type,
				unit: metadata.unit,
				format: metadata.format,
				step: metadata.step,
			};
			const variant = definition.property.variant;

			if (metadata.hasMultipleDataTypes === true) {
				const selected = metadata.dataTypeVariants?.find((candidate) => candidate.id === variant);

				if (variant === undefined) {
					fail(
						`property category '${propertyCategory}' has data type variants, a variant is required ` +
							`(${(metadata.dataTypeVariants ?? []).map((candidate) => candidate.id).join(', ')})`,
					);
					continue;
				}

				if (selected === undefined) {
					fail(`variant '${variant}' does not exist for property category '${propertyCategory}'`);
					continue;
				}

				attributes = {
					dataType: selected.data_type,
					unit: selected.unit,
					format: selected.format,
					step: selected.step,
				};
			} else if (variant !== undefined) {
				fail(`variant '${variant}' is not offered by the spec for property category '${propertyCategory}'`);
				continue;
			}

			const format = attributes.format === null ? null : [...(attributes.format as (string | number)[])];

			if (definition.value !== undefined) {
				this.validateValueSource(definition.value, {
					dataType: attributes.dataType,
					format,
					channel,
					channelCategory,
					propertyCategory: propertyCategory as PropertyCategory,
					fail,
				});
			}

			resolvedProperties.push({
				name: definition.name,
				channel: definition.channel,
				devices: definition.devices === undefined ? null : [...definition.devices],
				identifier: definition.property.identifier,
				category: propertyCategory as PropertyCategory,
				displayName: definition.property.name ?? this.toSentenceCase(definition.property.identifier),
				dataType: attributes.dataType,
				permissions: [...metadata.permissions],
				unit: attributes.unit,
				format,
				step: attributes.step,
				value: definition.value === undefined ? null : structuredClone(definition.value),
			});
		}

		// Rule 9: every channel mapping covers the required properties of its category, per device.
		for (const definition of channelDefinitions) {
			const category = channelCategories.get(definition.name);

			if (category === undefined) {
				continue;
			}

			for (const deviceName of definition.devices) {
				const covered = new Set(
					propertyDefinitions
						.filter(
							(property) =>
								property.channel === definition.name &&
								(property.devices === undefined || property.devices.includes(deviceName)),
						)
						.map((property) => property.property.category),
				);

				for (const required of getRequiredProperties(category)) {
					if (!covered.has(required)) {
						report(
							channelsFile,
							definition.name,
							`missing required property '${required}' of channel '${category}' for device mapping '${deviceName}'`,
						);
					}
				}
			}
		}

		// Rule 10: unconditional channel mappings cover the required channels of each device mapping.
		for (const definition of deviceDefinitions) {
			const deviceCategory = deviceCategories.get(definition.name);

			if (deviceCategory === undefined) {
				continue;
			}

			const covered = new Set<ChannelCategory>();

			for (const channel of channelDefinitions) {
				const category = channelCategories.get(channel.name);

				if (
					category !== undefined &&
					channel.devices.includes(definition.name) &&
					(channel.when ?? []).length === 0 &&
					channel.for_each === undefined
				) {
					covered.add(category);
				}
			}

			for (const required of getRequiredChannels(deviceCategory)) {
				if (!covered.has(required)) {
					report(devicesFile, definition.name, `missing required channel '${required}' for '${deviceCategory}'`);
				}
			}
		}

		const devices: ResolvedProtectDeviceMapping[] = [];

		for (const definition of deviceDefinitions) {
			const category = deviceCategories.get(definition.name);

			if (category !== undefined && PROTECT_MODEL_KEYS.includes(definition.match.model_key)) {
				devices.push({
					name: definition.name,
					priority: definition.priority ?? 0,
					modelKey: definition.match.model_key,
					when: structuredClone(definition.match.when ?? []),
					category,
				});
			}
		}

		devices.sort((left, right) =>
			left.priority !== right.priority
				? right.priority - left.priority
				: left.name < right.name
					? -1
					: left.name > right.name
						? 1
						: 0,
		);

		const channels: ResolvedProtectChannelMapping[] = [];

		for (const definition of channelDefinitions) {
			const category = channelCategories.get(definition.name);

			if (category !== undefined) {
				channels.push({
					name: definition.name,
					devices: [...definition.devices],
					when: structuredClone(definition.when ?? []),
					forEach:
						definition.for_each === undefined
							? null
							: {
									path: definition.for_each.path,
									values: structuredClone(definition.for_each.values),
									ignore: [...(definition.for_each.ignore ?? [])],
								},
					identifier: definition.channel.identifier,
					category,
					channelName: definition.channel.name,
				});
			}
		}

		return { devices, channels, properties: resolvedProperties };
	}

	private validateValueSource(
		source: ProtectValueSource,
		context: {
			dataType: DataTypeType;
			format: (string | number)[] | null;
			channel: ProtectChannelMappingDefinition;
			channelCategory: ChannelCategory;
			propertyCategory: PropertyCategory;
			fail: (message: string) => void;
		},
	): void {
		const { dataType, format, channel, fail } = context;
		const isEnum = dataType === DataTypeType.ENUM && format !== null;
		const checkEnum = (value: ProtectMappingScalar | undefined, label: string): void => {
			if (isEnum && value !== undefined && value !== null && !format.includes(value as string | number)) {
				fail(`${label} '${String(value)}' is not in the spec format [${format.join(', ')}]`);
			}
		};

		if ('constant' in source) {
			checkEnum(source.constant, 'constant');
		} else if ('template' in source) {
			for (const match of source.template.matchAll(/\{([^{}]*)\}/g)) {
				if (!TEMPLATE_PLACEHOLDERS.has(match[1])) {
					fail(`unknown placeholder '{${match[1]}}' in template`);
				}
			}

			if (source.template.includes('{key}')) {
				if (channel.for_each === undefined) {
					fail('the template uses {key} but the channel mapping has no for_each');
				} else if (isEnum) {
					for (const entry of Object.values(channel.for_each.values)) {
						checkEnum(source.template.replaceAll('{key}', entry.key), 'for_each key value');
					}
				}
			}
		} else if ('path' in source) {
			this.validatePath(source.path, fail);
			checkEnum(source.default, 'default');

			if (source.transform !== undefined) {
				this.validateTransform(source.transform, checkEnum, fail);
			}
		} else if (
			context.channelCategory !== ChannelCategory.CAMERA ||
			context.propertyCategory !== PropertyCategory.STATUS
		) {
			fail("stream_status is only allowed on the status property of a 'camera' channel");
		}
	}

	private validateTransform(
		transform: ProtectTransform,
		checkEnum: (value: ProtectMappingScalar | undefined, label: string) => void,
		fail: (message: string) => void,
	): void {
		switch (transform.type) {
			case 'map':
				Object.values(transform.table).forEach((value) => checkEnum(value, 'map value'));
				checkEnum(transform.default, 'map default');
				break;
			case 'thresholds':
				if (
					transform.thresholds.some(
						(entry, index) => index > 0 && entry.minimum >= transform.thresholds[index - 1].minimum,
					)
				) {
					fail('thresholds must be descending (strictly decreasing minimums)');
				}

				transform.thresholds.forEach((entry) => checkEnum(entry.value, 'threshold value'));
				checkEnum(transform.default, 'threshold default');
				break;
			case 'scale':
				if (transform.input_range[0] === transform.input_range[1]) {
					fail('scale input range must have distinct endpoints');
				}

				if (transform.output_range[0] === transform.output_range[1]) {
					fail('scale output range must have distinct endpoints');
				}
				break;
			case 'round':
				break;
		}
	}

	private validateConditions(conditions: readonly ProtectCondition[], fail: (message: string) => void): void {
		for (const condition of conditions) {
			if ('any' in condition) {
				this.validateConditions(condition.any, fail);
				continue;
			}

			this.validatePath(condition.path, fail);

			if ('matches' in condition) {
				try {
					new RegExp(condition.matches, 'i');
				} catch {
					fail(`matches '${condition.matches}' is not a valid regular expression`);
				}
			}
		}
	}

	private validatePath(path: string, fail: (message: string) => void): void {
		if (!PATH_PATTERN.test(path) || path.split('.').some((segment) => FORBIDDEN_PATH_SEGMENTS.has(segment))) {
			fail(`invalid path '${path}'`);
		}
	}

	/** Whether two channel mappings can yield one identifier, decided from the identifier templates alone. */
	private identifiersCollide(a: ProtectChannelMappingDefinition, b: ProtectChannelMappingDefinition): boolean {
		const parse = (
			definition: ProtectChannelMappingDefinition,
		): { prefix: string; suffix: string; template: boolean } => {
			const identifier = definition.channel.identifier;
			const index = identifier.indexOf('{key}');

			return definition.for_each !== undefined && index >= 0
				? { prefix: identifier.slice(0, index), suffix: identifier.slice(index + 5), template: true }
				: { prefix: identifier, suffix: '', template: false };
		};

		const left = parse(a);
		const right = parse(b);

		if (!left.template && !right.template) {
			return left.prefix === right.prefix;
		}

		if (left.template && right.template) {
			return (
				(left.prefix.startsWith(right.prefix) || right.prefix.startsWith(left.prefix)) &&
				(left.suffix.endsWith(right.suffix) || right.suffix.endsWith(left.suffix))
			);
		}

		const [template, fixed] = left.template ? [left, right] : [right, left];
		const key = fixed.prefix.slice(template.prefix.length, fixed.prefix.length - template.suffix.length);

		return (
			fixed.prefix.startsWith(template.prefix) &&
			fixed.prefix.endsWith(template.suffix) &&
			FOR_EACH_KEY_PATTERN.test(key)
		);
	}

	private isEnumValue(enumType: Record<string, string>, value: string): boolean {
		return Object.values(enumType).includes(value);
	}

	private toSentenceCase(identifier: string): string {
		const text = identifier.replace(/_/g, ' ');

		return text.charAt(0).toUpperCase() + text.slice(1);
	}
}
