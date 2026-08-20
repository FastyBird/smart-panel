import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { DeviceCategory, PermissionType } from '../../../modules/devices/devices.constants';
import { DeviceValidationService } from '../../../modules/devices/services/device-validation.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	HomeyMappingPreviewDeviceNotFoundError,
	HomeyMappingPreviewUnavailableError,
} from '../errors/homey-mapping-preview.error';
import { HomeyMappingLoaderService } from '../mappings/mapping-loader.service';
import { HomeyMappingTransformerService } from '../mappings/mapping-transformer.service';
import { HomeyCapabilityType } from '../models/homey-capability.model';
import { HomeyDevice } from '../models/homey-device.model';
import { HomeyMappingPreviewWarningCode, HomeyMappingPreviewWarningSeverity } from '../models/mapping-preview.model';

import { HomeyMappingPreviewService } from './homey-mapping-preview.service';
import { HomeyService } from './homey.service';

const FIXTURE_ROOT = resolve(__dirname, '../__fixtures__/expected/v1/devices');
const FIXTURE_NAMES = [
	'climate',
	'cover',
	'energy-meter',
	'light',
	'repeated-capabilities',
	'sensor-air-quality',
	'sensor-safety',
	'switch',
	'unavailable',
] as const;

const readDeviceFixture = (name: (typeof FIXTURE_NAMES)[number]): HomeyDevice =>
	JSON.parse(readFileSync(resolve(FIXTURE_ROOT, `${name}.json`), 'utf8')) as HomeyDevice;

const findProperty = (
	preview: Awaited<ReturnType<HomeyMappingPreviewService['generatePreview']>>,
	capabilityId: string,
) =>
	preview.channels.flatMap((channel) => channel.properties).find((property) => property.capabilityId === capabilityId);

