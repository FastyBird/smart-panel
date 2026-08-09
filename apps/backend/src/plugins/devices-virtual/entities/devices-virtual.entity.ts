import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ChildEntity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PermissionType } from '../../../modules/devices/devices.constants';
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

/** Permissions through which a client can command a property. `ev` is a report channel, not one. */
const WRITABLE_PERMISSIONS: readonly PermissionType[] = [PermissionType.READ_WRITE, PermissionType.WRITE_ONLY];

/**
 * True for an OWNED property that claims to be writable — a control that can never move anything.
 *
 * An owned property stores its own value and forwards nothing, so there is no hardware behind it to
 * command. VirtualDevicePlatform.processBatch() says so outright and refuses every LOCAL property
 * ("owned properties are read-only in this release"), which makes a writable one not merely useless
 * but actively misleading: ChannelsPropertiesService.update() persists the optimistic value into the
 * property's own series *before* the controller dispatches the command, and that dispatch is
 * fire-and-forget — so the control appears to move, the refusal goes to a log, and nothing happens.
 *
 * v1 is wiring only: the only owned properties that exist are the synthesized, read-only
 * `device_information` strings (design spec, "v1 category boundary"). Writable owned properties are
 * what the follow-up controller-support work is for, when a setpoint someone can actually act on
 * becomes meaningful — so this restricts rather than implements.
 *
 * A free function, and shaped like `isUnsupportedValueOriginPair` above, for the same reason: the
 * two callers judge the pair at different points in its life. The DTO constraint
 * (../validators/owned-property-not-writable-constraint.validator.ts) sees the fields of one request
 * payload; VirtualDevicesService.assertOwnedPropertyNotWritable sees the merged row a PATCH is about
 * to persist. Both must apply the same rule; this is it.
 *
 * `undefined` permissions are not writable — an absent field is @IsOptional's business, not this
 * rule's. `undefined` valueOrigin is deliberately not LOCAL, matching the column default (see the
 * entity's `valueOrigin` comment).
 */
export const isUnsupportedOwnedPermissionsPair = (
	valueOrigin: VirtualValueOrigin | undefined,
	permissions: PermissionType[] | undefined | null,
): boolean =>
	valueOrigin === VirtualValueOrigin.LOCAL &&
	!!permissions?.some((permission) => WRITABLE_PERMISSIONS.includes(permission));

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
/**
 * Declared here as well as in the migration, because the two build the schema in different places:
 * a migration creates it for an installation that upgrades, and `synchronize` — which CI and the e2e
 * suite run with `FB_DB_SYNC=true` — creates it from these decorators. Without it here the column
 * would exist in those environments while the constraint that gives it meaning would not, so a
 * concurrent pair of claims would persist and the tests meant to prove they cannot would pass for the
 * wrong reason.
 *
 * Partial, so the many projections that claim nothing are not all competing for one NULL slot.
 */
@Index('UQ_channels_properties_energyClaim', ['energyClaimPropertyId'], {
	unique: true,
	where: '"energyClaimPropertyId" IS NOT NULL',
})
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

	/**
	 * The meter this projection is the one accountable for, or null.
	 *
	 * Energy is additive, so a reading may be counted once and attributed to one place. A source
	 * property can legitimately feed several virtual devices — one sensor serves two rooms' climate —
	 * but only one of them may bill its kWh, and it is the room of *that* device the consumption
	 * lands in. This column is that claim: it holds the claimed source property's id, and a partial
	 * unique index over it makes "one claimant per meter" something the database enforces rather than
	 * something the application remembers to check.
	 *
	 * Set only where the *destination* slot is energy-bearing — the pair `findSourceType` recognises,
	 * judged on this property's own channel — because that is what decides whether the ingestion will
	 * treat it as a meter at all. A `generic.consumption` source projected into an `electrical_energy`
	 * slot is a meter here even though its source is not one anywhere else.
	 *
	 * Its value is always either null or exactly `sourcePropertyId`; it carries the id rather than a
	 * flag so the unique index has something per-meter to be unique *on*. Same `ON DELETE SET NULL` as
	 * the link beside it, so a deleted meter takes the claim with it in the one statement that orphans
	 * the projection — nothing application-side runs there.
	 */
	@Column({ nullable: true, default: null })
	energyClaimPropertyId: string | null;

	@ManyToOne(() => ChannelPropertyEntity, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'energyClaimPropertyId' })
	energyClaim: ChannelPropertyEntity | null;

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
