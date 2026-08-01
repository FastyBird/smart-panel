import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { Logger } from '@nestjs/common';

import { EventType } from '../../../modules/devices/devices.constants';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { VirtualIndexRebuildResult, VirtualPropertyIndexService } from '../services/virtual-property-index.service';

import { VirtualIndexMaintenanceListener } from './virtual-index-maintenance.listener';
import { VirtualStatusListener } from './virtual-status.listener';

// The metadata key @nestjs/event-emitter's @OnEvent() decorator stores its subscriptions under.
// Not part of the package's public exports (only the decorator itself is), so the key is
// duplicated here rather than imported. See the "subscribes to exactly..." test below: reading
// this back is what actually proves an event is (or is not) wired to the handler, as opposed to
// merely calling the handler directly, which would prove nothing about the decorator stack itself.
const EVENT_LISTENER_METADATA = 'EVENT_LISTENER_METADATA';

interface OnEventMetadataEntry {
	event: string | symbol | Array<string | symbol>;
}

// A rebuild that observed no transition at all — the ordinary outcome of a structural event that did
// not touch any virtual device's wiring, and the default every mock below starts from.
const NO_CHANGES: VirtualIndexRebuildResult = { rewiredVirtualDeviceIds: [], abandonedSourceDeviceIds: [] };