describe('HomeyMappingPreviewService', () => {
	let homeyService: jest.Mocked<Pick<HomeyService, 'getFreshDevice'>>;
	let mappingLoader: HomeyMappingLoaderService;
	let service: HomeyMappingPreviewService;

	beforeEach(() => {
		homeyService = { getFreshDevice: jest.fn() };
		mappingLoader = new HomeyMappingLoaderService();
		mappingLoader.loadAllMappings();
		service = new HomeyMappingPreviewService(
			homeyService as unknown as HomeyService,
			mappingLoader,
			new HomeyMappingTransformerService(),
			new DeviceValidationService({} as DevicesService),
		);
	});

	it('previews a fresh light with transformed values, effective access, and conversion metadata', async () => {
		const device = readDeviceFixture('light');
		homeyService.getFreshDevice.mockResolvedValue(device);

		const preview = await service.generatePreview({ deviceId: device.id });

		expect(homeyService.getFreshDevice).toHaveBeenCalledWith(device.id);
		expect(preview.device).toMatchObject({
			id: device.id,
			name: device.name,
			class: device.class,
			zoneId: device.zoneId,
			zonePath: device.zonePath,
			available: true,
		});
		expect(preview.suggestedCategory).toBe(DeviceCategory.LIGHTING);
		expect(preview.selectedCategory).toBe(DeviceCategory.LIGHTING);
		expect(preview.validCategories).toContain(DeviceCategory.LIGHTING);
		expect(preview.channels.map((channel) => channel.identifier)).toStrictEqual(['light']);
		expect(preview.channels[0]).toMatchObject({
			mappingName: 'light',
			mappingSource: 'builtin',
		});
		expect(preview.channels[0]?.properties.map((property) => property.capabilityId)).toStrictEqual([
			'dim',
			'light_hue',
			'light_saturation',
			'light_temperature',
			'onoff',
		]);

		expect(findProperty(preview, 'onoff')).toMatchObject({
			capabilityBaseId: 'onoff',
			currentValue: false,
			valueAvailable: true,
			permissions: [PermissionType.READ_WRITE],
			readable: true,
			writable: true,
			conversion: { type: 'identity', reversible: true, lossy: false, ambiguous: false },
		});
		expect(findProperty(preview, 'dim')).toMatchObject({
			currentValue: 24,
			sourceRange: { minimum: 0, maximum: 1, step: null },
			conversion: {
				type: 'scale',
				inputRange: [0, 1],
				outputRange: [0, 100],
				clamp: true,
			},
		});
		expect(findProperty(preview, 'light_hue')?.currentValue).toBe(313);
		expect(findProperty(preview, 'light_saturation')?.currentValue).toBe(95);
		expect(findProperty(preview, 'light_temperature')?.currentValue).toBe(6455);
		expect(preview.unsupportedCapabilityIds).toStrictEqual([
			'button.capability-suffix-000005',
			'effect',
			'last_seen',
			'light_mode',
			'measure_linkquality',
			'power_on_behavior',
		]);
		expect(preview.readyToAdopt).toBe(true);
	});

	it.each(FIXTURE_NAMES)('is deterministic and side-effect free for the %s fixture', async (fixtureName) => {
		const device = readDeviceFixture(fixtureName);
		const original = structuredClone(device);
		homeyService.getFreshDevice.mockResolvedValue(device);

		const first = await service.generatePreview({ deviceId: device.id });
		const second = await service.generatePreview({ deviceId: device.id });
		const sourceCapabilityIds = new Set(device.capabilities.map((capability) => capability.id));

		expect(second).toStrictEqual(first);
		expect(device).toStrictEqual(original);
		expect(
			first.channels
				.flatMap((channel) => channel.properties)
				.every((property) => sourceCapabilityIds.has(property.capabilityId)),
		).toBe(true);
		expect(first.unsupportedCapabilityIds.every((capabilityId) => sourceCapabilityIds.has(capabilityId))).toBe(true);
		if (first.suggestedCategory !== null) {
			expect(first.validCategories).toContain(first.suggestedCategory);
		}
		expect(first.device).not.toHaveProperty('availabilityMessage');
		expect(first.device).not.toHaveProperty('driverId');
		expect(first.device).not.toHaveProperty('energy');
	});

	it('reports unavailable inventory without leaking the Homey availability message', async () => {
		const device = readDeviceFixture('unavailable');
		homeyService.getFreshDevice.mockResolvedValue(device);

		const preview = await service.generatePreview({ deviceId: device.id });

		expect(preview.warnings).toContainEqual(
			expect.objectContaining({
				code: HomeyMappingPreviewWarningCode.DEVICE_UNAVAILABLE,
				severity: HomeyMappingPreviewWarningSeverity.WARNING,
			}),
		);
		expect(JSON.stringify(preview)).not.toContain(device.availabilityMessage);
	});

	it('keeps repeated full capability identifiers distinct and selects only the primary binding', async () => {
		const device = readDeviceFixture('repeated-capabilities');
		homeyService.getFreshDevice.mockResolvedValue(device);

		const preview = await service.generatePreview({ deviceId: device.id });
		const properties = preview.channels.flatMap((channel) => channel.properties);
		const repeatedPowerId = device.capabilities.find(
			(capability) => capability.id.startsWith('meter_power.') && capability.id !== 'meter_power',
		)?.id;

		expect(
			properties
				.filter((property) => property.capabilityBaseId === 'meter_power')
				.map((property) => property.capabilityId),
		).toStrictEqual(['meter_power']);
		expect(repeatedPowerId).toBeDefined();
		expect(preview.unsupportedCapabilityIds).toContain(repeatedPowerId);
		expect(preview.warnings).toContainEqual(
			expect.objectContaining({
				code: HomeyMappingPreviewWarningCode.UNSUPPORTED_CAPABILITY,
				identifier: repeatedPowerId,
			}),
		);
	});

	it('marks an incompatible operator-selected category as blocking', async () => {
		const device = readDeviceFixture('light');
		homeyService.getFreshDevice.mockResolvedValue(device);

		const preview = await service.generatePreview({
			deviceId: device.id,
			deviceCategory: DeviceCategory.CAMERA,
		});

		expect(preview.suggestedCategory).toBe(DeviceCategory.LIGHTING);
		expect(preview.selectedCategory).toBe(DeviceCategory.CAMERA);
		expect(preview.validCategories).not.toContain(DeviceCategory.CAMERA);
		expect(preview.warnings).toContainEqual(
			expect.objectContaining({
				code: HomeyMappingPreviewWarningCode.INVALID_DEVICE_CATEGORY,
				severity: HomeyMappingPreviewWarningSeverity.ERROR,
			}),
		);
		expect(preview.readyToAdopt).toBe(false);
	});

	it('returns stable blocking findings for a device with no supported contract', async () => {
		const device: HomeyDevice = {
			...readDeviceFixture('unavailable'),
			id: 'unsupported-device',
			class: 'unsupported',
			available: true,
			availabilityMessage: null,
			capabilities: [],
		};
		homeyService.getFreshDevice.mockResolvedValue(device);

		const preview = await service.generatePreview({ deviceId: device.id });

		expect(preview.suggestedCategory).toBeNull();
		expect(preview.selectedCategory).toBeNull();
		expect(preview.validCategories).toStrictEqual([]);
		expect(preview.channels).toStrictEqual([]);
		expect(preview.warnings.map((warning) => warning.code)).toStrictEqual([
			HomeyMappingPreviewWarningCode.NO_CHANNEL_MAPPING,
			HomeyMappingPreviewWarningCode.NO_PROPERTY_MAPPING,
			HomeyMappingPreviewWarningCode.UNSUPPORTED_DEVICE,
		]);
		expect(preview.readyToAdopt).toBe(false);
	});

	it('surfaces conflicts and orphaned property bindings as blocking findings', async () => {
		const device = readDeviceFixture('light');
		homeyService.getFreshDevice.mockResolvedValue(device);
		const deviceResolution = mappingLoader.resolveDeviceMappings(device);
		jest.spyOn(mappingLoader, 'resolveDeviceMappings').mockReturnValue({
			mappings: deviceResolution.mappings,
			conflicts: [
				{
					kind: 'devices',
					key: device.id,
					policy: 'error',
					mappings: ['user-light', 'builtin-light'],
				},
			],
		});
		jest.spyOn(mappingLoader, 'resolveChannelMappings').mockReturnValue({ mappings: [], conflicts: [] });

		const preview = await service.generatePreview({ deviceId: device.id });

		expect(preview.warnings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: HomeyMappingPreviewWarningCode.DEVICE_MAPPING_CONFLICT }),
				expect.objectContaining({ code: HomeyMappingPreviewWarningCode.ORPHANED_PROPERTY_MAPPING }),
			]),
		);
		expect(preview.readyToAdopt).toBe(false);
	});

	it('reports access, conversion, lossy, and ambiguous mapping findings', async () => {
		const fixture = readDeviceFixture('light');
		const device: HomeyDevice = {
			...fixture,
			capabilities: fixture.capabilities.map((capability) =>
				capability.id === 'onoff'
					? { ...capability, readable: false, writable: false }
					: capability.id === 'dim'
						? { ...capability, value: 'not-a-number' }
						: capability,
			),
		};
		homeyService.getFreshDevice.mockResolvedValue(device);
		const propertyResolution = mappingLoader.resolvePropertyMappings(device);
		jest.spyOn(mappingLoader, 'resolvePropertyMappings').mockReturnValue({
			conflicts: propertyResolution.conflicts,
			mappings: propertyResolution.mappings.map((binding) =>
				binding.capabilityId === 'onoff'
					? {
							...binding,
							mapping: {
								...binding.mapping,
								property: {
									...binding.mapping.property,
									transform: {
										type: 'map',
										read: { false: 'same', true: 'same' },
										write: { same: false },
									},
								},
							},
						}
					: binding,
			),
		});

		const preview = await service.generatePreview({ deviceId: device.id });
		const codes = preview.warnings.map((warning) => warning.code);

		expect(codes).toEqual(
			expect.arrayContaining([
				HomeyMappingPreviewWarningCode.ACCESS_MISMATCH,
				HomeyMappingPreviewWarningCode.VALUE_CONVERSION_FAILED,
				HomeyMappingPreviewWarningCode.LOSSY_CONVERSION,
				HomeyMappingPreviewWarningCode.AMBIGUOUS_CONVERSION,
			]),
		);
		expect(findProperty(preview, 'onoff')?.conversion).toMatchObject({
			type: 'map',
			reversible: false,
			lossy: true,
			ambiguous: true,
			readTableSize: 2,
			writeTableSize: 1,
		});
		expect(preview.readyToAdopt).toBe(false);
	});

	it('blocks a non-reversible bidirectional map even when its read outputs are unique', async () => {
		const device = readDeviceFixture('light');
		homeyService.getFreshDevice.mockResolvedValue(device);
		const propertyResolution = mappingLoader.resolvePropertyMappings(device);
		jest.spyOn(mappingLoader, 'resolvePropertyMappings').mockReturnValue({
			conflicts: propertyResolution.conflicts,
			mappings: propertyResolution.mappings.map((binding) =>
				binding.capabilityId === 'onoff'
					? {
							...binding,
							mapping: {
								...binding.mapping,
								property: {
									...binding.mapping.property,
									transform: {
										type: 'map',
										read: { false: false, true: true },
										write: { false: true, true: true },
									},
								},
							},
						}
					: binding,
			),
		});

		const preview = await service.generatePreview({ deviceId: device.id });

		expect(findProperty(preview, 'onoff')?.conversion).toMatchObject({
			type: 'map',
			reversible: false,
			lossy: false,
			ambiguous: false,
		});
		expect(preview.warnings).toContainEqual(
			expect.objectContaining({
				code: HomeyMappingPreviewWarningCode.NON_REVERSIBLE_CONVERSION,
				severity: HomeyMappingPreviewWarningSeverity.ERROR,
				identifier: 'onoff',
			}),
		);
		expect(preview.readyToAdopt).toBe(false);
	});

	it('blocks a readable map that omits a declared Homey enum value', async () => {
		const fixture = readDeviceFixture('light');
		const device: HomeyDevice = {
			...fixture,
			capabilities: fixture.capabilities.map((capability) =>
				capability.id === 'onoff'
					? {
							...capability,
							type: HomeyCapabilityType.ENUM,
							value: 'off',
							enumValues: [
								{ id: 'off', title: 'Off' },
								{ id: 'on', title: 'On' },
								{ id: 'standby', title: 'Standby' },
							],
						}
					: capability,
			),
		};
		homeyService.getFreshDevice.mockResolvedValue(device);
		const propertyResolution = mappingLoader.resolvePropertyMappings(device);
		jest.spyOn(mappingLoader, 'resolvePropertyMappings').mockReturnValue({
			conflicts: propertyResolution.conflicts,
			mappings: propertyResolution.mappings.map((binding) =>
				binding.capabilityId === 'onoff'
					? {
							...binding,
							mapping: {
								...binding.mapping,
								property: {
									...binding.mapping.property,
									transform: {
										type: 'map',
										read: { off: false, on: true },
										write: { false: 'off', true: 'on' },
									},
								},
							},
						}
					: binding,
			),
		});

		const preview = await service.generatePreview({ deviceId: device.id });

		expect(preview.warnings).toContainEqual(
			expect.objectContaining({
				code: HomeyMappingPreviewWarningCode.INCOMPLETE_CAPABILITY_DOMAIN,
				severity: HomeyMappingPreviewWarningSeverity.ERROR,
				identifier: 'onoff',
			}),
		);
		expect(preview.readyToAdopt).toBe(false);
	});

	it('blocks potential transformed enum values outside the Smart Panel property format', async () => {
		const device = readDeviceFixture('cover');
		homeyService.getFreshDevice.mockResolvedValue(device);
		const propertyResolution = mappingLoader.resolvePropertyMappings(device);
		jest.spyOn(mappingLoader, 'resolvePropertyMappings').mockReturnValue({
			conflicts: propertyResolution.conflicts,
			mappings: propertyResolution.mappings.map((binding) =>
				binding.mapping.name === 'window-covering-status'
					? {
							...binding,
							mapping: {
								...binding.mapping,
								property: {
									...binding.mapping.property,
									transform: {
										type: 'thresholds',
										thresholds: [
											{ minimum: 1, value: 'open' },
											{ minimum: 0.000001, value: 'stopped' },
										],
										default: 'closed',
									},
								},
							},
						}
					: binding,
			),
		});

		const preview = await service.generatePreview({ deviceId: device.id });

		expect(preview.warnings).toContainEqual(
			expect.objectContaining({
				code: HomeyMappingPreviewWarningCode.INVALID_PROPERTY_VALUE_DOMAIN,
				severity: HomeyMappingPreviewWarningSeverity.ERROR,
				identifier: 'windowcoverings_set',
			}),
		);
		expect(preview.readyToAdopt).toBe(false);
	});

	it('blocks map write outputs outside the declared Homey enum domain', async () => {
		const fixture = readDeviceFixture('light');
		const device: HomeyDevice = {
			...fixture,
			capabilities: fixture.capabilities.map((capability) =>
				capability.id === 'onoff'
					? {
							...capability,
							type: HomeyCapabilityType.ENUM,
							value: 'off',
							enumValues: [
								{ id: 'off', title: 'Off' },
								{ id: 'on', title: 'On' },
							],
						}
					: capability,
			),
		};
		homeyService.getFreshDevice.mockResolvedValue(device);
		const propertyResolution = mappingLoader.resolvePropertyMappings(device);
		jest.spyOn(mappingLoader, 'resolvePropertyMappings').mockReturnValue({
			conflicts: propertyResolution.conflicts,
			mappings: propertyResolution.mappings.map((binding) =>
				binding.capabilityId === 'onoff'
					? {
							...binding,
							mapping: {
								...binding.mapping,
								property: {
									...binding.mapping.property,
									transform: {
										type: 'map',
										read: { off: false, on: true },
										write: { false: 'off', true: 'standby' },
									},
								},
							},
						}
					: binding,
			),
		});

		const preview = await service.generatePreview({ deviceId: device.id });

		expect(preview.warnings).toContainEqual(
			expect.objectContaining({
				code: HomeyMappingPreviewWarningCode.INVALID_CAPABILITY_VALUE_DOMAIN,
				severity: HomeyMappingPreviewWarningSeverity.ERROR,
				identifier: 'onoff',
			}),
		);
		expect(preview.readyToAdopt).toBe(false);
	});

	it('validates transformed values against the mapping declared range', async () => {
		const device = readDeviceFixture('light');
		homeyService.getFreshDevice.mockResolvedValue(device);
		const propertyResolution = mappingLoader.resolvePropertyMappings(device);
		jest.spyOn(mappingLoader, 'resolvePropertyMappings').mockReturnValue({
			conflicts: propertyResolution.conflicts,
			mappings: propertyResolution.mappings.map((binding) =>
				binding.capabilityId === 'dim'
					? {
							...binding,
							mapping: {
								...binding.mapping,
								property: {
									...binding.mapping.property,
									range: { minimum: 0, maximum: 50, step: 1 },
								},
							},
						}
					: binding,
			),
		});

		const preview = await service.generatePreview({ deviceId: device.id });

		expect(findProperty(preview, 'dim')?.currentValue).toBe(24);
		expect(preview.warnings).toContainEqual(
			expect.objectContaining({
				code: HomeyMappingPreviewWarningCode.INVALID_PROPERTY_VALUE_DOMAIN,
				severity: HomeyMappingPreviewWarningSeverity.ERROR,
				identifier: 'dim',
			}),
		);
		expect(preview.readyToAdopt).toBe(false);
	});

	it('blocks a boolean transform with identical Homey representations', async () => {
		const device = readDeviceFixture('light');
		homeyService.getFreshDevice.mockResolvedValue(device);
		const propertyResolution = mappingLoader.resolvePropertyMappings(device);
		jest.spyOn(mappingLoader, 'resolvePropertyMappings').mockReturnValue({
			conflicts: propertyResolution.conflicts,
			mappings: propertyResolution.mappings.map((binding) =>
				binding.capabilityId === 'onoff'
					? {
							...binding,
							mapping: {
								...binding.mapping,
								property: {
									...binding.mapping.property,
									transform: {
										type: 'boolean',
										true_value: false,
										false_value: false,
									},
								},
							},
						}
					: binding,
			),
		});

		const preview = await service.generatePreview({ deviceId: device.id });

		expect(findProperty(preview, 'onoff')?.conversion).toMatchObject({
			type: 'boolean',
			reversible: false,
			lossy: true,
			ambiguous: true,
		});
		expect(preview.warnings).toContainEqual(
			expect.objectContaining({
				code: HomeyMappingPreviewWarningCode.NON_REVERSIBLE_CONVERSION,
				severity: HomeyMappingPreviewWarningSeverity.ERROR,
				identifier: 'onoff',
			}),
		);
		expect(preview.readyToAdopt).toBe(false);
	});

	it('validates identity write values against the Homey capability domain', async () => {
		const fixture = readDeviceFixture('light');
		const device: HomeyDevice = {
			...fixture,
			capabilities: fixture.capabilities.map((capability) =>
				capability.id === 'onoff'
					? {
							...capability,
							type: HomeyCapabilityType.ENUM,
							value: null,
							enumValues: [
								{ id: 'off', title: 'Off' },
								{ id: 'on', title: 'On' },
							],
						}
					: capability,
			),
		};
		homeyService.getFreshDevice.mockResolvedValue(device);
		const propertyResolution = mappingLoader.resolvePropertyMappings(device);
		jest.spyOn(mappingLoader, 'resolvePropertyMappings').mockReturnValue({
			conflicts: propertyResolution.conflicts,
			mappings: propertyResolution.mappings.map((binding) =>
				binding.capabilityId === 'onoff'
					? {
							...binding,
							mapping: {
								...binding.mapping,
								property: {
									...binding.mapping.property,
									direction: 'write_only',
									transform: undefined,
								},
							},
						}
					: binding,
			),
		});

		const preview = await service.generatePreview({ deviceId: device.id });

		expect(preview.warnings).toContainEqual(
			expect.objectContaining({
				code: HomeyMappingPreviewWarningCode.INVALID_CAPABILITY_VALUE_DOMAIN,
				severity: HomeyMappingPreviewWarningSeverity.ERROR,
				identifier: 'onoff',
			}),
		);
		expect(preview.readyToAdopt).toBe(false);
	});

	it('transforms the full declared readable numeric domain into panel constraints', async () => {
		const fixture = readDeviceFixture('light');
		const device: HomeyDevice = {
			...fixture,
			capabilities: fixture.capabilities.map((capability) =>
				capability.id === 'dim' ? { ...capability, value: 24, minimum: -50, maximum: 50 } : capability,
			),
		};
		homeyService.getFreshDevice.mockResolvedValue(device);
		const propertyResolution = mappingLoader.resolvePropertyMappings(device);
		jest.spyOn(mappingLoader, 'resolvePropertyMappings').mockReturnValue({
			conflicts: propertyResolution.conflicts,
			mappings: propertyResolution.mappings.map((binding) =>
				binding.capabilityId === 'dim'
					? {
							...binding,
							mapping: {
								...binding.mapping,
								property: {
									...binding.mapping.property,
									direction: 'read_only',
									transform: undefined,
								},
							},
						}
					: binding,
			),
		});

		const preview = await service.generatePreview({ deviceId: device.id });

		expect(findProperty(preview, 'dim')?.currentValue).toBe(24);
		expect(preview.warnings).toContainEqual(
			expect.objectContaining({
				code: HomeyMappingPreviewWarningCode.INVALID_PROPERTY_VALUE_DOMAIN,
				severity: HomeyMappingPreviewWarningSeverity.ERROR,
				identifier: 'dim',
			}),
		);
		expect(preview.readyToAdopt).toBe(false);
	});

	it('blocks writable numeric scales whose panel step produces off-grid Homey values', async () => {
		const fixture = readDeviceFixture('light');
		const device: HomeyDevice = {
			...fixture,
			capabilities: fixture.capabilities.map((capability) =>
				capability.id === 'dim' ? { ...capability, value: 0.2, step: 0.1 } : capability,
			),
		};
		homeyService.getFreshDevice.mockResolvedValue(device);

		const preview = await service.generatePreview({ deviceId: device.id });

		expect(findProperty(preview, 'dim')?.currentValue).toBe(20);
		expect(preview.warnings).toContainEqual(
			expect.objectContaining({
				code: HomeyMappingPreviewWarningCode.INVALID_CAPABILITY_VALUE_DOMAIN,
				severity: HomeyMappingPreviewWarningSeverity.ERROR,
				identifier: 'dim',
			}),
		);
		expect(preview.readyToAdopt).toBe(false);
	});

	it('allows writable numeric scales whose complete panel grid aligns with the Homey step', async () => {
		const fixture = readDeviceFixture('light');
		const device: HomeyDevice = {
			...fixture,
			capabilities: fixture.capabilities.map((capability) =>
				capability.id === 'dim' ? { ...capability, value: 0.2, step: 0.1 } : capability,
			),
		};
		homeyService.getFreshDevice.mockResolvedValue(device);
		const propertyResolution = mappingLoader.resolvePropertyMappings(device);
		jest.spyOn(mappingLoader, 'resolvePropertyMappings').mockReturnValue({
			conflicts: propertyResolution.conflicts,
			mappings: propertyResolution.mappings.map((binding) =>
				binding.capabilityId === 'dim'
					? {
							...binding,
							mapping: {
								...binding.mapping,
								property: {
									...binding.mapping.property,
									range: { minimum: 0, maximum: 100, step: 10 },
								},
							},
						}
					: binding,
			),
		});

		const preview = await service.generatePreview({ deviceId: device.id });

		expect(findProperty(preview, 'dim')?.currentValue).toBe(20);
		expect(preview.warnings).not.toContainEqual(
			expect.objectContaining({
				code: HomeyMappingPreviewWarningCode.INVALID_CAPABILITY_VALUE_DOMAIN,
				identifier: 'dim',
			}),
		);
		expect(preview.readyToAdopt).toBe(true);
	});

	it('blocks readable maps over unbounded Homey string capabilities', async () => {
		const fixture = readDeviceFixture('light');
		const device: HomeyDevice = {
			...fixture,
			capabilities: fixture.capabilities.map((capability) =>
				capability.id === 'onoff'
					? {
							...capability,
							type: HomeyCapabilityType.STRING,
							value: 'off',
							enumValues: [],
						}
					: capability,
			),
		};
		homeyService.getFreshDevice.mockResolvedValue(device);
		const propertyResolution = mappingLoader.resolvePropertyMappings(device);
		jest.spyOn(mappingLoader, 'resolvePropertyMappings').mockReturnValue({
			conflicts: propertyResolution.conflicts,
			mappings: propertyResolution.mappings.map((binding) =>
				binding.capabilityId === 'onoff'
					? {
							...binding,
							mapping: {
								...binding.mapping,
								property: {
									...binding.mapping.property,
									direction: 'read_only',
									transform: { type: 'map', read: { off: false } },
								},
							},
						}
					: binding,
			),
		});

		const preview = await service.generatePreview({ deviceId: device.id });

		expect(findProperty(preview, 'onoff')?.currentValue).toBe(false);
		expect(preview.warnings).toContainEqual(
			expect.objectContaining({
				code: HomeyMappingPreviewWarningCode.INCOMPLETE_CAPABILITY_DOMAIN,
				severity: HomeyMappingPreviewWarningSeverity.ERROR,
				identifier: 'onoff',
			}),
		);
		expect(preview.readyToAdopt).toBe(false);
	});

	it('uses fixed not-found and unavailable errors for fresh inventory failures', async () => {
		homeyService.getFreshDevice.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('private endpoint detail'));

		await expect(service.generatePreview({ deviceId: 'missing' })).rejects.toBeInstanceOf(
			HomeyMappingPreviewDeviceNotFoundError,
		);
		await expect(service.generatePreview({ deviceId: 'unavailable' })).rejects.toStrictEqual(
			new HomeyMappingPreviewUnavailableError(),
		);
	});
});
