import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { HomeyChannelEntity, HomeyChannelPropertyEntity, HomeyDeviceEntity } from '../entities/devices-homey.entity';
import { HomeyMappingLoaderService } from '../mappings/mapping-loader.service';
import { HomeyMappingTransformerService } from '../mappings/mapping-transformer.service';
import { HomeyTransformDefinition, ResolvedHomeyPropertyMapping } from '../mappings/mapping.types';
import { HomeyCapabilityType, HomeyCapabilityValue, createHomeyCapability } from '../models/homey-capability.model';
import { HomeyDevice } from '../models/homey-device.model';
import { HomeyService } from '../services/homey.service';

import { HomeyDevicePlatform } from './homey-device.platform';

interface CommandCase {
	readonly label: string;
	readonly panelValue: string | number | boolean;
	readonly homeyValue: HomeyCapabilityValue;
	readonly dataType: DataTypeType;
	readonly propertyCategory: PropertyCategory;
	readonly capabilityType: HomeyCapabilityType;
	readonly format: string[] | number[] | null;
	readonly minimum: number | null;
	readonly maximum: number | null;
	readonly step: number | null;
	readonly enumValues?: readonly string[];
	readonly transform?: HomeyTransformDefinition;
}

const commandCases: readonly CommandCase[] = [
	{
		label: 'on/off',
		panelValue: true,
		homeyValue: true,
		dataType: DataTypeType.BOOL,
		propertyCategory: PropertyCategory.ON,
		capabilityType: HomeyCapabilityType.BOOLEAN,
		format: null,
		minimum: null,
		maximum: null,
		step: null,
	},
	{
		label: 'dim normalization',
		panelValue: 50,
		homeyValue: 0.5,
		dataType: DataTypeType.UCHAR,
		propertyCategory: PropertyCategory.BRIGHTNESS,
		capabilityType: HomeyCapabilityType.NUMBER,
		format: [0, 100],
		minimum: 0,
		maximum: 1,
		step: 0.01,
		transform: { type: 'scale', input_range: [0, 1], output_range: [0, 100], clamp: true },
	},
	{
		label: 'color-temperature range conversion',
		panelValue: 4250,
		homeyValue: 0.5,
		dataType: DataTypeType.USHORT,
		propertyCategory: PropertyCategory.COLOR_TEMPERATURE,
		capabilityType: HomeyCapabilityType.NUMBER,
		format: [2000, 6500],
		minimum: 0,
		maximum: 1,
		step: 0.01,
		transform: { type: 'scale', input_range: [0, 1], output_range: [6500, 2000], clamp: true },
	},
	{
		label: 'enum',
		panelValue: 'heat',
		homeyValue: 'heat',
		dataType: DataTypeType.ENUM,
		propertyCategory: PropertyCategory.MODE,
		capabilityType: HomeyCapabilityType.ENUM,
		format: ['heat', 'cool'],
		minimum: null,
		maximum: null,
		step: null,
		enumValues: ['heat', 'cool'],
	},
	{
		label: 'cover command',
		panelValue: 'open',
		homeyValue: 'up',
		dataType: DataTypeType.ENUM,
		propertyCategory: PropertyCategory.COMMAND,
		capabilityType: HomeyCapabilityType.ENUM,
		format: ['open', 'close', 'stop'],
		minimum: null,
		maximum: null,
		step: null,
		enumValues: ['up', 'down', 'idle'],
		transform: { type: 'map', write: { open: 'up', close: 'down', stop: 'idle' } },
	},
	{
		label: 'lock command',
		panelValue: 'locked',
		homeyValue: true,
		dataType: DataTypeType.ENUM,
		propertyCategory: PropertyCategory.STATUS,
		capabilityType: HomeyCapabilityType.BOOLEAN,
		format: ['locked', 'unlocked'],
		minimum: null,
		maximum: null,
		step: null,
		transform: { type: 'map', write: { locked: true, unlocked: false } },
	},
];

function mapping(command: CommandCase): ResolvedHomeyPropertyMapping {
	return {
		kind: 'properties',
		source: 'builtin',
		name: `mapping-${command.label}`,
		priority: 100,
		exclusive: false,
		conflict: 'first',
		match: {
			classes: ['light'],
			capabilityBaseIds: ['capability'],
			allCapabilities: [],
			noneCapabilities: [],
			driverIds: [],
			manufacturers: [],
			models: [],
		},
		property: {
			channel: 'main',
			category: command.propertyCategory,
			dataType: command.dataType,
			direction: command.label === 'cover command' ? 'write_only' : 'bidirectional',
			...(command.transform === undefined ? {} : { transform: command.transform }),
		},
	};
}

function deviceWithCapability(command: CommandCase): HomeyDevice {
	return {
		id: 'homey-device',
		name: 'Device',
		class: 'light',
		zoneId: null,
		zoneName: null,
		zonePath: [],
		available: true,
		availabilityMessage: null,
		driverId: 'driver',
		manufacturer: null,
		model: null,
		energy: null,
		capabilities: [
			createHomeyCapability({
				id: 'capability.main',
				title: 'Capability',
				value: null,
				type: command.capabilityType,
				unit: null,
				minimum: command.minimum,
				maximum: command.maximum,
				step: command.step,
				enumValues: (command.enumValues ?? []).map((id) => ({ id, title: id })),
				readable: true,
				writable: true,
				available: true,
				lastUpdatedAt: null,
			}),
		],
	};
}

