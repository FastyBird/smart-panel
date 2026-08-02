import { useContainer, validate } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';
import { PermissionType } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { VirtualValueOrigin } from '../entities/devices-virtual.entity';
import { VirtualDevicesService } from '../services/virtual-devices.service';
import { VirtualPropertyIndexService } from '../services/virtual-property-index.service';
import { SourceNotVirtualConstraintValidator } from '../validators/source-not-virtual-constraint.validator';

import { CreateVirtualChannelPropertyDto } from './create-channel-property.dto';
import { UpdateVirtualChannelPropertyDto } from './update-channel-property.dto';

/**
 * End-to-end coverage (real DTO classes, real class-validator, DI-resolved constraint — not mocks of
 * the wiring itself) that `@ValidateSourceNotVirtual()` actually fires on `source_property` for both
 * the create and update DTOs, and that it sits alongside — not instead of — the existing `@IsUUID`
 * check on the same field. This is the guard VirtualProjectionListener's termination argument and
 * VirtualDevicePlatform's own backstop check both assume exists; this test is what proves it does.
 */
describe('source_property field validation on CreateVirtualChannelPropertyDto / UpdateVirtualChannelPropertyDto', () => {
	let channelsPropertiesService: { findOne: jest.Mock };
	let channelsService: { findOne: jest.Mock };
	let devicesService: { findOne: jest.Mock };

	beforeAll(() => {
		channelsPropertiesService = { findOne: jest.fn() };
		channelsService = { findOne: jest.fn() };
		devicesService = { findOne: jest.fn() };

		const virtualDevicesService = new VirtualDevicesService(
			channelsPropertiesService as unknown as ChannelsPropertiesService,
			channelsService as unknown as ChannelsService,
			devicesService as unknown as DevicesService,
			undefined as unknown as VirtualPropertyIndexService,
		);
		const sourceNotVirtualValidator = new SourceNotVirtualConstraintValidator(virtualDevicesService);

		// Minimal stand-in for Nest's DI container (see main.ts's real `useContainer(app.select(...))`):
		// resolves the one constraint class exercised here to a real, working instance.
		useContainer(
			{
				get: <T>(someClass: new () => T): T =>
					(someClass === SourceNotVirtualConstraintValidator ? sourceNotVirtualValidator : new someClass()) as T,
			},
			{ fallbackOnErrors: true },
		);
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	const basePropertyFields = {
		type: DEVICES_VIRTUAL_TYPE,
		category: 'generic',
		permissions: ['ro'],
		data_type: 'string',
	};

	it('CreateVirtualChannelPropertyDto still rejects a malformed uuid (inherited @IsUUID was not dropped)', async () => {
		const dto = toInstance(CreateVirtualChannelPropertyDto, { ...basePropertyFields, source_property: 'not-a-uuid' });

		const errors = await validate(dto);

		expect(errors.some((error) => error.property === 'source_property' && !!error.constraints?.isUuid)).toBe(true);
	});

	it('CreateVirtualChannelPropertyDto rejects a source_property belonging to a virtual device', async () => {
		const virtualDevice = { id: 'virtual-device-1', type: DEVICES_VIRTUAL_TYPE } as DeviceEntity;
		const channel = Object.assign(new ChannelEntity(), { id: 'chan-1', device: virtualDevice });

		channelsPropertiesService.findOne.mockResolvedValue(
			Object.assign(new ChannelPropertyEntity(), { id: 'nested-source', channel }),
		);
		channelsService.findOne.mockResolvedValue(channel);
		devicesService.findOne.mockResolvedValue(virtualDevice);

		const dto = toInstance(CreateVirtualChannelPropertyDto, {
			...basePropertyFields,
			source_property: '550e8400-e29b-41d4-a716-446655440000',
		});

		const errors = await validate(dto);

		expect(errors.some((error) => error.property === 'source_property' && !!error.constraints?.SourceNotVirtual)).toBe(
			true,
		);
	});

	it('CreateVirtualChannelPropertyDto accepts a source_property belonging to a physical device', async () => {
		const physicalDevice = { id: 'physical-device-1', type: 'simulator' } as DeviceEntity;
		const channel = Object.assign(new ChannelEntity(), { id: 'chan-2', device: physicalDevice });

		channelsPropertiesService.findOne.mockResolvedValue(
			Object.assign(new ChannelPropertyEntity(), { id: 'phys-source', channel }),
		);
		channelsService.findOne.mockResolvedValue(channel);
		devicesService.findOne.mockResolvedValue(physicalDevice);

		const dto = toInstance(CreateVirtualChannelPropertyDto, {
			...basePropertyFields,
			source_property: '550e8400-e29b-41d4-a716-446655440001',
		});

		const errors = await validate(dto);

		expect(errors.filter((error) => error.property === 'source_property')).toHaveLength(0);
	});

	it('UpdateVirtualChannelPropertyDto rejects a source_property belonging to a virtual device', async () => {
		const virtualDevice = { id: 'virtual-device-2', type: DEVICES_VIRTUAL_TYPE } as DeviceEntity;
		const channel = Object.assign(new ChannelEntity(), { id: 'chan-3', device: virtualDevice });

		channelsPropertiesService.findOne.mockResolvedValue(
			Object.assign(new ChannelPropertyEntity(), { id: 'nested-source-2', channel }),
		);
		channelsService.findOne.mockResolvedValue(channel);
		devicesService.findOne.mockResolvedValue(virtualDevice);

		const dto = toInstance(UpdateVirtualChannelPropertyDto, {
			type: DEVICES_VIRTUAL_TYPE,
			source_property: '550e8400-e29b-41d4-a716-446655440002',
		});

		const errors = await validate(dto);

		expect(errors.some((error) => error.property === 'source_property' && !!error.constraints?.SourceNotVirtual)).toBe(
			true,
		);
	});

	it('UpdateVirtualChannelPropertyDto still allows omitting source_property entirely (inherited @IsOptional was not dropped)', async () => {
		const dto = toInstance(UpdateVirtualChannelPropertyDto, { type: DEVICES_VIRTUAL_TYPE });

		const errors = await validate(dto);

		expect(errors.filter((error) => error.property === 'source_property')).toHaveLength(0);
		expect(channelsPropertiesService.findOne).not.toHaveBeenCalled();
	});

	// -- value_origin / source_property must name a state the entity actually has ---------------
	//
	// VirtualChannelPropertyEntity models exactly three: linked (source + a source id), orphaned
	// (source + null) and owned (local + null). `local` plus a named source is the missing fourth row:
	// both fields validate independently, so the API used to accept it and produce a property that
	// neither mirrors nor forwards — VirtualValueSourceService resolves an owned property to its own
	// storage key and never reads the source, VirtualPropertyIndexService skips owned properties so
	// nothing projects into it, and VirtualDevicePlatform refuses to forward a write for a property
	// that is not in the index.

	// Resolves any source_property to a property on a physical device, so @ValidateSourceNotVirtual
	// passes and the only thing left that can reject the payload is the pair constraint.
	const withPhysicalSource = (): void => {
		const physicalDevice = { id: 'physical-device-pair', type: 'simulator' } as DeviceEntity;
		const channel = Object.assign(new ChannelEntity(), { id: 'chan-pair', device: physicalDevice });

		channelsPropertiesService.findOne.mockResolvedValue(
			Object.assign(new ChannelPropertyEntity(), { id: 'phys-source-pair', channel }),
		);
		channelsService.findOne.mockResolvedValue(channel);
		devicesService.findOne.mockResolvedValue(physicalDevice);
	};

	const ownedSourceError = (errors: { property: string; constraints?: Record<string, string> }[]): boolean =>
		errors.some((error) => error.property === 'source_property' && !!error.constraints?.OwnedPropertyHasNoSource);

	it('CreateVirtualChannelPropertyDto rejects value_origin=local together with a source_property', async () => {
		withPhysicalSource();

		const dto = toInstance(CreateVirtualChannelPropertyDto, {
			...basePropertyFields,
			value_origin: VirtualValueOrigin.LOCAL,
			source_property: '550e8400-e29b-41d4-a716-446655440010',
		});

		expect(ownedSourceError(await validate(dto))).toBe(true);
	});

	it('UpdateVirtualChannelPropertyDto rejects value_origin=local together with a source_property', async () => {
		withPhysicalSource();

		const dto = toInstance(UpdateVirtualChannelPropertyDto, {
			type: DEVICES_VIRTUAL_TYPE,
			value_origin: VirtualValueOrigin.LOCAL,
			source_property: '550e8400-e29b-41d4-a716-446655440011',
		});

		expect(ownedSourceError(await validate(dto))).toBe(true);
	});

	// The three legitimate states, one test each — the constraint must not narrow the schema beyond
	// the one combination that has no meaning.

	it('CreateVirtualChannelPropertyDto accepts an owned property with no source at all', async () => {
		const dto = toInstance(CreateVirtualChannelPropertyDto, {
			...basePropertyFields,
			value_origin: VirtualValueOrigin.LOCAL,
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	it('CreateVirtualChannelPropertyDto accepts an owned property whose source is explicitly null', async () => {
		const dto = toInstance(CreateVirtualChannelPropertyDto, {
			...basePropertyFields,
			value_origin: VirtualValueOrigin.LOCAL,
			source_property: null,
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	it('CreateVirtualChannelPropertyDto accepts a linked property that names its source explicitly', async () => {
		withPhysicalSource();

		const dto = toInstance(CreateVirtualChannelPropertyDto, {
			...basePropertyFields,
			value_origin: VirtualValueOrigin.SOURCE,
			source_property: '550e8400-e29b-41d4-a716-446655440012',
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	// An orphan — the state a property lands in when its source is deleted, and the one a remap starts
	// from. `source` with no source is legal and must stay legal.
	it('UpdateVirtualChannelPropertyDto accepts clearing the source of a projecting property', async () => {
		const dto = toInstance(UpdateVirtualChannelPropertyDto, {
			type: DEVICES_VIRTUAL_TYPE,
			value_origin: VirtualValueOrigin.SOURCE,
			source_property: null,
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	// -- the class-validator override trap ------------------------------------------------------
	//
	// class-validator *replaces* rather than merges the decorator stack for a redeclared
	// (propertyName, type) pair, and nearly every decorator registers under the type
	// `customValidation` — so adding one decorator to a property can silently delete the @IsUUID /
	// @IsEnum / @IsOptional already on it. These assert the neighbours of the new constraint survived
	// it, on both DTOs.

	it('CreateVirtualChannelPropertyDto still rejects a malformed uuid after the pair constraint was added', async () => {
		const dto = toInstance(CreateVirtualChannelPropertyDto, { ...basePropertyFields, source_property: 'not-a-uuid' });

		const errors = await validate(dto);

		expect(errors.some((error) => error.property === 'source_property' && !!error.constraints?.isUuid)).toBe(true);
	});

	it('UpdateVirtualChannelPropertyDto still rejects a malformed uuid after the pair constraint was added', async () => {
		const dto = toInstance(UpdateVirtualChannelPropertyDto, {
			type: DEVICES_VIRTUAL_TYPE,
			source_property: 'not-a-uuid',
		});

		const errors = await validate(dto);

		expect(errors.some((error) => error.property === 'source_property' && !!error.constraints?.isUuid)).toBe(true);
	});

	it.each([
		['CreateVirtualChannelPropertyDto', CreateVirtualChannelPropertyDto, basePropertyFields],
		['UpdateVirtualChannelPropertyDto', UpdateVirtualChannelPropertyDto, { type: DEVICES_VIRTUAL_TYPE }],
	])('%s still rejects an unknown value_origin', async (_name, DtoClass, baseFields) => {
		const dto = toInstance(DtoClass as new () => object, { ...baseFields, value_origin: 'somewhere-else' });

		const errors = await validate(dto);

		expect(errors.some((error) => error.property === 'value_origin' && !!error.constraints?.isEnum)).toBe(true);
	});

	// -- value_origin / permissions must name a property something can actually act on -----------
	//
	// An owned property stores its own value and forwards nothing, and VirtualDevicePlatform refuses
	// every LOCAL property outright — so a writable one is a control that can never move anything. It
	// is not merely inert: ChannelsPropertiesService.update() persists the optimistic value into the
	// property's own series before the controller's fire-and-forget dispatch is refused, so the switch
	// appears to move and nothing happens. v1 is wiring only (design spec, "v1 category boundary"), so
	// this restricts rather than implements; writable owned properties arrive with controller support.

	const ownedWritableError = (errors: { property: string; constraints?: Record<string, string> }[]): boolean =>
		errors.some((error) => error.property === 'permissions' && !!error.constraints?.OwnedPropertyNotWritable);

	it.each([[PermissionType.READ_WRITE], [PermissionType.WRITE_ONLY]])(
		'CreateVirtualChannelPropertyDto rejects an owned property permitting %s',
		async (permission) => {
			const dto = toInstance(CreateVirtualChannelPropertyDto, {
				...basePropertyFields,
				permissions: [permission],
				value_origin: VirtualValueOrigin.LOCAL,
			});

			expect(ownedWritableError(await validate(dto))).toBe(true);
		},
	);

	it('UpdateVirtualChannelPropertyDto rejects switching to local and writable in one payload', async () => {
		const dto = toInstance(UpdateVirtualChannelPropertyDto, {
			type: DEVICES_VIRTUAL_TYPE,
			permissions: [PermissionType.READ_WRITE],
			value_origin: VirtualValueOrigin.LOCAL,
		});

		expect(ownedWritableError(await validate(dto))).toBe(true);
	});

	// The states that must stay legal — the constraint may not narrow the schema past the one
	// combination that cannot work.

	it('CreateVirtualChannelPropertyDto accepts a read-only owned property — what the synthesis creates', async () => {
		const dto = toInstance(CreateVirtualChannelPropertyDto, {
			...basePropertyFields,
			permissions: [PermissionType.READ_ONLY],
			value_origin: VirtualValueOrigin.LOCAL,
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	// A writable projection is the plugin's core feature: the write is forwarded to the source.
	it('CreateVirtualChannelPropertyDto accepts a writable linked property', async () => {
		withPhysicalSource();

		const dto = toInstance(CreateVirtualChannelPropertyDto, {
			...basePropertyFields,
			permissions: [PermissionType.READ_WRITE],
			source_property: '550e8400-e29b-41d4-a716-446655440020',
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	// `value_origin` absent means the SOURCE column default, not LOCAL — reading it the other way
	// would reject every writable linked property created without stating its origin.
	it('CreateVirtualChannelPropertyDto accepts writable permissions when value_origin is omitted', async () => {
		const dto = toInstance(CreateVirtualChannelPropertyDto, {
			...basePropertyFields,
			permissions: [PermissionType.READ_WRITE],
		});

		expect(await validate(dto)).toHaveLength(0);
	});

	// -- the class-validator override trap, on `permissions` this time ---------------------------
	//
	// `permissions` is redeclared on both DTOs to carry the new constraint, and class-validator
	// replaces rather than merges a redeclared property's stack — so the inherited checks have to be
	// asserted, not assumed. @IsOptional in particular is dropped from a redeclared property whatever
	// the child declares.

	it.each([
		['CreateVirtualChannelPropertyDto', CreateVirtualChannelPropertyDto, basePropertyFields],
		['UpdateVirtualChannelPropertyDto', UpdateVirtualChannelPropertyDto, { type: DEVICES_VIRTUAL_TYPE }],
	])('%s still rejects an empty permissions array', async (_name, DtoClass, baseFields) => {
		const dto = toInstance(DtoClass as new () => object, { ...baseFields, permissions: [] });

		const errors = await validate(dto);

		expect(errors.some((error) => error.property === 'permissions' && !!error.constraints?.arrayNotEmpty)).toBe(true);
	});

	it.each([
		['CreateVirtualChannelPropertyDto', CreateVirtualChannelPropertyDto, basePropertyFields],
		['UpdateVirtualChannelPropertyDto', UpdateVirtualChannelPropertyDto, { type: DEVICES_VIRTUAL_TYPE }],
	])('%s still rejects an unknown permission', async (_name, DtoClass, baseFields) => {
		const dto = toInstance(DtoClass as new () => object, { ...baseFields, permissions: ['sideways'] });

		const errors = await validate(dto);

		expect(errors.some((error) => error.property === 'permissions' && !!error.constraints?.isEnum)).toBe(true);
	});

	// The inherited @IsOptional the update DTO cannot lose: a PATCH that renames a property must not
	// be forced to restate its permissions.
	it('UpdateVirtualChannelPropertyDto still allows omitting permissions entirely', async () => {
		const dto = toInstance(UpdateVirtualChannelPropertyDto, { type: DEVICES_VIRTUAL_TYPE, name: 'Renamed' });

		expect((await validate(dto)).filter((error) => error.property === 'permissions')).toHaveLength(0);
	});

	// The create DTO's `permissions` is required, and redeclaring it must not have made it optional.
	it('CreateVirtualChannelPropertyDto still requires permissions', async () => {
		const withoutPermissions = { ...basePropertyFields, permissions: undefined };

		const dto = toInstance(CreateVirtualChannelPropertyDto, withoutPermissions);

		expect((await validate(dto)).some((error) => error.property === 'permissions')).toBe(true);
	});
});
