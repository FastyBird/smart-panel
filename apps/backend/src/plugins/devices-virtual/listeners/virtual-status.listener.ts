import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ConnectionState, EventType } from '../../../modules/devices/devices.constants';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DEVICES_VIRTUAL_PLUGIN_NAME, DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { VirtualChannelPropertyEntity } from '../entities/devices-virtual.entity';
import { VirtualPropertyIndexService } from '../services/virtual-property-index.service';

/**
 * A virtual device has no connection of its own: it is CONNECTED only while every distinct device
 * it draws a property from is online and none of its properties is orphaned, and DISCONNECTED
 * otherwise. Runs once per source device connection change, recomputing every virtual device that
 * change affects.
 *
 * `setConnectionState` re-emits DEVICE_CONNECTION_CHANGED for the virtual device this listener just
 * updated, re-entering `handleConnectionChanged`. Nesting is rejected at creation (enforced by
 * SourceNotVirtualConstraintValidator), so the index would report no virtual devices for a virtual
 * device's own id regardless — but the type check below makes that termination obvious rather than
 * incidental, and skips a pointless aggregation pass on every virtual status write.
 */
@Injectable()
export class VirtualStatusListener {
	private readonly logger = createExtensionLogger(DEVICES_VIRTUAL_PLUGIN_NAME, 'VirtualStatusListener');

	constructor(
		private readonly index: VirtualPropertyIndexService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
	) {}

	@OnEvent(EventType.DEVICE_CONNECTION_CHANGED)
	async handleConnectionChanged(payload: {
		device: DeviceEntity;
		state: ConnectionState;
		reason?: string;
	}): Promise<void> {
		if (payload.device.type === DEVICES_VIRTUAL_TYPE) {
			return;
		}

		const virtualDeviceIds = this.index.findVirtualDeviceIdsBySourceDevice(payload.device.id);

		for (const virtualDeviceId of virtualDeviceIds) {
			await this.deviceConnectivityService.setConnectionState(virtualDeviceId, {
				state: this.aggregateState(virtualDeviceId),
				reason: 'aggregated from source devices',
			});
		}

		if (virtualDeviceIds.length > 0) {
			this.logger.debug(
				`Recomputed connection state for ${virtualDeviceIds.length} virtual device(s) after source device id=${payload.device.id} changed to ${payload.state}`,
			);
		}
	}

	/**
	 * CONNECTED when every distinct source device backing this virtual device is online and none of
	 * its properties is orphaned; DISCONNECTED otherwise. A virtual device with only owned properties
	 * has no sources at all, which is vacuously CONNECTED. Reads only the in-memory index — no I/O.
	 */
	private aggregateState(virtualDeviceId: string): ConnectionState {
		const properties = this.index.findByVirtualDevice(virtualDeviceId);

		if (properties.some((property) => property.isOrphaned)) {
			return ConnectionState.DISCONNECTED;
		}

		// Keyed by device id, not by object identity: the same physical source device reached
		// through two different properties is very likely two different DeviceEntity instances (each
		// property's relation was hydrated on its own), so deduplicating by reference would fail to
		// collapse them.
		const sourceDevices = new Map<string, DeviceEntity>();

		for (const property of properties) {
			const device = this.resolveSourceDevice(property);

			if (device) {
				sourceDevices.set(device.id, device);
			}
		}

		const everySourceOnline = Array.from(sourceDevices.values()).every((device) => device.status?.online === true);

		return everySourceOnline ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED;
	}

	/** The DeviceEntity behind a linked property's source, or undefined if a relation hop is unresolved. */
	private resolveSourceDevice(property: VirtualChannelPropertyEntity): DeviceEntity | undefined {
		const channel = property.sourceProperty?.channel;

		if (!channel || typeof channel === 'string') {
			return undefined;
		}

		return typeof channel.device === 'string' ? undefined : channel.device;
	}
}
