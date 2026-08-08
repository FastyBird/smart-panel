import { DataSource, In, IsNull, Repository } from 'typeorm';

import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DeviceHiddenBy, DeviceHiddenFilter, EventType } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_VIRTUAL_PLUGIN_NAME, DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { VirtualChannelPropertyEntity } from '../entities/devices-virtual.entity';
import { VirtualDevicesService } from '../services/virtual-devices.service';
import { VirtualIndexRebuildResult, VirtualPropertyIndexService } from '../services/virtual-property-index.service';

import { VirtualStatusListener } from './virtual-status.listener';

/**
 * Owns VirtualPropertyIndexService's contents — the first hydration at bootstrap and every rebuild
 * after it.
 *
 * Nothing else ever calls add(), rebuild() or removeVirtualDevice() on the index (see its own class
 * docstring) — so without this listener a virtual device created after boot never projects, an
 * orphaned property never degrades, and a deleted virtual device's entries linger forever.
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
 * sampled at the moment rebuild() is actually invoked, an earlier version of this class that
 * deferred with one bare `setImmediate` hop observed `isTransactionActive === true` in 15 out of 15
 * repeated trials. deferPastOpenTransaction() therefore does not guess a hop count at all — it polls
 * the shared QueryRunner's own `isTransactionActive` flag, which the driver itself only clears once
 * `COMMIT`/`ROLLBACK` has actually completed (see AbstractSqliteQueryRunner). That makes "has the
 * transaction settled" an observed fact rather than a timing assumption, for both commit and
 * rollback alike.
 *
 * ## Why the wait is bounded, and why expiry still rebuilds
 *
 * The poll is bounded (see deferPastOpenTransaction()), and a bounded wait can expire while the flag
 * is still set — a transaction that keeps doing awaited work after emitting its event stays open for
 * as long as that work takes. runRebuildLoop() rebuilds anyway when that happens, and then schedules
 * a *repair* pass. Both halves of that are deliberate — and so is the limit of what a repair can
 * cover:
 *
 * - **Waiting indefinitely instead is not safe**, because `isTransactionActive` can be left set with
 *   no transaction behind it at all, permanently, for the life of the process.
 *   `AbstractSqliteQueryRunner.startTransaction()` assigns `isTransactionActive = true` *before* it
 *   awaits `BEGIN TRANSACTION`, and does not reset it if that query throws. When it does throw —
 *   `SQLITE_ERROR: cannot start a transaction within a transaction`, the collision follow-up 3.3
 *   documents and looksTransientSqliteError() below already matches on — `EntityManager.transaction()`
 *   calls `rollbackTransaction()`, whose `await this.query("ROLLBACK")` then also throws ("cannot
 *   rollback - no transaction is active") and so never reaches the `isTransactionActive = false` on
 *   the following line. The flag is stuck true from then on. A listener that refused to rebuild while
 *   it is set would freeze this index permanently on the first such collision, which is a strictly
 *   worse failure than the one the wait exists to prevent — and one this repo has actually observed
 *   (see `ensureDeviceDeleted` in test/devices-virtual.e2e-spec.ts).
 * - **Rebuilding without a repair is not safe either**, which is what the bound used to do. A read
 *   that lands inside a still-open transaction sees that transaction's uncommitted rows, so if it
 *   later rolls back, the index holds structure that never durably happened — and no further event
 *   arrives to correct it, because the rollback is not an event. scheduleRepairPass() is that
 *   correction: after any pass whose wait expired, another pass is queued, and it keeps being queued
 *   (up to MAX_REPAIR_PASSES) until one completes having actually observed the flag clear. Whatever
 *   the expired pass read, the repair overwrites with committed state.
 * - **The repair covers the index and nothing else.** Overwriting three in-memory maps costs one
 *   query; a row this listener has already patched is not coming back. So a pass whose wait expired
 *   may rebuild, and may recompute a connection state (which is level-triggered, and re-derived by
 *   the repair pass along with everything else), but it may not unhide a source device — an unhide is
 *   an edge with no opposite, and there is no pass, event or repair that would ever re-hide what one
 *   wrote off a read that turned out to be uncommitted. runRebuildLoop() holds those back for a pass
 *   that observed the flag clear, and unhideAbandonedSources() re-checks them against what that pass
 *   read.
 *
 * Either way the wait is scoped to whatever transaction happened to be open — it does not mean no
 * transaction is open at all by the time rebuild() reads. A different, unrelated transaction can
 * start in the gap between the poll returning and rebuild()'s own read executing, because
 * `dataSource.createQueryRunner()` is a single connection shared by every unscoped query in the app,
 * not just this listener's; by the same token the flag this polls may be held by a transaction that
 * has nothing to do with the event being handled. That is a pre-existing hazard (follow-up 3.3) this
 * task does not fix — see rebuildWithRetry() / looksTransientSqliteError() for how a rebuild() that
 * loses that particular race still recovers rather than leaving the index stale.
 */
@Injectable()
export class VirtualIndexMaintenanceListener implements OnApplicationBootstrap {
	private readonly logger = createExtensionLogger(DEVICES_VIRTUAL_PLUGIN_NAME, 'VirtualIndexMaintenanceListener');

	/**
	 * deferPastOpenTransaction()'s first, cheap phase: one `setImmediate` macrotask per poll. A
	 * transaction that emitted its event as its last statement settles within a handful of these, so
	 * the overwhelmingly common case never reaches a timer at all and costs well under a millisecond.
	 */
	private static readonly TRANSACTION_SETTLE_IMMEDIATE_POLLS = 50;

	/**
	 * deferPastOpenTransaction()'s second phase, entered only when the first did not see the flag
	 * clear. Spinning `setImmediate` is the wrong instrument here: a transaction still open after 50
	 * turns is one that keeps doing awaited work (`DevicesService.remove()` deletes a device's
	 * channels and properties one awaited statement at a time, each an sqlite3 threadpool round trip,
	 * and its storage cleanup is another), and a `setImmediate` loop starves exactly that work while
	 * waiting for it. Polling on a timer instead yields the loop between samples, and buys three
	 * orders of magnitude more headroom than counting event-loop turns did — the difference between
	 * an idle laptop and a loaded CI runner is a multiple of the turn cost, not of wall-clock
	 * seconds, which is precisely why a turn-counted bound passed locally and expired under CI load.
	 */
	private static readonly TRANSACTION_SETTLE_TIMER_POLLS = 60;

	private static readonly TRANSACTION_SETTLE_TIMER_INTERVAL_MS = 25;

	/**
	 * Bounds how many times scheduleRepairPass() re-queues a pass after one whose wait expired.
	 * Bounded rather than open-ended because the flag can be stuck true permanently (see the class
	 * docstring): an unbounded repair chain would then poll forever and log forever, having long
	 * since read the only state there is to read. The counter resets the moment any pass does observe
	 * the flag clear, so a genuinely long transaction gets a full budget again next time.
	 */
	private static readonly MAX_REPAIR_PASSES = 3;

