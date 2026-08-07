import 'reflect-metadata';
import { DataSource, Repository } from 'typeorm';

import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
	ConnectionState,
	DeviceHiddenBy,
	DeviceHiddenFilter,
	EventType,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceConnectionStateService } from '../../../modules/devices/services/device-connection-state.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { VirtualChannelPropertyEntity, VirtualValueOrigin } from '../entities/devices-virtual.entity';
import { VirtualDevicesService } from '../services/virtual-devices.service';
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
	let devicesService: { findAll: jest.Mock; findOne: jest.Mock; update: jest.Mock };
	// The devices table's own repository, which the listener uses for exactly one thing: clearing
	// `hiddenBy`, the one field of an unhide UpdateDeviceDto cannot express (its `@Transform` reads an
	// explicit null as "field not provided", so DevicesService.update() can never write one).
	let devicesRepository: { update: jest.Mock };
	let virtualDevicesService: { reportCompatibility: jest.Mock };
	let eventEmitterStub: { emit: jest.Mock };

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

	// Drives the listener's own waiting forward without spending wall-clock time, for the two describes
	// below that install fake timers: one real `setImmediate` turn per step (the wait's first phase, the
	// rebuild loop's own awaits, and any real sqlite I/O in flight) plus a slice of faked clock (its
	// second phase, and the repair delay). Nothing here is a race — every step is a discrete,
	// deterministic advance, and the loop stops the moment `predicate` holds, so a test only ever runs as
	// far as the behaviour it asserts on.
	const driveUntil = async (predicate: () => boolean, maxSteps = 600): Promise<void> => {
		for (let step = 0; step < maxSteps && !predicate(); step++) {
			await new Promise<void>((resolve) => setImmediate(resolve));
			await jest.advanceTimersByTimeAsync(50);
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
		devicesService = {
			// Nothing hidden at all — the ordinary installation, and the state every test that is not
			// about the bootstrap reconciliation should see.
			findAll: jest.fn().mockResolvedValue([]),
			findOne: jest.fn().mockResolvedValue(null),
			update: jest.fn().mockResolvedValue(undefined),
		};
		devicesRepository = { update: jest.fn().mockResolvedValue(undefined) };
		// Compatibility is asserted in the service's own spec; here it only has to answer.
		virtualDevicesService = { reportCompatibility: jest.fn().mockReturnValue({ compatible: true }) };
		eventEmitterStub = { emit: jest.fn() };
		listener = new VirtualIndexMaintenanceListener(
			index as unknown as VirtualPropertyIndexService,
			status as unknown as VirtualStatusListener,
			devicesService as unknown as DevicesService,
			virtualDevicesService as unknown as VirtualDevicesService,
			eventEmitterStub as unknown as EventEmitter2,
			dataSourceStub as unknown as DataSource,
			devicesRepository as unknown as Repository<DeviceEntity>,
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

	// -- bootstrap hydration, and the restart it has to repair ----------------------------------
	//
	// Regression tests for the bootstrap rebuild's result being discarded. The window is small but
	// durable: a source property's deletion commits, and the fire-and-forget pass that would have
	// degraded the virtual device to DISCONNECTED has not run yet when the process stops. The deletion
	// survives the restart; the status does not. On the next start the hydration below is the only
	// thing that can ever notice — an orphaned link names no source device, so the virtual device sits
	// in no `bySourceDevice` set and no DEVICE_CONNECTION_CHANGED event can select it again — which is
	// precisely why swallowing what that first pass reported left the device stale forever.

	it('hydrates the index at bootstrap', async () => {
		await listener.onApplicationBootstrap();

		expect(index.rebuild).toHaveBeenCalledTimes(1);
	});

	it('recomputes the connection state of every virtual device the bootstrap hydration re-wired', async () => {
		index.rebuild.mockResolvedValue({
			rewiredVirtualDeviceIds: ['virtual-a', 'virtual-b'],
			abandonedSourceDeviceIds: [],
		});

		await listener.onApplicationBootstrap();

		expect(status.recompute).toHaveBeenCalledTimes(2);
		expect(status.recompute).toHaveBeenCalledWith('virtual-a', expect.any(String));
		expect(status.recompute).toHaveBeenCalledWith('virtual-b', expect.any(String));
	});

	it('recomputes nothing when the bootstrap hydration found no virtual device wiring at all', async () => {
		await listener.onApplicationBootstrap();

		expect(status.recompute).not.toHaveBeenCalled();
	});

	// The bootstrap rebuild is the first query in the process to touch the schema, so it is also the
	// first to fail when there is no schema — a fresh install before migrations, and `generate:openapi`,
	// which boots the whole Nest app purely to read Swagger metadata against whatever database happens
	// to be there. An unguarded await here rejects out of `onApplicationBootstrap`, which aborts Nest's
	// bootstrap and kills the process; this repo has shipped that failure once already. Hydration is an
	// optimization — the next structural event rebuilds regardless — so it must degrade to an empty
	// index, never to a dead application.
	it('survives a bootstrap hydration failure, leaving the index empty rather than aborting startup', async () => {
		const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

		index.rebuild.mockRejectedValue(new Error('SQLITE_ERROR: no such table: devices_module_channels_properties'));

		await expect(listener.onApplicationBootstrap()).resolves.toBeUndefined();

		expect(status.recompute).not.toHaveBeenCalled();
		expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('no such table'), undefined, expect.anything());

		loggerErrorSpy.mockRestore();
	});

	// The same guarantee one step further in: a recompute that throws is a repair that did not happen,
	// which is a cost paid in staleness. Letting it reject out of the hook would cost the whole
	// application instead.
	it('still starts when a bootstrap recompute throws', async () => {
		const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

		index.rebuild.mockResolvedValue({
			rewiredVirtualDeviceIds: ['virtual-a', 'virtual-b'],
			abandonedSourceDeviceIds: [],
		});
		status.recompute.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);

		await expect(listener.onApplicationBootstrap()).resolves.toBeUndefined();

		expect(status.recompute).toHaveBeenCalledTimes(2);

		loggerWarnSpy.mockRestore();
	});

	// The deliberate asymmetry with a structural pass, pinned. rebuild() derives
	// `abandonedSourceDeviceIds` from source devices in the *outgoing* index that are absent from the
	// incoming one, and the outgoing index is empty at bootstrap — so the real value is structurally
	// always `[]` and there is no bootstrap equivalent of "the last virtual device referencing this
	// source went away". Forced non-empty here only to prove the hook does not act on it: unhiding at
	// startup would silently reverse a `hidden` flag the operator set, on nothing more than an empty
	// map on the other side of a restart.
	it('unhides nothing at bootstrap, whatever the hydration reports abandoned', async () => {
		index.rebuild.mockResolvedValue({ rewiredVirtualDeviceIds: [], abandonedSourceDeviceIds: ['source-a'] });

		await listener.onApplicationBootstrap();

		expect(devicesService.findOne).not.toHaveBeenCalled();
		expect(devicesService.update).not.toHaveBeenCalled();
	});

	// -- reconciling the sources the system hid, at bootstrap -----------------------------------
	//
	// The other half of the restart problem the hydration above repairs, and the half that is not
	// self-healing. An abandonment is an *edge* — a source device present in one index version and
	// absent from the next — drained by a fire-and-forget pass. If the deletion of the last virtual
	// reference commits and the process stops before that pass runs, the edge is gone for good: the
	// next start hydrates from an empty index, so `abandonedSourceDeviceIds` is structurally `[]` (see
	// the test above), and every later rebuild compares one already-reference-free index against
	// another and reports no transition. The source stays hidden forever, excluded from the pickers,
	// with no route back through the UI.
	//
	// Only a sweep at startup can recover a lost edge — and the naive sweep ("unhide every hidden
	// device nothing references") is worse than the bug it fixes, because `hidden` is also a plain
	// operator choice and unhiding those on every boot destroys a deliberate setting. `hiddenBy` is
	// what makes the sweep safe, which is why the user-hidden case below is the test that matters
	// most: it is the entire justification for the column existing.

	const systemHiddenSource = (overrides: Partial<DeviceEntity> = {}): Partial<DeviceEntity> => ({
		id: 'src',
		type: 'simulator',
		hidden: true,
		hiddenBy: DeviceHiddenBy.SYSTEM,
		enabled: true,
		...overrides,
	});

	it('unhides a system-hidden source that nothing references any more', async () => {
		devicesService.findAll.mockResolvedValue([systemHiddenSource()]);

		await listener.onApplicationBootstrap();

		expect(devicesService.update).toHaveBeenCalledWith('src', expect.objectContaining({ hidden: false }));
	});

	// The one that matters most. A device an operator deliberately hid, which a virtual device also
	// happens to have referenced at some point, must survive every boot untouched — silently reversing
	// that setting on startup is a worse failure than the stranded source the sweep exists to recover.
	it('never unhides a user-hidden source', async () => {
		devicesService.findAll.mockResolvedValue([systemHiddenSource({ hiddenBy: DeviceHiddenBy.USER })]);

		await listener.onApplicationBootstrap();

		expect(devicesService.update).not.toHaveBeenCalled();
	});

	// Rows hidden before the provenance column existed migrate to `user` (see
	// 1000000000009-AddDeviceHiddenBy), but a row can still read `null` here — a `hidden` written by a
	// caller that never named a reason. Unknown provenance is not system provenance, and the
	// conservative reading is the only safe one: leaving a source hidden is recoverable through the
	// UI, un-hiding one the operator chose to hide is not.
	it('never unhides a source whose hide names no provenance at all', async () => {
		devicesService.findAll.mockResolvedValue([systemHiddenSource({ hiddenBy: null })]);

		await listener.onApplicationBootstrap();

		expect(devicesService.update).not.toHaveBeenCalled();
	});

	// System provenance alone is not enough: the source is only stranded if the virtual device that
	// replaced it is genuinely gone. One that is still referenced is still replaced, and must stay
	// hidden.
	it('leaves a system-hidden source alone while a virtual device still references it', async () => {
		index.findVirtualDeviceIdsBySourceDevice.mockReturnValue(['virtual-a']);
		devicesService.findAll.mockResolvedValue([systemHiddenSource()]);

		await listener.onApplicationBootstrap();

		expect(devicesService.update).not.toHaveBeenCalled();
	});

	// Hidden devices are a handful; every device in the system is not. Filtering in SQL keeps the
	// sweep proportionate to what it can possibly act on, on a hook that runs before the app serves
	// its first request.
	it('reads only the hidden devices, rather than sweeping the whole device table', async () => {
		await listener.onApplicationBootstrap();

		expect(devicesService.findAll).toHaveBeenCalledWith(undefined, DeviceHiddenFilter.TRUE);
	});

	// Same defect, same defence as the abandonment path below: DevicesService.update() transforms the
	// DTO into the mapped entity class, and DeviceEntity.enabled carries a `= true` class field
	// initializer class-transformer cannot drop, so any patch omitting `enabled` writes `true`. A
	// reconciliation that silently re-enabled every disabled device it unhid would be a second bug
	// shipped inside the fix for the first.
	it('keeps a disabled source disabled when it unhides it', async () => {
		devicesService.findAll.mockResolvedValue([systemHiddenSource({ enabled: false })]);

		await listener.onApplicationBootstrap();

		expect(devicesService.update).toHaveBeenCalledWith(
			'src',
			expect.objectContaining({ hidden: false, enabled: false }),
		);
	});

	// A visible device claiming it was hidden by the system is a row in a state nothing produced on
	// purpose, and the next thing to read that column has no way to tell it from a live claim. The
	// clear cannot go through the patch above: `UpdateDeviceDto.hidden_by` maps an explicit `null` to
	// `undefined` (the null-means-absent convention every optional field on that DTO follows), and
	// DevicesService.update() drops undefined keys — so no DTO value means "clear this", and the write
	// has to go through the entity's own repository.
	it('clears the provenance of a source it unhides', async () => {
		devicesService.findAll.mockResolvedValue([systemHiddenSource()]);

		await listener.onApplicationBootstrap();

		expect(devicesRepository.update).toHaveBeenCalledWith('src', { hiddenBy: null });
	});

	// Ordering, not just presence: the pair is not atomic, and only one of the two half-states a
	// failure can leave is recoverable. `hidden = false` with a stale `hiddenBy` is cosmetic on a
	// device the user can now see; `hidden = true` with `hiddenBy = null` is a hidden device this very
	// reconciliation is then required to skip forever.
	it('clears the provenance only after the device is actually visible', async () => {
		const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

		devicesService.findAll.mockResolvedValue([systemHiddenSource()]);
		devicesService.update.mockRejectedValue(new Error('boom'));

		await listener.onApplicationBootstrap();

		expect(devicesRepository.update).not.toHaveBeenCalled();

		loggerWarnSpy.mockRestore();
	});

	// DevicesService.update() refuses a `room_id`/`zone_ids` change on a device that is *currently*
	// hidden — which this one is, right up until this very patch. The guard is on the fields the patch
	// carries, so the unhide passes only for as long as it carries neither.
	it('sends no placement field with the unhide, so the placement guard cannot refuse it', async () => {
		devicesService.findAll.mockResolvedValue([systemHiddenSource()]);

		await listener.onApplicationBootstrap();

		const [, patch] = devicesService.update.mock.calls[0] as [string, Record<string, unknown>];

		expect(patch).not.toHaveProperty('room_id');
		expect(patch).not.toHaveProperty('zone_ids');
	});

	// The sweep's whole question is "does anything still reference this source", and the index is what
	// answers it. A failed hydration leaves that index empty, which answers "nothing references
	// anything" for every source in the system — so reconciling on it would unhide every
	// system-hidden device at once, on no evidence at all.
	it('reconciles nothing when the bootstrap hydration failed', async () => {
		const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

		index.rebuild.mockRejectedValue(new Error('SQLITE_ERROR: no such table: devices_module_channels_properties'));
		devicesService.findAll.mockResolvedValue([systemHiddenSource()]);

		await expect(listener.onApplicationBootstrap()).resolves.toBeUndefined();

		expect(devicesService.findAll).not.toHaveBeenCalled();
		expect(devicesService.update).not.toHaveBeenCalled();

		loggerErrorSpy.mockRestore();
	});

	// The same startup guarantee the hydration itself has to give. `generate:openapi` boots the whole
	// Nest app against whatever database happens to be there purely to read Swagger metadata, and a
	// fresh install has no schema until its migrations run — so this query can and does fail, and an
	// `onApplicationBootstrap` that rejects aborts Nest's bootstrap and kills the process. A
	// reconciliation that never runs costs a source device staying hidden one more restart; one that
	// throws costs the entire application.
	it('still starts when the reconciliation query fails', async () => {
		const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

		devicesService.findAll.mockRejectedValue(new Error('SQLITE_ERROR: no such table: devices_module_devices'));

		await expect(listener.onApplicationBootstrap()).resolves.toBeUndefined();

		// Reported as its own failure rather than swallowed by the hydration's catch: the index
		// hydrated perfectly well here, and an error blaming it sends an operator to the wrong place.
		expect(loggerErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining('reconcile system-hidden source devices'),
			undefined,
			expect.anything(),
		);
		expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('no such table'), undefined, expect.anything());

		loggerErrorSpy.mockRestore();
	});

	// One source that cannot be patched must not cost the others their recovery — the same per-device
	// containment the abandonment path uses.
	it('keeps reconciling the remaining sources after one patch throws', async () => {
		const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

		devicesService.findAll.mockResolvedValue([
			systemHiddenSource({ id: 'src-a' }),
			systemHiddenSource({ id: 'src-b' }),
		]);
		devicesService.update.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);

		await expect(listener.onApplicationBootstrap()).resolves.toBeUndefined();

		expect(devicesService.update).toHaveBeenCalledTimes(2);
		expect(devicesService.update).toHaveBeenCalledWith('src-b', expect.objectContaining({ hidden: false }));

		loggerWarnSpy.mockRestore();
	});

	// The restart shape end-to-end within this plugin: a durably orphaned row is what the database
	// actually holds at hydration, and the real index and the real status listener decide the rest.
	// Everything between rebuild() and the connection-state write is genuine here, because the stale
	// status this fixes is produced by their interaction — an index that files an orphan under its
	// virtual device but under no source device, and an aggregation that degrades on exactly that.
	describe('against the real index and status listener', () => {
		let repository: { find: jest.Mock };
		let realIndex: VirtualPropertyIndexService;
		let connectivity: { setConnectionState: jest.Mock };
		let connectionState: { readLatest: jest.Mock };
		let bootstrapping: VirtualIndexMaintenanceListener;

		// A property row exactly as TypeORM returns it once rebuild()'s relations are loaded. `channel`
		// walks to the owning virtual device; `sourceProperty` is what the FK's ON DELETE SET NULL left
		// behind, or a live source, depending on the test.
		const propertyRow = (overrides: Partial<VirtualChannelPropertyEntity>): VirtualChannelPropertyEntity => {
			const device = new DeviceEntity();

			Object.assign(device, { id: 'virtual-device' });

			const channel = new ChannelEntity();

			Object.assign(channel, { id: 'virtual-channel', device });

			const property = new VirtualChannelPropertyEntity();

			Object.assign(
				property,
				{
					id: 'projecting-prop',
					valueOrigin: VirtualValueOrigin.SOURCE,
					sourcePropertyId: null,
					sourceProperty: null,
					channel,
				},
				overrides,
			);

			return property;
		};

		const liveSourceProperty = (): ChannelPropertyEntity => {
			const device = new DeviceEntity();

			Object.assign(device, { id: 'source-device' });

			const channel = new ChannelEntity();

			Object.assign(channel, { id: 'source-channel', device });

			const property = new ChannelPropertyEntity();

			Object.assign(property, { id: 'source-prop', channel });

			return property;
		};

		beforeEach(() => {
			repository = { find: jest.fn().mockResolvedValue([]) };
			realIndex = new VirtualPropertyIndexService(repository as unknown as Repository<VirtualChannelPropertyEntity>);
			connectivity = { setConnectionState: jest.fn().mockResolvedValue(undefined) };
			// Reports every source device as online, so nothing in these tests can produce DISCONNECTED
			// except the orphan branch itself.
			connectionState = {
				readLatest: jest
					.fn()
					.mockResolvedValue({ online: true, status: ConnectionState.CONNECTED, lastChanged: new Date() }),
			};
			bootstrapping = new VirtualIndexMaintenanceListener(
				realIndex,
				new VirtualStatusListener(
					realIndex,
					connectivity as unknown as DeviceConnectivityService,
					connectionState as unknown as DeviceConnectionStateService,
				),
				devicesService as unknown as DevicesService,
				virtualDevicesService as unknown as VirtualDevicesService,
				eventEmitterStub as unknown as EventEmitter2,
				dataSourceStub as unknown as DataSource,
				devicesRepository as unknown as Repository<DeviceEntity>,
			);
		});

		it('degrades a virtual device whose source property was deleted while the process was down', async () => {
			repository.find.mockResolvedValue([propertyRow({ sourcePropertyId: null, sourceProperty: null })]);

			await bootstrapping.onApplicationBootstrap();

			// Nothing else in the process can reach this device: the orphan put it in no source device's
			// reverse index, so without this write it keeps whatever status it was left with — CONNECTED,
			// with nothing behind it — for the entire life of the process.
			expect(realIndex.findVirtualDeviceIdsBySourceDevice('source-device')).toEqual([]);
			expect(connectivity.setConnectionState).toHaveBeenCalledWith(
				'virtual-device',
				expect.objectContaining({ state: ConnectionState.DISCONNECTED }),
			);
		});

		// The other half of the same pass: hydration must not blanket-degrade everything it indexes. A
		// device still linked to a source that reports online comes out CONNECTED.
		it('reports a virtual device whose source survived as connected', async () => {
			const sourceProperty = liveSourceProperty();

			repository.find.mockResolvedValue([
				propertyRow({ sourcePropertyId: sourceProperty.id, sourceProperty: sourceProperty }),
			]);

			await bootstrapping.onApplicationBootstrap();

			expect(connectivity.setConnectionState).toHaveBeenCalledWith(
				'virtual-device',
				expect.objectContaining({ state: ConnectionState.CONNECTED }),
			);
		});

		// An owned (LOCAL) property is nobody's projection, so it never enters the index and the
		// hydration has no transition to report for its device — the vacuous case must stay silent
		// rather than write a state nothing asked for.
		it('writes nothing for a virtual device assembled only from owned properties', async () => {
			repository.find.mockResolvedValue([
				propertyRow({ valueOrigin: VirtualValueOrigin.LOCAL, sourcePropertyId: null, sourceProperty: null }),
			]);

			await bootstrapping.onApplicationBootstrap();

			expect(connectivity.setConnectionState).not.toHaveBeenCalled();
		});

		// The "still referenced" case with the index genuinely answering the question rather than a
		// stub agreeing to: a real property row linking `virtual-device` to `source-device` goes
		// through a real rebuild(), and the reconciliation reads the reference back out of the map that
		// rebuild produced.
		it('leaves a system-hidden source alone while a virtual property still references it', async () => {
			const sourceProperty = liveSourceProperty();

			repository.find.mockResolvedValue([
				propertyRow({ sourcePropertyId: sourceProperty.id, sourceProperty: sourceProperty }),
			]);
			devicesService.findAll.mockResolvedValue([systemHiddenSource({ id: 'source-device' })]);

			await bootstrapping.onApplicationBootstrap();

			expect(realIndex.findVirtualDeviceIdsBySourceDevice('source-device')).toEqual(['virtual-device']);
			expect(devicesService.update).not.toHaveBeenCalled();
		});

		// The mirror image, and the state a restart that lost the abandonment edge actually leaves
		// behind: the same hidden source, with no projecting property referencing it left in the
		// database at all.
		it('unhides a system-hidden source once no virtual property in the database references it', async () => {
			repository.find.mockResolvedValue([]);
			devicesService.findAll.mockResolvedValue([systemHiddenSource({ id: 'source-device' })]);

			await bootstrapping.onApplicationBootstrap();

			expect(devicesService.update).toHaveBeenCalledWith('source-device', expect.objectContaining({ hidden: false }));
		});
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

	// The source device as findOne() returns it: hidden, and hidden *by the system*. The provenance is
	// part of the fixture rather than an extra on the cases that assert on it, because this path checks
	// it before patching anything — the same rule the bootstrap sweep applies, for the same reason (see
	// the user-hidden case below).
	const abandonedSystemHiddenSource = (overrides: Partial<DeviceEntity> = {}): Partial<DeviceEntity> => ({
		id: 'source-device',
		type: 'simulator',
		hidden: true,
		hiddenBy: DeviceHiddenBy.SYSTEM,
		enabled: true,
		...overrides,
	});

	it('unhides a source device the rebuild reports as abandoned', async () => {
		index.rebuild.mockResolvedValue(rebuiltWithAbandoned('source-device'));
		devicesService.findOne.mockResolvedValue(abandonedSystemHiddenSource());

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
		devicesService.findOne.mockResolvedValue(abandonedSystemHiddenSource({ enabled: false }));

		listener.handleStructuralChange();
		await flushMicrotasks();

		expect(devicesService.update).toHaveBeenCalledWith(
			'source-device',
			expect.objectContaining({ hidden: false, enabled: false }),
		);
	});

	// The same clean-up the bootstrap reconciliation does, because it is the same unhide: a device that
	// is no longer hidden must not keep claiming who hid it. Both paths share one helper precisely so
	// they cannot drift on what unhiding a device consists of.
	it('clears the provenance of an abandoned source device it unhides', async () => {
		index.rebuild.mockResolvedValue(rebuiltWithAbandoned('source-device'));
		devicesService.findOne.mockResolvedValue(abandonedSystemHiddenSource());

		listener.handleStructuralChange();
		await flushMicrotasks();

		expect(devicesRepository.update).toHaveBeenCalledWith('source-device', { hiddenBy: null });
	});

	it('leaves an enabled source device enabled when it unhides it', async () => {
		index.rebuild.mockResolvedValue(rebuiltWithAbandoned('source-device'));
		devicesService.findOne.mockResolvedValue(abandonedSystemHiddenSource({ enabled: true }));

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
		devicesService.findOne.mockResolvedValue(abandonedSystemHiddenSource());

		listener.handleStructuralChange();
		await flushMicrotasks();

		expect(devicesService.findOne).not.toHaveBeenCalled();
		expect(devicesService.update).not.toHaveBeenCalled();
	});

	it('does not patch a source device that was never hidden', async () => {
		index.rebuild.mockResolvedValue(rebuiltWithAbandoned('source-device'));
		devicesService.findOne.mockResolvedValue(abandonedSystemHiddenSource({ hidden: false }));

		listener.handleStructuralChange();
		await flushMicrotasks();

		expect(devicesService.update).not.toHaveBeenCalled();
	});

	// The runtime mirror of the bootstrap sweep's user-hidden case, and the more exposed of the two:
	// this path runs on every structural change that drops the last reference, not once per process
	// start. Observing the abandonment says a virtual device was drawing from this source; it does not
	// say the system is what hid it. An operator who hid a physical device by hand must not lose that
	// setting because some unrelated virtual device referencing it was deleted — silently, with nothing
	// that would ever put it back.
	it('leaves a user-hidden source device hidden when its last virtual device is deleted', async () => {
		index.rebuild.mockResolvedValue(rebuiltWithAbandoned('source-device'));
		devicesService.findOne.mockResolvedValue(abandonedSystemHiddenSource({ hiddenBy: DeviceHiddenBy.USER }));

		listener.handleStructuralChange();
		await flushMicrotasks();

		expect(devicesService.update).not.toHaveBeenCalled();
		expect(devicesRepository.update).not.toHaveBeenCalled();
	});

	// Unknown provenance is not system provenance here either — including every row hidden before the
	// column existed, which the migration backfilled to `user` precisely because it cannot tell those
	// apart from a deliberate hide.
	it('leaves a source device whose hide names no provenance hidden', async () => {
		index.rebuild.mockResolvedValue(rebuiltWithAbandoned('source-device'));
		devicesService.findOne.mockResolvedValue(abandonedSystemHiddenSource({ hiddenBy: null }));

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
		devicesService.findOne.mockResolvedValue(abandonedSystemHiddenSource());

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
		devicesService.findOne.mockResolvedValue(abandonedSystemHiddenSource());

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
			.mockResolvedValue(abandonedSystemHiddenSource({ id: 'source-b' }));

		listener.handleStructuralChange();
		await flushMicrotasks();

		expect(devicesService.update).toHaveBeenCalledTimes(1);

		loggerWarnSpy.mockRestore();
	});

	// -- Task 12b: the rebuild must not read while the emitting transaction is still open -------

	// Advances one event-loop turn per iteration, without touching the clock. Used to hold a
	// transaction open for a *counted number of turns* rather than a number of milliseconds: the
	// listener's first waiting phase polls once per `setImmediate`, so turns are the unit it actually
	// measures in, and a turn-counted hold cannot invert under machine load the way a wall-clock one
	// can. This is what makes the two real-sqlite cases below deterministic instead of timing-
	// dependent — the property they pin ("the read never lands inside the open transaction") is
	// decided by ordering, not by how fast the machine is.
	const burnEventLoopTurns = async (turns: number): Promise<void> => {
		for (let turn = 0; turn < turns; turn++) {
			await new Promise<void>((resolve) => setImmediate(resolve));
		}
	};

	// Four times the listener's own immediate-poll budget. Any implementation that gives up after a
	// fixed number of turns and reads anyway is therefore guaranteed — not merely likely — to read
	// while the transaction below is still open, and to see its uncommitted rows through the shared
	// single connection.
	const TURNS_TO_HOLD_A_TRANSACTION_OPEN = 200;

	// Real DataSource + dataSource.transaction() — the same call this app's DevicesService.remove()
	// and ChannelsPropertiesService.remove() make — so this exercises the actual TypeORM + sqlite3
	// mechanics the class docstring's correctness argument rests on: SqliteDriver.createQueryRunner()
	// handing out one shared, single-connection QueryRunner to every non-transactional-manager query
	// in the app, that connection only clearing `isTransactionActive` once COMMIT/ROLLBACK has
	// actually completed, and a read issued on it mid-transaction seeing that transaction's own
	// uncommitted writes. A mocked-only test cannot prove any of this — there is no real transaction,
	// and no real (threadpool-backed, not same-tick) COMMIT, to be inside of.
	//
	// The assertions are on rows read, not on a sampled `isTransactionActive`. A row that a rolled-back
	// transaction wrote is visible on this connection for exactly as long as that transaction is open
	// and never again afterwards, so "did the rebuild see it" answers "did the rebuild read inside the
	// transaction" with no clock involved at all — which the previous version of this test, which
	// raced the commit and sampled the flag, could not.
	describe('reads only committed state (real sqlite)', () => {
		let dataSource: DataSource;

		beforeAll(async () => {
			dataSource = new DataSource({ type: 'sqlite', database: ':memory:', entities: [], synchronize: false });
			await dataSource.initialize();
			await dataSource.query('CREATE TABLE probe (id TEXT PRIMARY KEY)');
		});

		afterAll(async () => {
			await dataSource.destroy();
		});

		beforeEach(async () => {
			await dataSource.query('DELETE FROM probe');
		});

		// A listener whose rebuild() does what VirtualPropertyIndexService.rebuild() does — read the
		// table through the shared query runner — and records what it saw.
		const createProbe = (): {
			listener: VirtualIndexMaintenanceListener;
			rebuild: jest.Mock;
			rowsRead: () => { id: string }[];
			observed: Promise<void>;
		} => {
			// The exact query runner obtainQueryRunner() falls back to for any unscoped query —
			// including VirtualPropertyIndexService.rebuild()'s repository.find() — because sqlite is
			// not pooled (see AbstractSqliteDriver): this one instance is shared by every
			// non-transactional caller in the app, ours included.
			const sharedQueryRunner = dataSource.createQueryRunner();

			let rows: { id: string }[] = [];
			let resolveObserved!: () => void;
			const observed = new Promise<void>((resolve) => {
				resolveObserved = resolve;
			});

			const rebuild = jest.fn().mockImplementation(async () => {
				rows = (await sharedQueryRunner.query('SELECT id FROM probe')) as { id: string }[];

				resolveObserved();

				return NO_CHANGES;
			});

			const listener = new VirtualIndexMaintenanceListener(
				{ rebuild } as unknown as VirtualPropertyIndexService,
				{ recompute: jest.fn().mockResolvedValue(undefined) } as unknown as VirtualStatusListener,
				{ findOne: jest.fn(), update: jest.fn() } as unknown as DevicesService,
				{ reportCompatibility: jest.fn().mockReturnValue({ compatible: true }) } as unknown as VirtualDevicesService,
				eventEmitterStub as unknown as EventEmitter2,
				dataSource,
				{ update: jest.fn() } as unknown as Repository<DeviceEntity>,
			);

			return { listener, rebuild, rowsRead: () => rows, observed };
		};

		it('never sees rows the emitting transaction went on to roll back', async () => {
			const probe = createProbe();

			let releaseTransaction!: () => void;
			const heldOpen = new Promise<void>((resolve) => {
				releaseTransaction = resolve;
			});

			const transaction = dataSource
				.transaction(async (manager) => {
					await manager.query('INSERT INTO probe (id) VALUES (?)', ['never-committed']);

					// Mimics DevicesService.remove()/ChannelsPropertiesService.remove(): a synchronous
					// emit() of a structural event from inside the still-open transaction.
					probe.listener.handleStructuralChange();

					// Stands in for the reviewer's "subsequent property removals await storage cleanup" —
					// the transaction keeps doing awaited work after emitting, and stays open for it.
					await heldOpen;

					throw new Error('rolled back');
				})
				.catch((error: Error) => error.message);

			await burnEventLoopTurns(TURNS_TO_HOLD_A_TRANSACTION_OPEN);

			releaseTransaction();

			await expect(transaction).resolves.toBe('rolled back');
			await probe.observed;

			expect(probe.rebuild).toHaveBeenCalledTimes(1);
			// The row existed on this connection throughout the hold above and never afterwards. Seeing
			// it would mean the index had been rebuilt from state that never durably happened, with no
			// event left to correct it — a rollback emits none.
			expect(probe.rowsRead()).toEqual([]);
		});

		// The control for the case above: without it, an implementation that simply never rebuilt, or
		// whose read was broken, would satisfy "saw no uncommitted rows" vacuously. Same shape, same
		// hold, opposite outcome — so between the two, only a rebuild that reads *after* the emitting
		// transaction settles passes both.
		it('does see rows the emitting transaction went on to commit', async () => {
			const probe = createProbe();

			let releaseTransaction!: () => void;
			const heldOpen = new Promise<void>((resolve) => {
				releaseTransaction = resolve;
			});

			const transaction = dataSource.transaction(async (manager) => {
				await manager.query('INSERT INTO probe (id) VALUES (?)', ['committed']);

				probe.listener.handleStructuralChange();

				await heldOpen;
			});

			await burnEventLoopTurns(TURNS_TO_HOLD_A_TRANSACTION_OPEN);

			releaseTransaction();

			await transaction;
			await probe.observed;

			expect(probe.rebuild).toHaveBeenCalledTimes(1);
			expect(probe.rowsRead()).toEqual([{ id: 'committed' }]);
		});
	});

	// -- Round 4: what the bounded wait does when it expires ------------------------------------

	// The real-sqlite pair above pins the ordinary case, where the transaction does settle. These pin
	// the two cases it cannot reach: a connection that reports a transaction open for longer than the
	// wait is willing to hold out, and one that reports it forever. Both are driven off a stub flag
	// the test sets directly, so neither depends on a real transaction ever behaving that way — and
	// with the clock faked, neither spends the wait's real duration either.
	describe('when the shared connection keeps reporting an open transaction', () => {
		// Stands in for the shared, single-connection QueryRunner deferPastOpenTransaction() polls,
		// with `isTransactionActive` under the test's control and every read of it counted — the count
		// is how a test waits for "the implementation has polled a good many times" without encoding
		// how many times the implementation polls.
		const createSharedConnectionStub = (): {
			queryRunner: { isTransactionActive: boolean; readonly polls: number };
			dataSource: DataSource;
		} => {
			const state = { active: true, polls: 0 };

			const queryRunner = {
				get isTransactionActive(): boolean {
					state.polls++;

					return state.active;
				},
				set isTransactionActive(value: boolean) {
					state.active = value;
				},
				get polls(): number {
					return state.polls;
				},
			};

			return { queryRunner, dataSource: { createQueryRunner: () => queryRunner } as unknown as DataSource };
		};

		// The messages a logger spy was called with, ignoring the context/tag arguments
		// createExtensionLogger() appends — asserting on those would pin the logger's call shape rather
		// than what this listener reported.
		const loggedMessages = (spy: jest.SpyInstance): string[] =>
			(spy.mock.calls as unknown[][]).map((call) => (typeof call[0] === 'string' ? call[0] : ''));

		let queryRunner: { isTransactionActive: boolean; readonly polls: number };
		let probeListener: VirtualIndexMaintenanceListener;
		// What `isTransactionActive` read at the moment each rebuild() was entered — sampled before any
		// query of the rebuild's own, which is what deferPastOpenTransaction() actually promises about.
		let flagAtRebuild: boolean[];
		let loggerWarnSpy: jest.SpyInstance;
		let loggerErrorSpy: jest.SpyInstance;

		beforeEach(() => {
			// `setImmediate` stays real so the wait's first phase runs at its natural pace; only the
			// timers its second phase and the repair delay use are faked, which is what collapses a
			// multi-second wait into an instant, repeatable test.
			jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });

			loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
			loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

			const stub = createSharedConnectionStub();

			queryRunner = stub.queryRunner;
			flagAtRebuild = [];

			index.rebuild.mockImplementation(() => {
				flagAtRebuild.push(queryRunner.isTransactionActive);

				return Promise.resolve(NO_CHANGES);
			});

			probeListener = new VirtualIndexMaintenanceListener(
				index as unknown as VirtualPropertyIndexService,
				status as unknown as VirtualStatusListener,
				devicesService as unknown as DevicesService,
				virtualDevicesService as unknown as VirtualDevicesService,
				eventEmitterStub as unknown as EventEmitter2,
				stub.dataSource,
				devicesRepository as unknown as Repository<DeviceEntity>,
			);
		});

		afterEach(() => {
			jest.useRealTimers();

			loggerWarnSpy.mockRestore();
			loggerErrorSpy.mockRestore();
		});

		it('holds the rebuild back until the connection reports the transaction settled', async () => {
			probeListener.handleStructuralChange();

			// Well past the point where a single hop, or a handful, would have given up. Clearing the
			// flag only now means any rebuild recorded before this line recorded `true`.
			await driveUntil(() => queryRunner.polls > 25);

			expect(flagAtRebuild).toEqual([]);

			queryRunner.isTransactionActive = false;

			await driveUntil(() => flagAtRebuild.length > 0);

			expect(flagAtRebuild).toEqual([false]);
		});

		// The finding this round: the old bound simply logged and rebuilt, so a transaction that
		// outlasted it got its uncommitted state indexed — and if it then rolled back, nothing ever
		// said so, because a rollback emits no event. Rebuilding anyway is still the right call (the
		// flag can be stuck set with no transaction behind it at all — see the class docstring), but
		// only because the expired pass now queues its own correction.
		it('rebuilds anyway once the wait expires, then repairs the index when the transaction settles', async () => {
			probeListener.handleStructuralChange();

			await driveUntil(() => flagAtRebuild.length > 0);

			// Read through a connection still reporting an open transaction: whatever it indexed may be
			// uncommitted.
			expect(flagAtRebuild).toEqual([true]);
			expect(loggedMessages(loggerWarnSpy)).toContainEqual(expect.stringContaining('Gave up waiting'));

			queryRunner.isTransactionActive = false;

			// No further structural event is emitted here on purpose. The second rebuild has to come
			// from the repair the expired pass scheduled for itself — which is the whole point, since a
			// rollback produces no event to ride in on.
			await driveUntil(() => flagAtRebuild.length > 1);

			expect(flagAtRebuild).toEqual([true, false]);
		});

		// The flag can be left set permanently by a failed BEGIN (class docstring), and repairing
		// forever would then poll and log forever having long since read the only state there is.
		it('stops repairing once the repair budget is exhausted', async () => {
			probeListener.handleStructuralChange();

			await driveUntil(() => loggerErrorSpy.mock.calls.length > 0);

			// One pass that expired, plus MAX_REPAIR_PASSES repairs that expired the same way.
			expect(flagAtRebuild).toEqual([true, true, true, true]);
			expect(loggedMessages(loggerErrorSpy)).toContainEqual(expect.stringContaining('repair pass'));

			// And then it stays put rather than rebuilding on a timer for the life of the process.
			await driveUntil(() => flagAtRebuild.length > 4, 200);

			expect(flagAtRebuild).toHaveLength(4);
		});

		// A transaction on this shared connection can be abandoned outright — begun, then neither
		// committed nor rolled back — which leaves the flag set indefinitely rather than for the few
		// hundred milliseconds a real deletion takes. Observed directly against the e2e suite: seven
		// consecutive passes each spent the entire budget, and index maintenance fell far enough behind
		// that assertions waiting on it timed out. Paying the budget once is the cost of caution;
		// paying it on every pass is a starved index.
		it('stops spending the full wait budget once the connection has proven it is not settling', async () => {
			probeListener.handleStructuralChange();

			await driveUntil(() => flagAtRebuild.length > 0);

			const pollsForFirstPass = queryRunner.polls;
			const pollsBeforeSecondPass = queryRunner.polls;

			// A second structural event, with the transaction still reported open.
			probeListener.handleStructuralChange();

			await driveUntil(() => flagAtRebuild.length > 1);

			expect(queryRunner.polls - pollsBeforeSecondPass).toBeLessThan(pollsForFirstPass / 2);

			// Reported once, not once per pass — the connection has not got any newer.
			expect(loggedMessages(loggerWarnSpy).filter((message) => message.includes('Gave up waiting'))).toHaveLength(1);

			// And the caution comes back the moment the connection does: a pass that settles releases
			// the latch, so the next transaction to run long is waited out in full again.
			queryRunner.isTransactionActive = false;
			probeListener.handleStructuralChange();

			await driveUntil(() => flagAtRebuild.at(-1) === false);

			queryRunner.isTransactionActive = true;
			const pollsBeforeThirdPass = queryRunner.polls;
			const rebuildsBeforeThirdPass = flagAtRebuild.length;

			probeListener.handleStructuralChange();

			await driveUntil(() => flagAtRebuild.length > rebuildsBeforeThirdPass);

			expect(queryRunner.polls - pollsBeforeThirdPass).toBeGreaterThan(pollsForFirstPass / 2);
		});

		// The budget is per unbroken run of expired passes, not per process: a connection that
		// misbehaves once must not leave a later, genuinely slow transaction without a repair.
		it('restores the repair budget once a pass does observe the transaction settled', async () => {
			probeListener.handleStructuralChange();

			await driveUntil(() => loggerErrorSpy.mock.calls.length > 0);

			expect(flagAtRebuild).toHaveLength(4);

			queryRunner.isTransactionActive = false;
			probeListener.handleStructuralChange();

			await driveUntil(() => flagAtRebuild.length > 4);

			expect(flagAtRebuild).toEqual([true, true, true, true, false]);

			// Budget restored: this pass expires again and gets its own full run of repairs.
			queryRunner.isTransactionActive = true;
			loggerErrorSpy.mockClear();
			probeListener.handleStructuralChange();

			await driveUntil(() => loggerErrorSpy.mock.calls.length > 0);

			expect(flagAtRebuild).toHaveLength(9);
		});
	});

	// -- Round 7: the one write no repair pass can take back ------------------------------------
	//
	// The finding: unhideAbandonedSources() ran before runRebuildLoop()'s `settled` check, so a pass
	// whose wait expired patched `hidden` off rows it had read through a still-open transaction. When
	// that transaction rolled back, the repair pass restored the *index* — three maps in memory — and
	// nothing restored the flag: a rollback emits no event, and an abandonment is an edge with no
	// opposite, so no later pass has anything to react to. The physical source stayed visible next to
	// the virtual device that was still replacing it.
	//
	// Everything below runs against real sqlite and asserts on the `hidden` column, not on which
	// methods were called with what. An earlier round's timing test on this same listener passed
	// vacuously against call counts, and the question here is specifically what durably happened to a
	// row — call counts appear only as conditions to drive the loop far enough to ask.
	describe('unhiding a source abandoned by an uncommitted deletion (real sqlite)', () => {
		let dataSource: DataSource;
		let subject: VirtualIndexMaintenanceListener;
		let indexStub: ReturnType<typeof createIndexStub>;
		let devicesStub: { findOne: jest.Mock; update: jest.Mock };
		// What `isTransactionActive` read at the moment each rebuild was entered, sampled before that
		// rebuild's own query. Used as a precondition — "this pass really did read inside the open
		// transaction" — never as the assertion.
		let flagAtRebuild: boolean[];
		let releaseTheUnhide: () => void;
		let loggerWarnSpy: jest.SpyInstance;
		let loggerErrorSpy: jest.SpyInstance;

		// Stands in for VirtualPropertyIndexService with the two behaviours this case turns on kept
		// intact: rebuild() reads through `dataSource.createQueryRunner()`, which for sqlite is the one
		// connection every unscoped query in the app shares (see AbstractSqliteDriver) and therefore
		// sees an open transaction's uncommitted rows; and it reports as abandoned exactly the source
		// devices present in the outgoing map and absent from the incoming one, which is what
		// VirtualPropertyIndexService.rebuild() computes. The real service is not used here because it
		// needs the full STI entity metadata and schema to run at all — that path has its own coverage
		// in test/devices-virtual.e2e-spec.ts.
		function createIndexStub() {
			let bySourceDevice = new Map<string, string[]>();
			let readers: (() => void)[] = [];

			return {
				rebuild: jest.fn(async (): Promise<VirtualIndexRebuildResult> => {
					flagAtRebuild.push(dataSource.createQueryRunner().isTransactionActive);

					const rows = (await dataSource
						.createQueryRunner()
						.query('SELECT virtual_device_id, source_device_id FROM links')) as {
						virtual_device_id: string;
						source_device_id: string;
					}[];

					const incoming = new Map<string, string[]>();

					for (const row of rows) {
						incoming.set(row.source_device_id, [...(incoming.get(row.source_device_id) ?? []), row.virtual_device_id]);
					}

					const abandonedSourceDeviceIds = [...bySourceDevice.keys()].filter(
						(sourceDeviceId) => !incoming.has(sourceDeviceId),
					);

					bySourceDevice = incoming;

					for (const reader of readers) {
						reader();
					}

					readers = [];

					return { rewiredVirtualDeviceIds: [], abandonedSourceDeviceIds };
				}),
				findVirtualDeviceIdsBySourceDevice: jest.fn(
					(sourceDeviceId: string): string[] => bySourceDevice.get(sourceDeviceId) ?? [],
				),
				/** Resolves the next time a rebuild has actually read the table. */
				nextRead: (): Promise<void> => new Promise<void>((resolve) => readers.push(resolve)),
			};
		}

		// Reads and writes the real `devices` row. findOne — the first thing the unhide does — waits on
		// a gate the test opens once the emitting transaction has finished, which is the shape the
		// finding describes rather than an artificial delay: the unhide runs several awaited round trips
		// after the read it was derived from (the rebuild, then a recompute, then this findOne), so its
		// patch lands on the far side of the commit or rollback. Without the gate the patch could land
		// inside the open transaction and be rolled back along with it, which would hide the defect
		// behind a coincidence of scheduling rather than prove anything about it.
		const createDevicesStub = (unhideAllowed: Promise<void>): { findOne: jest.Mock; update: jest.Mock } => ({
			findOne: jest.fn(async (id: string) => {
				await unhideAllowed;

				const rows = await dataSource.query<{ id: string; hidden: number }[]>(
					'SELECT id, hidden FROM devices WHERE id = ?',
					[id],
				);

				// `hiddenBy` is a fixed `system` rather than a column of its own: these cases turn on *when*
				// the unhide's read and write land relative to the emitting transaction, and the provenance
				// check (isSystemHidden(), covered above) would only be a constant gate in front of that.
				// Stating it here keeps the unhide reachable, which is what these tests need to observe.
				return rows.length > 0
					? {
							id: rows[0].id,
							type: 'simulator',
							hidden: rows[0].hidden === 1,
							hiddenBy: DeviceHiddenBy.SYSTEM,
							enabled: true,
						}
					: null;
			}),
			update: jest.fn(async (id: string, dto: { hidden?: boolean }) => {
				await dataSource.query('UPDATE devices SET hidden = ? WHERE id = ?', [dto.hidden === false ? 0 : 1, id]);
			}),
		});

		const readHidden = async (id: string): Promise<number | undefined> => {
			const rows = await dataSource.query<{ hidden: number }[]>('SELECT hidden FROM devices WHERE id = ?', [id]);

			return rows[0]?.hidden;
		};

		const countLinks = async (): Promise<number> => {
			const rows = await dataSource.query<{ total: number }[]>('SELECT COUNT(*) AS total FROM links');

			return rows[0].total;
		};

		beforeAll(async () => {
			dataSource = new DataSource({ type: 'sqlite', database: ':memory:', entities: [], synchronize: false });

			await dataSource.initialize();
			await dataSource.query('CREATE TABLE devices (id TEXT PRIMARY KEY, hidden INTEGER NOT NULL)');
			await dataSource.query('CREATE TABLE links (virtual_device_id TEXT NOT NULL, source_device_id TEXT NOT NULL)');
		});

		afterAll(async () => {
			await dataSource.destroy();
		});

		beforeEach(async () => {
			await dataSource.query('DELETE FROM devices');
			await dataSource.query('DELETE FROM links');
			// The state the auto-unhide rule is about: a physical device hidden because a virtual device
			// replaced it, and the link that records the replacement.
			await dataSource.query("INSERT INTO devices (id, hidden) VALUES ('source-device', 1)");
			await dataSource.query(
				"INSERT INTO links (virtual_device_id, source_device_id) VALUES ('virtual-device', 'source-device')",
			);

			flagAtRebuild = [];
			indexStub = createIndexStub();

			devicesStub = createDevicesStub(
				new Promise<void>((resolve) => {
					releaseTheUnhide = resolve;
				}),
			);

			// Primes the index exactly as any earlier pass would have, so a later rebuild that stops
			// seeing the link has an outgoing entry to report as abandoned.
			await indexStub.rebuild();

			flagAtRebuild = [];
			indexStub.rebuild.mockClear();

			subject = new VirtualIndexMaintenanceListener(
				indexStub as unknown as VirtualPropertyIndexService,
				status as unknown as VirtualStatusListener,
				devicesStub as unknown as DevicesService,
				virtualDevicesService as unknown as VirtualDevicesService,
				eventEmitterStub as unknown as EventEmitter2,
				dataSource,
				// The provenance clear that follows every unhide. These cases are about *when* the
				// unhide's read and write land relative to the emitting transaction, which the patch
				// above already decides — the `devices` table here carries an `id` and a `hidden`
				// column and nothing else, so there is no `hiddenBy` for a real repository to write.
				{ update: jest.fn().mockResolvedValue(undefined) } as unknown as Repository<DeviceEntity>,
			);

			loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
			loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

			// `setImmediate` stays real so the wait's first phase — and every sqlite callback, which
			// arrives through libuv's I/O phase rather than a timer — runs at its natural pace. Only the
			// wait's second phase and the repair delay are faked, which is what collapses a multi-second
			// wait into an instant, repeatable test.
			jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
		});

		afterEach(() => {
			jest.useRealTimers();

			loggerWarnSpy.mockRestore();
			loggerErrorSpy.mockRestore();
		});

		it('leaves the source hidden when the deletion it read was rolled back', async () => {
			const transaction = dataSource
				.transaction(async (manager) => {
					await manager.query('DELETE FROM links WHERE virtual_device_id = ?', ['virtual-device']);

					// What DevicesService.remove() does: EventEmitter2.emit() runs listeners
					// synchronously, from inside the still-open transaction.
					subject.handleStructuralChange();

					// Holds the transaction open until the listener has given up waiting and read through
					// it — the expiry this case is about, reproduced rather than assumed.
					await indexStub.nextRead();

					throw new Error('rolled back');
				})
				.catch((error: Error) => error.message);

			await driveUntil(() => flagAtRebuild.length > 0);

			// Preconditions, not the assertion: the pass really did read inside the open transaction,
			// and really did give up waiting rather than settle.
			expect(flagAtRebuild).toEqual([true]);
			expect(
				(loggerWarnSpy.mock.calls as unknown[][]).some(
					(call) => typeof call[0] === 'string' && call[0].includes('Gave up waiting'),
				),
			).toBe(true);

			await expect(transaction).resolves.toBe('rolled back');

			// From here every read and write the unhide makes lands on committed state — the durable
			// case, not one that a rollback could quietly undo for it.
			releaseTheUnhide();

			await driveUntil(() => flagAtRebuild.length > 1 && indexStub.rebuild.mock.calls.length > 1);

			// The rollback put the link back, so the virtual device still replaces this source and the
			// source must still be hidden. A visible physical device sitting next to its own virtual
			// replacement is the duplicate the user sees, and nothing in this system would ever hide it
			// again.
			await expect(countLinks()).resolves.toBe(1);
			await expect(readHidden('source-device')).resolves.toBe(1);
		});

		// The control for the case above, and the risk the fix itself carries: holding the unhide back
		// until a pass reads committed state must not lose it. Same shape, same expired wait, opposite
		// outcome — and the repair pass cannot re-derive the abandonment from its own rebuild here, since
		// the index dropped the source on the expired pass and reports no transition on the next one. The
		// only thing that can unhide this device is the queued id being re-checked and acted on.
		it('unhides the source once the deletion it read has committed', async () => {
			const transaction = dataSource.transaction(async (manager) => {
				await manager.query('DELETE FROM links WHERE virtual_device_id = ?', ['virtual-device']);

				subject.handleStructuralChange();

				await indexStub.nextRead();
			});

			await driveUntil(() => flagAtRebuild.length > 0);

			expect(flagAtRebuild).toEqual([true]);

			await transaction;

			releaseTheUnhide();

			await driveUntil(() => devicesStub.update.mock.calls.length > 0);

			await expect(countLinks()).resolves.toBe(0);
			await expect(readHidden('source-device')).resolves.toBe(0);
		});

		// The other way the queue could strand a device: a connection whose flag never clears at all.
		// That is the failed-BEGIN case in the class docstring — `isTransactionActive` set with no
		// transaction behind it, permanently — where no pass can ever observe it settle and every read is
		// of committed state regardless. The rows here are real and the deletion is committed before the
		// listener hears about it; only the flag lies.
		it('unhides the source once the repair budget is spent, when no pass can ever settle', async () => {
			const stuckConnection = {
				createQueryRunner: () => ({ isTransactionActive: true }),
			} as unknown as DataSource;

			const stuck = new VirtualIndexMaintenanceListener(
				indexStub as unknown as VirtualPropertyIndexService,
				status as unknown as VirtualStatusListener,
				devicesStub as unknown as DevicesService,
				virtualDevicesService as unknown as VirtualDevicesService,
				eventEmitterStub as unknown as EventEmitter2,
				stuckConnection,
				{ update: jest.fn().mockResolvedValue(undefined) } as unknown as Repository<DeviceEntity>,
			);

			await dataSource.query('DELETE FROM links WHERE virtual_device_id = ?', ['virtual-device']);

			releaseTheUnhide();

			stuck.handleStructuralChange();

			await driveUntil(() => devicesStub.update.mock.calls.length > 0, 1000);

			// One pass plus MAX_REPAIR_PASSES repairs, none of which could settle, and then the queue is
			// released rather than held forever: a hidden device with no replacement and no route back
			// through the UI is the failure the rule exists to prevent.
			expect(flagAtRebuild).toHaveLength(4);
			await expect(readHidden('source-device')).resolves.toBe(0);
		});
	});
	// Compatibility is checked when a projection is created or remapped, but nothing re-checked it when
	// the source moved underneath: a physical property's permissions or data type can be PATCHed, and the
	// projection stayed attached, exposing values under a representation the source no longer speaks.
	describe('when a source property changes into something incompatible', () => {
		const sourceProperty = {
			id: 'source-property',
			permissions: ['ro'],
			dataType: 'bool',
		} as unknown as ChannelPropertyEntity;

		const dependent = {
			id: 'virtual-property',
			category: 'on',
			channel: { id: 'virtual-channel', category: 'light', device: { id: 'virtual-device', category: 'lighting' } },
		};

		// Built here rather than reusing the suite's shared stubs: this is the only group that reaches
		// `findBySourceProperty` and `getRepository`, and widening those stubs would loosen every other
		// case's expectations for no benefit.
		const build = (report: { compatible: boolean; reason?: string }, dependents: unknown[] = [dependent]) => {
			const update = jest.fn().mockResolvedValue(undefined);
			const findOne = jest.fn().mockResolvedValue({ ...dependent, sourcePropertyId: null });
			const emit = jest.fn();
			const reportCompatibility = jest.fn().mockReturnValue(report);

			const subject = new VirtualIndexMaintenanceListener(
				{
					rebuild: jest.fn().mockResolvedValue(NO_CHANGES),
					findLinksByVirtualDevice: jest.fn().mockReturnValue([]),
					findVirtualDeviceIdsBySourceDevice: jest.fn().mockReturnValue([]),
					findBySourceProperty: jest.fn().mockReturnValue(dependents),
				} as unknown as VirtualPropertyIndexService,
				{ recompute: jest.fn().mockResolvedValue(undefined) } as unknown as VirtualStatusListener,
				{ findOne: jest.fn(), update: jest.fn() } as unknown as DevicesService,
				{ reportCompatibility } as unknown as VirtualDevicesService,
				{ emit } as unknown as EventEmitter2,
				{
					getRepository: jest.fn().mockReturnValue({ update, findOne }),
					createQueryRunner: () => ({ isTransactionActive: false }),
				} as unknown as DataSource,
				{ update: jest.fn() } as unknown as Repository<DeviceEntity>,
			);

			return { subject, update, reportCompatibility, emit };
		};

		it('orphans the projection it can no longer feed', async () => {
			const { subject, update, emit } = build({ compatible: false, reason: 'permissions [ro] do not satisfy [rw]' });

			await subject.handleSourceMetadataChange(sourceProperty);

			expect(update).toHaveBeenCalledWith('virtual-property', { sourcePropertyId: null });
			// Announced, or an open admin keeps the stale link and never shows the remap action.
			expect(emit).toHaveBeenCalledWith(
				EventType.CHANNEL_PROPERTY_UPDATED,
				expect.objectContaining({ sourcePropertyId: null }),
			);
		});

		it('leaves a projection the source can still feed alone', async () => {
			const { subject, update } = build({ compatible: true });

			await subject.handleSourceMetadataChange(sourceProperty);

			expect(update).not.toHaveBeenCalled();
		});

		it('does nothing for a property nothing projects', async () => {
			const { subject, update, reportCompatibility } = build({ compatible: false }, []);

			await subject.handleSourceMetadataChange(sourceProperty);

			expect(reportCompatibility).not.toHaveBeenCalled();
			expect(update).not.toHaveBeenCalled();
		});
	});
});
