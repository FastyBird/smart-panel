import { DataSource } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { EventType } from '../../../modules/devices/devices.constants';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_VIRTUAL_PLUGIN_NAME } from '../devices-virtual.constants';
import { VirtualIndexRebuildResult, VirtualPropertyIndexService } from '../services/virtual-property-index.service';

import { VirtualStatusListener } from './virtual-status.listener';

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
 * completing is a real async I/O round trip, not merely a same-tick submission. A single
 * `setImmediate` hop is not sufficient — confirmed empirically, not just argued: with the read
 * sampled at the moment rebuild() is actually invoked (see the "does not observe the emitting
 * transaction as still open" test below), an earlier version of this class that deferred with one
 * bare `setImmediate` hop observed `isTransactionActive === true` in 15 out of 15 repeated trials.
 * deferPastOpenTransaction() therefore does not guess a hop count at all — it polls the shared
 * QueryRunner's own `isTransactionActive` flag, which the driver itself only clears once
 * `COMMIT`/`ROLLBACK` has actually completed (see AbstractSqliteQueryRunner). That makes "has the
 * transaction settled" an observed fact rather than a timing assumption, for both commit and
 * rollback alike — the same test passes 15/15 against this version.
 *
 * That guarantee is scoped to the transaction which was actually open when handleStructuralChange()
 * fired — it does not mean no transaction is open at all by the time rebuild() reads. A different,
 * unrelated transaction can start in the gap between the poll returning and rebuild()'s own read
 * executing, because `dataSource.createQueryRunner()` is a single connection shared by every
 * unscoped query in the app, not just this listener's. That is a separate, pre-existing hazard (two
 * unrelated transactions racing each other for that one connection) this task does not fix — see
 * rebuildWithRetry() / looksTransientSqliteError() for how a rebuild() that loses that particular
 * race still recovers rather than leaving the index stale.
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
		private readonly status: VirtualStatusListener,
		private readonly devicesService: DevicesService,
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
	 * Runs rebuild() passes until one completes with no further event pending. Defers past whatever
	 * transaction is open (see deferPastOpenTransaction()) before *every* pass, not just the first —
	 * a follow-up pass triggered by `pending` runs on exactly the same shared connection the first
	 * one did, and an event arriving while that first pass was in flight could just as easily have
	 * come from inside a second, independently-opened transaction as the first event did. Deferring
	 * only once, before the loop, would leave that follow-up read exposed to precisely the hazard
	 * this task exists to close. The same defer before the first pass also still does its original
	 * job of letting a synchronous burst of handleStructuralChange() calls land before ever reading,
	 * so it folds into a single pass rather than the first event in the burst kicking off its own
	 * rebuild before the rest arrive.
	 *
	 * `running` stays true for the whole loop — including between passes — so an event arriving
	 * mid-rebuild can never start a second, overlapping loop; it can only extend this one via
	 * `pending`, which is exactly why at most one further rebuild ever follows a pass that was
	 * already in flight. `running` is reset in `finally` rather than after the loop so that even an
	 * unexpected throw here (deferPastOpenTransaction() and rebuildWithRetry() are not expected to
	 * throw, but "not expected to" is not a guarantee) can't leave it stuck `true` forever — which
	 * would silently stop every future structural event from ever triggering another rebuild, the
	 * exact permanently-stale-index failure this listener exists to prevent.
	 *
	 * Failures from rebuild() itself are caught and logged inside rebuildWithRetry() rather than left
	 * to reject here: this loop is started fire-and-forget from an event handler, detached from any
	 * request that could otherwise observe or handle the rejection.
	 */
	private async runRebuildLoop(): Promise<void> {
		try {
			do {
				await this.deferPastOpenTransaction();

				this.pending = false;

				const rebuilt = await this.rebuildWithRetry();

				// null means the index was never refreshed, so it reported no transitions — not because
				// there were none, but because it never looked. Left for the next pass / next structural
				// event, which is exactly how a failed rebuild already behaved.
				if (rebuilt) {
					await this.recomputeStatuses(rebuilt.rewiredVirtualDeviceIds);
					await this.unhideAbandonedSources(rebuilt.abandonedSourceDeviceIds);
				}
			} while (this.pending);
		} finally {
			this.running = false;
		}
	}

	/**
	 * Re-aggregates the connection state of every virtual device the rebuild just re-wired.
	 *
	 * Without this, a virtual device whose last linked source property was deleted is never recomputed
	 * again by anything. The FK's ON DELETE SET NULL fires, the rebuild duly records an orphan, and
	 * VirtualStatusListener — which runs only on DEVICE_CONNECTION_CHANGED — never hears about it,
	 * because a fully orphaned device has dropped out of `bySourceDevice` and no source device change
	 * can select it. It stays reported as connected forever, with nothing behind it.
	 *
	 * ## Why this cannot loop
	 *
	 * The write below (DeviceConnectivityService.setConnectionState) can emit two things, and neither
	 * re-enters this listener:
	 * - DEVICE_CONNECTION_CHANGED, which is not among the subscriptions on handleStructuralChange()
	 *   above, and which VirtualStatusListener itself discards for a virtual device by type;
	 * - CHANNEL_PROPERTY_VALUE_SET, from writing the new state onto the existing connection-state
	 *   property. ChannelsPropertiesService.update() emits CHANNEL_PROPERTY_UPDATED only when a
	 *   non-`value`, non-`type` field changes, and this write sends neither. VALUE_SET is deliberately
	 *   not subscribed to here (see the class docstring), so it schedules nothing.
	 *
	 * The one path that does schedule another pass is a device whose connection-state property does not
	 * exist yet, where setConnectionState find-or-creates it and CHANNEL_PROPERTY_CREATED fires. That
	 * converges rather than oscillating: the following pass finds the property already there, so its
	 * write is value-only and emits VALUE_SET. Recomputing is also idempotent in itself — an unchanged
	 * state writes nothing and emits nothing at all.
	 *
	 * Failures are logged per device and do not abort the rest: this runs inside the fire-and-forget
	 * rebuild loop, and one virtual device that cannot be recomputed must not cost the others theirs.
	 */
	private async recomputeStatuses(virtualDeviceIds: string[]): Promise<void> {
		for (const virtualDeviceId of virtualDeviceIds) {
			try {
				await this.status.recompute(virtualDeviceId, 'aggregated after a source wiring change');
			} catch (error) {
				this.logger.warn(`Failed to recompute connection state for virtual device id=${virtualDeviceId}: ${error}`);
			}
		}

		if (virtualDeviceIds.length > 0) {
			this.logger.debug(
				`Recomputed connection state for ${virtualDeviceIds.length} virtual device(s) whose source wiring changed`,
			);
		}
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
	 *
	 * Returns what rebuild() reported changed, or null if no attempt succeeded — a distinction the
	 * caller needs, because an empty result means "the index is current and nothing changed" while null
	 * means "the index still holds whatever it held before the event", and every follow-up step acts on
	 * that difference.
	 */
	private async rebuildWithRetry(): Promise<VirtualIndexRebuildResult | null> {
		for (let attempt = 1; ; attempt++) {
			try {
				return await this.index.rebuild();
			} catch (error) {
				this.logger.warn(`Failed to rebuild the virtual property index: ${error}`);

				if (attempt >= VirtualIndexMaintenanceListener.MAX_REBUILD_ATTEMPTS || !this.looksTransientSqliteError(error)) {
					return null;
				}

				await this.deferPastOpenTransaction();
			}
		}
	}

	/**
	 * Unhides every source device the rebuild just found is referenced by no virtual device at all —
	 * the spec's "Deleting the last virtual device referencing a hidden source auto-unhides it".
	 *
	 * Without this, a source hidden because a virtual device replaced it stays hidden once that
	 * replacement is gone: excluded from every picker, absent from the default device list, and — since
	 * `hidden` is only reachable through a PATCH the admin no longer offers for a device it does not
	 * show — with no route back through the UI.
	 *
	 * ## Driven by the index transition, not by DEVICE_DELETED
	 *
	 * The obvious implementation reads the deleted device's links off the index when DEVICE_DELETED
	 * fires. That does not work, and the failure is not a narrow race: DevicesService.remove() deletes
	 * the device's channels and properties *before* it emits DEVICE_DELETED, each of those deletions is
	 * itself a structural event, and a rebuild triggered by one of them routinely completes before the
	 * device event arrives — observed directly, about half of all deletions. By then the index has
	 * already forgotten every link the device had, and the handler captures nothing.
	 *
	 * Comparing `bySourceDevice` across the rebuild has no such dependency. Whichever pass happens to
	 * observe the transition reports it, whatever triggered that pass and whenever it ran.
	 *
	 * It is also slightly wider than the spec's wording, and deliberately so: it fires whenever the last
	 * *reference* goes, which includes unlinking a virtual device's last property from the source as
	 * well as deleting the virtual device outright. Both leave a hidden device with nothing standing in
	 * for it, which is the condition the rule exists to prevent.
	 *
	 * The patch emits DEVICE_UPDATED, which schedules one further rebuild pass. That converges rather
	 * than looping: the source device is already absent from `bySourceDevice` by then, so the next pass
	 * reports no transition and unhides nothing.
	 */
	private async unhideAbandonedSources(sourceDeviceIds: string[]): Promise<void> {
		for (const sourceDeviceId of sourceDeviceIds) {
			try {
				const sourceDevice = await this.devicesService.findOne(sourceDeviceId);

				// Already visible, or gone entirely — a source device can be deleted in the same sweep as
				// the virtual device that replaced it.
				if (!sourceDevice?.hidden) {
					continue;
				}

				await this.devicesService.update(sourceDevice.id, { type: sourceDevice.type, hidden: false });

				this.logger.debug(`Unhid source device id=${sourceDevice.id}, no virtual device references it anymore`);
			} catch (error) {
				this.logger.warn(`Failed to unhide abandoned source device id=${sourceDeviceId}: ${error}`);
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
