import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { DEVICES_HOMEY_TYPE } from '../devices-homey.constants';
import { HomeyAdoptDeviceDto } from '../dto/adoption.dto';
import { CreateHomeyDeviceChannelPropertyDto } from '../dto/create-device-channel-property.dto';
import { HomeyChannelEntity, HomeyChannelPropertyEntity, HomeyDeviceEntity } from '../entities/devices-homey.entity';
import { HomeyMappingPreviewDeviceNotFoundError } from '../errors/homey-mapping-preview.error';
import { HomeyAdoptionFailureCode, HomeyAdoptionStatus } from '../models/adoption.model';
import { HomeyMappingPreviewModel } from '../models/mapping-preview.model';

import { HomeyAdoptionLockService } from './homey-adoption-lock.service';
import { HomeyDeviceAdoptionService } from './homey-device-adoption.service';
import { HomeyMappingPreviewService } from './homey-mapping-preview.service';

const selection = (deviceId = 'homey-light'): HomeyAdoptDeviceDto => ({ deviceId });

const preview = (deviceId = 'homey-light', withProperties = true): HomeyMappingPreviewModel =>
	Object.assign(new HomeyMappingPreviewModel(), {
		device: {
			id: deviceId,
			name: 'Living light',
			class: 'light',
			zoneId: 'living',
			zonePath: ['Living room'],
			available: true,
		},
		suggestedCategory: DeviceCategory.LIGHTING,
		selectedCategory: DeviceCategory.LIGHTING,
		validCategories: [DeviceCategory.LIGHTING],
		channels: withProperties
			? [
					{
						identifier: 'light',
						mappingName: 'light',
						mappingSource: 'builtin',
						category: ChannelCategory.LIGHT,
						name: 'Light',
						properties: [
							{
								capabilityId: 'onoff',
								capabilityBaseId: 'onoff',
								mappingName: 'light-power',
								mappingSource: 'builtin',
								category: PropertyCategory.ON,
								dataType: DataTypeType.BOOL,
								direction: 'bidirectional',
								permissions: [PermissionType.READ_WRITE],
								readable: true,
								writable: true,
								unit: null,
								range: null,
								sourceRange: null,
								enumValues: [],
								panelEnumValues: [],
								currentValue: false,
								valueAvailable: true,
								capabilityAvailable: true,
								conversion: {},
							},
							{
								capabilityId: 'onoff',
								capabilityBaseId: 'onoff',
								mappingName: 'light-state-label',
								mappingSource: 'builtin',
								category: PropertyCategory.STATE,
								dataType: DataTypeType.STRING,
								direction: 'read_only',
								permissions: [PermissionType.READ_ONLY],
								readable: true,
								writable: false,
								unit: null,
								range: null,
								sourceRange: null,
								enumValues: [],
								panelEnumValues: [],
								currentValue: 'off',
								valueAvailable: true,
								capabilityAvailable: true,
								conversion: {},
							},
							{
								capabilityId: 'dim',
								capabilityBaseId: 'dim',
								mappingName: 'light-brightness',
								mappingSource: 'builtin',
								category: PropertyCategory.BRIGHTNESS,
								dataType: DataTypeType.UCHAR,
								direction: 'bidirectional',
								permissions: [PermissionType.READ_WRITE],
								readable: true,
								writable: true,
								unit: '%',
								range: { minimum: 0, maximum: 100, step: 1 },
								sourceRange: { minimum: 0, maximum: 1, step: 0.01 },
								enumValues: [],
								panelEnumValues: [],
								currentValue: 0,
								valueAvailable: true,
								capabilityAvailable: true,
								conversion: {},
							},
						],
					},
				]
			: [],
		unsupportedCapabilityIds: [],
		warnings: [],
		readyToAdopt: true,
	});

const existingDevice = (deviceId = 'homey-light'): HomeyDeviceEntity =>
	Object.assign(new HomeyDeviceEntity(), {
		id: 'f331d5d9-52b5-40fa-8312-ae08260065ea',
		identifier: deviceId,
		name: 'Living light',
		category: DeviceCategory.LIGHTING,
	});