	private static readonly REPAIR_PASS_DELAY_MS = 250;

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
	private repairTimer: NodeJS.Timeout | null = null;
	private repairPasses = 0;

	/**
	 * Source devices some pass reported abandoned, held until a pass that actually read committed
	 * state can confirm them. Drained only by unhideAbandonedSources().
	 *
	 * Exists because unhiding is the one thing this listener does that a repair cannot take back. The
	 * index is memory: a pass that read a still-open transaction's uncommitted rows can hold structure
	 * that never durably happened, and the repair pass scheduleRepairPass() queues simply overwrites
	 * all three maps with committed state. `hidden` is a column. Patching it off the same uncommitted
	 * read leaves a physical device visible after the deletion it was inferred from rolled back, and
	 * nothing in this class — or anywhere else — ever re-hides it: the rebuild reports an abandonment
	 * as the *edge* `bySourceDevice` lost a key (see VirtualIndexRebuildResult), and there is no
	 * opposite edge that means "this source is covered again, put it back".
	 *
	 * So the queue is not a buffer for tidiness; it is what makes the write wait for a read that can
	 * be trusted. See unhideAbandonedSources() for how a queued id is re-checked before it is acted on,
	 * and runRebuildLoop() for when the queue is drained.
	 */
	private readonly pendingUnhideSourceDeviceIds = new Set<string>();

	/**
	 * Virtual devices some pass reported re-wired, held until a pass that actually read committed state
	 * can announce what became of them. Drained only by announceOrphanedProjections().
	 *
	 * Same reasoning as `pendingUnhideSourceDeviceIds` above, and for the same structural reason: an
	 * orphan announcement is an *edge*, and this one has no opposite. A pass whose wait expired can read
	 * a still-open deletion's uncommitted rows, and announcing off that read tells every client a
	 * projection lost its source — then the transaction rolls back, the repair pass quietly restores the
	 * link in the index, and nothing ever tells them otherwise, because this only ever looks for rows
	 * with no source. The false orphan would sit in the admin and the panel until a reload.
	 *
	 * Queueing is what makes the *read* wait rather than the write: announceOrphanedProjections() asks
	 * the database at the moment it drains, so a rollback that restored the link simply produces no
	 * orphan to announce.
	 */
	private readonly pendingAnnounceVirtualDeviceIds = new Set<string>();

	/**
	 * True once a wait has run the full budget out with the transaction flag still set, and back to
	 * false the moment any poll sees it clear again.
	 *
	 * Exists because a transaction on this shared connection can be *abandoned* — begun, and then
	 * neither committed nor rolled back — which leaves the flag set indefinitely rather than for a
	 * few hundred milliseconds. That is not hypothetical: it is the collision documented on
	 * `ensureDeviceDeleted` in test/devices-virtual.e2e-spec.ts, and it was observed directly while
	 * building this, with the driver reporting a real open transaction (depth 1) that never settled.
	 * Without this latch every pass after such an abandonment pays the whole timed budget again, so a
	 * single leaked transaction turns into seconds of added latency on every structural change for as
	 * long as it lasts — starving the index far worse than the dirty read the budget is there to
	 * avoid. With it, the cost of an abandoned transaction is paid once.
	 */
	private connectionStoppedSettling = false;

	constructor(
		private readonly index: VirtualPropertyIndexService,
		private readonly status: VirtualStatusListener,
		private readonly devicesService: DevicesService,
		private readonly virtualDevicesService: VirtualDevicesService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly eventEmitter: EventEmitter2,
		private readonly dataSource: DataSource,
		// Only ever used to clear `hiddenBy` — the one field of an unhide that UpdateDeviceDto cannot
		// express. See unhideSource() for why that needs a write outside DevicesService.update().
		@InjectRepository(DeviceEntity)
		private readonly devicesRepository: Repository<DeviceEntity>,
	) {}

