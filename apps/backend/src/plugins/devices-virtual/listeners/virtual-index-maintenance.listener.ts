import { DataSource } from 'typeorm';

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
 *
 * DEVICE_DELETED and CHANNEL_PROPERTY_DELETED are emitted synchronously from *inside* the
 * `dataSource.transaction()` callback that performs the deletion (`DevicesService.remove()`,
 * `ChannelsPropertiesService.remove()`) — `EventEmitter2.emit()` runs listeners synchronously, so
 * handleStructuralChange() executes before that transaction has committed. rebuild() must not read
 * through it: on the shared, single-connection SQLite driver this app runs on (see
 * AbstractSqliteDriver — sqlite is not pooled, so `dataSource.createQueryRunner()` always returns
 * the one instance every non-transactional query in the app shares), a read that lands before
 * commit is a read of state that could still be rolled back — the index would then reflect a
 * structural change that never durably happened.
 *
 * Getting "after commit" right is *not* a matter of picking a long-enough delay: sqlite3 (the
 * driver's underlying npm package) executes queued commands via libuv's threadpool, so `COMMIT`
 * completing is a real async I/O round trip, not merely a same-tick submission — one `setImmediate`
 * hop is not enough to guarantee it has landed (verified directly: an earlier version of this class
 * that deferred with a single `setImmediate` failed the "does not observe the emitting transaction
 * as still open" test below). deferPastOpenTransaction() therefore does not guess a hop count at
 * all — it polls the shared QueryRunner's own `isTransactionActive` flag, which the driver itself
 * only clears once `COMMIT`/`ROLLBACK` has actually completed (see AbstractSqliteQueryRunner). That
 * makes "has the transaction settled" an observed fact, not a timing assumption, for both commit and
 * rollback alike.
 */
@Injectable()
export class VirtualIndexMaintenanceListener {
	private readonly logger = createExtensionLogger(DEVICES_VIRTUAL_PLUGIN_NAME, 'VirtualIndexMaintenanceListener');

	/**
	 * Bounds deferPastOpenTransaction()'s poll loop. A transaction on this app's local, single-file
	 * SQLite database settles within, at most, a handful of event-loop turns — there is no network
	 * hop or external dependency involved — so this bound exists purely so a wildly abnormal state
	 * (the flag somehow never clearing) still lets the loop proceed and log, rather than hang
	 * runRebuildLoop() forever. That would itself be a worse bug than the one this task fixes.
	 */
	private static readonly MAX_TRANSACTION_WAIT_POLLS = 50;

	/**
	 * Bounds rebuildWithRetry()'s retry loop. Kept small: a retry here only ever exists to ride out
	 * a transient, already-in-progress SQLite contention on the shared connection (see
	 * looksTransientSqliteError()) that deferPastOpenTransaction() did not already fully resolve —
	 * not to paper over a genuinely broken database. Bounding it means a persistently failing
	 * rebuild() still falls back to Task 12a's original guarantee (log and wait for the next
	 * structural event) instead of retrying forever.
	 */
	private static readonly MAX_REBUILD_ATTEMPTS = 3;

	private running = false;
	private pending = false;

	constructor(
		private readonly index: VirtualPropertyIndexService,
		private readonly dataSource: DataSource,
	) {}

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
	 * Runs rebuild() passes until one completes with no further event pending. Defers past the
	 * caller's current transaction (see deferPastOpenTransaction()) before the first pass so a
	 * synchronous burst of handleStructuralChange() calls all lands and folds into that single pass,
	 * rather than the first event in the burst kicking off its own rebuild before the rest arrive —
	 * and, when that first event was DEVICE_DELETED or CHANNEL_PROPERTY_DELETED, before the emitting
	 * transaction has committed. `running` stays true for the whole loop — including between passes
	 * — so an event arriving mid-rebuild can never start a second, overlapping loop; it can only
	 * extend this one via `pending`, which is exactly why at most one further rebuild ever follows a
	 * pass that was already in flight.
	 *
	 * Failures are caught and logged here rather than left to reject: this loop is started
	 * fire-and-forget from an event handler, detached from any request that could otherwise observe
	 * or handle the rejection.
	 */
	private async runRebuildLoop(): Promise<void> {
		await this.deferPastOpenTransaction();

		do {
			this.pending = false;

			await this.rebuildWithRetry();
		} while (this.pending);

		this.running = false;
	}

	/**
	 * Calls rebuild() once; on a transient-looking SQLite failure (see looksTransientSqliteError()),
	 * retries up to MAX_REBUILD_ATTEMPTS times, deferring past any open transaction between attempts
	 * the same way runRebuildLoop() defers before the first one. A non-transient failure — or a
	 * transient one that is still failing once the attempts are exhausted — is logged and left for
	 * the do-while loop above / the next structural event to pick up, exactly as Task 12a's original
	 * one-shot rebuild() call behaved. This never wedges the loop: every path through this method
	 * returns, so runRebuildLoop() always reaches its `while (this.pending)` check and eventually
	 * sets `running = false`.
	 */
	private async rebuildWithRetry(): Promise<void> {
		for (let attempt = 1; ; attempt++) {
			try {
				await this.index.rebuild();

				return;
			} catch (error) {
				this.logger.warn(`Failed to rebuild the virtual property index: ${error}`);

				if (attempt >= VirtualIndexMaintenanceListener.MAX_REBUILD_ATTEMPTS || !this.looksTransientSqliteError(error)) {
					return;
				}

				await this.deferPastOpenTransaction();
			}
		}
	}

	/**
	 * True for the SQLite error signatures the shared, single-connection driver this app runs on is
	 * known to produce when two unrelated callers race a BEGIN/COMMIT on that one connection —
	 * "cannot start a transaction within a transaction", "cannot commit - no transaction is active",
	 * and ordinary lock contention (SQLITE_BUSY / SQLITE_LOCKED). rebuild() itself only ever issues a
	 * plain, non-transactional SELECT (see VirtualPropertyIndexService.rebuild()), so it cannot be
	 * the caller that opens a conflicting transaction — but it shares that one connection with every
	 * other query in the app, so it can still be a bystander to contention caused elsewhere. Matching
	 * on the driver's own wording is the same approach TypeORM's sqlite QueryRunner itself uses to
	 * recognise SQLITE_BUSY for its own busyErrorRetry option — there is no error `code` specific
	 * enough to distinguish these cases from any other SQLITE_ERROR.
	 */
	private looksTransientSqliteError(error: unknown): boolean {
		// A non-Error rejection has no message worth pattern-matching — treated as not transient,
		// which is the conservative choice: it falls back to logging and waiting for the next
		// structural event, exactly like any other non-transient failure, rather than guessing.
		if (!(error instanceof Error)) {
			return false;
		}

		return /SQLITE_BUSY|SQLITE_LOCKED|cannot start a transaction within a transaction|no transaction is active/i.test(
			error.message,
		);
	}

	/**
	 * Waits until the shared QueryRunner reports no transaction active, polling one `setImmediate`
	 * macrotask at a time (never a bare microtask, which would still resolve inside the emitting
	 * transaction's own async flow — see the class docstring). `dataSource.createQueryRunner()` is
	 * the exact call `VirtualPropertyIndexService.rebuild()`'s `repository.find()` resolves to
	 * internally (obtainQueryRunner() falls back to it for any unscoped query), and sqlite is not
	 * pooled, so this is always the one connection every such query — including the caller's, if it
	 * is still mid-transaction — actually runs on. Polling the flag itself, rather than assuming a
	 * fixed number of hops clears it, is what makes this an *observed* fact rather than a timing
	 * guess: the driver only flips `isTransactionActive` back to false once `COMMIT`/`ROLLBACK` has
	 * actually completed (see AbstractSqliteQueryRunner's commitTransaction()/rollbackTransaction()),
	 * so by the time this resolves, any transaction that was open when it was called has genuinely
	 * settled — one way or the other — regardless of how many turns that took.
	 */
	private async deferPastOpenTransaction(): Promise<void> {
		const queryRunner = this.dataSource.createQueryRunner();

		for (let poll = 0; poll < VirtualIndexMaintenanceListener.MAX_TRANSACTION_WAIT_POLLS; poll++) {
			await new Promise<void>((resolve) => setImmediate(resolve));

			if (!queryRunner.isTransactionActive) {
				return;
			}
		}

		this.logger.warn(
			`Gave up waiting for an open transaction to settle after ${VirtualIndexMaintenanceListener.MAX_TRANSACTION_WAIT_POLLS} polls; rebuilding anyway.`,
		);
	}
}
