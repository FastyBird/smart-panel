import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable } from '@nestjs/common';

/**
 * Serializes the writes that decide a device's structure against each other.
 *
 * A structural rule spans rows that no single statement touches. `assertCategoryChangeSafe` judges a
 * device's channels and properties against the category a PATCH is about to store, and the plugin
 * hooks on channel and property writes judge the row being written against the category the device
 * currently has. Each reads what the other is about to change, and several awaited round trips
 * separate every one of those reads from its own write — so a property created against the old
 * category can commit after the category change was judged and before it is stored, leaving a device
 * advertising a category its own structure does not satisfy, with neither request having done
 * anything wrong on its own.
 *
 * A transaction is the wrong instrument here. The backend runs on one shared SQLite connection, so a
 * transaction held across awaits collects whatever statements other requests happen to issue in that
 * window — the hazard `VirtualIndexMaintenanceListener.deferPastOpenTransaction` already exists to
 * work around. This is a single process, so an in-process queue closes the window completely, which
 * is the same reason `SuggestionEngineService.withMutex` serializes its own check-then-insert.
 *
 * Re-entrant on purpose. Creating a device creates its channels, and creating a channel creates its
 * properties, so these windows nest: a nested call that took a fresh ticket would wait for one only
 * its own caller can release. The holder is tracked per async call chain rather than by a flag, so a
 * *concurrent* request is still queued while a nested one passes straight through.
 */
@Injectable()
export class DeviceStructureLockService {
	private readonly heldOnThisChain = new AsyncLocalStorage<true>();

	private tail: Promise<unknown> = Promise.resolve();

	async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
		if (this.heldOnThisChain.getStore()) {
			return fn();
		}

		// Chained onto the previous ticket whether it resolved or rejected: a refused structural write
		// must not leave the queue closed behind it.
		const ticket = this.tail.then(
			() => this.heldOnThisChain.run(true, fn),
			() => this.heldOnThisChain.run(true, fn),
		);

		this.tail = ticket.then(
			() => {},
			() => {},
		);

		return ticket;
	}
}