	/**
	 * Fills the index for the first time, and recomputes the connection state of every virtual device
	 * that first pass found wired differently than the empty index it started from.
	 *
	 * `onApplicationBootstrap` rather than `onModuleInit`: every plugin's entities must already be
	 * registered for rebuild()'s query, which spans the devices module's STI hierarchy, to see virtual
	 * rows correctly. The plugin's own `onModuleInit` also has to have run by then, since the mapping it
	 * registers there carries the `afterCreate` hook that keeps a connection-state property created
	 * below from being born an orphan.
	 *
	 * ## Why the result cannot be discarded
	 *
	 * At bootstrap the outgoing index is empty, so `rewiredVirtualDeviceIds` is simply every virtual
	 * device that has a projecting property at all — including one whose source property was deleted
	 * while this process was *not* running. That case is the reason this runs at all. A source-property
	 * deletion commits, and the fire-and-forget pass that would have degraded the virtual device to
	 * DISCONNECTED (see recomputeStatuses()) is scheduled but not yet run when the process stops. The
	 * deletion is durable; the status is not. On the next start the rebuild below duly discovers the
	 * orphan — and nothing else ever will: an orphaned link has no source device, so the device is in
	 * no `bySourceDevice` set and no DEVICE_CONNECTION_CHANGED event can ever select it again. Feeding
	 * this result through the same recomputeStatuses() a structural rebuild uses is what turns a
	 * restart into the repair for that, instead of leaving a device that renders fine, reports
	 * plausible values and is permanently, silently wrong.
	 *
	 * `abandonedSourceDeviceIds` is deliberately *not* queued for unhideAbandonedSources(): rebuild()
	 * derives it from source devices present in the outgoing index and absent from the incoming one,
	 * and the outgoing index is empty here, so it is structurally always `[]` on this pass. There is no
	 * bootstrap equivalent of "the last virtual device referencing this source went away".
	 *
	 * The abandonment a restart *loses* — as opposed to the one it structurally cannot observe — is
	 * recovered by reconcileSystemHiddenSources() instead, from two things that do survive a restart:
	 * the hydrated index, and the `hiddenBy` column. It runs after the hydration for a reason that is
	 * not merely ordering — the index is its entire evidence for "nothing references this source
	 * anymore", so a pass that failed to fill it must not reach the reconciliation at all. A rebuild()
	 * that throws leaves the `try` below before it, which is exactly the intended behaviour: an empty
	 * index would otherwise answer "nothing references anything" for every source in the system.
	 *
	 * ## Why it is awaited, and why it still cannot abort startup
	 *
	 * Awaited rather than started fire-and-forget so the index is populated and the repair complete
	 * before the app serves its first request — the same guarantee this hook gave when the index
	 * hydrated itself. The added cost is bounded by the number of virtual devices with links, which is
	 * a hand-assembled, small number, and setConnectionState() writes nothing at all when the state it
	 * computes matches what is already stored.
	 *
	 * Nothing in here may propagate, because an `onApplicationBootstrap` rejection aborts Nest's
	 * bootstrap and takes the whole application down. The realistic trigger is a schema that does not
	 * exist yet — a fresh install whose migrations have not run, and `generate:openapi`, which boots
	 * the app purely to extract Swagger metadata against whatever database happens to be there; both
	 * make rebuild()'s query fail with `SQLITE_ERROR: no such table:
	 * devices_module_channels_properties`. Hydration is an optimization, not a precondition: the index
	 * starts empty and the next structural event rebuilds it regardless, so a failed first pass costs
	 * staleness until then rather than a dead process. Logged at error level, not warn — outside those
	 * two known-benign cases a failure here means the index is silently empty, and an operator should
	 * see that. recomputeStatuses() and reconcileSystemHiddenSources() additionally contain their own
	 * failures — per device, and as a whole — so neither one virtual device that cannot be recomputed
	 * nor a reconciliation that cannot read at all costs the others their repair or reaches this catch.
	 *
	 * Deliberately not routed through handleStructuralChange()/runRebuildLoop(). That path is
	 * fire-and-forget by construction and defers past whatever transaction is open on the shared
	 * connection — both of which exist because a structural event is emitted from *inside* an
	 * uncommitted transaction. Bootstrap has no such emitter and no such transaction to outlive, and
	 * routing through it would trade this hook's awaited guarantee for a wait it has no reason to pay.
	 */
	async onApplicationBootstrap(): Promise<void> {
		try {
			const hydrated = await this.index.rebuild();

			await this.recomputeStatuses(hydrated.rewiredVirtualDeviceIds, 'aggregated from source devices at startup');

			await this.reconcileSystemHiddenSources();
		} catch (error) {
			this.logger.error(
				`Failed to hydrate the virtual property index at bootstrap: ${error}. The index starts empty and will be rebuilt on the next structural change.`,
			);
		}
	}

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
	 *
	 * ## Why only one of the two follow-up steps is gated on `settled`
	 *
	 * Both recomputeStatuses() and unhideAbandonedSources() write to the database, and both act on
	 * what this pass read — which, on a pass whose wait expired, may be a still-open transaction's
	 * uncommitted rows. They are treated differently because only one of them is *self-correcting*:
	 *
	 * - A recompute is level-triggered. It re-derives a virtual device's whole connection state from
	 *   whatever wiring the index currently holds, and `rewiredVirtualDeviceIds` comes from a diff that
	 *   is symmetric (see VirtualPropertyIndexService.diffVirtualDevices()) — if a rollback puts the
	 *   wiring back, the repair pass's diff necessarily names the same device again, and recomputing it
	 *   against restored wiring writes the state that was correct all along. Deferring it would only
	 *   delay a repair that arrives on its own.
	 * - An unhide is edge-triggered and one-directional. `abandonedSourceDeviceIds` is the moment a
	 *   source device dropped out of `bySourceDevice` entirely, and no transition ever means the
	 *   reverse, so a rollback produces nothing that would put `hidden` back. Whatever it writes off an
	 *   uncommitted read stands. It therefore waits for a pass that observed the flag clear, and is
	 *   re-checked against that pass's index before it writes at all.
	 *
	 * The drain is also skipped when this pass did not read (`rebuilt === null`): confirming a queued
	 * id means asking the index whether anything still references that source, and a failed rebuild
	 * swapped nothing in, so the index would answer from exactly the state that queued the id. The ids
	 * stay queued for the next pass, which is the same "left for the next structural event" a failed
	 * rebuild has always degraded to.
	 *
	 * The one case where the queue is drained without a settled read is a repair budget spent in full
	 * — see scheduleRepairPass()'s return value, and unhideAbandonedSources() for why that is still the
	 * right call rather than dropping the unhide on the floor.
	 */
	private async runRebuildLoop(): Promise<void> {
		try {
			do {
				const settled = await this.deferPastOpenTransaction();

				this.pending = false;

				const rebuilt = await this.rebuildWithRetry();

				// null means the index was never refreshed, so it reported no transitions — not because
				// there were none, but because it never looked. Left for the next pass / next structural
				// event, which is exactly how a failed rebuild already behaved.
				if (rebuilt) {
					await this.recomputeStatuses(rebuilt.rewiredVirtualDeviceIds);

					for (const virtualDeviceId of rebuilt.rewiredVirtualDeviceIds) {
						this.pendingAnnounceVirtualDeviceIds.add(virtualDeviceId);
					}

					for (const sourceDeviceId of rebuilt.abandonedSourceDeviceIds) {
						this.pendingUnhideSourceDeviceIds.add(sourceDeviceId);
					}
				}

				let repairPending = false;

				if (settled) {
					// The pass read with no transaction open, so whatever it read is committed state and
					// no repair is owed. Clearing the counter here (rather than never) is what lets a
					// later, genuinely slow transaction claim a full repair budget of its own.
					this.repairPasses = 0;
				} else {
					repairPending = this.scheduleRepairPass();
				}

				if (rebuilt && !repairPending) {
					await this.announceOrphanedProjections();

					await this.unhideAbandonedSources();
				}
			} while (this.pending);
		} finally {
			this.running = false;
		}
	}

