import { Injectable } from '@nestjs/common';

import {
	ChannelCategory,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceValidationService, ValidationIssue } from '../../../modules/devices/services/device-validation.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { matchesInvalidValue, matchesStep } from '../../../modules/devices/utils/property-command-value.utils';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';
import { getAllProperties, isChannelAllowed, isValidDataType } from '../../../modules/devices/utils/schema.utils';
import { findEnergySourceType } from '../../../modules/energy/utils/energy-source-type.utils';
import { DEVICES_VIRTUAL_TYPE, VIRTUAL_BLOCKED_CATEGORIES } from '../devices-virtual.constants';
import {
	VirtualCategoryChangeUnsafeException,
	VirtualCategoryNotSupportedException,
	VirtualChannelCategoryChangeUnsafeException,
	VirtualNestingNotAllowedException,
	VirtualOwnedPropertyNotWritableException,
	VirtualOwnerNotVirtualException,
	VirtualPermissionsIncompatibleException,
	VirtualProjectionIncompatibleException,
	VirtualSourceNotFoundException,
	VirtualValueOriginConflictException,
} from '../devices-virtual.exceptions';
import {
	VirtualChannelEntity,
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
		private readonly deviceValidationService: DeviceValidationService,
	) {}

	/**
	 * Throws when moving `device` to its current category would leave it advertising a shape it does
	 * not have.
	 *
	 * `assertCategoryAllowed` only asks whether a category is one virtual devices support at all, which
	 * is a question about the category. This is the question about the *device*: its channels and
	 * properties were built for whichever category the wizard was pointed at, and every slot in them —
	 * which channels are required, which properties each must carry, what each may declare — comes from
	 * that category's specification. A PATCH that swaps `lighting` for `switcher` keeps the `light`
	 * channels and every projection under them, so the device goes on being read as a switcher whose
	 * required slots are simply absent. The admin does not offer the field, but nothing stopped an API
	 * client, and no other guard runs on this path: `assertProjectionCompatible` is a *property* hook
	 * and no property is written by a device PATCH.
	 *
	 * Validated rather than refused outright. A recategorisation the stored structure genuinely
	 * survives is not a problem to solve, and a device with no channels yet has nothing to contradict —
	 * `validateDeviceStructure` (documented for exactly this pre-save use) answers both without a rule
	 * of its own that could drift from the one the validation endpoint applies. What it is asked is a
	 * comparison rather than a verdict; see the diff below for why an absolute one would be a blanket
	 * ban in disguise.
	 *
	 * Only asked when the category actually changes. Running it on every PATCH would mean a device that
	 * is *already* structurally invalid — a hand-built one, or one whose spec moved under it — could no
	 * longer even be renamed.
	 */
	async assertCategoryChangeSafe(device: DeviceEntity, previousCategory: DeviceCategory | undefined): Promise<void> {
		if (previousCategory === undefined || device.category === previousCategory) {
			return;
		}

		const channels = await this.channelsService.findAll(device.id);

		if (channels.length === 0) {
			return;
		}

		const structure = await Promise.all(
			channels.map(async (channel) => ({
				id: channel.id,
				category: channel.category,
				parent: typeof channel.parent === 'string' ? channel.parent : (channel.parent?.id ?? null),
				properties: (await this.channelsPropertiesService.findAll(channel.id)).map((property) => ({
					category: property.category,
					dataType: property.dataType,
					permissions: property.permissions,
				})),
			})),
		);

		// The same structure judged twice, and only what the *move* introduces is held against it.
		//
		// Absolute validity is the wrong bar here, because a virtual device does not clear it against any
		// category, including its own: `device_information` is synthesized carrying only `status`, so
		// `manufacturer`, `model` and `serial_number` are always missing. Refusing on that would make
		// every recategorisation impossible while claiming to have judged the structure, which is a
		// blanket ban wearing a validation costume. Diffing answers the question actually being asked —
		// does moving to this category break something that was not already broken — so a pre-existing
		// gap travels along untouched and a channel that only *this* category fails to define is caught.
		//
		// Every issue counts, not the errors `isValid` is computed from. That flag serves the reporting
		// endpoint, where a stored channel outside the specification is advisory because the device is at
		// least still what it claims to be. Here it is the damage itself — every projection under such a
		// channel stays attached to a slot the new category never defines, which `reportCompatibility`
		// would refuse on sight — and `UNKNOWN_CHANNEL` is warning-severity, as are `DUPLICATE_CHANNEL`,
		// `INVALID_DATA_TYPE` and `INVALID_PERMISSIONS`.
		// Identity is the structured fields only. `message` and `expected` are both *rendered against the
		// category being validated* — "…is not defined in specification for device category 'generic'"
		// against "…for device category 'switcher'" — so keying on either would make a defect the device
		// already had look newly introduced purely because the sentence changed, and the diff would
		// collapse back into the blanket ban it exists to avoid. Type, channel and property say which
		// defect it is; the rendered text is kept for the operator, not for the comparison.
		const identify = (issue: ValidationIssue): string =>
			`${issue.type}|${issue.channelCategory ?? ''}|${issue.propertyCategory ?? ''}`;

		const before = new Set(
			this.deviceValidationService
				.validateDeviceStructure({ category: previousCategory, channels: structure })
				.issues.map(identify),
		);

		const introduced = this.deviceValidationService
			.validateDeviceStructure({ category: device.category, channels: structure })
			.issues.filter((issue) => !before.has(identify(issue)));

		if (introduced.length === 0) {
			return;
		}

		const reasons = introduced.map((issue) => issue.message).join('; ');

		throw new VirtualCategoryChangeUnsafeException(
			`Device id=${device.id} cannot change category from '${previousCategory}' to '${device.category}': the channels and properties it already has do not satisfy the new category (${reasons}). Its structure is built for the category it was created with — rebuild the device rather than relabelling it`,
		);
	}

	/**
	 * Refuses a virtual channel's category change while projections still hang off it.
	 *
	 * A channel's category is half of the address of every slot its properties fill — the other half is
	 * the device's — so moving it leaves each projection reading a source that was judged against a slot
	 * the new category never defines. Nothing else would notice: no property row is written by a channel
	 * PATCH, so no property hook runs, and the maintenance listener skips virtual properties by design.
	 *
	 * Refused rather than repaired, for the same reason `assertCategoryChangeSafe` refuses: a virtual
	 * device's structure is generated from the category it was created with, and rebuilding it is the
	 * operation an operator relabelling a channel actually meant. A channel carrying nothing that
	 * projects has nothing to invalidate and is left alone.
	 */
	async assertChannelCategoryChangeSafe(
		channel: VirtualChannelEntity,
		previousCategory: ChannelCategory | undefined,
	): Promise<void> {
		if (previousCategory === undefined || channel.category === previousCategory) {
			return;
		}

		const properties = await this.channelsPropertiesService.findAll(channel.id);

		if (properties.length === 0) {
			return;
		}

		// Every property is judged, owned ones included. An owned property fills a slot just as surely as
		// a projection does — an `outlet` channel owns a read-only `in_use`, and `switcher` has no such
		// slot, so relabelling would leave a property the specification does not know about on a device
		// that claims to be a switcher.
		const withoutSlot = properties.filter(
			(property) => !getAllProperties(channel.category).some((slot) => slot.category === property.category),
		);

		// A projection is refused even when the new category happens to define a slot of the same name.
		// `reportCompatibility` judged its source against the *old* slot — its data type, its permissions,
		// its unit — and two categories can define the same property category with different shapes.
		// Nothing re-derives that verdict on a channel PATCH, so the safe answer is the same one the
		// device-level guard gives: rebuild rather than relabel.
		const projecting = properties.filter(
			(property) => property instanceof VirtualChannelPropertyEntity && property.isProjecting,
		);

		if (withoutSlot.length === 0 && projecting.length === 0) {
			return;
		}

		const reason =
			withoutSlot.length > 0
				? `it carries ${withoutSlot.length} propert${withoutSlot.length === 1 ? 'y' : 'ies'} ` +
					`(${withoutSlot.map((property) => property.category).join(', ')}) that '${channel.category}' does not define`
				: `${projecting.length} of its properties read a source judged against the slots '${previousCategory}' defines`;

		throw new VirtualChannelCategoryChangeUnsafeException(
			`Channel id=${channel.id} cannot change category from '${previousCategory}' to '${channel.category}': ` +
				`${reason}. Rebuild the device rather than relabelling its channel`,
		);
	}

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

		// Unit, before format. Two slots can agree on permissions, data type and range and still mean
		// different things: `carbon_dioxide.concentration` is ppm and `nitrogen_dioxide.concentration` is
		// µg/m³, both read-only floats over [0, 100000]. A projection forwards the number unchanged, so
		// pairing those relabels every reading rather than converting it — the same reasoning that makes
		// a representation mismatch a refusal rather than a conversion.
		const unitVariant = metadata.hasMultipleDataTypes
			? metadata.dataTypeVariants?.find((candidate) => String(candidate.data_type) === String(sourceProperty.dataType))
			: undefined;

		const expectedUnit = (unitVariant ? unitVariant.unit : metadata.unit) ?? null;
		const actualUnit = sourceProperty.unit ?? null;

		// Equality, not "equal when both declare one". A unit on one side and nothing on the other is a
		// mismatch too: recategorising a `battery` channel to `door` leaves the same `percentage`
		// property unitless while the projection still says `%`, and the readings keep being presented
		// as percentages. Same rule as format and step — unknown is not compatible with declared.
		if (expectedUnit !== actualUnit) {
			return {
				compatible: false,
				reason: `Source property id=${sourceProperty.id} is measured in ${actualUnit === null ? 'no unit' : `'${actualUnit}'`}, which '${specSlot.channel}.${specSlot.property}' exposes as ${expectedUnit === null ? 'no unit' : `'${expectedUnit}'`}; a projection forwards the value unchanged rather than converting it`,
			};
		}

		const formatMismatch = this.describeFormatMismatch(metadata, specSlot, sourceProperty);

		if (formatMismatch !== null) {
			return { compatible: false, reason: formatMismatch };
		}

		return { compatible: true };
	}

	/**
	 * Why `sourceProperty`'s format cannot serve the slot, or `null` when it can.
	 *
	 * Matching data types are not enough. `fan.speed` and `light.brightness` are both `rw` enums, so
	 * every check above passes — but their value sets differ (`…high, turbo, auto` against
	 * `…high, full`), so a fan speed projected into a brightness slot would report `turbo` as a
	 * brightness and could never produce `full`. The same holds for numeric ranges.
	 *
	 * Direction matters, and the two directions are different questions:
	 *
	 * - Every value the *source* can produce has to be legal in the slot, or a read exposes something
	 *   the slot's own specification says cannot occur.
	 * - Every value the *slot* can be commanded with has to be acceptable to the source, or a write
	 *   is forwarded to a device that will refuse it. Only asked of a writable slot.
	 *
	 * For a read-write slot that comes to equality, which is the honest answer: a projection is meant
	 * to be the source seen from somewhere else, not a lossy adapter. Conversion between value spaces
	 * is a different feature, and pretending compatibility here would be the wrong place to start it.
	 *
	 * A slot or source without a declared format is not judged: nothing constrains it, so there is
	 * nothing to contradict.
	 */
	private describeFormatMismatch(
		metadata: {
			permissions: PermissionType[];
			format?: unknown;
			step?: unknown;
			dataTypeVariants?: { data_type: string; format?: unknown; step?: unknown }[] | null;
		},
		specSlot: VirtualCompatibilitySpecSlot,
		sourceProperty: ChannelPropertyEntity,
	): string | null {
		// WRITE_ONLY counts: the question the reverse check asks is "can the source accept everything this
		// slot may be commanded with", and a write-only slot is commanded exactly like a read-write one.
		// Missing it let a source accepting only `play` fill `media_playback.command`, which also exposes
		// `pause`, `stop` and the navigation commands.
		const slotWritable =
			metadata.permissions.includes(PermissionType.READ_WRITE) ||
			metadata.permissions.includes(PermissionType.WRITE_ONLY);
		const slotName = `'${specSlot.channel}.${specSlot.property}'`;

		const variant = metadata.dataTypeVariants?.find(
			(candidate) => String(candidate.data_type) === String(sourceProperty.dataType),
		);
		// `variant ? variant.format : …`, not `??`: a matched variant's format may be *explicitly* null,
		// and that null is the answer. `media_input.input`'s string variant declares no format on
		// purpose — coalescing past it borrows the first variant's enum set and rejects every legitimate
		// free-text source, which the specification plainly allows.
		const expected = variant ? variant.format : metadata.format;
		const actual = sourceProperty.format as unknown;

		if (!Array.isArray(expected) || expected.length === 0) {
			// An unconstrained *read-only* slot cannot be contradicted: whatever the source reports is a
			// value the slot permits, because the slot permits everything.
			if (!slotWritable || !Array.isArray(actual) || actual.length === 0) {
				return null;
			}

			// Writable is the other direction, and it does not follow. The slot says any value may be
			// commanded and the source says only some may — so `media_input.source`'s free-text variant
			// backed by a source restricted to `['HDMI 1']` accepts `TV` at the projection and forwards it
			// to a device that refuses it. Unconstrained is the widest possible claim, so any source
			// narrowing it is narrowing something the slot promises.
			return `Source property id=${sourceProperty.id} accepts only [${actual.join(', ')}], while ${slotName} may be commanded with any value of its type`;
		}

		if (!Array.isArray(actual) || actual.length === 0) {
			// The slot *is* constrained and the source declares no format, so nothing here can show the
			// source stays inside it — an `rw` `uchar` with no format could report anything, including
			// values outside a `[0, 100]` slot. Unverified is not the same as compatible, and treating it
			// as compatible is how an out-of-range value gets stored and projected.
			return `Source property id=${sourceProperty.id} declares no format, so it cannot be shown to stay within the one '${specSlot.channel}.${specSlot.property}' defines`;
		}

		// Which shape the slot expects is decided by the slot, not by what the candidate happens to send.
		// A numeric variant declaring `[0, 86400]` and a candidate declaring `['0', '86400']` would
		// otherwise fall through to the enum comparison, where stringifying both sides makes the sets
		// look equal — so a `fan.timer` projection could pass with neither numeric bounds nor a step as
		// far as the command validator is concerned, and 61 would reach a step-60 source.
		// Numeric by its *values*, not by its length: `[min]` is a supported one-sided format meaning "no
		// maximum", and PropertyValueService reads it that way. Deciding by length sent a `[0]` source
		// down the enum path, where `{0}` looked like a subset of `{0, 10000}` and passed while the
		// source could report anything above the slot's ceiling.
		// Numeric by its values, and a `null` endpoint counts as one. `[0, null]` is how the specification
		// writes "no maximum" — `electrical_energy.consumption`, `grid_import`, `grid_export` and
		// `electrical_generation.production` all use it — and reading that `null` as "not a number" sent
		// the whole slot down the enum path, where a perfectly good `[0, 100]` source failed for the
		// reason that `100` is not one of `{0, null}`. Every energy slot in the specification was
		// unmappable.
		const isBound = (value: unknown): boolean => typeof value === 'number' || value === null;
		const rangeLike = (values: unknown[]): boolean =>
			values.every(isBound) && values.some((value) => typeof value === 'number');

		const slotIsNumeric = rangeLike(expected);

		if (slotIsNumeric && !rangeLike(actual)) {
			return `Source property id=${sourceProperty.id} declares a non-numeric format, which cannot describe the numeric range ${slotName} defines`;
		}

		// A numeric format is a range; anything else is an enum value set.
		const numeric = slotIsNumeric && rangeLike(actual);

		if (numeric) {
			// An absent or null endpoint is an open side, so a range reads as `[min, +∞)` — which makes
			// containment ordinary arithmetic again: `[0, 100]` sits inside `[0, ∞)`, and `[0, ∞)` does not
			// sit inside `[0, 100]`, both of which fall out of comparing the bounds directly. This replaces
			// a blanket refusal of one-sided formats that was right about the second case and wrong about
			// the first.
			const bounds = (values: unknown[]): [number, number] => [
				typeof values[0] === 'number' ? values[0] : Number.NEGATIVE_INFINITY,
				typeof values[1] === 'number' ? values[1] : Number.POSITIVE_INFINITY,
			];

			const describe = ([min, max]: [number, number]): string =>
				`[${min === Number.NEGATIVE_INFINITY ? 'unbounded' : min}, ${max === Number.POSITIVE_INFINITY ? 'unbounded' : max}]`;

			const [expectedMin, expectedMax] = bounds(expected);
			const [actualMin, actualMax] = bounds(actual);

			if (actualMin < expectedMin || actualMax > expectedMax) {
				return `Source property id=${sourceProperty.id} ranges ${describe([actualMin, actualMax])}, outside the range ${describe([expectedMin, expectedMax])} that ${slotName} accepts`;
			}

			if (slotWritable && (expectedMin < actualMin || expectedMax > actualMax)) {
				return `Source property id=${sourceProperty.id} ranges ${describe([actualMin, actualMax])}, which cannot accept every value ${slotName} may be commanded with (${describe([expectedMin, expectedMax])})`;
			}

			// The range says which values are legal; the step says which of them actually exist. A slot
			// stepping by 1 can be commanded with 43, and a source stepping by 5 cannot take it — the
			// command passes validation against the virtual property and is then forwarded unchanged, so
			// the source rejects or silently rounds something both the preview and the persistence guard
			// accepted. Judged only when both sides declare a step; an undeclared one constrains nothing.
			// Same reason as the format above: a matched variant's explicit null step is the answer.
			const expectedStep = variant ? variant.step : metadata.step;
			const actualStep = sourceProperty.step as unknown;

			// A writable slot with no grid of its own accepts any value in range, so a source that *does*
			// impose one is stricter than the projection standing in front of it: `light.saturation` has
			// no step, and a source stepping by 5 rejects the 43 the projection happily accepted and
			// forwarded. Only asked of writable slots — a read-only projection never sends anything.
			if (
				slotWritable &&
				(typeof expectedStep !== 'number' || expectedStep <= 0) &&
				typeof actualStep === 'number' &&
				actualStep > 0
			) {
				return `Source property id=${sourceProperty.id} steps by ${actualStep}, a stricter grid than ${slotName} imposes, so it would refuse values the projection accepts`;
			}

			if (typeof expectedStep === 'number' && expectedStep > 0) {
				// A slot that defines a grid is not satisfied by a candidate that defines none. Skipping the
				// comparison in that case let a `fan.timer` projection declare `[0, 86400]` with no step,
				// so `validatePropertyCommandValue` accepted 61 and forwarded it unchanged to a step-60
				// source. Same rule as formats: unconstrained is not compatible with constrained.
				if (typeof actualStep !== 'number' || actualStep <= 0) {
					return `Source property id=${sourceProperty.id} declares no step, so it cannot be shown to land on the ${expectedStep} grid ${slotName} defines`;
				}

				// A grid is a width *and* an origin. `matchesStep` — the same helper that validates an
				// incoming command — measures from `format[0]`, so two grids of equal width sitting half a
				// step apart accept entirely disjoint value sets: an accelerometer reporting
				// [-15.9995, 15.9995] by 0.001 never lands on a [-16, 16] slot's grid, even though the
				// widths match exactly. Asked through that helper rather than by remainder arithmetic,
				// which would also be wrong for floats — it carries the tolerance the validator uses.
				//
				// A grid needs a finite origin to be measured from. Both origins are finite for every slot
				// the specification defines — the open side of a `[0, null]` range is its *maximum* — but a
				// lower bound left open would make `matchesStep` measure from -∞ and answer NaN, which
				// compares false and would refuse a pairing for a reason nobody could act on. Nothing is
				// lost by declining to judge: a range with no floor has no grid to be on.
				if (!Number.isFinite(expectedMin) || !Number.isFinite(actualMin)) {
					return null;
				}

				// Every value the source can report has to land on the slot's grid: that holds when the
				// source's own origin does and its width is a whole number of the slot's steps.
				const sourceOriginOnSlotGrid = matchesStep(actualMin, expectedStep, expectedMin);

				if (!sourceOriginOnSlotGrid || !matchesStep(expectedMin + actualStep, expectedStep, expectedMin)) {
					return `Source property id=${sourceProperty.id} steps by ${actualStep} from ${actualMin}, which does not land on the ${expectedStep} grid ${slotName} defines from ${expectedMin}`;
				}

				// And every value the slot may be commanded with has to land on the source's.
				if (
					slotWritable &&
					(!matchesStep(expectedMin, actualStep, actualMin) ||
						!matchesStep(actualMin + expectedStep, actualStep, actualMin))
				) {
					return `Source property id=${sourceProperty.id} steps by ${actualStep} from ${actualMin}, so it cannot accept every value ${slotName} may be commanded with (it steps by ${expectedStep} from ${expectedMin})`;
				}
			}

			return null;
		}

		const expectedValues = new Set(expected.map((value) => String(value)));
		const actualValues = new Set(actual.map((value) => String(value)));

		const unreadable = [...actualValues].filter((value) => !expectedValues.has(value));

		if (unreadable.length > 0) {
			return `Source property id=${sourceProperty.id} can report ${unreadable.map((value) => `'${value}'`).join(', ')}, which ${slotName} does not define`;
		}

		if (slotWritable) {
			const uncommandable = [...expectedValues].filter((value) => !actualValues.has(value));

			if (uncommandable.length > 0) {
				return `Source property id=${sourceProperty.id} does not accept ${uncommandable.map((value) => `'${value}'`).join(', ')}, which ${slotName} may be commanded with`;
			}
		}

		return null;
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
	/**
	 * Why `sourceProperty`'s value domain does not fit inside `property`'s, or `null` when it does.
	 *
	 * Matching data types are not the whole of "speaks the same language", and neither is fitting the
	 * slot. Both halves are judged against the slot separately, and the slot is routinely wide enough to
	 * admit two declarations that contradict each other: `temperature.temperature` accepts [0, 100], so a
	 * source formatted [0, 40] and a projection formatted [60, 100] each pass on their own while every
	 * reading the source produces falls outside the range its projection advertises.
	 *
	 * Asked with `describeFormatMismatch` rather than a second comparison of its own, by handing it the
	 * *projection* where it normally takes the slot. Both of its directions are then the ones that matter
	 * here — every value the source can produce has to be legal in the projection, and, when the
	 * projection is writable, every value the projection may be commanded with has to be acceptable to
	 * the source — and its step-grid and one-sided-range handling comes along unchanged. One rule, one
	 * implementation, applied to the other pair.
	 *
	 * Public because the write paths are not the only place this has to hold: a source whose format is
	 * *edited* can walk out of its projection's range while still fitting the slot, which
	 * `reportCompatibility` cannot see, so the metadata listener asks the same question of the same
	 * method rather than approximating it.
	 */
	describeProjectionConstraintMismatch(
		property: ChannelPropertyEntity,
		sourceProperty: ChannelPropertyEntity,
		specSlot: VirtualCompatibilitySpecSlot,
	): string | null {
		const mismatch = this.describeFormatMismatch(
			{ permissions: property.permissions ?? [], format: property.format, step: property.step },
			specSlot,
			sourceProperty,
		);

		// The slot's name is what `describeFormatMismatch` reaches for when it describes the side it was
		// handed; here that side is the projection, so the reason has to say so.
		return mismatch === null
			? null
			: mismatch.replace(`'${specSlot.channel}.${specSlot.property}'`, `property id=${property.id}`);
	}

	/**
	 * Why `property` may not project `sourceProperty`'s values given their reserved sentinels, or `null`
	 * when it may.
	 *
	 * A sentinel belongs to the device, not to the specification — no channel spec declares one, because
	 * "999 means I have no reading" is a fact about a particular thermometer. `reportCompatibility` asks
	 * what a *slot* requires and so cannot ask this at all; it is a question only the projection and its
	 * source can answer about each other.
	 *
	 * One-sided on purpose. A source that reserves a value needs its projection to reserve the same one,
	 * in both directions of travel:
	 *
	 * - Reading, the projection forwards the value unchanged, so a sentinel it does not know about is
	 *   presented as a real measurement.
	 * - Writing, `validatePropertyCommandValue` runs against the *projection* — that is the property the
	 *   command names — and `VirtualDevicePlatform.processBatch()` forwards what it accepts without
	 *   revalidating against the source. So a command equal to the source's sentinel passes a projection
	 *   that declares none and reaches a device that would have refused it outright.
	 *
	 * The other way round is only over-strict: a projection reserving a value its source does not means
	 * a command it would have accepted is refused early. Nothing unsafe happens, and refusing to persist
	 * it would buy nothing, so it is left alone.
	 *
	 * Compared with `matchesInvalidValue` rather than `!==`, because `invalid` is a `text` column: a
	 * numeric sentinel written as 50 reads back as '50', and the command validator already normalizes
	 * across that. Asking the same helper is what keeps this from disagreeing with the check that
	 * actually refuses a value.
	 */
	describeSentinelMismatch(property: ChannelPropertyEntity, sourceProperty: ChannelPropertyEntity): string | null {
		const sourceSentinel = sourceProperty.invalid ?? null;
		const declared = property.invalid ?? null;

		if (sourceSentinel === null && declared === null) {
			return null;
		}

		if (sourceSentinel !== null && declared !== null && matchesInvalidValue(sourceSentinel, declared)) {
			return null;
		}

		const describe = (sentinel: string | number | boolean | null): string =>
			sentinel === null ? 'no invalid value' : `'${String(sentinel)}'`;

		return `Property id=${property.id} reserves ${describe(declared)} while its source id=${sourceProperty.id} reserves ${describe(sourceSentinel)}; a projection forwards its source's value unchanged and is what a command is validated against, so the two have to reserve the same sentinel`;
	}

	async assertProjectionCompatible(property: VirtualChannelPropertyEntity, channelId: string): Promise<void> {
		// Cleared before anything is judged, and re-earned below by a row that still qualifies.
		//
		// The claim is a statement about what this property projects *now*, so every path that leaves
		// this method has to leave it consistent — including the ones that leave early. A PATCH turning a
		// claimed projection into an owned property or into an orphan returns before the settlement at
		// the end, and a claim surviving that would hold its meter forever: the unique index would then
		// refuse a legitimate replacement, and nothing but deleting the stale row would release it.
		//
		// Clearing is also the conservative direction where the source or channel cannot be resolved at
		// all. An unclaimed meter attributes to the physical device, which is where it went before any of
		// this existed — wrong for a split, but not misleading.
		//
		// The meter this releases may be left with no claimant, which is what the promotion path picks
		// up; see `settleEnergyClaim`.
		property.energyClaimPropertyId = null;

		// Only an *explicit* `local` is skipped. `valueOrigin` deliberately carries no class-field
		// initializer (see the entity), so a create that supplies `source_property` and omits the
		// optional `value_origin` arrives here as `undefined` and only becomes `source` when the column
		// default is applied on save — after this hook. Testing for `!== SOURCE` would let exactly that
		// request through unchecked, which is the shape a direct API caller is most likely to send.
		if (property.valueOrigin === VirtualValueOrigin.LOCAL) {
			return;
		}

		const sourcePropertyId =
			property.sourcePropertyId ??
			(typeof property.sourceProperty === 'string' ? property.sourceProperty : property.sourceProperty?.id);

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

		const specSlot = { category: device.category, channel: channel.category, property: property.category };

		const report = this.reportCompatibility(specSlot, sourceProperty);

		if (!report.compatible) {
			throw new VirtualProjectionIncompatibleException(
				report.reason ?? 'Source property cannot fill this specification slot',
			);
		}

		// The projection's own declaration is checked against the slot too, not only its source: the
		// wizard derives these fields from the spec, but a direct create or PATCH sets them freely.
		//
		// Data type and format are genuinely the same question a source is asked, so they go through the
		// same predicate. Permissions are *not*. `reportCompatibility` asks whether a candidate can
		// satisfy what the slot requires, and a source offering more than required is fine — an `rw`
		// source happily feeds a `ro` slot. A projection declaring more than the slot exposes is the
		// opposite situation: `temperature.temperature` is read-only, and a projection calling itself
		// `rw` there advertises and forwards a write the specification does not have. So the declaration
		// is checked the other way round — it may not claim a capability the slot does not offer.
		// Judged with the unit resolved rather than as stored, because `unit` is never stored: it has no
		// column, the create DTO cannot carry it, and ChannelPropertyEntitySubscriber derives it on load.
		// A projection arriving here from a create therefore has none at all, and comparing that absence
		// against a slot that declares one refused every creation on `temperature.temperature`,
		// `electrical_power.power` and every other unit-bearing slot — after the wizard preview had said
		// the pairing was fine. An update is the subtler half of the same thing: the loaded row carries
		// the unit derived from its *old* data type, so a PATCH that changes the representation would be
		// judged against a unit that no longer applies.
		//
		// There is nothing lost by resolving it. The unit is a function of channel category, property
		// category and data type — the same three the slot's own expected unit is read from — so for a
		// projection the comparison can only ever be a tautology. It earns its place on the *source* side
		// of this method, where the two really can disagree.
		// Cloned through the prototype rather than spread: `type` is a getter on the entity, and a spread
		// would drop it. The clone is what gets the resolved unit, so the row on its way to `save` is
		// left exactly as the caller sent it.
		const declared = Object.assign(
			Object.create(Object.getPrototypeOf(property) as object) as VirtualChannelPropertyEntity,
			property,
			{ channel },
		);

		declared.unit = resolvePropertyUnit(declared);

		const declaration = this.reportCompatibility(specSlot, declared);

		if (!declaration.compatible) {
			throw new VirtualProjectionIncompatibleException(
				declaration.reason?.replace(`Source property id=${property.id}`, `Property id=${property.id}`) ??
					'Property does not match this specification slot',
			);
		}

		// Both halves can satisfy a multi-variant slot independently and still disagree with each other:
		// `light.brightness` accepts a `uchar` percentage and an `enum` level, so remapping a `uchar`
		// projection onto a compatible enum source passes both checks above while leaving enum readings
		// flowing through a property that calls itself numeric. A projection forwards its source's value
		// unchanged — there is no conversion anywhere — so the two have to speak the same representation.
		if (property.dataType !== sourceProperty.dataType) {
			throw new VirtualProjectionIncompatibleException(
				`Property id=${property.id} is declared '${property.dataType}' but its source id=${sourceProperty.id} is '${sourceProperty.dataType}'; a projection forwards its source's value unchanged, so the two must match`,
			);
		}

		// Matching data types are not the whole of "speaks the same language". Both halves have been
		// judged against the *slot* by now, and both can pass that independently while disagreeing with
		// each other: `temperature.temperature` accepts [0, 100], so a source formatted [0, 40] and a
		// projection formatted [60, 100] each fit, and every reading the source produces then falls
		// outside the range its projection advertises. The same holds for a step grid.
		//
		const projectionMismatch = this.describeProjectionConstraintMismatch(property, sourceProperty, specSlot);

		if (projectionMismatch !== null) {
			throw new VirtualProjectionIncompatibleException(projectionMismatch);
		}

		const sentinelMismatch = this.describeSentinelMismatch(property, sourceProperty);

		if (sentinelMismatch !== null) {
			throw new VirtualProjectionIncompatibleException(sentinelMismatch);
		}

		// A step is either absent or a usable grid — `validatePropertyCommandValue` refuses every numeric
		// command on a property whose step is non-null but not finite and positive. Treating `0` as "no
		// constraint" here would persist a projection that is compatible on paper and can never actually
		// be commanded, so the declaration is held to the same rule the validator applies.
		if (
			property.step !== null &&
			property.step !== undefined &&
			(!Number.isFinite(property.step) || property.step <= 0)
		) {
			throw new VirtualProjectionIncompatibleException(
				`Property id=${property.id} declares step ${property.step}, which is not a usable grid; a step must be absent or a positive, finite number`,
			);
		}

		const slotMetadata = getAllProperties(specSlot.channel).find(
			(candidate) => candidate.category === specSlot.property,
		);

		if (slotMetadata) {
			const slotPermissions = new Set(slotMetadata.permissions);
			const overclaimed = (property.permissions ?? []).filter((declared) => !slotPermissions.has(declared));

			if (overclaimed.length > 0) {
				throw new VirtualProjectionIncompatibleException(
					`Property id=${property.id} declares permission(s) [${overclaimed.join(', ')}] that '${specSlot.channel}.${specSlot.property}' does not offer (it is [${slotMetadata.permissions.join(', ')}])`,
				);
			}
		}

		await this.settleEnergyClaim(property, channel.category, sourceProperty);
	}

	/**
	 * Decides whether this projection is the one accountable for its source's kWh, and writes that onto
	 * the row about to be saved.
	 *
	 * A gate that mutates, which is worth justifying: this is the one point holding everything the
	 * decision needs — the destination channel, the property's own category, and the source it was just
	 * judged against — and the value it derives is a function of exactly what it judged. Setting it here
	 * also means the claim and the projection are written by the same statement, so no failure can leave
	 * one without the other, and the unique index arbitrates concurrent claimants without a transaction
	 * spanning these hooks.
	 *
	 * Energy is the one quantity where two virtual devices reading one source is not merely redundant
	 * but wrong. A temperature is non-additive — two rooms observing the same thermometer is coherent,
	 * and the design allows it deliberately — while a kWh billed to two rooms is arithmetic nobody
	 * asked for.
	 */
	private async settleEnergyClaim(
		property: VirtualChannelPropertyEntity,
		destinationChannelCategory: ChannelCategory,
		sourceProperty: ChannelPropertyEntity,
	): Promise<void> {
		const conflict = await this.describeEnergyClaimConflict(
			{ channel: destinationChannelCategory, property: property.category },
			sourceProperty,
			property.id,
		);

		if (conflict !== null) {
			throw new VirtualProjectionIncompatibleException(conflict);
		}

		// Judged on the *destination*: what makes a reading energy is the slot it is presented in, which
		// is the pair the ingestion classifies when it handles this projection's own event. A
		// `consumption` property sitting in a `generic` channel is not a meter anywhere else and becomes
		// one here — which is exactly the case that double-counts today, since nothing skips those
		// projections.
		if (findEnergySourceType(destinationChannelCategory, property.category) === null) {
			return;
		}

		property.energyClaimPropertyId = sourceProperty.id;
	}

	/**
	 * Why this slot may not bill this source's kWh, or null when it may — and null, too, for the many
	 * slots that carry no energy at all and so have nothing to bill.
	 *
	 * Separate from the settlement above because two callers need the same answer: the gate, which
	 * refuses the write, and the wizard's compatibility preview, which greys the pairing out before
	 * anyone tries. A preview that offered a meter the very next request rejects is the shape of false
	 * green the nesting rule already avoids the same way — the user acts on green.
	 *
	 * `holder` is the property allowed to be holding the claim already: its own id at the gate, so a
	 * PATCH that leaves the source alone is not read as a second claimant, and nothing in the preview,
	 * where the property being described does not exist yet.
	 */
	async describeEnergyClaimConflict(
		slot: { channel: ChannelCategory; property: PropertyCategory },
		sourceProperty: ChannelPropertyEntity,
		holder?: string,
	): Promise<string | null> {
		const destination = findEnergySourceType(slot.channel, slot.property);

		if (destination === null) {
			return null;
		}

		const sourceChannel = await this.resolveChannelOf(sourceProperty);
		const source = findEnergySourceType(sourceChannel?.category, sourceProperty.category);

		// A projection may not change what a reading means. Nothing structural separates `grid_import`
		// from `grid_export` — both read-only floats in kWh over the same range — so the slot report
		// accepts the pairing, and the room would then be shown an import under the heading of an
		// export. Refused rather than relabelled: an import meter is not an export meter, and quietly
		// filing it as one is worse than saying the mapping is wrong.
		//
		// Dormant today, and deliberately kept: `electrical_energy.consumption` is the only energy slot
		// a virtual device can currently reach, so no two reachable slots disagree. The other three are
		// unreachable for reasons that have nothing to do with energy — `mapPropertyCategory` in
		// `schema.utils.ts` omits `grid_import` and `grid_export` (34 of the spec's 100 property keys are
		// missing from it), and no device category declares an `electrical_generation` channel at all.
		// Both are recorded as follow-ups; this guard is what stops the gap reopening when either is
		// fixed, which is exactly when nobody would think to look for it.
		if (source !== null && source.sourceType !== destination.sourceType) {
			return `Source id=${sourceProperty.id} would be presented as '${destination.sourceType}', but it reads '${source.sourceType}'; a projection forwards its source's value unchanged, so it cannot change what the reading means`;
		}

		const claimant = await this.index.findEnergyClaimant(sourceProperty.id);

		if (claimant !== null && claimant !== holder) {
			return `Source property id=${sourceProperty.id} is already the energy meter of virtual property id=${claimant}; a meter's consumption is billed to one place, so it can only be projected into one energy slot`;
		}

		return null;
	}

	private async resolveChannelOf(property: ChannelPropertyEntity): Promise<ChannelEntity | null> {
		const channelId = typeof property.channel === 'string' ? property.channel : property.channel?.id;

		return channelId ? await this.channelsService.findOne(channelId) : null;
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