describe('HomeyDeviceAdoptionService', () => {
	let mappingPreviewService: jest.Mocked<Pick<HomeyMappingPreviewService, 'generatePreview'>>;
	let devicesService: jest.Mocked<Pick<DevicesService, 'findOneBy' | 'create' | 'update'>>;
	let channelsService: jest.Mocked<Pick<ChannelsService, 'findAll' | 'findOneBy' | 'create' | 'update' | 'remove'>>;
	let propertiesService: jest.Mocked<
		Pick<ChannelsPropertiesService, 'findAll' | 'findOne' | 'findOneBy' | 'create' | 'update' | 'remove'>
	>;
	let propertyValueService: jest.Mocked<Pick<PropertyValueService, 'readLatest' | 'write' | 'delete'>>;
	let adoptionLock: Pick<HomeyAdoptionLockService, 'runExclusive'>;
	let service: HomeyDeviceAdoptionService;

	beforeEach(() => {
		mappingPreviewService = { generatePreview: jest.fn().mockResolvedValue(preview()) };
		devicesService = {
			findOneBy: jest.fn().mockResolvedValue(null),
			create: jest.fn().mockResolvedValue(existingDevice()),
			update: jest.fn(),
		};
		channelsService = {
			findAll: jest.fn().mockResolvedValue([]),
			findOneBy: jest.fn().mockResolvedValue(null),
			create: jest.fn(),
			update: jest.fn(),
			remove: jest.fn(),
		};
		propertiesService = {
			findAll: jest.fn().mockResolvedValue([]),
			findOne: jest.fn(),
			findOneBy: jest.fn().mockResolvedValue(null),
			create: jest.fn(),
			update: jest.fn(),
			remove: jest.fn(),
		};
		propertyValueService = {
			readLatest: jest.fn().mockResolvedValue(null),
			write: jest.fn().mockResolvedValue(true),
			delete: jest.fn(),
		};
		const structureLock = {
			runExclusive: jest.fn((operation: () => Promise<unknown>) => operation()),
		};
		adoptionLock = {
			runExclusive: <T>(_deviceIdentifier: string, operation: () => Promise<T>): Promise<T> => operation(),
		};

		service = new HomeyDeviceAdoptionService(
			mappingPreviewService as unknown as HomeyMappingPreviewService,
			devicesService as unknown as DevicesService,
			channelsService as unknown as ChannelsService,
			propertiesService as unknown as ChannelsPropertiesService,
			propertyValueService as unknown as PropertyValueService,
			structureLock as unknown as DeviceStructureLockService,
			adoptionLock as unknown as HomeyAdoptionLockService,
		);
	});

	it('creates the full hierarchy with authoritative capability identity and falsy initial values', async () => {
		const result = await service.adoptOne(selection());

		expect(result).toMatchObject({ status: HomeyAdoptionStatus.CREATED, panelDeviceId: existingDevice().id });
		expect(mappingPreviewService.generatePreview).toHaveBeenCalledWith({
			deviceId: 'homey-light',
			deviceCategory: undefined,
		});
		expect(devicesService.findOneBy).toHaveBeenCalledWith('identifier', 'homey-light', DEVICES_HOMEY_TYPE);

		const createDto = devicesService.create.mock.calls[0][0] as unknown as {
			channels: Array<{ properties: Array<Record<string, unknown>> }>;
		};
		const properties = createDto.channels[0].properties;
		expect(properties).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					identifier: 'onoff::light-power',
					homeyCapabilityId: 'onoff',
					homeyMappingName: 'light-power',
					value: false,
				}),
				expect.objectContaining({
					identifier: 'onoff::light-state-label',
					homeyCapabilityId: 'onoff',
					homeyMappingName: 'light-state-label',
					format: null,
				}),
				expect.objectContaining({
					identifier: 'dim::light-brightness',
					homeyCapabilityId: 'dim',
					homeyMappingName: 'light-brightness',
					format: [0, 100],
					value: 0,
				}),
			]),
		);
		expect(properties).toHaveLength(3);
	});

	it('holds the database-backed claim from the fresh preview through persistence', async () => {
		let claimHeld = false;
		adoptionLock.runExclusive = async <T>(_deviceIdentifier: string, operation: () => Promise<T>): Promise<T> => {
			claimHeld = true;

			try {
				return await operation();
			} finally {
				claimHeld = false;
			}
		};
		mappingPreviewService.generatePreview.mockImplementation(() => {
			expect(claimHeld).toBe(true);

			return Promise.resolve(preview());
		});
		devicesService.create.mockImplementation(() => {
			expect(claimHeld).toBe(true);

			return Promise.resolve(existingDevice());
		});

		await expect(service.adoptOne(selection())).resolves.toMatchObject({ status: HomeyAdoptionStatus.CREATED });
		expect(claimHeld).toBe(false);
	});

	it('persists the transformed panel enum domain instead of Homey enum identifiers', async () => {
		const commandProperty = {
			...preview().channels[0].properties[0],
			capabilityId: 'windowcoverings_state',
			capabilityBaseId: 'windowcoverings_state',
			mappingName: 'window-covering-command',
			category: PropertyCategory.COMMAND,
			dataType: DataTypeType.ENUM,
			direction: 'write_only' as const,
			permissions: [PermissionType.WRITE_ONLY],
			readable: false,
			writable: true,
			enumValues: ['up', 'down', 'idle'],
			panelEnumValues: ['open', 'close', 'stop'],
			currentValue: null,
			valueAvailable: false,
		};
		mappingPreviewService.generatePreview.mockResolvedValueOnce(
			Object.assign(preview(), {
				channels: [
					{
						...preview().channels[0],
						identifier: 'window-covering',
						category: ChannelCategory.WINDOW_COVERING,
						properties: [commandProperty],
					},
				],
			}),
		);

		await service.adoptOne(selection());

		const createDto = devicesService.create.mock.calls[0][0] as unknown as {
			channels: Array<{ properties: Array<{ format: string[] }> }>;
		};
		expect(createDto.channels[0].properties[0].format).toStrictEqual(['open', 'close', 'stop']);
	});

	it.each([
		[{ minimum: 0, maximum: null, step: 0.001 }, [0, null]],
		[{ minimum: null, maximum: 100, step: 1 }, [null, 100]],
	] as const)('persists one-sided mapping bounds as nullable endpoint pairs', async (range, expectedFormat) => {
		const boundedProperty = {
			...preview().channels[0].properties[2],
			range: { ...range },
		};
		mappingPreviewService.generatePreview.mockResolvedValueOnce(
			Object.assign(preview(), {
				channels: [{ ...preview().channels[0], properties: [boundedProperty] }],
			}),
		);

		await service.adoptOne(selection());

		const createDto = devicesService.create.mock.calls[0][0] as unknown as {
			channels: Array<{ properties: Array<{ format: Array<number | null> }> }>;
		};
		expect(createDto.channels[0].properties[0].format).toStrictEqual(expectedFormat);
	});

	it('fails closed when a fresh preview is stale, unsupported, or missing', async () => {
		mappingPreviewService.generatePreview.mockResolvedValueOnce(Object.assign(preview(), { readyToAdopt: false }));

		await expect(service.adoptOne(selection())).resolves.toMatchObject({
			status: HomeyAdoptionStatus.FAILED,
			failureCode: HomeyAdoptionFailureCode.UNSUPPORTED_MAPPING,
		});
		expect(devicesService.findOneBy).not.toHaveBeenCalled();

		mappingPreviewService.generatePreview.mockRejectedValueOnce(new HomeyMappingPreviewDeviceNotFoundError());
		await expect(service.adoptOne(selection('missing'))).resolves.toMatchObject({
			status: HomeyAdoptionStatus.FAILED,
			failureCode: HomeyAdoptionFailureCode.DEVICE_NOT_FOUND,
			message: 'The selected Homey device no longer exists',
		});
	});

	it('isolates batch failures and preserves request order', async () => {
		mappingPreviewService.generatePreview
			.mockResolvedValueOnce(preview('first'))
			.mockRejectedValueOnce(new HomeyMappingPreviewDeviceNotFoundError())
			.mockResolvedValueOnce(preview('third'));
		devicesService.create.mockResolvedValueOnce(existingDevice('first')).mockResolvedValueOnce(existingDevice('third'));

		const results = await service.adoptBatch([selection('first'), selection('missing'), selection('third')]);

		expect(results.map(({ deviceId, status }) => ({ deviceId, status }))).toEqual([
			{ deviceId: 'first', status: HomeyAdoptionStatus.CREATED },
			{ deviceId: 'missing', status: HomeyAdoptionStatus.FAILED },
			{ deviceId: 'third', status: HomeyAdoptionStatus.CREATED },
		]);
	});

	it('sanitizes failures that occur before a persistence journal can be created', async () => {
		devicesService.findOneBy.mockRejectedValueOnce(new Error('sqlite path and raw statement'));

		const result = await service.adoptOne(selection());

		expect(result).toMatchObject({
			status: HomeyAdoptionStatus.FAILED,
			failureCode: HomeyAdoptionFailureCode.PERSISTENCE_FAILED,
			message: 'The Homey device could not be adopted',
		});
		expect(JSON.stringify(result)).not.toContain('sqlite path and raw statement');
	});

	it('serializes duplicate concurrent requests and skips the second mutation', async () => {
		let stored: HomeyDeviceEntity | null = null;
		mappingPreviewService.generatePreview.mockResolvedValue(preview('same', false));
		devicesService.findOneBy.mockImplementation(() => Promise.resolve(stored));
		devicesService.create.mockImplementation(() => {
			stored = existingDevice('same');
			return Promise.resolve(stored);
		});

		const results = await Promise.all([service.adoptOne(selection('same')), service.adoptOne(selection('same'))]);

		expect(results.map((result) => result.status)).toEqual([HomeyAdoptionStatus.CREATED, HomeyAdoptionStatus.SKIPPED]);
		expect(devicesService.create).toHaveBeenCalledTimes(1);
		expect(mappingPreviewService.generatePreview).toHaveBeenCalledTimes(2);
	});

	it('waits for a concurrent winning create to finish its expected hierarchy before reconciliation', async () => {
		const desiredPreview = Object.assign(preview(), {
			channels: [{ ...preview().channels[0], properties: [preview().channels[0].properties[0]] }],
		});
		const incomplete = Object.assign(existingDevice(), { channels: [] });
		const channel = Object.assign(new HomeyChannelEntity(), {
			id: '8421af4e-84f9-4822-bac6-3dbe49ac4893',
			identifier: 'light',
			name: 'Light',
			category: ChannelCategory.LIGHT,
		});
		const property = Object.assign(new HomeyChannelPropertyEntity(), {
			id: 'dba32214-aa13-4134-9578-2093351507f8',
			identifier: 'onoff::light-power',
			homeyCapabilityId: 'onoff',
			homeyMappingName: 'light-power',
			name: 'Light power',
			category: PropertyCategory.ON,
			permissions: [PermissionType.READ_WRITE],
			dataType: DataTypeType.BOOL,
			format: null,
			invalid: null,
			step: null,
		});
		channel.properties = [property];
		const complete = Object.assign(existingDevice(), { channels: [channel] });
		const current = Object.assign(new PropertyValueState(), {
			value: false,
			lastUpdated: new Date().toISOString(),
		});

		mappingPreviewService.generatePreview.mockResolvedValueOnce(desiredPreview);
		devicesService.findOneBy
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(incomplete)
			.mockResolvedValueOnce(complete)
			.mockResolvedValueOnce(complete);
		devicesService.create.mockRejectedValueOnce(new Error('provider identity already exists'));
		channelsService.findAll.mockResolvedValue([channel]);
		channelsService.findOneBy.mockResolvedValue(channel);
		propertiesService.findAll.mockResolvedValue([property]);
		propertiesService.findOneBy.mockResolvedValue(property);
		propertiesService.update.mockResolvedValue(property);
		propertyValueService.readLatest
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(current)
			.mockResolvedValueOnce(current);

		await expect(service.adoptOne(selection())).resolves.toMatchObject({
			status: HomeyAdoptionStatus.SKIPPED,
			panelDeviceId: complete.id,
		});
		expect(devicesService.findOneBy).toHaveBeenCalledTimes(4);
		expect(propertyValueService.readLatest).toHaveBeenCalledTimes(3);
		expect(devicesService.findOneBy.mock.invocationCallOrder[3]).toBeLessThan(
			channelsService.findOneBy.mock.invocationCallOrder[0],
		);
		expect(channelsService.create).not.toHaveBeenCalled();
		expect(propertiesService.update).not.toHaveBeenCalled();
	});

	it('preserves the provider connectivity channel during mapping reconciliation', async () => {
		const device = existingDevice();
		const deviceInformation = Object.assign(new HomeyChannelEntity(), {
			id: 'cc20e6ff-a0e9-403c-bd19-835a9d1af267',
			identifier: 'device_information',
			name: 'Device information',
			category: ChannelCategory.DEVICE_INFORMATION,
		});

		mappingPreviewService.generatePreview.mockResolvedValueOnce(preview('homey-light', false));
		devicesService.findOneBy.mockResolvedValue(device);
		channelsService.findAll.mockResolvedValue([deviceInformation]);

		await expect(service.adoptOne(selection())).resolves.toMatchObject({
			status: HomeyAdoptionStatus.SKIPPED,
			panelDeviceId: device.id,
		});
		expect(channelsService.remove).not.toHaveBeenCalled();
	});

	it('uses parent and provider scoped lookups and applies current values through the property service path', async () => {
		const device = existingDevice();
		const channel = Object.assign(new HomeyChannelEntity(), {
			id: '8421af4e-84f9-4822-bac6-3dbe49ac4893',
			identifier: 'light',
			name: 'Light',
			category: ChannelCategory.LIGHT,
		});
		const property = Object.assign(new HomeyChannelPropertyEntity(), {
			id: 'dba32214-aa13-4134-9578-2093351507f8',
			identifier: 'onoff::light-power',
			homeyCapabilityId: 'onoff',
			homeyMappingName: 'light-power',
			name: 'Light power',
			category: PropertyCategory.ON,
			permissions: [PermissionType.READ_WRITE],
			dataType: DataTypeType.BOOL,
			format: null,
			invalid: null,
			step: null,
		});
		const current = Object.assign(new PropertyValueState(), { value: true, lastUpdated: new Date().toISOString() });

		mappingPreviewService.generatePreview.mockResolvedValueOnce(
			Object.assign(preview(), { channels: [preview().channels[0]] }),
		);
		devicesService.findOneBy.mockResolvedValue(device);
		channelsService.findAll.mockResolvedValue([channel]);
		channelsService.findOneBy.mockResolvedValue(channel);
		propertiesService.findAll.mockResolvedValue([property]);
		propertiesService.findOneBy.mockResolvedValueOnce(property).mockResolvedValueOnce(null);
		propertyValueService.readLatest.mockResolvedValue(current);
		propertiesService.create.mockImplementation((_channelId, dto) => {
			const homeyDto = dto as CreateHomeyDeviceChannelPropertyDto;
			const created = new HomeyChannelPropertyEntity();
			created.id = 'c6a0a056-5061-4091-a831-944118216f51';
			created.identifier = homeyDto.identifier ?? null;
			created.homeyCapabilityId = homeyDto.homeyCapabilityId;
			created.homeyMappingName = homeyDto.homeyMappingName;
			created.category = homeyDto.category;
			created.name = homeyDto.name ?? null;
			created.permissions = homeyDto.permissions;
			created.dataType = homeyDto.data_type;
			created.format = homeyDto.format ?? null;
			created.invalid = homeyDto.invalid ?? null;
			created.step = homeyDto.step ?? null;

			return Promise.resolve(created);
		});

		const result = await service.adoptOne(selection());

		expect(result).toMatchObject({ status: HomeyAdoptionStatus.UPDATED, failureCode: null });
		expect(channelsService.findOneBy).toHaveBeenCalledWith('identifier', 'light', device.id, DEVICES_HOMEY_TYPE);
		expect(propertiesService.findOneBy).toHaveBeenCalledWith(
			'identifier',
			'onoff::light-power',
			channel.id,
			DEVICES_HOMEY_TYPE,
		);
		expect(propertiesService.update).toHaveBeenCalledWith(
			property.id,
			expect.objectContaining({ value: false, type: DEVICES_HOMEY_TYPE }),
			{ strictValuePersistence: true },
		);
	});

	it('keeps append-only value writes terminal when a later property write fails', async () => {
		const device = existingDevice();
		const channel = Object.assign(new HomeyChannelEntity(), {
			id: '8421af4e-84f9-4822-bac6-3dbe49ac4893',
			identifier: 'light',
			name: 'Light',
			category: ChannelCategory.LIGHT,
		});
		const powerProperty = Object.assign(new HomeyChannelPropertyEntity(), {
			id: 'dba32214-aa13-4134-9578-2093351507f8',
			identifier: 'onoff::light-power',
			homeyCapabilityId: 'onoff',
			homeyMappingName: 'light-power',
			name: 'Light power',
			category: PropertyCategory.ON,
			permissions: [PermissionType.READ_WRITE],
			dataType: DataTypeType.BOOL,
			format: null,
			invalid: null,
			step: null,
		});
		const stateProperty = Object.assign(new HomeyChannelPropertyEntity(), {
			id: '91e4c7aa-eb5a-4f7b-bf62-ef9481f8565e',
			identifier: 'onoff::light-state-label',
			homeyCapabilityId: 'onoff',
			homeyMappingName: 'light-state-label',
			name: 'Light state label',
			category: PropertyCategory.STATE,
			permissions: [PermissionType.READ_ONLY],
			dataType: DataTypeType.STRING,
			format: null,
			invalid: null,
			step: null,
		});

		mappingPreviewService.generatePreview.mockResolvedValueOnce(
			Object.assign(preview(), {
				channels: [{ ...preview().channels[0], properties: preview().channels[0].properties.slice(0, 2) }],
			}),
		);
		devicesService.findOneBy.mockResolvedValue(device);
		channelsService.findAll.mockResolvedValue([channel]);
		channelsService.findOneBy.mockResolvedValue(channel);
		propertiesService.findAll.mockResolvedValue([powerProperty, stateProperty]);
		propertiesService.findOneBy.mockResolvedValueOnce(powerProperty).mockResolvedValueOnce(stateProperty);
		propertyValueService.readLatest.mockImplementation((property) =>
			Promise.resolve(
				Object.assign(new PropertyValueState(), {
					value: property.id === powerProperty.id ? true : 'on',
					lastUpdated: new Date().toISOString(),
				}),
			),
		);
		propertiesService.update
			.mockResolvedValueOnce(powerProperty)
			.mockRejectedValueOnce(new Error('second write failed'));

		await expect(service.adoptOne(selection())).resolves.toMatchObject({
			status: HomeyAdoptionStatus.UPDATED,
			failureCode: null,
		});
		expect(propertiesService.update).toHaveBeenNthCalledWith(
			1,
			powerProperty.id,
			{
				type: DEVICES_HOMEY_TYPE,
				value: false,
			},
			{ strictValuePersistence: true },
		);
		expect(propertiesService.update).toHaveBeenNthCalledWith(
			2,
			stateProperty.id,
			{
				type: DEVICES_HOMEY_TYPE,
				value: 'off',
			},
			{ strictValuePersistence: true },
		);
		expect(propertyValueService.write).not.toHaveBeenCalled();
		expect(propertyValueService.delete).not.toHaveBeenCalled();
	});

	it('updates changed categories in place and preserves history when a later mutation rolls back', async () => {
		const device = existingDevice();
		const channel = Object.assign(new HomeyChannelEntity(), {
			id: '8421af4e-84f9-4822-bac6-3dbe49ac4893',
			identifier: 'light',
			name: 'Light',
			category: ChannelCategory.LIGHT,
		});
		const property = Object.assign(new HomeyChannelPropertyEntity(), {
			id: 'dba32214-aa13-4134-9578-2093351507f8',
			identifier: 'onoff::light-power',
			homeyCapabilityId: 'onoff',
			homeyMappingName: 'light-power',
			name: 'Light power',
			category: PropertyCategory.STATE,
			permissions: [PermissionType.READ_WRITE],
			dataType: DataTypeType.BOOL,
			format: null,
			invalid: null,
			step: null,
		});
		const desiredProperty = { ...preview().channels[0].properties[0], valueAvailable: false, currentValue: null };
		const updatedProperty = Object.assign(new HomeyChannelPropertyEntity(), {
			...property,
			category: PropertyCategory.ON,
		});

		mappingPreviewService.generatePreview.mockResolvedValueOnce(
			Object.assign(preview(), {
				channels: [{ ...preview().channels[0], properties: [desiredProperty] }],
			}),
		);
		devicesService.findOneBy.mockResolvedValue(device);
		channelsService.findAll.mockResolvedValue([channel]);
		channelsService.findOneBy.mockResolvedValue(channel);
		propertiesService.findAll.mockResolvedValue([property]);
		propertiesService.findOneBy.mockResolvedValue(property);
		propertiesService.findOne.mockResolvedValue(updatedProperty);
		propertiesService.update.mockResolvedValue(updatedProperty);
		devicesService.update.mockRejectedValueOnce(new Error('later write failed'));

		await expect(service.adoptOne({ ...selection(), name: 'Renamed' })).resolves.toMatchObject({
			status: HomeyAdoptionStatus.FAILED,
			failureCode: HomeyAdoptionFailureCode.PERSISTENCE_FAILED,
		});
		expect(propertiesService.update).toHaveBeenNthCalledWith(
			1,
			property.id,
			expect.objectContaining({ category: PropertyCategory.ON }),
		);
		expect(propertiesService.update).toHaveBeenNthCalledWith(
			2,
			property.id,
			expect.objectContaining({ category: PropertyCategory.STATE }),
		);
		expect(propertiesService.remove).not.toHaveBeenCalled();
		expect(propertyValueService.delete).not.toHaveBeenCalled();
		expect(propertyValueService.write).not.toHaveBeenCalled();
	});

	it('restores explicit null Homey identity metadata when a later mutation rolls back', async () => {
		const device = existingDevice();
		const channel = Object.assign(new HomeyChannelEntity(), {
			id: '8421af4e-84f9-4822-bac6-3dbe49ac4893',
			identifier: 'light',
			name: 'Light',
			category: ChannelCategory.LIGHT,
		});
		const property = Object.assign(new HomeyChannelPropertyEntity(), {
			id: 'dba32214-aa13-4134-9578-2093351507f8',
			identifier: 'onoff::light-power',
			homeyCapabilityId: null,
			homeyMappingName: null,
			name: 'Light power',
			category: PropertyCategory.ON,
			permissions: [PermissionType.READ_WRITE],
			dataType: DataTypeType.BOOL,
			format: null,
			invalid: null,
			step: null,
		});
		const desiredProperty = { ...preview().channels[0].properties[0], valueAvailable: false, currentValue: null };
		const updatedProperty = Object.assign(new HomeyChannelPropertyEntity(), {
			...property,
			homeyCapabilityId: 'onoff',
			homeyMappingName: 'light-power',
		});

		mappingPreviewService.generatePreview.mockResolvedValueOnce(
			Object.assign(preview(), {
				channels: [{ ...preview().channels[0], properties: [desiredProperty] }],
			}),
		);
		devicesService.findOneBy.mockResolvedValue(device);
		channelsService.findAll.mockResolvedValue([channel]);
		channelsService.findOneBy.mockResolvedValue(channel);
		propertiesService.findAll.mockResolvedValue([property]);
		propertiesService.findOneBy.mockResolvedValue(property);
		propertiesService.findOne.mockResolvedValue(updatedProperty);
		propertiesService.update.mockResolvedValue(updatedProperty);
		devicesService.update.mockRejectedValueOnce(new Error('later write failed'));

		await expect(service.adoptOne({ ...selection(), name: 'Renamed' })).resolves.toMatchObject({
			status: HomeyAdoptionStatus.FAILED,
			failureCode: HomeyAdoptionFailureCode.PERSISTENCE_FAILED,
		});
		expect(propertiesService.update).toHaveBeenNthCalledWith(
			2,
			property.id,
			expect.objectContaining({ homeyCapabilityId: null, homeyMappingName: null }),
		);
	});

	it('defers stale property removal until later reversible mutations have succeeded', async () => {
		const device = existingDevice();
		const channel = Object.assign(new HomeyChannelEntity(), {
			id: '8421af4e-84f9-4822-bac6-3dbe49ac4893',
			identifier: 'light',
			name: 'Light',
			category: ChannelCategory.LIGHT,
		});
		const staleProperty = Object.assign(new HomeyChannelPropertyEntity(), {
			id: 'dba32214-aa13-4134-9578-2093351507f8',
			identifier: 'obsolete::mapping',
			homeyCapabilityId: 'obsolete',
			homeyMappingName: 'mapping',
			name: 'Obsolete',
			category: PropertyCategory.STATE,
			permissions: [PermissionType.READ_ONLY],
			dataType: DataTypeType.STRING,
			format: null,
			invalid: null,
			step: null,
		});

		mappingPreviewService.generatePreview.mockResolvedValueOnce(
			Object.assign(preview(), {
				channels: [{ ...preview().channels[0], properties: [] }],
			}),
		);
		devicesService.findOneBy.mockResolvedValue(device);
		channelsService.findAll.mockResolvedValue([channel]);
		channelsService.findOneBy.mockResolvedValue(channel);
		propertiesService.findAll.mockResolvedValue([staleProperty]);
		devicesService.update.mockRejectedValueOnce(new Error('later write failed'));

		await expect(service.adoptOne({ ...selection(), name: 'Renamed' })).resolves.toMatchObject({
			status: HomeyAdoptionStatus.FAILED,
			failureCode: HomeyAdoptionFailureCode.PERSISTENCE_FAILED,
		});
		expect(propertiesService.remove).not.toHaveBeenCalled();
		expect(propertyValueService.delete).not.toHaveBeenCalled();
	});

	it('removes newly created local structure when an existing-device reconciliation fails', async () => {
		const device = existingDevice();
		const createdChannel = Object.assign(new HomeyChannelEntity(), {
			id: '90c9cfb7-dc60-4e36-aa7e-7d77c3cbdf94',
			identifier: 'light',
			name: 'Light',
			category: ChannelCategory.LIGHT,
		});

		mappingPreviewService.generatePreview.mockResolvedValueOnce(
			Object.assign(preview(), {
				channels: [{ ...preview().channels[0], properties: [] }],
			}),
		);
		devicesService.findOneBy.mockResolvedValue(device);
		channelsService.create.mockResolvedValue(createdChannel);
		devicesService.update.mockRejectedValueOnce(new Error('raw database detail'));

		const result = await service.adoptOne({ ...selection(), name: 'Renamed' });

		expect(channelsService.remove).toHaveBeenCalledWith(createdChannel.id);
		expect(result).toMatchObject({
			status: HomeyAdoptionStatus.FAILED,
			failureCode: HomeyAdoptionFailureCode.PERSISTENCE_FAILED,
			message: 'The Homey device could not be adopted',
		});
		expect(JSON.stringify(result)).not.toContain('raw database detail');
	});

	it('reports a fixed cleanup result when rollback itself fails', async () => {
		const device = existingDevice();
		const createdChannel = Object.assign(new HomeyChannelEntity(), {
			id: '90c9cfb7-dc60-4e36-aa7e-7d77c3cbdf94',
			identifier: 'light',
			name: 'Light',
			category: ChannelCategory.LIGHT,
		});

		mappingPreviewService.generatePreview.mockResolvedValueOnce(
			Object.assign(preview(), {
				channels: [{ ...preview().channels[0], properties: [] }],
			}),
		);
		devicesService.findOneBy.mockResolvedValue(device);
		channelsService.create.mockResolvedValue(createdChannel);
		devicesService.update.mockRejectedValueOnce(new Error('write failed'));
		channelsService.remove.mockRejectedValueOnce(new Error('cleanup failed'));

		await expect(service.adoptOne({ ...selection(), name: 'Renamed' })).resolves.toMatchObject({
			status: HomeyAdoptionStatus.FAILED,
			failureCode: HomeyAdoptionFailureCode.ROLLBACK_FAILED,
			message: 'Homey adoption failed and requires local cleanup',
		});
	});
});