	/**
	 * Queues another pass after one that had to read without ever seeing the transaction flag clear.
	 *
	 * That pass may have read a transaction's uncommitted rows; if the transaction then rolled back,
	 * the index holds structure that never durably happened, and nothing else will ever say so — a
	 * rollback emits no event. This is the "explicit post-rollback rebuild" that closes it: the next
	 * pass waits again from scratch, and if it does observe the flag clear, its read is committed
	 * state and overwrites whatever the expired pass left behind.
	 *
	 * A timer rather than an immediate re-entry, because the condition being waited out is measured in
	 * the hundreds of milliseconds the expired wait already spent — re-reading in the same turn would
	 * only reproduce the same expiry at the cost of a full table scan. `unref()` so a repair pending on
	 * an otherwise idle process never holds it open; the index is rebuilt at bootstrap anyway, so a
	 * repair skipped by shutdown costs nothing.
	 *
	 * Only ever one timer in flight: a pass that expires while a repair is already armed is the same
	 * repair, not a second one. The budget is spent per unbroken run of expired passes (see
	 * MAX_REPAIR_PASSES), and exhausting it logs at error level and stops — at that point the flag is
	 * stuck rather than busy, and further passes would read exactly what the last one did.
	 *
	 * Returns whether a correcting pass is actually still coming — true both when this call armed one
	 * and when one was already armed, false only once the budget is spent. runRebuildLoop() holds the
	 * pending unhide queue back on `true` and releases it on `false`, so "no further pass will read
	 * this any better" is a fact the caller is told rather than one it has to infer from the counter.
	 */
	private scheduleRepairPass(): boolean {
		if (this.repairTimer) {
			return true;
		}

		if (this.repairPasses >= VirtualIndexMaintenanceListener.MAX_REPAIR_PASSES) {
			this.logger.error(
				`[ERROR] The shared query runner still reports an open transaction after ${VirtualIndexMaintenanceListener.MAX_REPAIR_PASSES} repair pass(es); the virtual property index may reflect uncommitted state until the next structural change.`,
			);

			return false;
		}

		this.repairPasses++;

		this.repairTimer = setTimeout(() => {
			this.repairTimer = null;

			this.handleStructuralChange();
		}, VirtualIndexMaintenanceListener.REPAIR_PASS_DELAY_MS);

		this.repairTimer.unref();

		return true;
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
	 * Shared with the bootstrap hydration (see onApplicationBootstrap()), which is the same problem one
	 * process restart later; `reason` is a parameter only so the state written there does not claim a
	 * wiring change nobody made during this process's lifetime.
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
	/**
	 * Tells everyone holding a projection that it has lost its source.
	 *
	 * A source property's deletion clears `sourcePropertyId` through the foreign key
	 * (`ON DELETE SET NULL`), and a foreign key emits nothing. The websocket carries
	 * CHANNEL_PROPERTY_DELETED for the *source*, which every client duly drops — and then keeps its
	 * cached projection, still naming an id that no longer exists. The admin's sources panel decides
	 * whether to show the orphan warning and its remap action by reading `sourceProperty === null`, so
	 * it showed neither until the page was reloaded; the panel had the same stale copy. The database is
	 * right and every client is wrong, with nothing to tell them.
	 *
	 * Announced from here rather than from a CHANNEL_PROPERTY_DELETED handler because that event is
	 * emitted from *inside* the deleting transaction (see the class docstring), so a handler reading
	 * there would read state that can still roll back. Held back further, to a pass that observed the
	 * transaction settle, for the reason on `pendingAnnounceVirtualDeviceIds`: a bounded wait can expire
	 * with the transaction still open, and an orphan announced off that read has no opposite edge to
	 * correct it if the deletion rolls back.
	 *
	 * Scoped to the devices some rebuild reported *re-wired*, which is a diff: a device orphaned long
	 * ago is not re-wired by later passes and so is not re-announced on every rebuild. The bootstrap
	 * hydration deliberately does not feed this — no client is connected yet to hear it, and the rows
	 * are already correct by the time one is.
	 */
	private async announceOrphanedProjections(): Promise<void> {
		if (this.pendingAnnounceVirtualDeviceIds.size === 0) {
			return;
		}

		const virtualDeviceIds = [...this.pendingAnnounceVirtualDeviceIds];

		this.pendingAnnounceVirtualDeviceIds.clear();

		const repository = this.dataSource.getRepository(VirtualChannelPropertyEntity);

		// One query for the whole set rather than one per device. Every query here runs on the connection
		// the whole app shares, and this runs after every rebuild — which is after every structural event
		// — so a per-device loop would put a burst of round trips right where the index maintenance is
		// already contending with the writes that triggered it.
		const orphans = await repository
			.find({
				where: { channel: { device: { id: In(virtualDeviceIds) } }, sourcePropertyId: IsNull() },
				relations: ['channel'],
			})
			.catch((error: unknown): VirtualChannelPropertyEntity[] => {
				this.logger.error(
					`Failed to read back orphaned projections of virtual devices [${virtualDeviceIds.join(', ')}]`,
					error instanceof Error ? error : undefined,
				);

				return [];
			});

		for (const orphan of orphans) {
			// An owned property has no source and never had one — null there is its normal state, not a
			// loss, and announcing it as one would put an orphan warning on a property that is fine.
			if (!orphan.isProjecting) {
				continue;
			}

			this.eventEmitter.emit(EventType.CHANNEL_PROPERTY_UPDATED, orphan);
		}
	}

	private async recomputeStatuses(
		virtualDeviceIds: string[],
		reason = 'aggregated after a source wiring change',
	): Promise<void> {
		for (const virtualDeviceId of virtualDeviceIds) {
			try {
				await this.status.recompute(virtualDeviceId, reason);
			} catch (error) {
				this.logger.warn(`Failed to recompute connection state for virtual device id=${virtualDeviceId}: ${error}`);
			}
		}

		if (virtualDeviceIds.length > 0) {
			this.logger.debug(`Recomputed connection state for ${virtualDeviceIds.length} virtual device(s): ${reason}`);
		}
	}

	/**
	 * Unhides every source device that is hidden *by the system* and that the freshly hydrated index
	 * shows nothing referencing anymore.
	 *
	 * ## The gap this closes
	 *
	 * unhideAbandonedSources() acts on an *edge* — a source device present in one index version and
	 * absent from the next — which exists only in this process's memory and only until the pass that
	 * drains it runs. If the deletion of the last virtual reference commits and the process stops
	 * before that fire-and-forget pass, the edge is gone permanently: the next start hydrates from an
	 * empty index, so the bootstrap rebuild reports nothing abandoned (see onApplicationBootstrap()),
	 * and every rebuild after it compares one already-reference-free index against another and reports
	 * no transition either. Nothing in the system can name that source device again, and it stays
	 * hidden — excluded from every picker, absent from `?hidden=false`, and out of reach of an admin
	 * that does not show it — for as long as the installation lives.
	 *
	 * A durable queue could not close it: the abandonment is *derived* by a rebuild that must run
	 * strictly after the deleting transaction commits (that is what deferPastOpenTransaction() is for),
	 * so there is no moment at which the intent could be recorded atomically with the deletion. Any
	 * queue is written after the commit and has the same crash window, only narrower. Recovering a lost
	 * edge needs a reconciliation from durable state, which is what this is.
	 *
	 * ## Why provenance is the whole design, not a detail of it
	 *
	 * The obvious sweep — unhide every hidden device nothing references — is not a smaller version of
	 * this; it is a different and worse bug. `hidden` is also a plain operator choice: a physical
	 * device can be hidden with no virtual device involved anywhere, and one that *was* referenced by a
	 * virtual device at some point is not thereby the system's to unhide. A sweep with no provenance
	 * silently reverses a deliberate setting on every single boot, which is a worse failure than the
	 * stranded source it set out to recover — the stranded source is at least recoverable through a
	 * PATCH, whereas a setting reversed at startup is reversed again the next time, forever.
	 *
	 * So the filter is isSystemHidden() — see there for why `USER` and `null` both fail it. The cost of
	 * that conservatism is that a source stranded before provenance existed is not recovered here,
	 * which is correct: nothing can tell it apart from a device its owner meant to hide, and the admin
	 * unhides it in one action.
	 *
	 * ## Failure containment
	 *
	 * Contained as a whole rather than left to onApplicationBootstrap()'s catch, so that a
	 * reconciliation that cannot read does not read as a hydration failure in the log, and — since it
	 * runs last — so a future step added after it would still run. Contained per device as well: one
	 * source that cannot be patched must not cost the others their recovery. Both matter more than
	 * usual here because this is on the startup path, where an escaping rejection aborts Nest's
	 * bootstrap and kills the process; `generate:openapi` boots the whole app against whatever database
	 * happens to be there, and a fresh install has no schema at all until its migrations run.
	 */
	private async reconcileSystemHiddenSources(): Promise<void> {
		try {
			// Filtered in SQL: hidden devices are a handful, every device in the system is not, and this
			// runs before the app serves its first request.
			const hiddenDevices = await this.devicesService.findAll(undefined, DeviceHiddenFilter.TRUE);

			for (const device of hiddenDevices) {
				if (!this.isSystemHidden(device)) {
					continue;
				}

				// Answered from the index this bootstrap just hydrated from committed state, so it is the
				// same question unhideAbandonedSources() asks of a settled pass: anything at all
				// referencing the source means it still has a stand-in and must stay hidden.
				const referencedBy = this.index.findVirtualDeviceIdsBySourceDevice(device.id);

				if (referencedBy.length > 0) {
					continue;
				}

				try {
					await this.unhideSource(device);

					this.logger.log(`Unhid source device id=${device.id} at startup, no virtual device references it anymore`, {
						resource: device.id,
					});
				} catch (error) {
					this.logger.warn(`Failed to unhide system-hidden source device id=${device.id} at startup: ${error}`);
				}
			}
		} catch (error) {
			this.logger.error(
				`Failed to reconcile system-hidden source devices at bootstrap: ${error}. A source device stranded by an abandonment this process never got to write stays hidden until the next start.`,
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
	 * Unhides every queued source device that is still referenced by no virtual device at all — the
	 * spec's "Deleting the last virtual device referencing a hidden source auto-unhides it".
	 *
	 * Without this, a source hidden because a virtual device replaced it stays hidden once that
	 * replacement is gone: excluded from every picker, absent from the default device list, and — since
	 * `hidden` is only reachable through a PATCH the admin no longer offers for a device it does not
	 * show — with no route back through the UI.
	 *
	 * ## Queued by one pass, confirmed by another
	 *
	 * The ids come from `pendingUnhideSourceDeviceIds`, not from the current pass's rebuild result, and
	 * runRebuildLoop() only calls this on a pass that both read something and knows no better-informed
	 * pass is coming. That indirection is the whole point: `hidden` is a column, and a rollback of the
	 * deletion an abandonment was inferred from produces no event and no reverse transition, so a patch
	 * written off an uncommitted read is never taken back by anything.
	 *
	 * Queueing alone would not be enough, because the id cannot simply be replayed later either: the
	 * abandonment is an edge between two index versions, and by the time a confirming pass runs, the
	 * index has already forgotten the source device that queued it — so that pass reports no transition
	 * whichever way the transaction went. What distinguishes the two outcomes is the index itself,
	 * which the confirming pass just rebuilt from committed state: a rollback puts the virtual device's
	 * links back, so the source device is in `bySourceDevice` again and the check below drops the id
	 * untouched; a commit leaves it absent, and the unhide proceeds exactly as it always did.
	 *
	 * A queued id is decided once and dropped either way — including when the source device is
	 * genuinely gone, and when the patch itself throws, which is logged and left alone as before.
	 * Re-queueing a failure would mean carrying it across every future pass with nothing new to learn
	 * from, since the read it would be re-checked against is the same one that just failed.
	 *
	 * ## When the wait never settles
	 *
	 * A budget spent in full releases the queue anyway (see runRebuildLoop() and scheduleRepairPass()),
	 * which is deliberate. A transaction that genuinely rolls back *clears* the flag doing it —
	 * `AbstractSqliteQueryRunner.rollbackTransaction()` resets `isTransactionActive` once ROLLBACK
	 * completes — so a real rollback is observed by a repair pass within the budget. Reaching the end
	 * of the budget instead means the flag is set with nothing behind it (the failed-BEGIN case in the
	 * class docstring), where reads are of committed state despite what the flag says. Holding the
	 * queue back forever there would strand a hidden device with no replacement and no route back
	 * through the UI — the exact failure this method exists to prevent — on a signal that has already
	 * proven meaningless.
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
	 *
	 * ## Provenance is checked here too
	 *
	 * Observing the abandonment is evidence that *a* virtual device was drawing from this source. It is
	 * not evidence that the system is the one that hid it: an operator can hide a physical device by
	 * hand for their own reasons, and that device being referenced by some unrelated virtual device
	 * does not make the flag the system's to clear. So this path applies the same
	 * `hiddenBy === SYSTEM` rule reconcileSystemHiddenSources() does (see isSystemHidden()), and for
	 * more reason rather than less: this runs on every structural change that drops the last reference,
	 * where the sweep runs once per process start, so an ungated version reverses a deliberate setting
	 * far more often — silently, with no notification, and with nothing that would ever put it back.
	 *
	 * The cost is that a source hidden *before* provenance existed does not auto-unhide anymore: the
	 * column's migration backfills every pre-existing hidden row to `user`, precisely because it cannot
	 * tell those apart from a deliberate hide. That cost is bounded and visible — such a device is
	 * still listed by `GET /devices` and unhidden from the admin's hidden-device list in one action —
	 * whereas the setting an ungated unhide destroys is silent and unrecoverable. Newly hidden sources
	 * carry `hidden_by: system` from the flow that hides them, so the mislabelling does not accumulate.
	 */
	private async unhideAbandonedSources(): Promise<void> {
		if (this.pendingUnhideSourceDeviceIds.size === 0) {
			return;
		}

		const sourceDeviceIds = [...this.pendingUnhideSourceDeviceIds];

		this.pendingUnhideSourceDeviceIds.clear();

		for (const sourceDeviceId of sourceDeviceIds) {
			try {
				// Answered from the index this pass just rebuilt, so on a settled pass this is committed
				// state: anything at all referencing the source means it still has a stand-in and must
				// stay hidden. Non-empty here is what a rolled-back deletion looks like from the outside
				// — and equally what a virtual device created in the meantime looks like, which deserves
				// the same answer.
				const referencedBy = this.index.findVirtualDeviceIdsBySourceDevice(sourceDeviceId);

				if (referencedBy.length > 0) {
					this.logger.debug(
						`Left source device id=${sourceDeviceId} hidden, ${referencedBy.length} virtual device(s) reference it again`,
					);

					continue;
				}

				const sourceDevice = await this.devicesService.findOne(sourceDeviceId);

				// Gone entirely — a source device can be deleted in the same sweep as the virtual device
				// that replaced it.
				if (!sourceDevice) {
					continue;
				}

				// Already visible, or hidden by someone this listener is not entitled to overrule (see the
				// docstring above and isSystemHidden()).
				if (!this.isSystemHidden(sourceDevice)) {
					continue;
				}

				await this.unhideSource(sourceDevice);

				this.logger.debug(`Unhid source device id=${sourceDevice.id}, no virtual device references it anymore`);
			} catch (error) {
				this.logger.warn(`Failed to unhide abandoned source device id=${sourceDeviceId}: ${error}`);
			}
		}
	}

	/**
	 * Whether this device is hidden *and* the system is what hid it — the only state either unhide path
	 * is entitled to reverse, and the single place that rule is expressed so the two cannot drift.
	 *
	 * `USER` is a deliberate operator setting and is never touched. Neither is `null`, which is what a
	 * hide written by a caller that named no reason reads as, and what every row hidden before the
	 * column existed was migrated to (see 1000000000009-AddDeviceHiddenBy, which backfills them to
	 * `user`). Unknown provenance is not system provenance: leaving a source hidden is recoverable —
	 * `GET /devices` still lists it and the admin's hidden-device list unhides it in one action —
	 * whereas reversing a hide the operator chose is silent, unnotified and reversed again the next
	 * time the condition recurs.
	 */
	private isSystemHidden(device: DeviceEntity): boolean {
		return device.hidden && device.hiddenBy === DeviceHiddenBy.SYSTEM;
	}

	/**
	 * Orphans a projection whose source property has just been changed into something that can no
	 * longer fill the slot it feeds.
	 *
	 * Compatibility is checked when a projection is created or remapped, but nothing re-checked it when
	 * the *source* moved underneath: `ChannelsPropertiesService.update()` happily changes a physical
	 * property's `permissions` or `dataType`, and the projection stayed attached — exposing values under
	 * a representation the source no longer speaks, or forwarding commands it can no longer accept.
	 *
	 * Degrading rather than refusing the source update. Refusing would need a guard inside the *source*
	 * property's own update path, which belongs to whichever plugin owns that device, and it would let a
	 * virtual device veto an edit to a physical one — the wrong way round. Orphaning is the behaviour
	 * this feature already has for a source that disappears: the device goes offline, the admin shows
	 * the property as orphaned, and the remap dialog is the way back. A source that changes into
	 * something incompatible is the same loss, arriving by a different route.
	 *
	 * Written straight to the repository, as `unhideSource` does and for the same reason: `source_property`
	 * cannot be cleared through the update DTO. That also keeps this from re-entering — no
	 * CHANNEL_PROPERTY_UPDATED is emitted for the row it clears — and the rebuild it schedules is what
	 * refreshes the index and recomputes the affected devices' status.
	 */
	/**
	 * The same question asked of a whole channel.
	 *
	 * A property's own row is not the only thing that decides what it means: `resolvePropertyUnit`
	 * derives the unit from the *channel's* category, and the Shelly v1/NG update DTOs allow that
	 * category to change. `ChannelsService.update()` emits CHANNEL_UPDATED rather than
	 * CHANNEL_PROPERTY_UPDATED, so recategorising a concentration channel from one gas to another moved
	 * its properties from ppm to µg/m³ with every projection still attached, forwarding unchanged
	 * numbers under a unit that no longer applied.
	 */
	@OnEvent(EventType.CHANNEL_UPDATED)
	async handleSourceChannelChange(payload: ChannelEntity): Promise<void> {
		if (!payload?.id) {
			return;
		}

		const properties = await this.channelsPropertiesService
			.findAll(payload.id)
			.catch((error: unknown): ChannelPropertyEntity[] => {
				this.logger.error(
					`Failed to read back properties of updated channel id=${payload.id}`,
					error instanceof Error ? error : undefined,
				);

				return [];
			});

		for (const property of properties) {
			await this.handleSourceMetadataChange(property);
		}
	}

	@OnEvent(EventType.CHANNEL_PROPERTY_UPDATED)
	async handleSourceMetadataChange(payload: ChannelPropertyEntity): Promise<void> {
		if (!payload?.id) {
			return;
		}

		// Nothing may project a virtual property — `assertSourcePropertyUsable` refuses a source whose
		// device is virtual — so a virtual payload can have no dependents by construction. Returning
		// here is what keeps the orphaning emit below from paying for a query to learn that, and what
		// bounds `handleSourceChannelChange` when the channel it read back is itself virtual.
		if (payload.type === DEVICES_VIRTUAL_TYPE) {
			return;
		}

		const repository = this.dataSource.getRepository(VirtualChannelPropertyEntity);

		// Asked of storage rather than of `index.findBySourceProperty`. The index is rebuilt behind
		// structural changes asynchronously, so a projection created moments ago is not in it yet — and
		// a source edited inside that window would find no dependents, return, and then be picked up by
		// the very next rebuild as a link that nothing ever checked. Exactly the case this handler
		// exists for, missed on a race. The row is committed the instant the projection exists, so
		// asking for it cannot be early; `sourcePropertyId` carries an index, and this runs on metadata
		// updates rather than value changes, so the query is cheap and rare.
		//
		// `channel.device` is spelled out because neither hop is populated unless its exact relation
		// path is requested, and the compatibility report below needs the device's category.
		const dependents = (
			await repository.find({
				where: { sourcePropertyId: payload.id },
				relations: ['channel', 'channel.device'],
			})
		).filter((dependent) => dependent.isProjecting);

		if (dependents.length === 0) {
			return;
		}

		// The event's payload is a snapshot of a row at the moment it was emitted, and this handler is
		// asynchronous — so by the time it runs, the source may have been edited again. Two PATCHes that
		// overlap is the ordinary case: one that breaks compatibility followed by one that restores it
		// (the obvious repair, and the one an operator makes as soon as the admin shows the problem).
		// Judging the first payload after the second has landed would orphan a link that is valid again,
		// and the conditional write beside it cannot tell — its predicate proves the projection still
		// points at this source, not that this source still looks the way the event said.
		//
		// So the judgement is made against the row as it stands now. That leaves a much smaller window,
		// between this read and the write, which is the same one every read-then-write here has; what it
		// removes is the arbitrarily large one that queueing behind an async handler opens up.
		const source = await this.channelsPropertiesService
			.findOne<ChannelPropertyEntity>(payload.id)
			.catch((error: unknown): ChannelPropertyEntity | null => {
				this.logger.error(
					`Failed to re-read source property id=${payload.id} before judging its dependents`,
					error instanceof Error ? error : undefined,
				);

				return null;
			});

		if (!source) {
			// Gone, or unreadable. A deletion has its own path — the FK clears `sourcePropertyId` and the
			// rebuild reports the abandonment — and orphaning off a failed read would be acting on nothing.
			return;
		}

		// Part of what is judged below comes off the channel rather than the property — `resolvePropertyUnit`
		// derives the unit from the channel's category — so the channel is one of the rows this pass read,
		// and the write has to name its version too. Every query in ChannelsPropertiesService joins
		// `channel`, so a bare id here would mean something changed underneath; declining to judge is the
		// safe answer, since the alternative is orphaning against a channel this pass never actually saw.
		const sourceChannel = typeof source.channel === 'string' ? null : source.channel;

		if (!sourceChannel) {
			this.logger.warn(
				`Source property id=${payload.id} came back without its channel; leaving its dependents alone rather than judging them against a channel this pass never read`,
			);

			return;
		}

		let orphaned = false;

		for (const dependent of dependents) {
			const channel = dependent.channel;

			if (!channel || typeof channel === 'string') {
				continue;
			}

			const device = channel.device;

			if (!device || typeof device === 'string') {
				continue;
			}

			const report = this.virtualDevicesService.reportCompatibility(
				{ category: device.category, channel: channel.category, property: dependent.category },
				source,
			);

			// The slot report alone is not enough here. `light.brightness` accepts a `uchar` percentage and
			// an `enum` level, so a source switching between two allowed variants stays compatible *with
			// the slot* while no longer agreeing with the projection reading it — enum values would keep
			// flowing through a property still declaring itself numeric. `assertProjectionCompatible`
			// makes that comparison on the write paths; this update path has to make it too.
			const representationDiverged = dependent.dataType !== source.dataType;

			// The same gap on the other metadata a slot report cannot see. A sentinel is the device's, not
			// the specification's, so `reportCompatibility` never asks about it — but a source that starts
			// reserving a value its projection does not is exactly this handler's case: the projection
			// would present that value as a real reading, and accept a command carrying it.
			const sentinelMismatch = this.virtualDevicesService.describeSentinelMismatch(dependent, source);

			if (report.compatible && !representationDiverged && sentinelMismatch === null) {
				continue;
			}

			const reason = !report.compatible
				? (report.reason ?? 'incompatible')
				: representationDiverged
					? `its representation changed to '${source.dataType}' while the projection declares '${dependent.dataType}'`
					: (sentinelMismatch ?? 'incompatible');

			this.logger.warn(
				`Source property id=${payload.id} no longer fits the slot filled by virtual property id=${dependent.id}: ${reason}. Orphaning it.`,
			);

			// Conditional on two things, both of which can stop being true between the reads above and this
			// write, and neither of which the other predicate covers.
			//
			// `sourcePropertyId` — a remap can repoint the projection at a different source in that window.
			// The admin's repair flow does exactly that, and it is the flow most likely to be running while
			// a source's metadata is being edited, so an id-only update would clear the *new* link: the
			// remap reports success and the projection orphans itself a moment later against a source it no
			// longer has anything to do with.
			//
			// The source's own `updatedAt` — a second PATCH can restore compatibility after the read that
			// judged it. That is the ordinary repair sequence (break it, see the problem, fix it), and this
			// handler queued behind the first event would otherwise orphan a link that is valid again.
			// Re-reading before judging narrowed that window to this one statement; naming the version in
			// the statement closes it, because the row cannot change while it is being matched. A
			// millisecond-resolution timestamp cannot distinguish two writes inside the same millisecond,
			// which is the residue — far smaller than an await boundary, and self-correcting, since the
			// second write emits its own event.
			const sourceTable = this.dataSource.getMetadata(ChannelPropertyEntity).tableName;
			const channelTable = this.dataSource.getMetadata(ChannelEntity).tableName;

			// One clause per row the judgement read, each naming the version it read. `= NULL` matches
			// nothing in SQL, so a row that has never been updated is matched with IS NULL instead — without
			// that, a source nobody had edited yet could never be orphaned at all.
			const unchanged = (
				table: string,
				alias: string,
				idParam: string,
				versionParam: string,
				version: Date | string | null | undefined,
			): [string, Record<string, unknown>] =>
				version === null || version === undefined
					? [
							`EXISTS (SELECT 1 FROM ${table} ${alias} WHERE ${alias}.id = :${idParam} AND ${alias}.updatedAt IS NULL)`,
							{},
						]
					: [
							`EXISTS (SELECT 1 FROM ${table} ${alias} WHERE ${alias}.id = :${idParam} AND ${alias}.updatedAt = :${versionParam})`,
							{ [versionParam]: version },
						];

			const [sourceUnchanged, sourceVersionParams] = unchanged(
				sourceTable,
				'src',
				'sourceId',
				'sourceUpdatedAt',
				source.updatedAt,
			);

			// The channel is versioned too, because part of what was judged comes off it rather than off
			// the property: `resolvePropertyUnit` derives the unit from the channel's *category*, which is
			// why `handleSourceChannelChange` funnels a recategorisation through here at all. A channel
			// moved to something incompatible and then moved back leaves the property row untouched, so a
			// property-only version would still match and orphan a projection that is fine again.
			const [channelUnchanged, channelVersionParams] = unchanged(
				channelTable,
				'ch',
				'sourceChannelId',
				'sourceChannelUpdatedAt',
				sourceChannel?.updatedAt,
			);

			const orphaning = await repository
				.createQueryBuilder()
				.update(VirtualChannelPropertyEntity)
				.set({ sourcePropertyId: null })
				.where('id = :dependentId', { dependentId: dependent.id })
				.andWhere('sourcePropertyId = :sourceId', { sourceId: payload.id })
				.andWhere(sourceUnchanged, sourceVersionParams)
				.andWhere(channelUnchanged, { sourceChannelId: sourceChannel?.id, ...channelVersionParams })
				.execute();

			if (!orphaning.affected) {
				// Either the projection was repointed first, or the source was edited again after this pass
				// read it. In both cases the state this judgement was about is gone, and the write that
				// replaced it brought its own event and its own guard — the remap passed
				// `assertProjectionCompatible`, the PATCH will arrive here in turn. Nothing here has judged
				// what is stored now, so nothing here announces it or counts it as a structural change.
				this.logger.debug(
					`Virtual property id=${dependent.id} no longer matches the state it was judged in (source id=${payload.id}); leaving it to whatever wrote it`,
				);

				continue;
			}

			// Announced, or an already-open admin keeps the old link: the sources panel would not show
			// the orphan warning or its remap action until the page was reloaded, and other websocket
			// clients would hold the stale projection too. Re-read rather than patching the cached row,
			// so what goes out is what was actually stored.
			const refreshed = await repository.findOne({ where: { id: dependent.id }, relations: ['channel'] });

			if (refreshed) {
				// Safe to emit even though this handler listens for the same event: the payload is a
				// *virtual* property, and nothing projects a virtual property, so the re-entrant pass
				// finds no dependents and returns immediately.
				this.eventEmitter.emit(EventType.CHANNEL_PROPERTY_UPDATED, refreshed);
			}

			orphaned = true;
		}

		if (orphaned) {
			this.handleStructuralChange();
		}
	}

	/**
	 * Makes one source device visible again, and leaves its row in a clean state rather than one
	 * claiming a provenance for a device that is no longer hidden. Shared by both unhide paths — the
	 * abandonment this process observed (unhideAbandonedSources()) and the one it inherited from a
	 * predecessor (reconcileSystemHiddenSources()) — so the two can never disagree about what unhiding
	 * a device consists of. Both decide *whether* to call it with isSystemHidden().
	 *
	 * ## Why the patch echoes `enabled` back
	 *
	 * `hidden: false` alone would silently re-enable a device the user had explicitly disabled.
	 * `DevicesService.update()` transforms the DTO into the mapped entity class and saves the result,
	 * and `DeviceEntity.enabled` carries a `= true` class field initializer — class-transformer builds
	 * its target with `new Target()`, so that initializer is already on the instance before anything is
	 * copied across, and `omitBy(..., isUndefined)` therefore cannot drop it. Any PATCH that omits
	 * `enabled` writes `true`. That is the pre-existing defect documented on the entity itself
	 * (devices.entity.ts) and as follow-up 3.1; fixing it at the root is blocked on
	 * `devices-shelly-v1`'s afterInsert subscriber reading `event.entity.enabled` before the row is
	 * re-read, so this call defends itself by sending the value it just read back unchanged.
	 *
	 * ## Why the patch carries no placement field
	 *
	 * `DevicesService.update()` refuses a `room_id`/`zone_ids` change on a device that is *currently*
	 * hidden (assertPlacementChangeAllowed()), and this device is, right up until this very patch. The
	 * guard is on the fields the patch carries rather than on the resulting state, so an unhide that
	 * sends neither passes — and this one has no business moving a device between rooms anyway.
	 *
	 * ## Why clearing `hiddenBy` takes a second, non-DTO write
	 *
	 * `UpdateDeviceDto.hidden_by` cannot express `null`. Its `@Transform` maps an explicit `null` to
	 * `undefined` — the null-means-field-absent convention every optional field on that DTO follows,
	 * `hidden` and `enabled` included — and `DevicesService.update()` then drops undefined keys
	 * (`omitBy(..., isUndefined)`) before assigning. There is therefore no DTO value that means "clear
	 * this", by construction rather than by oversight, which is why this goes through the entity's own
	 * repository instead. Written as a targeted column update rather than a `save()` of a loaded
	 * entity: the row was just re-read and written by the call above, and re-saving a whole entity on
	 * top of that would put every other column back in play for the sake of one.
	 *
	 * Second rather than first, deliberately. Whichever write fails, the pair is not atomic, so the
	 * order decides which half-state a failure leaves behind: `hidden = false` with a stale
	 * `hiddenBy = system` is a cosmetic inconsistency on a device the user can see and act on, whereas
	 * `hidden = true` with `hiddenBy = null` is a hidden device that reconcileSystemHiddenSources() is
	 * then required to ignore forever — the exact failure this whole path exists to prevent, recreated
	 * by the fix for it.
	 */
	private async unhideSource(device: DeviceEntity): Promise<void> {
		await this.devicesService.update(device.id, {
			type: device.type,
			hidden: false,
			enabled: device.enabled,
		});

		await this.devicesRepository.update(device.id, { hiddenBy: null });
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
	 * Waits until the shared QueryRunner reports no transaction active, and reports whether it got
	 * there — `true` means a poll actually observed the flag clear, `false` means the bound was
	 * exhausted with it still set. The caller acts on that difference (see runRebuildLoop() and
	 * scheduleRepairPass()); it is deliberately not swallowed here, because "we read anyway" and "we
	 * read after it settled" are not the same guarantee.
	 *
	 * `dataSource.createQueryRunner()` is the exact call `VirtualPropertyIndexService.rebuild()`'s
	 * `repository.find()` resolves to internally (obtainQueryRunner() falls back to it for any
	 * unscoped query), and sqlite is not pooled, so this is always the one connection every such
	 * query — including the caller's, if it is still mid-transaction — actually runs on. Polling the
	 * flag itself, rather than assuming a fixed number of hops clears it, is what makes a settled
	 * transaction an *observed* fact rather than a timing guess: the driver only flips
	 * `isTransactionActive` back to false once `COMMIT`/`ROLLBACK` has actually completed (see
	 * AbstractSqliteQueryRunner's commitTransaction()/rollbackTransaction()).
	 *
	 * Two phases, never a bare microtask in either (a microtask would still resolve inside the
	 * emitting transaction's own async flow — see the class docstring): `setImmediate` first, which
	 * settles the ordinary case in well under a millisecond, then a timer, which is what an
	 * abnormally long transaction needs and what a `setImmediate` spin would actively obstruct. See
	 * the two poll-count constants for why the split is drawn there. Measured against this app's own
	 * e2e suite, a real device deletion settles between 25 and 350 ms after emitting its event —
	 * comfortably past the first phase, comfortably inside the second.
	 *
	 * The second phase is skipped while `connectionStoppedSettling` is latched; see that field for
	 * why an abandoned transaction must cost the budget once rather than once per pass.
	 */
	private async deferPastOpenTransaction(): Promise<boolean> {
		const queryRunner = this.dataSource.createQueryRunner();

		for (let poll = 0; poll < VirtualIndexMaintenanceListener.TRANSACTION_SETTLE_IMMEDIATE_POLLS; poll++) {
			await new Promise<void>((resolve) => setImmediate(resolve));

			if (!queryRunner.isTransactionActive) {
				this.connectionStoppedSettling = false;

				return true;
			}
		}

		// Skipped entirely once this connection has already failed to settle within the full budget:
		// paying it again on every subsequent pass is what turns one abandoned transaction into a
		// permanently starved index (see the field's own comment). One poll of the fast phase above is
		// enough to notice the moment it recovers, at which point the full budget is available again.
		if (!this.connectionStoppedSettling) {
			for (let poll = 0; poll < VirtualIndexMaintenanceListener.TRANSACTION_SETTLE_TIMER_POLLS; poll++) {
				await new Promise<void>((resolve) =>
					setTimeout(resolve, VirtualIndexMaintenanceListener.TRANSACTION_SETTLE_TIMER_INTERVAL_MS),
				);

				if (!queryRunner.isTransactionActive) {
					this.connectionStoppedSettling = false;

					return true;
				}
			}

			this.connectionStoppedSettling = true;

			this.logger.warn(
				`Gave up waiting for an open transaction to settle after ${VirtualIndexMaintenanceListener.TRANSACTION_SETTLE_IMMEDIATE_POLLS} immediate and ${VirtualIndexMaintenanceListener.TRANSACTION_SETTLE_TIMER_POLLS} timed poll(s); rebuilding anyway and scheduling a repair pass.`,
			);
		}

		return false;
	}
}
