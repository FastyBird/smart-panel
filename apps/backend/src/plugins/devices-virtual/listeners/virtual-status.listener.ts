import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ConnectionState, EventType } from '../../../modules/devices/devices.constants';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceConnectionStateService } from '../../../modules/devices/services/device-connection-state.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DEVICES_VIRTUAL_PLUGIN_NAME, DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { VirtualPropertyIndexService } from '../services/virtual-property-index.service';

/**
 * A virtual device has no connection of its own: it is CONNECTED only while every distinct device
 * it draws a property from is online and none of its properties is orphaned, and DISCONNECTED
 * otherwise. Runs once per source device connection change, recomputing every virtual device that
 * change affects.
 *
 * Both halves of that rule are answered from live state, not from anything cached at index time:
 * - orphan-ness comes from VirtualPropertyLink.sourcePropertyId being null, and the index records
 *   orphans specifically so this branch is reachable;
 * - online-ness comes from DeviceConnectionStateService, which is the same in-memory map
 *   DeviceConnectivityService writes to *before* it emits the event that lands here — so by the time
 *   this runs, the changed device's new state is already the answer that map gives. Reading a
 *   `DeviceEntity.status` hydrated at index-build time instead would pin every source to whatever it
 *   was during the last rebuild(): after a restart the index hydrates before plugins connect, so
 *   every source reads offline, and the first genuine "source came online" event would aggregate
 *   from that stale `false` and write DISCONNECTED — which PropertyCommandService then refuses every
 *   command against, permanently, since no structural event ever re-runs the rebuild.
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
		private readonly deviceConnectionStateService: DeviceConnectionStateService,
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
			await this.recompute(virtualDeviceId, 'aggregated from source devices');
		}

		if (virtualDeviceIds.length > 0) {
			this.logger.debug(
				`Recomputed connection state for ${virtualDeviceIds.length} virtual device(s) after source device id=${payload.device.id} changed to ${payload.state}`,
			);
		}
	}

	/**
	 * Re-aggregates one virtual device's connection state and records it.
	 *
	 * Public because a source device connection change is not the only thing that invalidates the
	 * answer: so does a change to *which* sources the device draws from, which arrives as a structural
	 * event rather than a connection one. VirtualIndexMaintenanceListener calls this after a rebuild
	 * that altered a virtual device's links — the only path that can ever recompute a device whose last
	 * source property was deleted, since such a device is in no source device's reverse index and no
	 * DEVICE_CONNECTION_CHANGED event can select it again.
	 *
	 * Terminates rather than recursing: the write below emits DEVICE_CONNECTION_CHANGED for a device of
	 * DEVICES_VIRTUAL_TYPE, which handleConnectionChanged() above returns on immediately.
	 */
	async recompute(virtualDeviceId: string, reason: string): Promise<void> {
		await this.deviceConnectivityService.setConnectionState(virtualDeviceId, {
			state: await this.aggregateState(virtualDeviceId),
			reason,
		});
	}

	/**
	 * CONNECTED when every distinct source device backing this virtual device is online and none of
	 * its properties is orphaned; DISCONNECTED otherwise. A virtual device with only owned properties
	 * has no links at all, which is vacuously CONNECTED.
	 *
	 * The index supplies only ids; the per-device answer is read from DeviceConnectionStateService,
	 * which serves its in-memory status map first and only falls through to storage for a device that
	 * has not reported since this process started (caching the result, so that is at most one read
	 * per device per process — not per event).
	 */
	private async aggregateState(virtualDeviceId: string): Promise<ConnectionState> {
		const links = this.index.findLinksByVirtualDevice(virtualDeviceId);

		if (links.some((link) => link.sourcePropertyId === null)) {
			return ConnectionState.DISCONNECTED;
		}

		// Deduplicated by id: the same physical source device very commonly backs several of a virtual
		// device's properties, and each would otherwise cost its own status read.
		const sourceDeviceIds = new Set(
			links.map((link) => link.sourceDeviceId).filter((sourceDeviceId): sourceDeviceId is string => !!sourceDeviceId),
		);

		for (const sourceDeviceId of sourceDeviceIds) {
			const status = await this.deviceConnectionStateService.readLatest({ id: sourceDeviceId });

			if (!status.online) {
				return ConnectionState.DISCONNECTED;
			}
		}

		return ConnectionState.CONNECTED;
	}
}
