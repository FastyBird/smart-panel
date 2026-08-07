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
import { DEVICES_VIRTUAL_TYPE, VIRTUAL_BLOCKED_CATEGORIES } from '../devices-virtual.constants';
import {
	VirtualCategoryNotSupportedException,
	VirtualNestingNotAllowedException,
	VirtualOwnedPropertyNotWritableException,
	VirtualOwnerNotVirtualException,
	VirtualSourceNotFoundException,
	VirtualValueOriginConflictException,
} from '../devices-virtual.exceptions';
import { VirtualChannelPropertyEntity, VirtualValueOrigin } from '../entities/devices-virtual.entity';

import { VirtualDevicesService } from './virtual-devices.service';
import { VirtualPropertyIndexService, VirtualPropertyLink } from './virtual-property-index.service';

describe('VirtualDevicesService', () => {
	let service: VirtualDevicesService;
	let channelsPropertiesService: { findOne: jest.Mock };
	let channelsService: { findOne: jest.Mock };
	let devicesService: { findOne: jest.Mock };
	let index: { loadLinksByVirtualDevice: jest.Mock; findLinksByVirtualDevice: jest.Mock };

	// -- fixtures --------------------------------------------------------------------------------

	const property = (overrides: Partial<ChannelPropertyEntity> = {}): ChannelPropertyEntity => {
		const entity = new ChannelPropertyEntity();

		Object.assign(entity, { id: 'source-prop', permissions: [PermissionType.READ_ONLY] }, overrides);

		return entity;
	};

	const readOnlySource = property({ id: 'ro-source', permissions: [PermissionType.READ_ONLY] });
	const readWriteSource = property({ id: 'rw-source', permissions: [PermissionType.READ_WRITE] });

	// reportCompatibility also judges data type, which the assertPermissionsCompatible fixtures above
	// never set (that suite only exercises permissions) — so reportCompatibility gets its own fixtures,
	// with a dataType meaningful against the spec slots the pinned tests target below.
	const readOnlySourceProperty = property({
		id: 'ro-source-property',
		permissions: [PermissionType.READ_ONLY],
		dataType: DataTypeType.BOOL,
	});
	// Carries a format, as a persisted row does: a constrained slot now refuses a source that cannot be
	// shown to stay inside it, and `temperature.temperature` is constrained to [0, 100].
	const readWriteSourceProperty = property({
		id: 'rw-source-property',
		permissions: [PermissionType.READ_WRITE],
		dataType: DataTypeType.FLOAT,
		format: [0, 100],
	});
	const floatSourceProperty = property({
		id: 'float-source-property',
		permissions: [PermissionType.READ_WRITE],
		dataType: DataTypeType.FLOAT,
	});

	// A link exactly as VirtualPropertyIndexService records one: plain ids, never a hydrated entity.
	const linkedTo = (id: string, deviceId: string): VirtualPropertyLink => ({
		propertyId: id,
		sourcePropertyId: `${id}-source`,
		sourceDeviceId: deviceId,
	});

	beforeEach(() => {
		channelsPropertiesService = { findOne: jest.fn() };
		channelsService = { findOne: jest.fn() };
		devicesService = { findOne: jest.fn() };
		index = {
			loadLinksByVirtualDevice: jest.fn().mockResolvedValue([]),
			findLinksByVirtualDevice: jest.fn().mockReturnValue([]),
		};

		service = new VirtualDevicesService(
			channelsPropertiesService as unknown as ChannelsPropertiesService,
			channelsService as unknown as ChannelsService,
			devicesService as unknown as DevicesService,
			index as unknown as VirtualPropertyIndexService,
		);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	// -- pinned brief cases ------------------------------------------------------------------------

	describe('assertCategoryAllowed', () => {
		it('rejects a category that needs closed-loop control', () => {
			expect(() => service.assertCategoryAllowed(DeviceCategory.HEATING_UNIT)).toThrow(
				VirtualCategoryNotSupportedException,
			);
		});

		it('accepts a category that only needs wiring', () => {
			expect(() => service.assertCategoryAllowed(DeviceCategory.LIGHTING)).not.toThrow();
		});

		it('rejects every category in VIRTUAL_BLOCKED_CATEGORIES', () => {
			expect(VIRTUAL_BLOCKED_CATEGORIES.length).toBeGreaterThan(0);

			for (const category of VIRTUAL_BLOCKED_CATEGORIES) {
				expect(() => service.assertCategoryAllowed(category)).toThrow(VirtualCategoryNotSupportedException);
			}
		});
	});

	describe('assertSourceNotVirtual', () => {
		it('rejects a source property that belongs to another virtual device', async () => {
			channelsPropertiesService.findOne.mockResolvedValue(property({ id: 'virtual-source', channel: 'chan-1' }));
			channelsService.findOne.mockResolvedValue(Object.assign(new ChannelEntity(), { id: 'chan-1', device: 'dev-1' }));
			// `type` is a getter-only property on the base entity (each @ChildEntity overrides it), so a
			// fixture that needs a custom value casts a plain object rather than mutating `new DeviceEntity()`.
			devicesService.findOne.mockResolvedValue({ id: 'dev-1', type: DEVICES_VIRTUAL_TYPE } as DeviceEntity);

			await expect(service.assertSourceNotVirtual('virtual-source')).rejects.toThrow(VirtualNestingNotAllowedException);
		});
	});

	describe('assertPermissionsCompatible', () => {
		it('rejects a read-only source for a writable spec slot', () => {
			expect(() => service.assertPermissionsCompatible([PermissionType.READ_WRITE], readOnlySource)).toThrow();
		});

		it('accepts a read-write source for a read-only spec slot', () => {
			expect(() => service.assertPermissionsCompatible([PermissionType.READ_ONLY], readWriteSource)).not.toThrow();
		});
	});

	describe('reportCompatibility', () => {
		// category is real, not filler: lighting genuinely offers a light channel and sensor genuinely
		// offers a temperature channel (spec/devices.ts), so these pin the permission/data-type outcomes
		// without also tripping the category/channel guard below.
		it('reports a read-only source as incompatible with a writable slot', () => {
			const report = service.reportCompatibility(
				{ category: DeviceCategory.LIGHTING, channel: ChannelCategory.LIGHT, property: PropertyCategory.ON },
				readOnlySourceProperty,
			);

			expect(report.compatible).toBe(false);
			expect(report.reason).toContain('permission');
		});

		it('reports a read-write source as compatible with a read-only slot', () => {
			const report = service.reportCompatibility(
				{
					category: DeviceCategory.SENSOR,
					channel: ChannelCategory.TEMPERATURE,
					property: PropertyCategory.TEMPERATURE,
				},
				readWriteSourceProperty,
			);

			expect(report.compatible).toBe(true);
		});

		it('reports a data-type mismatch as incompatible', () => {
			const report = service.reportCompatibility(
				{ category: DeviceCategory.LIGHTING, channel: ChannelCategory.LIGHT, property: PropertyCategory.ON },
				floatSourceProperty,
			);

			expect(report.compatible).toBe(false);
			expect(report.reason).toContain('data type');
		});

		// The gap a coordinator review caught: category was accepted and never consulted, so a channel
		// that is real but simply not part of *this* device category's spec looked identical to one that
		// is. lock's spec (spec/devices.ts) has no light channel at all. The source is rw/bool —
		// permission- and data-type-compatible with light.on in every other respect — precisely so that
		// only the category/channel guard can be responsible for the rejection; a source that also failed
		// on permission or data type would pass this test for the wrong reason.
		it('reports a channel that does not belong to the device category as incompatible', () => {
			const rwBoolSource = property({
				id: 'rw-bool-source',
				permissions: [PermissionType.READ_WRITE],
				dataType: DataTypeType.BOOL,
			});

			const report = service.reportCompatibility(
				{ category: DeviceCategory.LOCK, channel: ChannelCategory.LIGHT, property: PropertyCategory.ON },
				rwBoolSource,
			);

			expect(report.compatible).toBe(false);
			expect(report.reason).toContain('lock');
			expect(report.reason).toContain('light');
		});
	});

	// The enforcement half of reportCompatibility. The wizard previews compatibility before it writes,
	// but the preview is not atomic with the write, a source can change permissions or data type in
	// between, and a direct API call or a remap skips it entirely — so the rule has to hold at
	// persistence too, which is what these pin.
	describe('assertProjectionCompatible', () => {
		const CHANNEL_ID = 'virtual-channel';
		const DEVICE_ID = 'virtual-device';

		// Resolves channel -> device the way the assertion walks them, so a test only has to say which
		// source property is on the other end.
		const givenSlot = (channelCategory: ChannelCategory, deviceCategory: DeviceCategory): void => {
			channelsService.findOne.mockResolvedValue({ id: CHANNEL_ID, category: channelCategory, device: DEVICE_ID });
			devicesService.findOne.mockResolvedValue({ id: DEVICE_ID, category: deviceCategory });
		};

		// Declares its own permissions and data type, as a real row always does — they are non-null
		// columns, and the guard now checks the projection against the slot as well as its source.
		const projecting = (
			sourcePropertyId: string | null,
			category: PropertyCategory,
			declared: { permissions?: PermissionType[]; dataType?: DataTypeType; format?: (string | number | null)[] } = {},
		): VirtualChannelPropertyEntity => {
			const entity = new VirtualChannelPropertyEntity();

			Object.assign(entity, {
				id: 'virtual-property',
				category,
				permissions: declared.permissions ?? [PermissionType.READ_WRITE],
				dataType: declared.dataType ?? DataTypeType.BOOL,
				format: declared.format ?? null,
				valueOrigin: VirtualValueOrigin.SOURCE,
				sourcePropertyId,
			});

			return entity;
		};

		it('refuses a read-only source on a writable slot, carrying the reason', async () => {
			givenSlot(ChannelCategory.LIGHT, DeviceCategory.LIGHTING);
			channelsPropertiesService.findOne.mockResolvedValue(readOnlySourceProperty);

			await expect(
				service.assertProjectionCompatible(projecting(readOnlySourceProperty.id, PropertyCategory.ON), CHANNEL_ID),
			).rejects.toThrow(/permission/);
		});

		it('refuses a data-type mismatch', async () => {
			givenSlot(ChannelCategory.LIGHT, DeviceCategory.LIGHTING);
			channelsPropertiesService.findOne.mockResolvedValue(floatSourceProperty);

			await expect(
				service.assertProjectionCompatible(projecting(floatSourceProperty.id, PropertyCategory.ON), CHANNEL_ID),
			).rejects.toThrow(/data type/);
		});

		it('accepts a compatible source', async () => {
			givenSlot(ChannelCategory.TEMPERATURE, DeviceCategory.SENSOR);
			channelsPropertiesService.findOne.mockResolvedValue(readWriteSourceProperty);

			await expect(
				service.assertProjectionCompatible(
					projecting(readWriteSourceProperty.id, PropertyCategory.TEMPERATURE, {
						dataType: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						format: [0, 100],
					}),
					CHANNEL_ID,
				),
			).resolves.toBeUndefined();
		});

		// An owned property has no source to judge, so nothing should even be resolved for it — asserting
		// on the lookups rather than only on the absence of a throw, since a `local` property that
		// happened to be compatible would pass the weaker check for the wrong reason.
		// The wizard derives these from the spec, but a direct create or PATCH sets them freely, and
		// nothing else looked: a projection declaring itself `enum` over a perfectly good `uchar` source
		// would persist and then expose the wrong representation.
		it('refuses a projection whose own declaration does not fit the slot', async () => {
			givenSlot(ChannelCategory.LIGHT, DeviceCategory.LIGHTING);
			channelsPropertiesService.findOne.mockResolvedValue(
				property({ id: 'rw-bool', permissions: [PermissionType.READ_WRITE], dataType: DataTypeType.BOOL }),
			);

			const misdeclared = projecting('rw-bool', PropertyCategory.ON, { dataType: DataTypeType.FLOAT });

			await expect(service.assertProjectionCompatible(misdeclared, CHANNEL_ID)).rejects.toThrow(/data type/);
		});

		// `reportCompatibility` asks whether a candidate can *satisfy* the slot, so a source offering more
		// than required passes — an `rw` source happily feeds a `ro` slot. A projection is the opposite
		// situation: declaring `rw` on a read-only slot advertises a write the specification does not
		// have, and forwards it.
		it('refuses a projection claiming a capability the slot does not offer', async () => {
			givenSlot(ChannelCategory.TEMPERATURE, DeviceCategory.SENSOR);
			channelsPropertiesService.findOne.mockResolvedValue(readWriteSourceProperty);

			const overclaiming = projecting(readWriteSourceProperty.id, PropertyCategory.TEMPERATURE, {
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_WRITE],
				format: [0, 100],
			});

			await expect(service.assertProjectionCompatible(overclaiming, CHANNEL_ID)).rejects.toThrow(/does not offer/);
		});

		// Both halves can satisfy a multi-variant slot independently and still disagree with each other.
		// A projection forwards its source's value unchanged, so enum readings must not flow through a
		// property calling itself numeric.
		it('refuses a projection whose representation differs from its source', async () => {
			givenSlot(ChannelCategory.LIGHT, DeviceCategory.LIGHTING);
			channelsPropertiesService.findOne.mockResolvedValue(
				property({
					id: 'enum-brightness',
					permissions: [PermissionType.READ_WRITE],
					dataType: DataTypeType.ENUM,
					format: ['off', 'low', 'medium', 'high', 'full'],
				}),
			);

			const numericProjection = projecting('enum-brightness', PropertyCategory.BRIGHTNESS, {
				dataType: DataTypeType.UCHAR,
				permissions: [PermissionType.READ_WRITE],
				format: [0, 100],
			});

			// The `uchar` variant of this slot defines a step, and a declaration without one is refused
			// before the representation comparison is reached — this test is about the latter.
			Object.assign(numericProjection, { step: 1 });

			await expect(service.assertProjectionCompatible(numericProjection, CHANNEL_ID)).rejects.toThrow(/must match/);
		});

		// `validatePropertyCommandValue` refuses every numeric command on a property whose step is
		// non-null but not positive and finite, so accepting one here persists a projection that looks
		// compatible and can never be commanded.
		it('refuses a projection declaring an unusable step', async () => {
			givenSlot(ChannelCategory.LIGHT, DeviceCategory.LIGHTING);
			channelsPropertiesService.findOne.mockResolvedValue(
				property({ id: 'rw-bool', permissions: [PermissionType.READ_WRITE], dataType: DataTypeType.BOOL }),
			);

			const zeroStep = projecting('rw-bool', PropertyCategory.ON, { dataType: DataTypeType.BOOL });

			Object.assign(zeroStep, { step: 0 });

			await expect(service.assertProjectionCompatible(zeroStep, CHANNEL_ID)).rejects.toThrow(/usable grid/);
		});

		it('ignores an owned property', async () => {
			const owned = new VirtualChannelPropertyEntity();

			Object.assign(owned, {
				id: 'owned',
				category: PropertyCategory.ON,
				valueOrigin: VirtualValueOrigin.LOCAL,
				sourcePropertyId: null,
			});

			await expect(service.assertProjectionCompatible(owned, CHANNEL_ID)).resolves.toBeUndefined();
			expect(channelsService.findOne).not.toHaveBeenCalled();
		});

		// An orphan — a projection whose source was deleted — is a state the device degrades into, not a
		// write to refuse. Refusing it here would make an orphaned property impossible to edit back into
		// shape, which is exactly what the remap flow exists to do.
		// `value_origin` is optional on the create DTO and the column default supplies `source` only on
		// save, so a request that names a source but omits the origin reaches this hook with
		// `valueOrigin === undefined`. That is the shape a direct API caller sends most readily, and it
		// must not slip past unchecked.
		it('checks a projection whose origin has not been defaulted yet', async () => {
			givenSlot(ChannelCategory.LIGHT, DeviceCategory.LIGHTING);
			channelsPropertiesService.findOne.mockResolvedValue(readOnlySourceProperty);

			const undefaulted = new VirtualChannelPropertyEntity();

			Object.assign(undefaulted, {
				id: 'undefaulted',
				category: PropertyCategory.ON,
				sourcePropertyId: readOnlySourceProperty.id,
			});

			await expect(service.assertProjectionCompatible(undefaulted, CHANNEL_ID)).rejects.toThrow(/permission/);
		});

		it('ignores a projection whose source is not set', async () => {
			await expect(
				service.assertProjectionCompatible(projecting(null, PropertyCategory.ON), CHANNEL_ID),
			).resolves.toBeUndefined();
			expect(channelsService.findOne).not.toHaveBeenCalled();
		});
	});

	// Matching data types are not enough. `fan.speed` and `light.brightness` are both `rw` enums, so
	// every other check passes — but their value sets differ, so a fan speed projected into a brightness
	// slot would report `turbo` as a brightness and could never produce `full`.
	describe('reportCompatibility — formats', () => {
		it('refuses an enum source carrying values the slot does not define', () => {
			const fanSpeed = property({
				id: 'fan-speed',
				permissions: [PermissionType.READ_WRITE],
				dataType: DataTypeType.ENUM,
				format: ['off', 'low', 'medium', 'high', 'turbo', 'auto'],
			});

			const report = service.reportCompatibility(
				{ category: DeviceCategory.LIGHTING, channel: ChannelCategory.LIGHT, property: PropertyCategory.BRIGHTNESS },
				fanSpeed,
			);

			expect(report.compatible).toBe(false);
			expect(report.reason).toContain('turbo');
		});

		// A slot that constrains its values cannot be satisfied by a source that declares none: nothing
		// there shows the source stays inside the range, and "unknown" is not "compatible".
		it('refuses a source with no format against a constrained slot', () => {
			const formatless = property({
				id: 'formatless',
				permissions: [PermissionType.READ_WRITE],
				dataType: DataTypeType.UCHAR,
				format: null,
			});

			const report = service.reportCompatibility(
				{ category: DeviceCategory.LIGHTING, channel: ChannelCategory.LIGHT, property: PropertyCategory.BRIGHTNESS },
				formatless,
			);

			expect(report.compatible).toBe(false);
			expect(report.reason).toContain('declares no format');
		});

		// A write-only slot is commanded exactly like a read-write one, so the source still has to accept
		// everything the slot may be told to do.
		it('refuses a write-only slot a source cannot accept every command for', () => {
			const partialSource = property({
				id: 'play-only',
				permissions: [PermissionType.WRITE_ONLY],
				dataType: DataTypeType.ENUM,
				format: ['play'],
			});

			const report = service.reportCompatibility(
				{ category: DeviceCategory.MEDIA, channel: ChannelCategory.MEDIA_PLAYBACK, property: PropertyCategory.COMMAND },
				partialSource,
			);

			expect(report.compatible).toBe(false);
		});

		it('accepts an enum source whose values match the slot', () => {
			const brightnessLevel = property({
				id: 'brightness-level',
				permissions: [PermissionType.READ_WRITE],
				dataType: DataTypeType.ENUM,
				format: ['off', 'low', 'medium', 'high', 'full'],
			});

			const report = service.reportCompatibility(
				{ category: DeviceCategory.LIGHTING, channel: ChannelCategory.LIGHT, property: PropertyCategory.BRIGHTNESS },
				brightnessLevel,
			);

			expect(report.compatible).toBe(true);
		});

		// The range says which values are legal; the step says which of them exist. A slot stepping by 1
		// can be commanded with 43, and a source stepping by 5 cannot take it — the command passes
		// validation against the virtual property and is forwarded unchanged.
		// A grid is a width and an origin. `fan.speed`'s percentage variant steps by 1 from 0, so a source
		// stepping by the same 1 but from 0.5 sits inside the range and still never lands on a single one
		// of the slot's values — the widths match exactly and the two accept disjoint sets.
		it('refuses a numeric source whose grid is offset from the slot', () => {
			const offsetSource = property({
				id: 'offset-grid',
				permissions: [PermissionType.READ_WRITE],
				dataType: DataTypeType.UCHAR,
				format: [0.5, 99.5],
				step: 1,
			});

			const report = service.reportCompatibility(
				{ category: DeviceCategory.FAN, channel: ChannelCategory.FAN, property: PropertyCategory.SPEED },
				offsetSource,
			);

			expect(report.compatible).toBe(false);
			expect(report.reason).toContain('grid');
		});

		// A slot that defines a grid is not satisfied by a candidate that defines none: without a step,
		// `validatePropertyCommandValue` accepts 61 on a `[0, 86400]` projection and it is forwarded
		// unchanged to a step-60 source.
		// A matched variant's format may be *explicitly* null, and that null is the answer.
		// `media_input.source` has an enum variant and a `custom` string variant declaring no format on
		// purpose — coalescing past that null borrows the enum set and rejects every legitimate free-text
		// source the specification plainly allows.
		it('accepts a source matching a variant that declares no format', () => {
			const freeTextSource = property({
				id: 'custom-input',
				permissions: [PermissionType.READ_WRITE],
				dataType: DataTypeType.STRING,
				format: null,
			});

			const report = service.reportCompatibility(
				{
					category: DeviceCategory.TELEVISION,
					channel: ChannelCategory.MEDIA_INPUT,
					property: PropertyCategory.SOURCE,
				},
				freeTextSource,
			);

			expect(report.compatible).toBe(true);
		});

		it('refuses a numeric source with no step against a stepped slot', () => {
			const steplessSource = property({
				id: 'stepless',
				permissions: [PermissionType.READ_WRITE],
				dataType: DataTypeType.UCHAR,
				format: [0, 100],
				step: null,
			});

			const report = service.reportCompatibility(
				{ category: DeviceCategory.FAN, channel: ChannelCategory.FAN, property: PropertyCategory.SPEED },
				steplessSource,
			);

			expect(report.compatible).toBe(false);
			expect(report.reason).toContain('declares no step');
		});

		it('accepts a numeric source sharing the slot grid', () => {
			const alignedSource = property({
				id: 'aligned-grid',
				permissions: [PermissionType.READ_WRITE],
				dataType: DataTypeType.UCHAR,
				format: [0, 100],
				step: 1,
			});

			const report = service.reportCompatibility(
				{ category: DeviceCategory.FAN, channel: ChannelCategory.FAN, property: PropertyCategory.SPEED },
				alignedSource,
			);

			expect(report.compatible).toBe(true);
		});

		it('refuses a numeric source whose step grid cannot take every command', () => {
			const coarseSource = property({
				id: 'coarse-step',
				permissions: [PermissionType.READ_WRITE],
				dataType: DataTypeType.UCHAR,
				format: [0, 100],
				step: 5,
			});

			const report = service.reportCompatibility(
				{ category: DeviceCategory.LIGHTING, channel: ChannelCategory.LIGHT, property: PropertyCategory.BRIGHTNESS },
				coarseSource,
			);

			expect(report.compatible).toBe(false);
			expect(report.reason).toContain('step');
		});

		it('refuses a numeric source ranging outside what the slot accepts', () => {
			const wideRange = property({
				id: 'wide-range',
				permissions: [PermissionType.READ_WRITE],
				dataType: DataTypeType.UCHAR,
				format: [0, 255],
			});

			const report = service.reportCompatibility(
				{ category: DeviceCategory.LIGHTING, channel: ChannelCategory.LIGHT, property: PropertyCategory.BRIGHTNESS },
				wideRange,
			);

			expect(report.compatible).toBe(false);
			expect(report.reason).toContain('255');
		});
	});

	describe('assertValueOriginPairSupported', () => {
		// The merged row a partial PATCH produces. Built the way the entity actually is after
		// ChannelsPropertiesService.update() has assigned the update's fields onto the loaded row.
		const merged = (
			valueOrigin: VirtualValueOrigin | undefined,
			sourcePropertyId: string | null,
		): VirtualChannelPropertyEntity =>
			Object.assign(new VirtualChannelPropertyEntity(), { id: 'virtual-prop', valueOrigin, sourcePropertyId });

		it('rejects local plus a source — the state the entity has no state for', () => {
			expect(() => service.assertValueOriginPairSupported(merged(VirtualValueOrigin.LOCAL, 'source-prop'))).toThrow(
				VirtualValueOriginConflictException,
			);
		});

		it('accepts an owned property', () => {
			expect(() => service.assertValueOriginPairSupported(merged(VirtualValueOrigin.LOCAL, null))).not.toThrow();
		});

		it('accepts a linked property', () => {
			expect(() =>
				service.assertValueOriginPairSupported(merged(VirtualValueOrigin.SOURCE, 'source-prop')),
			).not.toThrow();
		});

		it('accepts an orphaned property', () => {
			expect(() => service.assertValueOriginPairSupported(merged(VirtualValueOrigin.SOURCE, null))).not.toThrow();
		});

		// `valueOrigin` has no class field initializer, so it is undefined on a row that has not
		// round-tripped through the database — which the column default makes mean SOURCE, not LOCAL.
		// Reading it as LOCAL here would reject every freshly created linked property.
		it('accepts an undefined value origin with a source, which the column default makes linked', () => {
			expect(() => service.assertValueOriginPairSupported(merged(undefined, 'source-prop'))).not.toThrow();
		});
	});

	// -- containment: nothing virtual hangs off a device that is not ------------------------------

	describe('assertDeviceIsVirtual', () => {
		it('accepts a virtual device', async () => {
			devicesService.findOne.mockResolvedValue({ id: 'dev-1', type: DEVICES_VIRTUAL_TYPE } as DeviceEntity);

			await expect(service.assertDeviceIsVirtual('dev-1')).resolves.toBeUndefined();
		});

		it('rejects a physical device', async () => {
			devicesService.findOne.mockResolvedValue({ id: 'dev-1', type: 'simulator' } as DeviceEntity);

			await expect(service.assertDeviceIsVirtual('dev-1')).rejects.toThrow(VirtualOwnerNotVirtualException);
		});

		// Folded into the same failure rather than passed through: this judges an id the caller has just
		// supplied, so "points at nothing" is exactly as invalid as "points at the wrong kind of thing".
		it('rejects a device that does not exist', async () => {
			devicesService.findOne.mockResolvedValue(null);

			await expect(service.assertDeviceIsVirtual('missing')).rejects.toThrow(VirtualOwnerNotVirtualException);
		});
	});

	describe('assertChannelOwnerIsVirtual', () => {
		// `type` is a getter-only property on ChannelEntity (each @ChildEntity overrides it), so a
		// fixture that needs a custom value casts a plain object rather than mutating `new ChannelEntity()`
		// — the same reason assertSourceNotVirtual's device fixtures above do.
		const channel = (type: string, device: ChannelEntity['device']): ChannelEntity =>
			({ id: 'chan-1', type, device }) as ChannelEntity;

		const virtualChannel = (device: ChannelEntity['device']): ChannelEntity => channel(DEVICES_VIRTUAL_TYPE, device);

		it('accepts a virtual channel on a virtual device', async () => {
			channelsService.findOne.mockResolvedValue(virtualChannel('dev-1'));
			devicesService.findOne.mockResolvedValue({ id: 'dev-1', type: DEVICES_VIRTUAL_TYPE } as DeviceEntity);

			await expect(service.assertChannelOwnerIsVirtual('chan-1')).resolves.toBeUndefined();
		});

		// The P1 failure itself: the channel is an ordinary physical one, so a virtual property in it
		// would make VirtualPropertyIndexService file a *physical* device under `byVirtualDevice`.
		it('rejects a physical channel', async () => {
			channelsService.findOne.mockResolvedValue(channel('simulator', 'dev-1'));

			await expect(service.assertChannelOwnerIsVirtual('chan-1')).rejects.toThrow(VirtualOwnerNotVirtualException);
			// Rejected on the channel alone — the device hop is not even reached, so this cannot depend on
			// what the owning device happens to be.
			expect(devicesService.findOne).not.toHaveBeenCalled();
		});

		// The level-up shape: a virtual channel that was hung off a physical device before the channel
		// DTO guard existed, or by any path that bypasses it. The device hop is what catches it.
		it('rejects a virtual channel whose device is physical', async () => {
			channelsService.findOne.mockResolvedValue(virtualChannel('dev-1'));
			devicesService.findOne.mockResolvedValue({ id: 'dev-1', type: 'simulator' } as DeviceEntity);

			await expect(service.assertChannelOwnerIsVirtual('chan-1')).rejects.toThrow(VirtualOwnerNotVirtualException);
		});

		it('resolves the device through a hydrated relation as well as a bare id', async () => {
			channelsService.findOne.mockResolvedValue(
				virtualChannel({ id: 'dev-1', type: DEVICES_VIRTUAL_TYPE } as DeviceEntity),
			);
			devicesService.findOne.mockResolvedValue({ id: 'dev-1', type: DEVICES_VIRTUAL_TYPE } as DeviceEntity);

			await expect(service.assertChannelOwnerIsVirtual('chan-1')).resolves.toBeUndefined();
			expect(devicesService.findOne).toHaveBeenCalledWith('dev-1');
		});

		it('rejects a channel that does not exist', async () => {
			channelsService.findOne.mockResolvedValue(null);

			await expect(service.assertChannelOwnerIsVirtual('missing')).rejects.toThrow(VirtualOwnerNotVirtualException);
		});

		it('rejects a channel whose device does not exist', async () => {
			channelsService.findOne.mockResolvedValue(virtualChannel('dev-1'));
			devicesService.findOne.mockResolvedValue(null);

			await expect(service.assertChannelOwnerIsVirtual('chan-1')).rejects.toThrow(VirtualOwnerNotVirtualException);
		});
	});

	describe('assertOwnedPropertyNotWritable', () => {
		// The merged row a partial PATCH produces, as in assertValueOriginPairSupported above.
		const merged = (
			valueOrigin: VirtualValueOrigin | undefined,
			permissions: PermissionType[],
		): VirtualChannelPropertyEntity =>
			Object.assign(new VirtualChannelPropertyEntity(), { id: 'virtual-prop', valueOrigin, permissions });

		it.each([[PermissionType.READ_WRITE], [PermissionType.WRITE_ONLY]])(
			'rejects an owned property permitting %s',
			(permission) => {
				expect(() => service.assertOwnedPropertyNotWritable(merged(VirtualValueOrigin.LOCAL, [permission]))).toThrow(
					VirtualOwnedPropertyNotWritableException,
				);
			},
		);

		it('rejects an owned property whose permissions merely include a writable one', () => {
			expect(() =>
				service.assertOwnedPropertyNotWritable(
					merged(VirtualValueOrigin.LOCAL, [PermissionType.READ_ONLY, PermissionType.WRITE_ONLY]),
				),
			).toThrow(VirtualOwnedPropertyNotWritableException);
		});

		it('accepts a read-only owned property — the only kind v1 synthesizes', () => {
			expect(() =>
				service.assertOwnedPropertyNotWritable(merged(VirtualValueOrigin.LOCAL, [PermissionType.READ_ONLY])),
			).not.toThrow();
		});

		// `ev` is a report channel, not a command one, so it is not writability.
		it('accepts an owned property that is event-only', () => {
			expect(() =>
				service.assertOwnedPropertyNotWritable(merged(VirtualValueOrigin.LOCAL, [PermissionType.EVENT_ONLY])),
			).not.toThrow();
		});

		// A writable projection is the plugin's core feature — the write is forwarded to the source.
		it('accepts a writable linked property', () => {
			expect(() =>
				service.assertOwnedPropertyNotWritable(merged(VirtualValueOrigin.SOURCE, [PermissionType.READ_WRITE])),
			).not.toThrow();
		});

		// Same reason as in assertValueOriginPairSupported: an entity that has not round-tripped through
		// the database has `valueOrigin` undefined, which the column default makes SOURCE. Reading it as
		// LOCAL here would reject every freshly created writable linked property.
		it('accepts an undefined value origin with writable permissions, which the column default makes linked', () => {
			expect(() =>
				service.assertOwnedPropertyNotWritable(merged(undefined, [PermissionType.READ_WRITE])),
			).not.toThrow();
		});
	});

	describe('findSourceDevices', () => {
		it('lists the distinct source devices behind a virtual device', async () => {
			const deviceA = Object.assign(new DeviceEntity(), { id: 'device-a' });
			const deviceB = Object.assign(new DeviceEntity(), { id: 'device-b' });

			index.loadLinksByVirtualDevice.mockResolvedValue([
				linkedTo('prop-a', 'device-a'),
				linkedTo('prop-b', 'device-b'),
			]);

			// Loaded by id rather than read off a relation the index cached, so the devices returned
			// carry a current connection status.
			devicesService.findOne.mockImplementation((id: string) => Promise.resolve(id === 'device-a' ? deviceA : deviceB));

			await expect(service.findSourceDevices('virtual-device')).resolves.toEqual([deviceA, deviceB]);
		});
	});

	// -- supplementary cases ------------------------------------------------------------------------
	// Not pinned by the brief, but exercised so each guard's branches are individually discriminated
	// (self-review checklist: "would each test fail if only its own branch broke?").

	describe('assertSourceNotVirtual — supplementary', () => {
		it('resolves through channel and device by id, not just off the property itself', async () => {
			channelsPropertiesService.findOne.mockResolvedValue(property({ id: 'virtual-source', channel: 'chan-1' }));
			channelsService.findOne.mockResolvedValue(Object.assign(new ChannelEntity(), { id: 'chan-1', device: 'dev-1' }));
			devicesService.findOne.mockResolvedValue({ id: 'dev-1', type: DEVICES_VIRTUAL_TYPE } as DeviceEntity);

			await service.assertSourceNotVirtual('virtual-source').catch(() => undefined);

			// A shortcut that only inspected the property itself (e.g. property.type) would never
			// need to call these — asserting they were called with the resolved ids proves the guard
			// actually walks property -> channel -> device.
			expect(channelsPropertiesService.findOne).toHaveBeenCalledWith('virtual-source');
			expect(channelsService.findOne).toHaveBeenCalledWith('chan-1');
			expect(devicesService.findOne).toHaveBeenCalledWith('dev-1');
		});

		it('accepts a source property belonging to a non-virtual device', async () => {
			channelsPropertiesService.findOne.mockResolvedValue(property({ id: 'phys-source', channel: 'chan-2' }));
			channelsService.findOne.mockResolvedValue(Object.assign(new ChannelEntity(), { id: 'chan-2', device: 'dev-2' }));
			devicesService.findOne.mockResolvedValue({ id: 'dev-2', type: 'simulator' } as DeviceEntity);

			await expect(service.assertSourceNotVirtual('phys-source')).resolves.toBeUndefined();
		});

		it('rejects nesting even when the relations are already hydrated as full entities', async () => {
			const virtualDevice = { id: 'dev-3', type: DEVICES_VIRTUAL_TYPE } as DeviceEntity;
			const channel = Object.assign(new ChannelEntity(), { id: 'chan-3', device: virtualDevice });

			channelsPropertiesService.findOne.mockResolvedValue(property({ id: 'hydrated-source', channel }));
			channelsService.findOne.mockResolvedValue(channel);
			devicesService.findOne.mockResolvedValue(virtualDevice);

			await expect(service.assertSourceNotVirtual('hydrated-source')).rejects.toThrow(
				VirtualNestingNotAllowedException,
			);
		});

		it('rejects when the source property does not exist', async () => {
			channelsPropertiesService.findOne.mockResolvedValue(null);

			await expect(service.assertSourceNotVirtual('missing')).rejects.toThrow(VirtualSourceNotFoundException);
		});

		it('rejects when the property exists but its channel does not', async () => {
			channelsPropertiesService.findOne.mockResolvedValue(property({ id: 'dangling-prop', channel: 'chan-4' }));
			channelsService.findOne.mockResolvedValue(null);

			await expect(service.assertSourceNotVirtual('dangling-prop')).rejects.toThrow(VirtualSourceNotFoundException);
		});

		it('rejects when the channel exists but its device does not', async () => {
			channelsPropertiesService.findOne.mockResolvedValue(property({ id: 'dangling-prop-2', channel: 'chan-5' }));
			channelsService.findOne.mockResolvedValue(Object.assign(new ChannelEntity(), { id: 'chan-5', device: 'dev-6' }));
			devicesService.findOne.mockResolvedValue(null);

			await expect(service.assertSourceNotVirtual('dangling-prop-2')).rejects.toThrow(VirtualSourceNotFoundException);
		});
	});

	describe('assertPermissionsCompatible — supplementary', () => {
		it('rejects a read-only source for a write-only spec slot', () => {
			expect(() => service.assertPermissionsCompatible([PermissionType.WRITE_ONLY], readOnlySource)).toThrow();
		});

		it('accepts a read-write source for a write-only spec slot', () => {
			expect(() => service.assertPermissionsCompatible([PermissionType.WRITE_ONLY], readWriteSource)).not.toThrow();
		});

		it('accepts a direct permission match with no read-write involved', () => {
			expect(() => service.assertPermissionsCompatible([PermissionType.READ_ONLY], readOnlySource)).not.toThrow();
		});

		it('accepts a source satisfying every one of several required permissions', () => {
			expect(() =>
				service.assertPermissionsCompatible([PermissionType.READ_ONLY, PermissionType.WRITE_ONLY], readWriteSource),
			).not.toThrow();
		});
	});

	describe('reportCompatibility — supplementary', () => {
		it('leaves reason unset when the source is fully compatible', () => {
			const report = service.reportCompatibility(
				{
					category: DeviceCategory.SENSOR,
					channel: ChannelCategory.TEMPERATURE,
					property: PropertyCategory.TEMPERATURE,
				},
				readWriteSourceProperty,
			);

			expect(report).toEqual({ compatible: true });
		});

		// Pins that permission is checked before data type, and that the check stops at the first
		// failure: a source wrong on both counts reports the permission reason, not both concatenated.
		// The wizard renders one reason per option, not a list.
		it('reports the permission reason, not the data-type reason, when a source fails both', () => {
			// temperature.temperature requires read-only; write-only satisfies neither a direct match nor
			// the read-write fallback, so this is wrong on permission. bool (vs. required float) makes it
			// wrong on data type too.
			const doublyWrongSource = property({
				id: 'doubly-wrong',
				permissions: [PermissionType.WRITE_ONLY],
				dataType: DataTypeType.BOOL,
			});

			const report = service.reportCompatibility(
				{
					category: DeviceCategory.SENSOR,
					channel: ChannelCategory.TEMPERATURE,
					property: PropertyCategory.TEMPERATURE,
				},
				doublyWrongSource,
			);

			expect(report.compatible).toBe(false);
			expect(report.reason).toContain('permission');
			expect(report.reason).not.toContain('data type');
		});

		// light.brightness accepts either a percentage (uchar) or a discrete level (enum) — exercises the
		// hasMultipleDataTypes branch's accepting path, which the pinned tests never reach (they only use
		// single-data-type slots).
		it('accepts a source matching one variant of a multi-datatype slot', () => {
			// Formats are compared now, so the row carries the one its variant defines.
			const percentageSource = property({
				id: 'brightness-percentage',
				permissions: [PermissionType.READ_WRITE],
				dataType: DataTypeType.UCHAR,
				format: [0, 100],
				step: 1,
			});

			const report = service.reportCompatibility(
				{ category: DeviceCategory.LIGHTING, channel: ChannelCategory.LIGHT, property: PropertyCategory.BRIGHTNESS },
				percentageSource,
			);

			expect(report.compatible).toBe(true);
		});

		it('rejects a source matching none of the variants of a multi-datatype slot', () => {
			const stringSource = property({
				id: 'brightness-string',
				permissions: [PermissionType.READ_WRITE],
				dataType: DataTypeType.STRING,
			});

			const report = service.reportCompatibility(
				{ category: DeviceCategory.LIGHTING, channel: ChannelCategory.LIGHT, property: PropertyCategory.BRIGHTNESS },
				stringSource,
			);

			expect(report.compatible).toBe(false);
			expect(report.reason).toContain('data type');
		});

		// Defensive: a spec slot the schema does not define (a client/schema mismatch, not a real
		// incompatibility) reports rather than throws, so one bad slot in a batch cannot 500 the request.
		it('reports a spec slot the schema does not define as incompatible rather than throwing', () => {
			// lighting genuinely offers a light channel (so this exercises the "channel has no such
			// property" branch specifically, not the category/channel guard covered above).
			const slot = {
				category: DeviceCategory.LIGHTING,
				channel: ChannelCategory.LIGHT,
				property: PropertyCategory.TEMPERATURE,
			};

			expect(() => service.reportCompatibility(slot, readWriteSourceProperty)).not.toThrow();

			const report = service.reportCompatibility(slot, readWriteSourceProperty);

			expect(report.compatible).toBe(false);
			expect(report.reason).toBeTruthy();
		});
	});

	describe('findSourceDevices — supplementary', () => {
		it('counts a source device once even when two properties project through it', async () => {
			const sharedDevice = Object.assign(new DeviceEntity(), { id: 'shared-device' });

			index.loadLinksByVirtualDevice.mockResolvedValue([
				linkedTo('prop-a', 'shared-device'),
				linkedTo('prop-b', 'shared-device'),
			]);
			devicesService.findOne.mockResolvedValue(sharedDevice);

			await expect(service.findSourceDevices('virtual-device')).resolves.toEqual([sharedDevice]);
			expect(devicesService.findOne).toHaveBeenCalledTimes(1);
		});

		it('returns an empty list for a virtual device with only owned properties', async () => {
			index.loadLinksByVirtualDevice.mockResolvedValue([]);

			await expect(service.findSourceDevices('virtual-device')).resolves.toEqual([]);
		});

		it('skips an orphaned projection, which has no source device left to list', async () => {
			index.loadLinksByVirtualDevice.mockResolvedValue([
				{ propertyId: 'orphaned-prop', sourcePropertyId: null, sourceDeviceId: null },
			]);

			await expect(service.findSourceDevices('virtual-device')).resolves.toEqual([]);
			expect(devicesService.findOne).not.toHaveBeenCalled();
		});

		// The synchronous map lookup is served from whatever the last rebuild() left behind, and a
		// structural event only *schedules* that rebuild — fire-and-forget, awaited by no mutation
		// response. Answering this HTTP read from the maps therefore hands a client that has just
		// linked, remapped or unlinked a property the wiring from before its own write. Asserting the
		// map accessor is never touched is what pins the read to the database.
		it('never consults the in-memory index maps, which lag every write', async () => {
			index.findLinksByVirtualDevice.mockReturnValue([linkedTo('stale-prop', 'stale-device')]);
			index.loadLinksByVirtualDevice.mockResolvedValue([linkedTo('fresh-prop', 'fresh-device')]);

			const freshDevice = Object.assign(new DeviceEntity(), { id: 'fresh-device' });

			devicesService.findOne.mockResolvedValue(freshDevice);

			await expect(service.findSourceDevices('virtual-device')).resolves.toEqual([freshDevice]);

			expect(index.findLinksByVirtualDevice).not.toHaveBeenCalled();
			expect(index.loadLinksByVirtualDevice).toHaveBeenCalledWith('virtual-device');
		});
	});
});
