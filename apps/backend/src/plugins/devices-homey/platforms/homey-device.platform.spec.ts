import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { HOMEY_COMMAND_MAX_DURATION_MS } from '../devices-homey.constants';
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

function thermostatDevice(modes: readonly string[] = ['off', 'heat', 'cool', 'auto']): HomeyDevice {
	return {
		id: 'homey-thermostat',
		name: 'Thermostat',
		class: 'thermostat',
		zoneId: null,
		zoneName: null,
		zonePath: [],
		available: true,
		availabilityMessage: null,
		driverId: 'thermostat-driver',
		manufacturer: null,
		model: null,
		energy: null,
		capabilities: [
			createHomeyCapability({
				id: 'measure_temperature',
				title: 'Current temperature',
				value: 21,
				type: HomeyCapabilityType.NUMBER,
				unit: '°C',
				minimum: -50,
				maximum: 100,
				step: 0.1,
				enumValues: [],
				readable: true,
				writable: false,
				available: true,
				lastUpdatedAt: null,
			}),
			createHomeyCapability({
				id: 'target_temperature',
				title: 'Target temperature',
				value: 22,
				type: HomeyCapabilityType.NUMBER,
				unit: '°C',
				minimum: 4,
				maximum: 35,
				step: 0.5,
				enumValues: [],
				readable: true,
				writable: true,
				available: true,
				lastUpdatedAt: null,
			}),
			createHomeyCapability({
				id: 'thermostat_mode',
				title: 'Thermostat mode',
				value: 'heat',
				type: HomeyCapabilityType.ENUM,
				unit: null,
				minimum: null,
				maximum: null,
				step: null,
				enumValues: modes.map((id) => ({ id, title: id })),
				readable: true,
				writable: true,
				available: true,
				lastUpdatedAt: null,
			}),
		],
	};
}

function thermostatEntities(loader: HomeyMappingLoaderService) {
	const upstream = thermostatDevice();
	const mappings = new Map(
		loader.resolvePropertyMappings(upstream).mappings.map((binding) => [binding.mapping.name, binding]),
	);
	const device = Object.assign(new HomeyDeviceEntity(), {
		id: 'panel-thermostat',
		identifier: upstream.id,
		name: 'Thermostat',
		enabled: true,
	});
	const heater = Object.assign(new HomeyChannelEntity(), {
		id: 'panel-heater',
		identifier: 'heater',
		category: ChannelCategory.HEATER,
		device,
	});
	const cooler = Object.assign(new HomeyChannelEntity(), {
		id: 'panel-cooler',
		identifier: 'cooler',
		category: ChannelCategory.COOLER,
		device,
	});
	const property = (
		id: string,
		channel: HomeyChannelEntity,
		mappingName: string,
		category: PropertyCategory,
		dataType: DataTypeType,
		format: string[] | number[] | null,
	) => {
		const binding = mappings.get(mappingName);
		expect(binding).toBeDefined();

		return Object.assign(new HomeyChannelPropertyEntity(), {
			id,
			identifier: `${binding.capabilityId}::${mappingName}`,
			category,
			dataType,
			permissions: [PermissionType.READ_WRITE],
			format,
			step: dataType === DataTypeType.FLOAT ? 0.1 : null,
			invalid: null,
			homeyCapabilityId: binding.capabilityId,
			homeyMappingName: mappingName,
			channel,
		});
	};
	const heaterOn = property('heater-on', heater, 'thermostat-heater-on', PropertyCategory.ON, DataTypeType.BOOL, null);
	const coolerOn = property('cooler-on', cooler, 'thermostat-cooler-on', PropertyCategory.ON, DataTypeType.BOOL, null);
	const heaterTarget = property(
		'heater-target',
		heater,
		'thermostat-heater-target-temperature',
		PropertyCategory.TEMPERATURE,
		DataTypeType.FLOAT,
		[0, 100],
	);
	const coolerTarget = property(
		'cooler-target',
		cooler,
		'thermostat-cooler-target-temperature',
		PropertyCategory.TEMPERATURE,
		DataTypeType.FLOAT,
		[0, 100],
	);
	heater.properties = [heaterOn, heaterTarget];
	cooler.properties = [coolerOn, coolerTarget];
	device.channels = [heater, cooler];

	return { upstream, device, heater, cooler, heaterOn, coolerOn, heaterTarget, coolerTarget };
}