describe('VirtualIndexMaintenanceListener', () => {
	let listener: VirtualIndexMaintenanceListener;
	let index: {
		rebuild: jest.Mock;
		findLinksByVirtualDevice: jest.Mock;
		findVirtualDeviceIdsBySourceDevice: jest.Mock;
	};
	let status: { recompute: jest.Mock };
	let devicesService: { findOne: jest.Mock; update: jest.Mock };

	// Drains Node's microtask queue completely — including microtasks newly queued while draining —
	// before the callback runs. Unlike a fixed number of `await Promise.resolve()` hops, this needs
	// no knowledge of how many microtask turns the coalescing loop takes internally, so it stays
	// correct even if that implementation detail changes.
	const flushMicrotasks = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

	// A promise plus its own resolver, so a test can decide exactly when a mocked rebuild() call
	// settles — needed to observe listener state while a rebuild is genuinely still in flight,
	// without racing real timers or guessing at microtask counts.
	// Resolves to rebuild()'s own return shape, so a deferred pass drives the follow-up steps exactly
	// as a real one would.
	const createDeferred = (
		value: VirtualIndexRebuildResult = NO_CHANGES,
	): { promise: Promise<VirtualIndexRebuildResult>; resolve: () => void } => {
		let resolve!: () => void;
		const promise = new Promise<VirtualIndexRebuildResult>((res) => {
			resolve = () => res(value);
		});

		return { promise, resolve };
	};

	// Repeatedly flushes macrotasks until either `predicate` is satisfied or `maxFlushes` is reached,
	// rather than a fixed hop count. Every pass through runRebuildLoop() — not just the first — defers
	// past any open transaction before reading (see deferPastOpenTransaction()), so a follow-up pass
	// costs at least one more flushMicrotasks() than the pass that triggered it, and pinning that
	// count here would just re-encode an implementation detail the brief says not to assert on.
	const flushUntil = async (predicate: () => boolean, maxFlushes = 10): Promise<void> => {
		for (let i = 0; i < maxFlushes && !predicate(); i++) {
			await flushMicrotasks();
		}
	};

	// A stand-in for the shared, single-connection QueryRunner deferPastOpenTransaction() polls.
	// Never mid-transaction here — these tests exercise coalescing/retry, not commit ordering, which
	// has its own real-sqlite coverage below — so every poll's `isTransactionActive` reads false, and
	// each deferPastOpenTransaction() call still costs exactly the one `setImmediate` hop the rest of
	// this file's flushMicrotasks()-based timing already assumes.
	const dataSourceStub = { createQueryRunner: () => ({ isTransactionActive: false }) };

	beforeEach(() => {
		// rebuild() resolves to the transitions it observed; both lists empty is "nothing changed", the
		// ordinary case for a structural event that did not touch any virtual device's wiring.
		index = {
			rebuild: jest.fn().mockResolvedValue(NO_CHANGES),
			findLinksByVirtualDevice: jest.fn().mockReturnValue([]),
			findVirtualDeviceIdsBySourceDevice: jest.fn().mockReturnValue([]),
		};
		status = { recompute: jest.fn().mockResolvedValue(undefined) };
		devicesService = { findOne: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue(undefined) };
		listener = new VirtualIndexMaintenanceListener(
			index as unknown as VirtualPropertyIndexService,
			status as unknown as VirtualStatusListener,
			devicesService as unknown as DevicesService,
			dataSourceStub as unknown as DataSource,
		);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	// -- pinned brief cases ---------------------------------------------------------------------

	it('triggers a rebuild when a structural event fires', async () => {
		listener.handleStructuralChange();

		await flushMicrotasks();

		expect(index.rebuild).toHaveBeenCalledTimes(1);
	});

	it('collapses a synchronous burst of structural events into exactly one rebuild', async () => {
		for (let i = 0; i < 5; i++) {
			listener.handleStructuralChange();
		}

		await flushMicrotasks();

		expect(index.rebuild).toHaveBeenCalledTimes(1);
	});

	// Calling the handler directly (as the tests above do) cannot prove any particular event is
	// absent from its decorator stack — the test alone decides what gets called either way. The
	// subscription list itself is the thing under test here, so this reads it back off the method
	// the same way @nestjs/event-emitter's own EventsMetadataAccessor does internally.
	it('subscribes to exactly the structural device and property lifecycle events, never CHANNEL_PROPERTY_VALUE_SET', () => {
		// Read as a bare function reference, never called — there is no `this` to lose here, so the
		// usual "unbound method" risk the rule guards against does not apply.
		// eslint-disable-next-line @typescript-eslint/unbound-method
		const handler = VirtualIndexMaintenanceListener.prototype.handleStructuralChange;
		const metadata =
			(Reflect.getMetadata(EVENT_LISTENER_METADATA, handler) as OnEventMetadataEntry[] | undefined) ?? [];

		const events = metadata.flatMap((entry) => (Array.isArray(entry.event) ? entry.event : [entry.event]));

		expect([...events].sort()).toEqual(
			[
				EventType.DEVICE_CREATED,
				EventType.DEVICE_UPDATED,
				EventType.DEVICE_DELETED,
				EventType.DEVICE_RESET,
				EventType.CHANNEL_PROPERTY_CREATED,
				EventType.CHANNEL_PROPERTY_UPDATED,
				EventType.CHANNEL_PROPERTY_DELETED,
				EventType.CHANNEL_PROPERTY_RESET,
				EventType.MODULE_RESET,
			].sort(),
		);
		expect(events).not.toContain(EventType.CHANNEL_PROPERTY_VALUE_SET);
	});

	it('coalesces events that arrive while a rebuild is in flight into exactly one subsequent rebuild', async () => {
		const first = createDeferred();
		const second = createDeferred();

		index.rebuild.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

		listener.handleStructuralChange();
		await flushMicrotasks();

		expect(index.rebuild).toHaveBeenCalledTimes(1);

		// Several events land here, all while the first rebuild is still in flight (first.promise is
		// deliberately still unresolved) — none of them may start a second, overlapping rebuild.
		listener.handleStructuralChange();
		listener.handleStructuralChange();
		listener.handleStructuralChange();

		first.resolve();

		// The follow-up pass defers past any open transaction before it reads, same as the first pass
		// did — see runRebuildLoop() — so it costs at least one more flush than the first pass's own
		// call did; flushUntil() waits however many that turns out to be instead of assuming a count.
		await flushUntil(() => index.rebuild.mock.calls.length >= 2);

		// Exactly one follow-up for the three events above, not three.
		expect(index.rebuild).toHaveBeenCalledTimes(2);

		second.resolve();
		await flushMicrotasks();

		// Nothing arrived during the follow-up, so the loop stops instead of running a third pass.
		// Stopping needs no further defer — only a fresh pass would — so a single flush still suffices
		// here to prove a third call does *not* happen.
		expect(index.rebuild).toHaveBeenCalledTimes(2);
	});

	it('catches and logs a rejected rebuild, and still rebuilds on a later event', async () => {
		const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn');
		const failure = new Error('rebuild boom');

		index.rebuild.mockRejectedValueOnce(failure).mockResolvedValueOnce(NO_CHANGES);

		listener.handleStructuralChange();
		await flushMicrotasks();

		expect(index.rebuild).toHaveBeenCalledTimes(1);
		expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('rebuild boom'), expect.anything());

		// A later, unrelated event must still trigger a fresh rebuild — a listener that gets stuck
		// after one failure would be worse than no listener at all.
		listener.handleStructuralChange();
		await flushMicrotasks();

		expect(index.rebuild).toHaveBeenCalledTimes(2);

		loggerWarnSpy.mockRestore();
	});

	// -- Task 12b: retry on a transient-looking SQLite failure ----------------------------------

	it('retries a transient-looking SQLite failure and the index ends up current', async () => {
		const transientFailure = new Error('SQLITE_ERROR: cannot start a transaction within a transaction');

		index.rebuild.mockRejectedValueOnce(transientFailure).mockResolvedValueOnce(NO_CHANGES);

		listener.handleStructuralChange();

		await flushUntil(() => index.rebuild.mock.calls.length >= 2);

		// The retry succeeded: exactly one extra attempt, not a fresh pass per flush, and the pass
		// completed (implied by reaching call #2 with nothing left pending).
		expect(index.rebuild).toHaveBeenCalledTimes(2);
	});

	it('gives up after MAX_REBUILD_ATTEMPTS consecutive transient failures, and still rebuilds on a later event', async () => {
		const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn');
		const transientFailure = new Error('SQLITE_ERROR: cannot start a transaction within a transaction');

		// Every attempt in this pass fails — proves the retry loop is bounded rather than retrying
		// forever, which would contradict "does not wedge the loop permanently" just as surely as
		// never retrying at all would.
		index.rebuild.mockRejectedValue(transientFailure);

		listener.handleStructuralChange();

		await flushUntil(() => index.rebuild.mock.calls.length >= 3);

		expect(index.rebuild).toHaveBeenCalledTimes(3);

		// Falls back to exactly Task 12a's original guarantee once attempts are exhausted: a later,
		// unrelated event still triggers a fresh rebuild rather than the listener staying stuck.
		index.rebuild.mockResolvedValueOnce(NO_CHANGES);
		listener.handleStructuralChange();
		await flushMicrotasks();

		expect(index.rebuild).toHaveBeenCalledTimes(4);

		loggerWarnSpy.mockRestore();
	});

	it('does not retry a non-transient failure — matches Task 12a exactly', async () => {
		const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn');
		const genericFailure = new Error('unexpected boom');

		index.rebuild.mockRejectedValueOnce(genericFailure).mockResolvedValueOnce(NO_CHANGES);

		listener.handleStructuralChange();
		await flushMicrotasks();

		// No retry attempted for a generic error, even though attempts remain — retrying here would
		// be indistinguishable, from the outside, from a rebuild silently running twice per event.
		expect(index.rebuild).toHaveBeenCalledTimes(1);

		loggerWarnSpy.mockRestore();
	});

	// -- recomputing connection state after a rebuild that re-wired something -------------------
	//
	// Regression tests for a virtual device whose last linked source property was deleted staying
	// reported as connected forever. The FK's ON DELETE SET NULL fires and the rebuild duly records an
	// orphan, but VirtualStatusListener runs only on DEVICE_CONNECTION_CHANGED — and a fully orphaned
	// device has dropped out of `bySourceDevice`, so no source device change can ever select it again.
	// Nothing else recomputed it, so nothing ever would.

	it('recomputes the connection state of every virtual device the rebuild re-wired', async () => {
		index.rebuild.mockResolvedValue({
			rewiredVirtualDeviceIds: ['virtual-a', 'virtual-b'],
			abandonedSourceDeviceIds: [],
		});

		listener.handleStructuralChange();
		await flushMicrotasks();

		expect(status.recompute).toHaveBeenCalledTimes(2);
		expect(status.recompute).toHaveBeenCalledWith('virtual-a', expect.any(String));
		expect(status.recompute).toHaveBeenCalledWith('virtual-b', expect.any(String));
	});

	it('recomputes nothing when the rebuild changed no virtual device wiring', async () => {
		listener.handleStructuralChange();
		await flushMicrotasks();

		expect(index.rebuild).toHaveBeenCalledTimes(1);
		expect(status.recompute).not.toHaveBeenCalled();
	});

	// A failed rebuild swapped nothing in, so there is nothing re-wired to recompute — and aggregating
	// against an index the failed pass left untouched would write a state derived from stale wiring.
	it('recomputes nothing when the rebuild failed outright', async () => {
		const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

		index.rebuild.mockRejectedValue(new Error('unexpected boom'));

		listener.handleStructuralChange();
		await flushMicrotasks();

		expect(status.recompute).not.toHaveBeenCalled();

		loggerWarnSpy.mockRestore();
	});

	// The recompute runs inside the fire-and-forget rebuild loop, so one virtual device that cannot be
	// recomputed must cost only its own result, not everyone else's.
	it('keeps recomputing the remaining devices after one of them throws', async () => {
		const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

		index.rebuild.mockResolvedValue({
			rewiredVirtualDeviceIds: ['virtual-a', 'virtual-b'],
			abandonedSourceDeviceIds: [],
		});
		status.recompute.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);

		listener.handleStructuralChange();
		await flushMicrotasks();

		expect(status.recompute).toHaveBeenCalledTimes(2);

		loggerWarnSpy.mockRestore();
	});

	// The loop-safety claim in recomputeStatuses()'s docstring, made observable: recomputing must not
	// itself schedule another rebuild. Nothing here calls handleStructuralChange() again, which is the
	// point — the real emissions a recompute causes (DEVICE_CONNECTION_CHANGED,
	// CHANNEL_PROPERTY_VALUE_SET) are both outside this listener's subscription list, so the pass that
	// recomputed must be the last one.
	it('does not schedule a further rebuild as a result of recomputing', async () => {
		index.rebuild.mockResolvedValue({ rewiredVirtualDeviceIds: ['virtual-a'], abandonedSourceDeviceIds: [] });

		listener.handleStructuralChange();

		await flushUntil(() => index.rebuild.mock.calls.length >= 2);

		expect(index.rebuild).toHaveBeenCalledTimes(1);
		expect(status.recompute).toHaveBeenCalledTimes(1);
	});

	// -- unhiding a source device abandoned by its last virtual device -------------------------
	//
	// Regression tests for the spec's "Deleting the last virtual device referencing a hidden source
	// auto-unhides it". The DEVICE_DELETED handler discarded its payload and only rebuilt, so a
	// physical device hidden because a virtual device replaced it stayed hidden after that replacement
	// was gone — excluded from every picker, absent from the default device list, with no route back
	// through the UI.

	const rebuiltWithAbandoned = (...sourceDeviceIds: string[]) => ({
		rewiredVirtualDeviceIds: [],
		abandonedSourceDeviceIds: sourceDeviceIds,
	});

	it('unhides a source device the rebuild reports as abandoned', async () => {
		index.rebuild.mockResolvedValue(rebuiltWithAbandoned('source-device'));
		devicesService.findOne.mockResolvedValue({ id: 'source-device', type: 'simulator', hidden: true });

		listener.handleStructuralChange();
		await flushMicrotasks();

		expect(devicesService.update).toHaveBeenCalledWith(
			'source-device',
			expect.objectContaining({ hidden: false, type: 'simulator' }),
		);
	});

	// `hidden: false` on its own would silently re-enable a device the user had explicitly disabled:
	// DevicesService.update() transforms the DTO into the mapped entity class before saving it, and
	// DeviceEntity.enabled carries a `= true` class field initializer that class-transformer cannot
	// drop (it is already on the instance `new Target()` produced), so `omitBy(..., isUndefined)`
	// keeps it and any PATCH omitting `enabled` writes `true`. That is the pre-existing defect
	// documented on the entity and as follow-up 3.1, whose root fix is blocked on devices-shelly-v1's
	// afterInsert subscriber — so this call defends itself by echoing back the value it just read.
	it('keeps a disabled source device disabled when it unhides it', async () => {
		index.rebuild.mockResolvedValue(rebuiltWithAbandoned('source-device'));
		devicesService.findOne.mockResolvedValue({
			id: 'source-device',
			type: 'simulator',
			hidden: true,
			enabled: false,
		});

		listener.handleStructuralChange();
		await flushMicrotasks();

		expect(devicesService.update).toHaveBeenCalledWith(
			'source-device',
			expect.objectContaining({ hidden: false, enabled: false }),
		);
	});

	it('leaves an enabled source device enabled when it unhides it', async () => {
		index.rebuild.mockResolvedValue(rebuiltWithAbandoned('source-device'));
		devicesService.findOne.mockResolvedValue({ id: 'source-device', type: 'simulator', hidden: true, enabled: true });

		listener.handleStructuralChange();
		await flushMicrotasks();

		expect(devicesService.update).toHaveBeenCalledWith(
			'source-device',
			expect.objectContaining({ hidden: false, enabled: true }),
		);
	});

	// "Still referenced" is not this method's question to ask — rebuild() answers it by reporting only
	// source devices that dropped out of bySourceDevice entirely.
	it('touches no source device when the rebuild reports none abandoned', async () => {
		devicesService.findOne.mockResolvedValue({ id: 'source-device', type: 'simulator', hidden: true });

		listener.handleStructuralChange();
		await flushMicrotasks();

		expect(devicesService.findOne).not.toHaveBeenCalled();
		expect(devicesService.update).not.toHaveBeenCalled();
	});

	it('does not patch a source device that was never hidden', async () => {
		index.rebuild.mockResolvedValue(rebuiltWithAbandoned('source-device'));
		devicesService.findOne.mockResolvedValue({ id: 'source-device', type: 'simulator', hidden: false });

		listener.handleStructuralChange();
		await flushMicrotasks();

		expect(devicesService.update).not.toHaveBeenCalled();
	});

	// A source device can be deleted in the same sweep as the virtual device that replaced it.
	it('skips a source device that no longer exists', async () => {
		index.rebuild.mockResolvedValue(rebuiltWithAbandoned('source-device'));
		devicesService.findOne.mockResolvedValue(null);

		listener.handleStructuralChange();
		await flushMicrotasks();

		expect(devicesService.update).not.toHaveBeenCalled();
	});

	// A failed rebuild reported no transitions because it never looked, not because there were none.
	it('does not unhide anything when the rebuild failed', async () => {
		const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

		index.rebuild.mockRejectedValue(new Error('unexpected boom'));
		devicesService.findOne.mockResolvedValue({ id: 'source-device', type: 'simulator', hidden: true });

		listener.handleStructuralChange();
		await flushMicrotasks();

		expect(devicesService.update).not.toHaveBeenCalled();

		loggerWarnSpy.mockRestore();
	});

	// The patch emits DEVICE_UPDATED, which schedules one further pass. That pass sees the source device
	// already absent from bySourceDevice, so rebuild() reports no transition and nothing is patched
	// again — the loop converges instead of unhiding the same device forever.
	it('does not unhide the same device again on the pass its own patch triggers', async () => {
		index.rebuild
			.mockResolvedValueOnce(rebuiltWithAbandoned('source-device'))
			.mockResolvedValue({ rewiredVirtualDeviceIds: [], abandonedSourceDeviceIds: [] });
		devicesService.findOne.mockResolvedValue({ id: 'source-device', type: 'simulator', hidden: true });

		listener.handleStructuralChange();
		await flushMicrotasks();

		expect(devicesService.update).toHaveBeenCalledTimes(1);

		// Stands in for the DEVICE_UPDATED the patch above emits.
		listener.handleStructuralChange();
		await flushMicrotasks();

		expect(devicesService.update).toHaveBeenCalledTimes(1);
	});

	it('keeps unhiding the remaining devices after one of them throws', async () => {
		const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

		index.rebuild.mockResolvedValue(rebuiltWithAbandoned('source-a', 'source-b'));
		devicesService.findOne
			.mockRejectedValueOnce(new Error('boom'))
			.mockResolvedValue({ id: 'source-b', type: 'simulator', hidden: true });

		listener.handleStructuralChange();
		await flushMicrotasks();

		expect(devicesService.update).toHaveBeenCalledTimes(1);

		loggerWarnSpy.mockRestore();
	});

	// -- Task 12b: the rebuild must not read while the emitting transaction is still open -------

	// Real DataSource + dataSource.transaction() — the same call this app's DevicesService.remove()
	// and ChannelsPropertiesService.remove() make — so this exercises the actual TypeORM + sqlite3
	// mechanics the class docstring's correctness argument rests on: SqliteDriver.createQueryRunner()
	// handing out one shared, single-connection QueryRunner to every non-transactional-manager query
	// in the app, and that connection only clearing `isTransactionActive` once COMMIT/ROLLBACK has
	// actually completed. A mocked-only test cannot prove this property — there is no real
	// transaction, and no real (threadpool-backed, not same-tick) COMMIT, to be "inside" of. This is
	// also the test that falsified this class's first implementation: an earlier version deferred
	// with a single bare `setImmediate` hop, reasoning (wrongly) that submitting the read after
	// COMMIT was submitted would be enough — this test caught that COMMIT's *completion* is what
	// matters, not its submission, before that version ever shipped.
	describe('defers past an open transaction (real sqlite)', () => {
		let dataSource: DataSource;

		beforeAll(async () => {
			dataSource = new DataSource({ type: 'sqlite', database: ':memory:', entities: [], synchronize: false });
			await dataSource.initialize();
			await dataSource.query('CREATE TABLE probe (id TEXT PRIMARY KEY)');
		});

		afterAll(async () => {
			await dataSource.destroy();
		});

		it('does not observe the emitting transaction as still open by the time it reads', async () => {
			// The exact query runner obtainQueryRunner() falls back to for any unscoped query —
			// including VirtualPropertyIndexService.rebuild()'s repository.find() — because sqlite is
			// not pooled (see AbstractSqliteDriver): this one instance is shared by every
			// non-transactional caller in the app, ours included.
			const sharedQueryRunner = dataSource.createQueryRunner();

			let observedTransactionActive: boolean | undefined;
			let resolveObserved!: () => void;
			const observed = new Promise<void>((resolve) => {
				resolveObserved = resolve;
			});

			const probeIndex = {
				rebuild: jest.fn().mockImplementation(async () => {
					// Sampled *before* issuing any query of our own: this is what deferPastOpenTransaction()
					// actually promises — that the flag already reads false at the moment it hands control
					// back to rebuild() — not merely that it reads false once some later query of ours
					// happens to resolve. Sampling after a query resolves would still usually read false
					// even for a caller that read the flag while it was still true and got lucky with
					// queue timing, which would make this assertion pass for the wrong reason.
					observedTransactionActive = sharedQueryRunner.isTransactionActive;

					await sharedQueryRunner.query('SELECT 1');
					resolveObserved();

					return NO_CHANGES;
				}),
			};

			const probeListener = new VirtualIndexMaintenanceListener(
				probeIndex as unknown as VirtualPropertyIndexService,
				{ recompute: jest.fn().mockResolvedValue(undefined) } as unknown as VirtualStatusListener,
				{ findOne: jest.fn(), update: jest.fn() } as unknown as DevicesService,
				dataSource,
			);

			await dataSource.transaction(async (manager) => {
				await manager.query('INSERT INTO probe (id) VALUES (?)', ['row-1']);

				// Mimics DevicesService.remove()/ChannelsPropertiesService.remove(): a synchronous
				// emit() of a structural event as the last statement inside the open transaction.
				probeListener.handleStructuralChange();
			});

			await observed;

			expect(probeIndex.rebuild).toHaveBeenCalledTimes(1);
			expect(observedTransactionActive).toBe(false);
		});
	});
});