function entities(command: CommandCase, resolvedMapping: ResolvedHomeyPropertyMapping) {
	const device = Object.assign(new HomeyDeviceEntity(), {
		id: 'panel-device',
		identifier: 'homey-device',
		name: 'Device',
		enabled: true,
	});
	const channel = Object.assign(new HomeyChannelEntity(), {
		id: 'panel-channel',
		identifier: 'main',
		category: ChannelCategory.GENERIC,
		device,
	});
	const property = Object.assign(new HomeyChannelPropertyEntity(), {
		id: 'panel-property',
		identifier: 'capability.main',
		category: command.propertyCategory,
		dataType: command.dataType,
		permissions: [PermissionType.READ_WRITE],
		format: command.format,
		step: command.step === null || command.format === null ? null : command.label.includes('temperature') ? 1 : 1,
		invalid: null,
		homeyCapabilityId: 'capability.main',
		homeyMappingName: resolvedMapping.name,
		channel,
	});

	return { device, channel, property };
}

function mappingLoader(resolvedMapping: ResolvedHomeyPropertyMapping) {
	return {
		resolvePropertyMappings: jest.fn().mockReturnValue({
			mappings: [
				{
					capabilityId: 'capability.main',
					capabilityBaseId: 'capability',
					mapping: resolvedMapping,
				},
			],
			conflicts: [],
		}),
	};
}

describe('HomeyDevicePlatform', () => {
	it.each(commandCases)('transforms and sends a validated $label command', async (command) => {
		const resolvedMapping = mapping(command);
		const upstream = deviceWithCapability(command);
		const homeyService = {
			getInventorySnapshot: jest.fn().mockReturnValue([upstream]),
			executeCapabilityCommand: jest.fn().mockResolvedValue(true),
		};
		const loader = mappingLoader(resolvedMapping);
		const platform = new HomeyDevicePlatform(
			homeyService as unknown as HomeyService,
			loader as unknown as HomeyMappingLoaderService,
			new HomeyMappingTransformerService(),
		);
		const target = entities(command, resolvedMapping);

		await expect(platform.process({ ...target, value: command.panelValue })).resolves.toBe(true);
		expect(homeyService.executeCapabilityCommand).toHaveBeenCalledWith(
			upstream.id,
			'capability.main',
			command.homeyValue,
		);
	});

	it('validates the whole batch before sending any partial command', async () => {
		const command = commandCases[0];
		const resolvedMapping = mapping(command);
		const upstream = deviceWithCapability(command);
		const homeyService = {
			getInventorySnapshot: jest.fn().mockReturnValue([upstream]),
			executeCapabilityCommand: jest.fn().mockResolvedValue(true),
		};
		const loader = mappingLoader(resolvedMapping);
		const platform = new HomeyDevicePlatform(
			homeyService as unknown as HomeyService,
			loader as unknown as HomeyMappingLoaderService,
			new HomeyMappingTransformerService(),
		);
		const valid = entities(command, resolvedMapping);
		const invalid = entities(command, resolvedMapping);
		invalid.property.homeyMappingName = 'missing';

		await expect(
			platform.processBatch([
				{ ...valid, value: true },
				{ ...invalid, value: false },
			]),
		).resolves.toBe(false);
		expect(homeyService.executeCapabilityCommand).not.toHaveBeenCalled();
	});

	it('rejects unavailable devices, read-only capabilities, and off-range values', async () => {
		const command = commandCases[1];
		const resolvedMapping = mapping(command);
		const upstream = deviceWithCapability(command);
		const homeyService = {
			getInventorySnapshot: jest.fn(),
			executeCapabilityCommand: jest.fn().mockResolvedValue(true),
		};
		const loader = mappingLoader(resolvedMapping);
		const platform = new HomeyDevicePlatform(
			homeyService as unknown as HomeyService,
			loader as unknown as HomeyMappingLoaderService,
			new HomeyMappingTransformerService(),
		);
		const target = entities(command, resolvedMapping);

		homeyService.getInventorySnapshot.mockReturnValue([upstream]);
		target.property.permissions = [PermissionType.READ_ONLY];
		await expect(platform.process({ ...target, value: 50 })).resolves.toBe(false);
		target.property.permissions = [PermissionType.READ_WRITE];

		homeyService.getInventorySnapshot.mockReturnValue([{ ...upstream, available: false }]);
		await expect(platform.process({ ...target, value: 50 })).resolves.toBe(false);

		homeyService.getInventorySnapshot.mockReturnValue([
			{ ...upstream, capabilities: [{ ...upstream.capabilities[0], writable: false }] },
		]);
		await expect(platform.process({ ...target, value: 50 })).resolves.toBe(false);

		homeyService.getInventorySnapshot.mockReturnValue([upstream]);
		await expect(platform.process({ ...target, value: 101 })).resolves.toBe(false);
		expect(homeyService.executeCapabilityCommand).not.toHaveBeenCalled();
	});
});
