import { useContainer, validate } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DeviceExistsConstraintValidator } from '../../../modules/devices/validators/device-exists-constraint.validator';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { VirtualValueOrigin } from '../entities/devices-virtual.entity';
import { VirtualDevicesService } from '../services/virtual-devices.service';
import { VirtualPropertyIndexService } from '../services/virtual-property-index.service';
import { CategoryAllowedConstraintValidator } from '../validators/category-allowed-constraint.validator';
import { SourceNotVirtualConstraintValidator } from '../validators/source-not-virtual-constraint.validator';

import { CreateVirtualChannelPropertyDto } from './create-channel-property.dto';
import { CreateVirtualChannelDto } from './create-channel.dto';
import { CreateVirtualDeviceChannelDto } from './create-device-channel.dto';
import { CreateVirtualDeviceDto } from './create-device.dto';

/**
 * Coverage for creating a virtual device together with its channels and linked properties in a single
 * POST — the atomic shape the API's nested create is supposed to support, and the one the plugin's
 * own listeners were written to serve (VirtualDeviceInformationListener's serialized initial status
 * and the `afterCreate` ownership claim both exist because CHANNEL_PROPERTY_CREATED fires for a
 * nested property *before* DEVICE_CREATED).
 *
 * It did not work. `@Type` metadata is inherited, so CreateVirtualDeviceDto.channels built its
 * children as the generic CreateDeviceChannelDto / CreateDeviceChannelPropertyDto, neither of which
 * declares `source_property` or `value_origin`. Both controller and service validate with
 * `whitelist: true` + `forbidNonWhitelisted: true`, so the request was rejected outright —
 * "property source_property should not exist" — long before ChannelsPropertiesTypeMapperService could
 * select CreateVirtualChannelPropertyDto for the insert.
 *
 * These tests run the real DTO classes through the real transformer and validator with the same
 * options the controller and DevicesService/ChannelsService use, so they fail against the inherited
 * `@Type` and pass against the redeclared one.
 */
