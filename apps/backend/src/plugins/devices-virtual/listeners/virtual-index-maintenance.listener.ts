import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { EventType } from '../../../modules/devices/devices.constants';
import { DEVICES_VIRTUAL_PLUGIN_NAME } from '../devices-virtual.constants';
import { VirtualPropertyIndexService } from '../services/virtual-property-index.service';

/**
 * Keeps VirtualPropertyIndexService current after bootstrap.
 *
 * The index is hydrated once at onApplicationBootstrap and nothing else ever calls add(),
 * rebuild() or removeVirtualDevice() on it at runtime (see its own class docstring) — so without
 * this listener a virtual device created after boot never projects, an orphaned property never
 * degrades, and a deleted virtual device's entries linger forever.
 *
 * Reacts to structural events only — device and channel-property lifecycle, plus the module-wide
 * reset — by scheduling a full rebuild() rather than maintaining the three maps incrementally. A
 * full rebuild is one relation-loaded query and structural changes are rare, whereas incremental
 * maintenance across three interdependent maps is where partial-state bugs live.
 * CHANNEL_PROPERTY_VALUE_SET is deliberately absent from the subscription list below: it fires on
 * every property report from every device in the system, and rebuilding on it would put a database
 * query on exactly the hot path this index exists to keep clear.
 *
 * Coalescing uses no timers: `pending` and `running` alone collapse a synchronous burst (e.g.
 * device provisioning, which creates a device plus several channels and properties in one go) into
 * a single rebuild(), and guarantee at most one further rebuild() runs immediately after a pass
 * that was already in flight when more events arrived — never a concurrent second pass, never one
 * rebuild per event. See runRebuildLoop() for the mechanics.
 */
@Injectable()
export class VirtualIndexMaintenanceListener {
	private readonly logger = createExtensionLogger(DEVICES_VIRTUAL_PLUGIN_NAME, 'VirtualIndexMaintenanceListener');

	private running = false;
	private pending = false;

	constructor(private readonly index: VirtualPropertyIndexService) {}

	@OnEvent(EventType.DEVICE_CREATED)
	@OnEvent(EventType.DEVICE_UPDATED)
	@OnEvent(EventType.DEVICE_DELETED)
	@OnEvent(EventType.DEVICE_RESET)
	@OnEvent(EventType.CHANNEL_PROPERTY_CREATED)
	@OnEvent(EventType.CHANNEL_PROPERTY_UPDATED)
	@OnEvent(EventType.CHANNEL_PROPERTY_DELETED)
	@OnEvent(EventType.CHANNEL_PROPERTY_RESET)
	@OnEvent(EventType.MODULE_RESET)
	handleStructuralChange(): void {
		this.pending = true;

		if (this.running) {
			// A pass is already running (or about to start) and will notice `pending` once it
			// finishes its current rebuild() — see runRebuildLoop(). Nothing further to do here.
			return;
		}

		this.running = true;

		void this.runRebuildLoop();
	}

	/**
	 * Runs rebuild() passes until one completes with no further event pending. Yields one microtask
	 * before the first pass so a synchronous burst of handleStructuralChange() calls all lands and
	 * folds into that single pass, rather than the first event in the burst kicking off its own
	 * rebuild before the rest arrive. `running` stays true for the whole loop — including between
	 * passes — so an event arriving mid-rebuild can never start a second, overlapping loop; it can
	 * only extend this one via `pending`, which is exactly why at most one further rebuild ever
	 * follows a pass that was already in flight.
	 *
	 * Failures are caught and logged here rather than left to reject: this loop is started
	 * fire-and-forget from an event handler, detached from any request that could otherwise observe
	 * or handle the rejection.
	 */
	private async runRebuildLoop(): Promise<void> {
		await Promise.resolve();

		do {
			this.pending = false;

			try {
				await this.index.rebuild();
			} catch (error) {
				this.logger.warn(`Failed to rebuild the virtual property index: ${error}`);
			}
		} while (this.pending);

		this.running = false;
	}
}