describe('HomeyDevicePlatform', () => {
	it('reports the bounded sequential command window for intent TTL selection', () => {
		const platform = new HomeyDevicePlatform(
			{} as HomeyService,
			{} as HomeyMappingLoaderService,
			{} as HomeyMappingTransformerService,
		);

		expect(platform.getCommandTimeoutMs(2)).toBe(HOMEY_COMMAND_MAX_DURATION_MS * 2);
	});

	it('reports authoritative readback from the current resolved property mapping', () => {
		const readableMapping = mapping(commandCases[0]);
		const writeOnlyMapping = mapping(commandCases.find((command) => command.label === 'cover command'));
		const platform = new HomeyDevicePlatform(
			{} as HomeyService,
			{
				getPropertyMappings: () => [readableMapping, writeOnlyMapping],
			} as unknown as HomeyMappingLoaderService,
			{} as HomeyMappingTransformerService,
		);
		const property = Object.assign(new HomeyChannelPropertyEntity(), {
			homeyCapabilityId: 'capability.main',
			homeyMappingName: readableMapping.name,
			permissions: [PermissionType.WRITE_ONLY],
		});

		expect(platform.usesAuthoritativePropertyReadback(property)).toBe(true);

		property.homeyMappingName = writeOnlyMapping.name;
		property.permissions = [PermissionType.READ_WRITE];
		expect(platform.usesAuthoritativePropertyReadback(property)).toBe(false);

		property.homeyMappingName = 'removed-mapping';
		expect(platform.usesAuthoritativePropertyReadback(property)).toBe(false);

		property.homeyCapabilityId = null;
		expect(platform.usesAuthoritativePropertyReadback(property)).toBe(false);
	});

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

	it('combines Homey thermostat heating and cooling enables into one configured mode command', async () => {
		const loader = new HomeyMappingLoaderService();
		loader.loadAllMappings();
		const target = thermostatEntities(loader);
		const homeyService = {
			getInventorySnapshot: jest.fn().mockReturnValue([target.upstream]),
			executeCapabilityCommand: jest.fn().mockResolvedValue(true),
		};
		const platform = new HomeyDevicePlatform(
			homeyService as unknown as HomeyService,
			loader,
			new HomeyMappingTransformerService(),
		);

		await expect(
			platform.processBatch([
				{ device: target.device, channel: target.heater, property: target.heaterOn, value: true },
				{ device: target.device, channel: target.cooler, property: target.coolerOn, value: true },
			]),
		).resolves.toBe(true);
		expect(homeyService.executeCapabilityCommand).toHaveBeenCalledTimes(1);
		expect(homeyService.executeCapabilityCommand).toHaveBeenCalledWith(target.upstream.id, 'thermostat_mode', 'auto');
	});

	it('combines a single thermostat mode update with the authoritative current mode', async () => {
		const loader = new HomeyMappingLoaderService();
		loader.loadAllMappings();
		const target = thermostatEntities(loader);
		const homeyService = {
			getInventorySnapshot: jest.fn().mockReturnValue([target.upstream]),
			executeCapabilityCommand: jest.fn().mockResolvedValue(true),
		};
		const platform = new HomeyDevicePlatform(
			homeyService as unknown as HomeyService,
			loader,
			new HomeyMappingTransformerService(),
		);

		await expect(
			platform.process({ device: target.device, channel: target.cooler, property: target.coolerOn, value: true }),
		).resolves.toBe(true);
		expect(homeyService.executeCapabilityCommand).toHaveBeenCalledWith(target.upstream.id, 'thermostat_mode', 'auto');
	});

	it('coalesces equal targets and projects a dual-setpoint range onto the shared Homey target', async () => {
		const loader = new HomeyMappingLoaderService();
		loader.loadAllMappings();
		const target = thermostatEntities(loader);
		const homeyService = {
			getInventorySnapshot: jest.fn().mockReturnValue([target.upstream]),
			executeCapabilityCommand: jest.fn().mockResolvedValue(true),
		};
		const platform = new HomeyDevicePlatform(
			homeyService as unknown as HomeyService,
			loader,
			new HomeyMappingTransformerService(),
		);

		await expect(
			platform.processBatch([
				{ device: target.device, channel: target.heater, property: target.heaterTarget, value: 23 },
				{ device: target.device, channel: target.cooler, property: target.coolerTarget, value: 23 },
			]),
		).resolves.toBe(true);
		expect(homeyService.executeCapabilityCommand).toHaveBeenCalledTimes(1);
		expect(homeyService.executeCapabilityCommand).toHaveBeenCalledWith(target.upstream.id, 'target_temperature', 23);

		homeyService.executeCapabilityCommand.mockClear();
		const preparedRange = platform.prepareBatch([
			{ device: target.device, channel: target.heater, property: target.heaterTarget, value: 21 },
			{ device: target.device, channel: target.cooler, property: target.coolerTarget, value: 25 },
		]);
		expect(preparedRange?.map((update) => update.value)).toStrictEqual([23, 23]);
		await expect(
			platform.processBatch([
				{ device: target.device, channel: target.heater, property: target.heaterTarget, value: 21 },
				{ device: target.device, channel: target.cooler, property: target.coolerTarget, value: 25 },
			]),
		).resolves.toBe(true);
		expect(homeyService.executeCapabilityCommand).toHaveBeenCalledTimes(1);
		expect(homeyService.executeCapabilityCommand).toHaveBeenCalledWith(target.upstream.id, 'target_temperature', 23);

		homeyService.executeCapabilityCommand.mockClear();
		const preparedOffGridMidpoint = platform.prepareBatch([
			{ device: target.device, channel: target.heater, property: target.heaterTarget, value: 21 },
			{ device: target.device, channel: target.cooler, property: target.coolerTarget, value: 21.5 },
		]);
		expect(preparedOffGridMidpoint?.map((update) => update.value)).toStrictEqual([21.5, 21.5]);
		await expect(
			platform.processBatch([
				{ device: target.device, channel: target.heater, property: target.heaterTarget, value: 21 },
				{ device: target.device, channel: target.cooler, property: target.coolerTarget, value: 21.5 },
			]),
		).resolves.toBe(true);
		expect(homeyService.executeCapabilityCommand).toHaveBeenCalledWith(target.upstream.id, 'target_temperature', 21.5);
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