describe('nested virtual device creation DTOs', () => {
	// The options both DevicesService.create() and the devices controller validate with. Repeated here
	// rather than relaxed, because `forbidNonWhitelisted` is the specific setting that turned an
	// undecorated field into a rejection instead of a silently ignored extra.
	const strict = { whitelist: true, forbidNonWhitelisted: true, stopAtFirstError: false } as const;

	const SOURCE_PROPERTY_ID = '550e8400-e29b-41d4-a716-446655440000';

	beforeAll(() => {
		// Every source_property resolves to a property on a physical device, so @ValidateSourceNotVirtual
		// passes and any error these tests see comes from the nesting under test.
		const physicalDevice = { id: 'physical-device-1', type: 'simulator' } as DeviceEntity;
		const channel = Object.assign(new ChannelEntity(), { id: 'source-channel', device: physicalDevice });

		const channelsPropertiesService = {
			findOne: jest
				.fn()
				.mockResolvedValue(Object.assign(new ChannelPropertyEntity(), { id: SOURCE_PROPERTY_ID, channel })),
		};
		const channelsService = { findOne: jest.fn().mockResolvedValue(channel) };
		const devicesService = { findOne: jest.fn().mockResolvedValue(physicalDevice) };

		const virtualDevicesService = new VirtualDevicesService(
			channelsPropertiesService as unknown as ChannelsPropertiesService,
			channelsService as unknown as ChannelsService,
			devicesService as unknown as DevicesService,
			undefined as unknown as VirtualPropertyIndexService,
		);

		const categoryAllowedValidator = new CategoryAllowedConstraintValidator(virtualDevicesService);
		const sourceNotVirtualValidator = new SourceNotVirtualConstraintValidator(virtualDevicesService);
		// CreateVirtualChannelDto inherits @ValidateDeviceExists on `device`; the standalone-channel case
		// below is the one that reaches it.
		const deviceExistsValidator = new DeviceExistsConstraintValidator(devicesService as unknown as DevicesService);

		// The same minimal stand-in for Nest's DI container the sibling DTO specs use.
		useContainer(
			{
				get: <T>(someClass: new () => T): T => {
					if (someClass === CategoryAllowedConstraintValidator) {
						return categoryAllowedValidator as T;
					}

					if (someClass === SourceNotVirtualConstraintValidator) {
						return sourceNotVirtualValidator as T;
					}

					if (someClass === DeviceExistsConstraintValidator) {
						return deviceExistsValidator as T;
					}

					return new someClass();
				},
			},
			{ fallbackOnErrors: true },
		);
	});

	const linkedProperty = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
		type: DEVICES_VIRTUAL_TYPE,
		category: PropertyCategory.ON,
		identifier: 'on',
		name: 'On',
		permissions: [PermissionType.READ_WRITE],
		data_type: DataTypeType.BOOL,
		source_property: SOURCE_PROPERTY_ID,
		...overrides,
	});

	const nestedChannel = (properties: Record<string, unknown>[]): Record<string, unknown> => ({
		type: DEVICES_VIRTUAL_TYPE,
		category: ChannelCategory.LIGHT,
		identifier: 'light',
		name: 'Light',
		properties,
	});

	const virtualDevice = (channels: Record<string, unknown>[]): Record<string, unknown> => ({
		type: DEVICES_VIRTUAL_TYPE,
		category: DeviceCategory.LIGHTING,
		name: 'Nested Virtual Light',
		channels,
	});

	// Flattens class-validator's nested error tree into "path -> constraint keys", which is what these
	// assertions are actually about: a bare `toHaveLength(0)` on the top-level array says nothing about
	// which nested field failed, and the failure mode under test is three levels down.
	const flatten = (
		errors: Awaited<ReturnType<typeof validate>>,
		path = '',
	): { path: string; constraints: string[] }[] =>
		errors.flatMap((error) => {
			const here = path ? `${path}.${error.property}` : error.property;

			return [
				...(error.constraints ? [{ path: here, constraints: Object.keys(error.constraints) }] : []),
				...flatten(error.children ?? [], here),
			];
		});

	const constraintsAt = (errors: Awaited<ReturnType<typeof validate>>, path: string): string[] =>
		flatten(errors).find((error) => error.path === path)?.constraints ?? [];

	// -- the transformer picks the virtual classes -------------------------------------------------

	it('builds nested channels and properties as the virtual DTO classes, not the generic ones', () => {
		const dto = toInstance(CreateVirtualDeviceDto, virtualDevice([nestedChannel([linkedProperty()])]), {
			excludeExtraneousValues: false,
		});

		expect(dto.channels?.[0]).toBeInstanceOf(CreateVirtualDeviceChannelDto);
		expect(dto.channels?.[0].properties?.[0]).toBeInstanceOf(CreateVirtualChannelPropertyDto);
	});

	// -- the rejection this whole change is about ---------------------------------------------------

	it('accepts a virtual device with a linked channel and property nested in one request', async () => {
		const dto = toInstance(CreateVirtualDeviceDto, virtualDevice([nestedChannel([linkedProperty()])]), {
			excludeExtraneousValues: false,
		});

		expect(flatten(await validate(dto, strict))).toEqual([]);
	});

	it('accepts a nested owned property declaring value_origin=local', async () => {
		const dto = toInstance(
			CreateVirtualDeviceDto,
			virtualDevice([
				nestedChannel([
					linkedProperty({
						value_origin: VirtualValueOrigin.LOCAL,
						source_property: undefined,
						permissions: [PermissionType.READ_ONLY],
					}),
				]),
			]),
			{ excludeExtraneousValues: false },
		);

		expect(flatten(await validate(dto, strict))).toEqual([]);
	});

	// ChannelsService.create() re-validates each nested channel against the *channel* type mapping's
	// DTO, with `properties` still attached — so this class is a second, independent gate on the same
	// request, and retyping only the device DTO would have moved the rejection rather than removed it.
	it('accepts a linked property nested under a standalone channel create', async () => {
		const dto = toInstance(
			CreateVirtualChannelDto,
			{ ...nestedChannel([linkedProperty()]), device: '550e8400-e29b-41d4-a716-446655440099' },
			{ excludeExtraneousValues: false },
		);

		expect(flatten(await validate(dto, strict))).toEqual([]);
	});

	// -- the plugin's own constraints still fire through the nesting --------------------------------
	//
	// Retyping must widen the schema to the virtual fields, not switch validation off: the pair
	// constraint and the enum check have to reach three levels down exactly as they do on a standalone
	// property POST.

	it('rejects a nested owned property that also names a source', async () => {
		const dto = toInstance(
			CreateVirtualDeviceDto,
			virtualDevice([nestedChannel([linkedProperty({ value_origin: VirtualValueOrigin.LOCAL })])]),
			{ excludeExtraneousValues: false },
		);

		expect(flatten(await validate(dto, strict))).toContainEqual({
			path: 'channels.0.properties.0.source_property',
			constraints: ['OwnedPropertyHasNoSource'],
		});
	});

	it('rejects a nested property with an unknown value_origin', async () => {
		const dto = toInstance(
			CreateVirtualDeviceDto,
			virtualDevice([nestedChannel([linkedProperty({ value_origin: 'somewhere-else' })])]),
			{ excludeExtraneousValues: false },
		);

		expect(flatten(await validate(dto, strict))).toContainEqual({
			path: 'channels.0.properties.0.value_origin',
			constraints: ['isEnum'],
		});
	});

	it('rejects a nested property whose source_property is not a uuid', async () => {
		const dto = toInstance(
			CreateVirtualDeviceDto,
			virtualDevice([nestedChannel([linkedProperty({ source_property: 'not-a-uuid' })])]),
			{ excludeExtraneousValues: false },
		);

		expect(flatten(await validate(dto, strict))).toContainEqual({
			path: 'channels.0.properties.0.source_property',
			constraints: ['isUuid'],
		});
	});

	// -- the inherited stack survived the redeclaration ---------------------------------------------
	//
	// class-validator REPLACES a redeclared property's decorators rather than merging them with the
	// parent's, and this has already bitten twice on this branch (CreateVirtualDeviceDto.category,
	// CreateVirtualChannelPropertyDto.source_property). `channels` and `properties` were redeclared
	// here purely to change `@Type`, so every neighbouring validator had to be copied across by hand —
	// these are what prove none was dropped.

	// `toContain` rather than an exact constraint list: a string also trips @ValidateNested's own
	// `nestedValidation`, and the fact under test is only that `isArray` is still among them.
	it('still rejects a non-array channels (inherited @IsArray was not dropped)', async () => {
		const dto = toInstance(
			CreateVirtualDeviceDto,
			{ ...virtualDevice([]), channels: 'not-an-array' },
			{ excludeExtraneousValues: false },
		);

		expect(constraintsAt(await validate(dto, strict), 'channels')).toContain('isArray');
	});

	it('still rejects a non-array nested properties (inherited @IsArray was not dropped)', async () => {
		const dto = toInstance(
			CreateVirtualDeviceDto,
			virtualDevice([{ ...nestedChannel([]), properties: 'not-an-array' }]),
			{ excludeExtraneousValues: false },
		);

		expect(constraintsAt(await validate(dto, strict), 'channels.0.properties')).toContain('isArray');
	});

	// @ValidateNested is the decorator whose loss would be silent and total: nested objects would stop
	// being validated at all rather than start failing, so an invalid child would pass. Asserted by
	// giving a nested channel a category the enum does not have.
	it('still validates nested channels themselves (inherited @ValidateNested was not dropped)', async () => {
		const dto = toInstance(
			CreateVirtualDeviceDto,
			virtualDevice([{ ...nestedChannel([]), category: 'not-a-real-category' }]),
			{ excludeExtraneousValues: false },
		);

		expect(flatten(await validate(dto, strict))).toContainEqual({
			path: 'channels.0.category',
			constraints: ['isEnum'],
		});
	});

	it('still validates nested properties themselves (inherited @ValidateNested was not dropped)', async () => {
		const dto = toInstance(
			CreateVirtualDeviceDto,
			virtualDevice([nestedChannel([linkedProperty({ data_type: 'not-a-real-data-type' })])]),
			{ excludeExtraneousValues: false },
		);

		expect(flatten(await validate(dto, strict))).toContainEqual({
			path: 'channels.0.properties.0.data_type',
			constraints: ['isEnum'],
		});
	});

	// @IsOptional and the null-to-undefined @Transform, the two remaining pieces of the copied stack.
	it.each([
		['omitted', {}],
		['null', { channels: null }],
	])(
		'still accepts a virtual device whose channels are %s (inherited @IsOptional/@Transform survived)',
		async (_label, overrides) => {
			const dto = toInstance(
				CreateVirtualDeviceDto,
				{ type: DEVICES_VIRTUAL_TYPE, category: DeviceCategory.LIGHTING, name: 'No Channels', ...overrides },
				{ excludeExtraneousValues: false },
			);

			expect(flatten(await validate(dto, strict))).toEqual([]);
		},
	);

	it.each([
		['omitted', {}],
		['null', { properties: null }],
	])(
		'still accepts a nested channel whose properties are %s (inherited @IsOptional/@Transform survived)',
		async (_label, overrides) => {
			const dto = toInstance(CreateVirtualDeviceDto, virtualDevice([{ ...nestedChannel([]), ...overrides }]), {
				excludeExtraneousValues: false,
			});

			expect(flatten(await validate(dto, strict))).toEqual([]);
		},
	);

	// The device DTO's own guards are unaffected by the redeclaration below them.
	it('still rejects a blocked device category alongside valid nested wiring', async () => {
		const dto = toInstance(
			CreateVirtualDeviceDto,
			{ ...virtualDevice([nestedChannel([linkedProperty()])]), category: DeviceCategory.HEATING_UNIT },
			{ excludeExtraneousValues: false },
		);

		expect(flatten(await validate(dto, strict))).toContainEqual({
			path: 'category',
			constraints: ['CategoryAllowed'],
		});
	});
});
