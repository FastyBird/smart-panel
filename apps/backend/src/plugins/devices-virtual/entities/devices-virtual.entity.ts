import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ChildEntity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';

export enum VirtualValueOrigin {
	/** Value is read from and written to `sourcePropertyId`. */
	SOURCE = 'source',
	/** Value is stored under this property's own id, e.g. synthesized device information. */
	LOCAL = 'local',
}

/**
 * True for the one (`valueOrigin`, `sourcePropertyId`) pair the state model below has no state for.
 *
 * VirtualChannelPropertyEntity defines exactly three states (see its `isProjecting` / `isOrphaned` /
 * `isLinked` getters, and the design spec's state table):
 *
 * | `valueOrigin` | `sourcePropertyId` | state    |
 * |---------------|--------------------|----------|
 * | `source`      | set                | linked   |
 * | `source`      | `null`             | orphaned |
 * | `local`       | `null`             | owned    |
 *
 * `local` + a source is the missing fourth row: a property that neither mirrors nor forwards.
 * VirtualValueSourceService resolves an owned property to its *own* storage key and never looks at
 * the source, VirtualPropertyIndexService skips owned properties entirely so nothing projects into
 * it, and VirtualDevicePlatform refuses to forward a write for a property that is not in the index.
 * The named source is inert in all three, and silently so.
 *
 * A free function rather than a getter, because the two callers judge the pair at different points
 * in its life and neither always holds an entity: the DTO constraint
 * (../validators/owned-property-has-no-source-constraint.validator.ts) sees only the fields of one
 * request payload, and VirtualDevicesService.assertValueOriginPairSupported sees the merged row a
 * PATCH is about to persist. Both must apply the same rule; this is it.
 *
 * `undefined` is deliberately not LOCAL — `valueOrigin` carries no class field initializer (see the
 * entity), so an entity built in memory and never round-tripped through the database has it
 * `undefined`, which the column default makes mean SOURCE.
 */
export const isUnsupportedValueOriginPair = (
	valueOrigin: VirtualValueOrigin | undefined,
	sourcePropertyId: string | null | undefined,
): boolean => valueOrigin === VirtualValueOrigin.LOCAL && !!sourcePropertyId;

@ApiSchema({ name: 'DevicesVirtualPluginDataDevice' })
@ChildEntity()
export class VirtualDeviceEntity extends DeviceEntity {
	@ApiProperty({
		description: 'Device type',
		type: 'string',
		default: DEVICES_VIRTUAL_TYPE,
		example: DEVICES_VIRTUAL_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_VIRTUAL_TYPE;
	}
}

@ApiSchema({ name: 'DevicesVirtualPluginDataChannel' })
@ChildEntity()
export class VirtualChannelEntity extends ChannelEntity {
	@ApiProperty({
		description: 'Channel type',
		type: 'string',
		default: DEVICES_VIRTUAL_TYPE,
		example: DEVICES_VIRTUAL_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_VIRTUAL_TYPE;
	}
}

@ApiSchema({ name: 'DevicesVirtualPluginDataChannelProperty' })
@ChildEntity()
export class VirtualChannelPropertyEntity extends ChannelPropertyEntity {
	@ApiProperty({
		name: 'value_origin',
		description: 'Whether the value comes from a source property or is stored by this property itself',
		enum: VirtualValueOrigin,
		example: VirtualValueOrigin.SOURCE,
	})
	@Expose({ name: 'value_origin' })
	@IsEnum(VirtualValueOrigin)
	@Transform(
		({ obj }: { obj: { value_origin?: VirtualValueOrigin; valueOrigin?: VirtualValueOrigin } }) =>
			obj.value_origin ?? obj.valueOrigin,
		{ toClassOnly: true },
	)
	// Deliberately declared WITHOUT a class field initializer, relying on the @Column default instead.
	// A field initializer runs in the constructor, and class-transformer builds its target with
	// `new Target()` before copying anything across — so an initialized value survives
	// `plainToInstance` even when the source object never mentioned the field, and
	// `omitBy(toInstance(...), isUndefined)` in ChannelsPropertiesService.update() would then write
	// it back on every PATCH. A PATCH that only renamed a synthesized (LOCAL) device_information
	// property would silently reset it to SOURCE, converting an owned property into an orphan. New
	// rows still get 'source' from the column default; see isProjecting/isOrphaned below for how an
	// entity that has not round-tripped through the database is read.
	@Column({ type: 'text', enum: VirtualValueOrigin, default: VirtualValueOrigin.SOURCE })
	valueOrigin: VirtualValueOrigin;

	@ApiPropertyOptional({
		name: 'source_property',
		description: 'Property whose value this one projects. Null once the source has been deleted.',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose({ name: 'source_property' })
	@IsOptional()
	@IsUUID('4', {
		message: '[{"field":"source_property","reason":"Source property must be a valid UUID (version 4)."}]',
	})
	@Transform(
		({ obj }: { obj: { source_property?: string | null; sourcePropertyId?: string | null } }) =>
			obj.source_property !== undefined ? obj.source_property : obj.sourcePropertyId,
		{ toClassOnly: true },
	)
	@Index()
	@Column({ nullable: true, default: null })
	sourcePropertyId: string | null;

	@ManyToOne(() => ChannelPropertyEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'sourcePropertyId' })
	sourceProperty: ChannelPropertyEntity | null;

	@ApiProperty({
		description: 'Channel property type',
		type: 'string',
		default: DEVICES_VIRTUAL_TYPE,
		example: DEVICES_VIRTUAL_TYPE,
	})
	@Expose()
	get type(): string {
		return DEVICES_VIRTUAL_TYPE;
	}

	/**
	 * True when this property draws its value from somewhere else rather than storing its own —
	 * whether it still has a source (linked) or has lost it (orphaned).
	 *
	 * Tested as "not LOCAL" rather than "=== SOURCE" on purpose: `valueOrigin` carries no class field
	 * initializer (see above), so an entity built in memory and never round-tripped through the
	 * database — `repository.create(...)` before the row is read back — has it `undefined`. The
	 * column default is SOURCE, so undefined means the same thing, and reading it as LOCAL would
	 * silently route a freshly created linked property's value into its own series instead of its
	 * source's.
	 */
	get isProjecting(): boolean {
		return this.valueOrigin !== VirtualValueOrigin.LOCAL;
	}

	/** True when this property was meant to project a source that has since been deleted. */
	get isOrphaned(): boolean {
		return this.isProjecting && this.sourcePropertyId === null;
	}

	/** True when this property projects a source that still exists. */
	get isLinked(): boolean {
		return this.isProjecting && this.sourcePropertyId !== null;
	}
}
