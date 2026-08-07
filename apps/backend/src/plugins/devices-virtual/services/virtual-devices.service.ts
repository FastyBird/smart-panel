import { Injectable } from '@nestjs/common';

import {
	ChannelCategory,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { getAllProperties, isChannelAllowed, isValidDataType } from '../../../modules/devices/utils/schema.utils';
import { DEVICES_VIRTUAL_TYPE, VIRTUAL_BLOCKED_CATEGORIES } from '../devices-virtual.constants';
import {
	VirtualCategoryNotSupportedException,
	VirtualNestingNotAllowedException,
	VirtualOwnedPropertyNotWritableException,
	VirtualOwnerNotVirtualException,
	VirtualPermissionsIncompatibleException,
	VirtualProjectionIncompatibleException,
	VirtualSourceNotFoundException,
	VirtualValueOriginConflictException,
} from '../devices-virtual.exceptions';
import {
	VirtualChannelPropertyEntity,
	VirtualValueOrigin,
	isUnsupportedOwnedPermissionsPair,
	isUnsupportedValueOriginPair,
} from '../entities/devices-virtual.entity';

import { VirtualPropertyIndexService } from './virtual-property-index.service';

/**
 * A spec slot the wizard is trying to fill: one property, on one channel category, from the target
 * device `category`'s specification. `category` is load-bearing, not context: `channel` plus
 * `property` alone resolve a property's own permissions/data-type requirements (see
 * getAllProperties(channelCategory) in schema.utils.ts), but say nothing about whether `channel`
 * belongs to `category`'s specification at all — a channel category (not a real channel id) is enough
 * to resolve what the slot requires, which is what lets reportCompatibility below be asked about a
 * slot before the virtual channel that will eventually hold it exists at all, but it is also what
 * makes the category dimension necessary: without it, a channel that is real but simply not part of
 * this device category's spec would look identical to one that is.
 */
export interface VirtualCompatibilitySpecSlot {
	category: DeviceCategory;
	channel: ChannelCategory;
	property: PropertyCategory;
}

/**
 * Whether a candidate source property can fill a spec slot, and — when it cannot — why not. `reason`
 * is set when and only when `compatible` is false. Reported as data rather than thrown so a batch of
 * candidates (VirtualDevicesController.checkCompatibility) can be evaluated in full: one incompatible
 * candidate must not stop the others from being judged.
 */
export interface VirtualCompatibilityReport {
	compatible: boolean;
	reason?: string;
}

/**
 * Validation guards for assembling a virtual device, plus a read of the physical devices behind one.
 *
 * The `assert*` methods each police one rule from the design's creation flow
 * (docs/superpowers/specs/2026-07-31-virtual-devices-design.md, "Creation flow" / "v1 category
 * boundary"):
 *
 * - `assertCategoryAllowed` — a blocked category needs closed-loop control this plugin does not have.
 * - `assertDeviceIsVirtual` / `assertChannelOwnerIsVirtual` — containment: nothing virtual may hang
 *   off a device that is not. The second is the load-bearing one — see its docstring for how a stray
 *   virtual property makes a *physical* device's own commands start failing.
 * - `assertOwnedPropertyNotWritable` — v1 has no write semantics for an owned property, so a writable
 *   one is a control that can never move anything.
 * - `assertSourceNotVirtual` — is load-bearing, not optional: VirtualProjectionListener re-emits
 *   CHANNEL_PROPERTY_VALUE_SET and terminates only because no virtual property is ever another's
 *   `sourcePropertyId` (see that listener's docstring). VirtualDevicePlatform.processBatch checks the
 *   same thing at forward-time and calls itself "the backstop against a stale or hand-edited row" —
 *   language that presupposes a *primary* guard exists elsewhere. This is that guard.
 * - `assertPermissionsCompatible` — a writable spec slot fed by a read-only source could never
 *   actually be written.
 * - `assertValueOriginPairSupported` — the entity's state model has no state for `local` + a source.
 *
 * ## How each is wired, and why they are not all wired the same way
 *
 * `assertCategoryAllowed`, `assertSourceNotVirtual` and `assertDeviceIsVirtual` hang off
 * class-validator constraints on the `category`, `source_property` and `device` fields of the virtual
 * device/channel/channel-property DTOs (`../validators/*.validator.ts`), because each judges a value
 * the request payload actually carries — so the rejection is a 400 that names the offending field.
 * This is what makes `VirtualProjectionListener`'s "nesting is rejected at creation" doc comment
 * actually true rather than aspirational.
 *
 * `assertChannelOwnerIsVirtual` cannot be: a property's channel is a *route parameter* on both
 * property controllers and an argument on the two nested-creation paths, so it never reaches the DTO.
 * It hangs off a `beforeCreate` mapping hook instead, which is handed the channel id explicitly.
 *
 * `assertValueOriginPairSupported` and `assertOwnedPropertyNotWritable` judge the *merged row* rather
 * than a payload — the half of each rule a partial PATCH cannot show — so both hang off a
 * `beforeUpdate` mapping hook. Each has a DTO-constraint counterpart for the payload that carries
 * both halves; they are complementary, not alternatives (see the methods).
 *
 * `assertPermissionsCompatible` is deliberately not wired to a DTO constraint: it needs the target
 * spec slot's required permissions, which depend on the channel category and are not available from a
 * property DTO in isolation. That objection is about DTOs specifically, and it still stands.
 *
 * It does not extend to the persistence hooks, which is where the rule is now actually enforced:
 * `assertProjectionCompatible` runs from `beforeCreate` and `beforeUpdate`, both of which have the
 * owning channel in hand and can therefore resolve the slot the DTO could not. `reportCompatibility`
 * remains the single place the rules live — the assertion resolves the slot and asks it, rather than
 * restating permissions or data types.
 *
 * The wizard's preview call (`POST /plugins/devices-virtual/devices/compatibility`,
 * VirtualDevicesController.checkCompatibility) is still just a preview, and deliberately so: it lets
 * the admin grey out bad options in a batch. It is not a guard, and it cannot be — it is not atomic
 * with the write that follows, so a source whose permissions or data type change in between would
 * otherwise be stored anyway, and a direct API call skips it entirely.
 */
@Injectable()
export class VirtualDevicesService {
	constructor(
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly channelsService: ChannelsService,
		private readonly devicesService: DevicesService,
		private readonly index: VirtualPropertyIndexService,
	) {}

	/** Throws when `category` needs closed-loop control (VIRTUAL_BLOCKED_CATEGORIES). */
	assertCategoryAllowed(category: DeviceCategory): void {
		if (VIRTUAL_BLOCKED_CATEGORIES.includes(category)) {
			throw new VirtualCategoryNotSupportedException(
				`Device category '${category}' requires closed-loop control, which virtual devices do not support yet`,
			);
		}
	}

	/**
	 * Throws when `sourcePropertyId` does not resolve to a real property/channel/device chain, or
	 * resolves to one whose owning device is itself virtual.
	 *
	 * Resolves property -> channel -> device strictly by id, one hop at a time — the same defensive
	 * shape VirtualDevicePlatform.resolveSource uses — rather than trusting relations to already be
	 * loaded on whatever entity a caller passes in.
	 *
	 * Rejecting an unresolvable source (rather than passing it through) matches this method's actual
	 * caller: a DTO field where the id was just supplied by whoever is creating or remapping the
	 * property, so "points at nothing" is exactly as invalid as "points at a virtual device" — neither
	 * is a legitimate value to accept here. This differs from a property that *becomes* orphaned after
	 * having been validly linked (VirtualChannelPropertyEntity.isOrphaned): that is a lifecycle state
	 * this method is never consulted for, since nothing re-validates an existing row's source_property
	 * after the fact.
	 */
	async assertSourceNotVirtual(sourcePropertyId: string): Promise<void> {
		const device = await this.resolveOwningDevice(sourcePropertyId);

		if (!device) {
			throw new VirtualSourceNotFoundException(
				`Source property id=${sourcePropertyId} does not resolve to an existing property/channel/device chain`,
			);
		}

		if (device.type === DEVICES_VIRTUAL_TYPE) {
			throw new VirtualNestingNotAllowedException(
				`Source property id=${sourcePropertyId} belongs to virtual device id=${device.id}; nesting virtual devices is not allowed`,
			);
		}
	}

	/**
	 * Throws when the property's *merged* (`valueOrigin`, `sourcePropertyId`) pair is the unsupported
	 * fourth row — see `isUnsupportedValueOriginPair` for what that row is and why it is inert.
	 *
	 * Takes an entity rather than DTO fields on purpose: this is the half of the rule a request payload
	 * cannot see. `ValidateOwnedPropertyHasNoSource` on the create/update DTOs judges the pair only when
	 * both halves are in the same payload — always true on create, where `value_origin` has a known
	 * default, but not on a PATCH. `{value_origin: 'local'}` sent to a *linked* property and
	 * `{source_property: <id>}` sent to an *owned* one each validate perfectly on their own and only
	 * become the unsupported pair once ChannelsPropertiesService.update() has merged them into the
	 * stored row. This is called from a `beforeUpdate` mapping hook, on that merged row, before it is
	 * saved — see the registration in ../devices-virtual.plugin.ts.
	 *
	 * The two are complementary, not alternatives: the DTO constraint still gives the better error (400,
	 * naming the offending field) for the combined payload, and this is the backstop no partial PATCH
	 * can slip past.
	 */
	assertValueOriginPairSupported(property: VirtualChannelPropertyEntity): void {
		if (isUnsupportedValueOriginPair(property.valueOrigin, property.sourcePropertyId)) {
			throw new VirtualValueOriginConflictException(
				`Property id=${property.id} would be stored with value origin '${property.valueOrigin}' and source property id=${property.sourcePropertyId}; an owned property stores its own value and has no source`,
			);
		}
	}

	/**
	 * Throws unless `deviceId` names an existing device of DEVICES_VIRTUAL_TYPE.
	 *
	 * The containment rule one level up from `assertChannelOwnerIsVirtual` below: a virtual *channel*
	 * may only hang off a virtual device. `POST /channels` takes `device` from the request payload, and
	 * the device-scoped route and the nested-in-device path both funnel the same field into
	 * `ChannelsService.create()`, so a physical device could be given virtual channels — and those
	 * channels could then be filled with virtual properties, which is where the real damage starts (see
	 * the property-level assert).
	 *
	 * "Does not exist" is folded into the same failure rather than passed through, matching
	 * `assertSourceNotVirtual`: this judges an id the caller has just supplied, so pointing at nothing
	 * is exactly as invalid as pointing at the wrong kind of thing. `ValidateDeviceExists` on the same
	 * field already reports the missing case with its own message, so nothing is lost by not
	 * distinguishing it here.
	 */
	async assertDeviceIsVirtual(deviceId: string): Promise<void> {
		const device = await this.devicesService.findOne(deviceId);

		if (!device || device.type !== DEVICES_VIRTUAL_TYPE) {
			throw new VirtualOwnerNotVirtualException(
				`Device id=${deviceId} is not a virtual device; a virtual channel can only belong to a virtual device`,
			);
		}
	}

	/**
	 * Throws unless `channelId` names an existing virtual channel whose own device is virtual too.
	 *
	 * This is the containment guard, and it is the one that matters most in this plugin. A channel
	 * property's `type` is chosen from the request payload while its channel is a *route parameter*, so
	 * before this existed `POST /channels/:physicalChannelId/properties` with `type: 'virtual'` built a
	 * VirtualChannelPropertyEntity inside an ordinary physical channel and nothing downstream ever
	 * re-checked the owner.
	 *
	 * What that costs is not confined to the plugin. VirtualPropertyIndexService resolves a virtual
	 * property's owning device from its own channel relation and files it under `byVirtualDevice`, so
	 * the physical device becomes, to the index, a virtual device; VirtualStatusListener then
	 * overwrites that device's real connectivity with the projection aggregate — DISCONNECTED for a
	 * source-less property, which is what a stray one is — and PropertyCommandService refuses every
	 * command against an offline device. A real device's own commands start failing because of a plugin
	 * it was never enrolled in. The virtual layer is meant to be strictly additive; this is what makes
	 * that true.
	 *
	 * Both hops are required, not just the device. A virtual property in a *physical* channel of a
	 * virtual device is contained, but it is still a row whose type disagrees with the channel that
	 * holds it, and the device hop below is only reachable through the channel anyway — so checking the
	 * channel costs nothing and closes the discrepancy at the same time.
	 *
	 * Resolved by id, one hop at a time, for the same reason as `assertSourceNotVirtual`: the caller
	 * hands over a channel id, not an entity with guaranteed-loaded relations.
	 */
	async assertChannelOwnerIsVirtual(channelId: string): Promise<void> {
		const channel = await this.channelsService.findOne(channelId);

		if (!channel || channel.type !== DEVICES_VIRTUAL_TYPE) {
			throw new VirtualOwnerNotVirtualException(
				`Channel id=${channelId} is not a virtual channel; a virtual property can only belong to a virtual channel`,
			);
		}

		const deviceId = typeof channel.device === 'string' ? channel.device : channel.device?.id;
		const device = deviceId ? await this.devicesService.findOne(deviceId) : null;

		if (!device || device.type !== DEVICES_VIRTUAL_TYPE) {
			throw new VirtualOwnerNotVirtualException(
				`Channel id=${channelId} belongs to device id=${deviceId ?? 'unknown'}, which is not a virtual device; a virtual property can only belong to a virtual device`,
			);
		}
	}

	/**
	 * Throws when the property's *merged* (`valueOrigin`, `permissions`) pair makes it an owned control
	 * nothing can act on — see `isUnsupportedOwnedPermissionsPair` for why that state is worse than
	 * merely useless.
	 *
	 * Takes an entity for the same reason `assertValueOriginPairSupported` does: this is the half of
	 * the rule a request payload cannot see. `ValidateOwnedPropertyNotWritable` on the create/update
	 * DTOs judges the pair when both halves arrive together — always true on create, where
	 * `value_origin` has a known default and `permissions` is required — but a PATCH can send either
	 * half alone. `{permissions: ['rw']}` against an owned property and `{value_origin: 'local'}`
	 * against a writable orphan each validate perfectly and only become the refused state once
	 * ChannelsPropertiesService.update() has merged them into the stored row.
	 *
	 * Called from the same `beforeUpdate` mapping hook as `assertValueOriginPairSupported`, on that
	 * merged row, before it is saved — see the registration in ../devices-virtual.plugin.ts.
	 */
	assertOwnedPropertyNotWritable(property: VirtualChannelPropertyEntity): void {
		if (isUnsupportedOwnedPermissionsPair(property.valueOrigin, property.permissions)) {
			throw new VirtualOwnedPropertyNotWritableException(
				`Property id=${property.id} would be stored as owned with permissions [${(property.permissions ?? []).join(', ')}]; an owned property stores its own value and forwards nothing, so it must be read-only`,
			);
		}
	}

	/**
	 * Throws when `sourceProperty`'s permissions cannot satisfy every one of `specPermissions`.
	 *
	 * Mirrors DeviceValidationService.permissionSatisfied (device-validation.service.ts:685):
	 * READ_WRITE satisfies both READ_ONLY and WRITE_ONLY. That method is private on a service this
	 * plan lists as an interface not to modify, so there is no public entry point to call into —
	 * the three-line rule is restated here rather than exposed. The truth table is identical; the
	 * canonical rule is cited above for anyone auditing the two for drift.
	 */
	assertPermissionsCompatible(specPermissions: PermissionType[], sourceProperty: ChannelPropertyEntity): void {
		const sourcePermissions = new Set(sourceProperty.permissions);

		const unsatisfied = specPermissions.filter((required) => !this.permissionSatisfied(required, sourcePermissions));

		if (unsatisfied.length > 0) {
			throw new VirtualPermissionsIncompatibleException(
				`Source property id=${sourceProperty.id} permissions [${(sourceProperty.permissions ?? []).join(', ')}] do not satisfy required permission(s) [${unsatisfied.join(', ')}]`,
			);
		}
	}

	/**
	 * Reports whether `sourceProperty` can fill `specSlot` — the non-throwing counterpart of
	 * `assertPermissionsCompatible`, plus the channel-membership and data-type halves of the same
	 * question.
	 *
	 * Never throws for a slot/property pair that is merely incompatible: the wizard needs to grey out
	 * every bad option in a batch at once (VirtualDevicesController.checkCompatibility), not discover
	 * them one at a time, so a rejection is data (`{compatible: false, reason}`), not control flow.
	 * `assertPermissionsCompatible` still throws — it is the assertion this wraps — its exception is
	 * caught here and its message becomes the report's reason, which is what keeps the permission rule
	 * itself living in exactly one place rather than being restated for the report shape. The data-type
	 * question is answered the same way, by calling schema.utils.ts's own `isValidDataType` rather than
	 * re-deriving its multi-variant-or-exact-match logic here — that logic already exists in two places
	 * (here, before this change, and privately inside DeviceValidationService.validatePropertyAgainstSpec)
	 * and a third copy is exactly the drift risk the permission rule was already written to avoid.
	 *
	 * Checked in order — category/channel membership, then permission, then data type — and checking
	 * stops at the first failure: a source wrong on more than one count reports only the first reason,
	 * not all of them concatenated. The wizard renders one reason per option, not a list. Category is
	 * checked first because it is the most fundamental mismatch: if `channel` is not even part of
	 * `category`'s specification, asking whether a property on it has the right permissions or data type
	 * is a question about the wrong channel.
	 *
	 * `specSlot` names a device `category`, a channel *category* and a property *category* — not a real
	 * channel or property id — see VirtualCompatibilitySpecSlot. `category` is what makes this endpoint
	 * safe against a channel that is real (it exists somewhere in the schema, so getAllProperties resolves
	 * it) but not actually offered by *this* device category: without checking `isChannelAllowed` first, a
	 * `lock` device asked about a `light` channel would silently defer entirely to the property-level
	 * checks below and could come back compatible. A slot the schema does not define at all (channel
	 * allowed but no such property in it) is reported incompatible rather than thrown, for the same
	 * batch-safety reason as above.
	 */
	reportCompatibility(
		specSlot: VirtualCompatibilitySpecSlot,
		sourceProperty: ChannelPropertyEntity,
	): VirtualCompatibilityReport {
		if (!isChannelAllowed(specSlot.category, specSlot.channel)) {
			return {
				compatible: false,
				reason: `Device category '${specSlot.category}' does not include a '${specSlot.channel}' channel in its specification`,
			};
		}

		const metadata = getAllProperties(specSlot.channel).find((candidate) => candidate.category === specSlot.property);

		if (!metadata) {
			return {
				compatible: false,
				reason: `Channel category '${specSlot.channel}' has no '${specSlot.property}' property in its specification`,
			};
		}

		try {
			this.assertPermissionsCompatible(metadata.permissions, sourceProperty);
		} catch (error) {
			return { compatible: false, reason: error instanceof Error ? error.message : String(error) };
		}

		if (!isValidDataType(specSlot.channel, specSlot.property, sourceProperty.dataType)) {
			// expectedDataTypes is display-only — built locally rather than by isValidDataType, which
			// (correctly) only answers yes/no. Mirrors the same multi-variant-or-single join
			// DeviceValidationService.validatePropertyAgainstSpec uses for its own "expected" field
			// (device-validation.service.ts:707-724), so the reason text matches what that private
			// method would have said, without calling it.
			const expectedDataTypes =
				metadata.hasMultipleDataTypes && metadata.dataTypeVariants && metadata.dataTypeVariants.length > 0
					? metadata.dataTypeVariants.map((variant) => variant.data_type).join(' | ')
					: metadata.data_type;

			return {
				compatible: false,
				reason: `Source property id=${sourceProperty.id} has data type '${sourceProperty.dataType}', which does not satisfy the required data type '${expectedDataTypes}' for '${specSlot.channel}.${specSlot.property}'`,
			};
		}

		return { compatible: true };
	}

	/**
	 * Distinct physical devices a virtual device's linked properties currently draw from. A virtual
	 * device built solely from owned properties (or one that does not exist) resolves to an empty
	 * list, as does one whose every projection has been orphaned.
	 *
	 * Reads the links from the database (`loadLinksByVirtualDevice`) rather than from
	 * VirtualPropertyIndexService's in-memory maps, so that a client which has just created,
	 * remapped or deleted a linked property sees the result of that write. The maps lag every such
	 * write by however long the fire-and-forget rebuild takes — no mutation response waits for it —
	 * which is the right trade for the two consumers the index exists for (both on system-wide,
	 * per-event traffic) and the wrong one here, where this endpoint is called once per request for
	 * a single device.
	 *
	 * The link lookup supplies source device *ids*; each is loaded here rather than served from a
	 * relation cached at index-build time. Loading gives the caller a device whose connection status
	 * is current, which a cached relation could not (see VirtualPropertyIndexService's docstring).
	 */
	async findSourceDevices(virtualDeviceId: string): Promise<DeviceEntity[]> {
		const links = await this.index.loadLinksByVirtualDevice(virtualDeviceId);

		const sourceDeviceIds = new Set(
			links.map((link) => link.sourceDeviceId).filter((sourceDeviceId): sourceDeviceId is string => !!sourceDeviceId),
		);

		const devices: DeviceEntity[] = [];

		for (const sourceDeviceId of sourceDeviceIds) {
			const device = await this.devicesService.findOne(sourceDeviceId);

			if (device) {
				devices.push(device);
			}
		}

		return devices;
	}

	private permissionSatisfied(required: PermissionType, sourcePermissions: Set<PermissionType>): boolean {
		if (sourcePermissions.has(required)) {
			return true;
		}

		if (required === PermissionType.READ_ONLY && sourcePermissions.has(PermissionType.READ_WRITE)) {
			return true;
		}

		if (required === PermissionType.WRITE_ONLY && sourcePermissions.has(PermissionType.READ_WRITE)) {
			return true;
		}

		return false;
	}

	/**
	 * Throws when `property` would be stored projecting a source that cannot fill the spec slot it sits
	 * in — the enforcement half of `reportCompatibility`, run at persistence rather than at preview.
	 *
	 * The wizard previews compatibility before it writes, but a preview is not a guarantee: it is not
	 * atomic with the write, a source's permissions or data type can change in between, and a direct
	 * API call or a remap skips the preview entirely. Without this, an incompatible projection reaches
	 * the database and only fails later — a read exposing the wrong representation, or a write
	 * forwarded to a source that cannot accept it.
	 *
	 * Only projections are checked. An owned (`local`) property has no source, and a projection whose
	 * `sourcePropertyId` is null is either mid-construction or orphaned by a deleted source — the
	 * latter is a lifecycle state the device degrades into, not a write to refuse, and refusing it here
	 * would make an orphaned property impossible to edit back into shape.
	 *
	 * The slot is resolved from stored rows (channel -> its category and its device -> that device's
	 * category) rather than from the payload, because the payload does not carry them: this is exactly
	 * the resolution a DTO constraint cannot do, and why the rule lives here instead. Resolution
	 * failures are left to the guards that own them — `assertChannelOwnerIsVirtual` and
	 * `assertSourceNotVirtual` both run on these same paths and give better messages for a channel or
	 * source that does not resolve — so an unresolvable hop here simply declines to judge rather than
	 * inventing a second, worse error for the same cause.
	 */
	async assertProjectionCompatible(property: VirtualChannelPropertyEntity, channelId: string): Promise<void> {
		if (property.valueOrigin !== VirtualValueOrigin.SOURCE) {
			return;
		}

		const sourcePropertyId =
			property.sourcePropertyId ?? (typeof property.sourceProperty === 'string' ? property.sourceProperty : property.sourceProperty?.id);

		if (!sourcePropertyId) {
			return;
		}

		const channel = await this.channelsService.findOne(channelId);

		if (!channel) {
			return;
		}

		const deviceId = typeof channel.device === 'string' ? channel.device : channel.device?.id;
		const device = deviceId ? await this.devicesService.findOne(deviceId) : null;

		if (!device) {
			return;
		}

		const sourceProperty = await this.channelsPropertiesService.findOne(sourcePropertyId);

		if (!sourceProperty) {
			return;
		}

		const report = this.reportCompatibility(
			{ category: device.category, channel: channel.category, property: property.category },
			sourceProperty,
		);

		if (!report.compatible) {
			throw new VirtualProjectionIncompatibleException(report.reason ?? 'Source property cannot fill this specification slot');
		}
	}

	private async resolveOwningDevice(propertyId: string): Promise<DeviceEntity | null> {
		const property = await this.channelsPropertiesService.findOne(propertyId);

		if (!property) {
			return null;
		}

		const channelId = typeof property.channel === 'string' ? property.channel : property.channel?.id;
		const channel = channelId ? await this.channelsService.findOne(channelId) : null;

		if (!channel) {
			return null;
		}

		const deviceId = typeof channel.device === 'string' ? channel.device : channel.device?.id;

		return deviceId ? await this.devicesService.findOne(deviceId) : null;
	}
}
