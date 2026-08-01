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

	/**
	 * Serializes recompute() — see its docstring for why it has to cover the *read* as well as the
	 * write. Always resolved, never rejected: the settle callback is invoked from a `finally`, so a
	 * caller whose own recompute throws cannot wedge or reject the next one waiting behind it.
	 */
	private recomputeQueue: Promise<void> = Promise.resolve();

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
	 *
	 * ## Why the read and the write are serialized together
	 *
	 * Three independent callers reach this method — a source device connection change, a rebuild that
	 * re-wired a virtual device, and the synthesis that runs on DEVICE_CREATED — and none of them is
	 * awaited by the others: all three start from EventEmitter2 handlers, which `.emit()` never awaits.
	 * So two recomputes for the same device genuinely overlap.
	 *
	 * Serializing only the write would not be enough, and this is the failure it exists to prevent: on
	 * a virtual device created with linked properties nested in the same request,
	 * CHANNEL_PROPERTY_CREATED fires for each of those *before* DEVICE_CREATED. The rebuild those
	 * events trigger correctly aggregates DISCONNECTED for an offline source, while the synthesis
	 * behind DEVICE_CREATED may already have read the index *before* that rebuild swapped its maps in —
	 * reading no links at all, which aggregates to a vacuous CONNECTED. Whichever of those two writes
	 * lands second wins, and nothing is guaranteed to correct it afterwards: the next rebuild pass
	 * reports no re-wiring, because by then the links have not changed again.
	 *
	 * Holding the queue across `aggregateState()` as well as the write removes that ordering question
	 * entirely. Whichever recompute runs second re-reads the index at that point, so it aggregates from
	 * the same state it is about to overwrite — and the last write is therefore always the one computed
	 * from the most recent index, not merely the one that happened to finish last.
	 *
	 * The queue is global rather than per-device: both loops that call this already await one device at
	 * a time, so there is no concurrency to lose, and a single chain cannot leak an entry per device
	 * that ever existed. It cannot deadlock — everything re-entered by the write below
	 * (`handleConnectionChanged` for a virtual device, VirtualIndexMaintenanceListener's fire-and-forget
	 * rebuild loop) either returns without calling recompute() or is not awaited by this call.
	 */
	async recompute(virtualDeviceId: string, reason: string): Promise<void> {
		const previous = this.recomputeQueue;
		let settle: () => void = () => {};
		this.recomputeQueue = new Promise<void>((resolve) => (settle = resolve));

		try {
			await previous;

			await this.deviceConnectivityService.setConnectionState(virtualDeviceId, {
				state: await this.aggregateState(virtualDeviceId),
				reason,
			});
		} finally {
			settle();
		}
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
