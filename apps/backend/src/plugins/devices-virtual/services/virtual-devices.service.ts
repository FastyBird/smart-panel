import { Injectable } from '@nestjs/common';

import { DeviceCategory, PermissionType } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_VIRTUAL_TYPE, VIRTUAL_BLOCKED_CATEGORIES } from '../devices-virtual.constants';
import {
	VirtualCategoryNotSupportedException,
	VirtualNestingNotAllowedException,
	VirtualPermissionsIncompatibleException,
	VirtualSourceNotFoundException,
} from '../devices-virtual.exceptions';
import { VirtualChannelPropertyEntity } from '../entities/devices-virtual.entity';

import { VirtualPropertyIndexService } from './virtual-property-index.service';

/**
 * Validation guards for assembling a virtual device, plus a read of the physical devices behind one.
 *
 * The three `assert*` methods each police one rule from the design's creation flow
 * (docs/superpowers/specs/2026-07-31-virtual-devices-design.md, "Creation flow" / "v1 category
 * boundary"):
 *
 * - `assertCategoryAllowed` — a blocked category needs closed-loop control this plugin does not have.
 * - `assertSourceNotVirtual` — is load-bearing, not optional: VirtualProjectionListener re-emits
 *   CHANNEL_PROPERTY_VALUE_SET and terminates only because no virtual property is ever another's
 *   `sourcePropertyId` (see that listener's docstring). VirtualDevicePlatform.processBatch checks the
 *   same thing at forward-time and calls itself "the backstop against a stale or hand-edited row" —
 *   language that presupposes a *primary* guard exists elsewhere. This is that guard.
 * - `assertPermissionsCompatible` — a writable spec slot fed by a read-only source could never
 *   actually be written.
 *
 * `assertCategoryAllowed` and `assertSourceNotVirtual` are wired into the create/update HTTP path via
 * class-validator constraints (`../validators/category-allowed-constraint.validator.ts`,
 * `../validators/source-not-virtual-constraint.validator.ts`) on the `category` and `source_property`
 * fields of the virtual device/channel-property DTOs — see those files for how. This is what makes
 * `VirtualProjectionListener`'s "nesting is rejected at creation" doc comment actually true rather
 * than aspirational. `assertPermissionsCompatible` is deliberately NOT wired the same way: it needs
 * the target spec slot's required permissions, which depend on the channel category and are not
 * available from a property DTO in isolation — the design spec assigns that filtering to the admin
 * wizard (a follow-up, not part of this backend+panel plan), so this method is called by the wizard,
 * not by a DTO constraint.
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
	 * Distinct physical devices a virtual device's linked properties currently draw from. Read off
	 * VirtualPropertyIndexService rather than a fresh query, per this task's Consumes interface — see
	 * that service's class docstring for the staleness this inherits: only as fresh as the last
	 * add()/rebuild() pass, not a live read. A virtual device built solely from owned properties (or
	 * one that does not exist) resolves to an empty list.
	 *
	 * Returns a Promise (rather than being synchronous) to match the interface this task commits to
	 * — `findSourceDevices(virtualDeviceId): Promise<DeviceEntity[]>` — even though today's lookup is
	 * a synchronous, in-memory index read; no `await` is needed internally.
	 */
	findSourceDevices(virtualDeviceId: string): Promise<DeviceEntity[]> {
		const properties = this.index.findByVirtualDevice(virtualDeviceId);

		const devices = new Map<string, DeviceEntity>();

		for (const property of properties) {
			const device = this.resolveIndexedSourceDevice(property);

			if (device) {
				devices.set(device.id, device);
			}
		}

		return Promise.resolve(Array.from(devices.values()));
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

	/** Mirrors VirtualStatusListener's own resolveSourceDevice: relation-based, not an id lookup. */
	private resolveIndexedSourceDevice(property: VirtualChannelPropertyEntity): DeviceEntity | null {
		const channel = property.sourceProperty?.channel;

		if (!channel || typeof channel === 'string') {
			return null;
		}

		return typeof channel.device === 'string' ? null : (channel.device ?? null);
	}
}
