import 'reflect-metadata';

import { Logger } from '@nestjs/common';

import { EventType } from '../../../modules/devices/devices.constants';
import { VirtualPropertyIndexService } from '../services/virtual-property-index.service';

import { VirtualIndexMaintenanceListener } from './virtual-index-maintenance.listener';

// The metadata key @nestjs/event-emitter's @OnEvent() decorator stores its subscriptions under.
// Not part of the package's public exports (only the decorator itself is), so the key is
// duplicated here rather than imported. See the "subscribes to exactly..." test below: reading
// this back is what actually proves an event is (or is not) wired to the handler, as opposed to
// merely calling the handler directly, which would prove nothing about the decorator stack itself.
const EVENT_LISTENER_METADATA = 'EVENT_LISTENER_METADATA';

interface OnEventMetadataEntry {
	event: string | symbol | Array<string | symbol>;
}

describe('VirtualIndexMaintenanceListener', () => {
	let listener: VirtualIndexMaintenanceListener;
	let index: { rebuild: jest.Mock };

	// Drains Node's microtask queue completely — including microtasks newly queued while draining —
	// before the callback runs. Unlike a fixed number of `await Promise.resolve()` hops, this needs
	// no knowledge of how many microtask turns the coalescing loop takes internally, so it stays
	// correct even if that implementation detail changes.
	const flushMicrotasks = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

	// A promise plus its own resolver, so a test can decide exactly when a mocked rebuild() call
	// settles — needed to observe listener state while a rebuild is genuinely still in flight,
	// without racing real timers or guessing at microtask counts.
	const createDeferred = (): { promise: Promise<void>; resolve: () => void } => {
		let resolve!: () => void;
		const promise = new Promise<void>((res) => {
			resolve = res;
		});

		return { promise, resolve };
	};

	beforeEach(() => {
		index = { rebuild: jest.fn().mockResolvedValue(undefined) };
		listener = new VirtualIndexMaintenanceListener(index as unknown as VirtualPropertyIndexService);
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
		await flushMicrotasks();

		// Exactly one follow-up for the three events above, not three.
		expect(index.rebuild).toHaveBeenCalledTimes(2);

		second.resolve();
		await flushMicrotasks();

		// Nothing arrived during the follow-up, so the loop stops instead of running a third pass.
		expect(index.rebuild).toHaveBeenCalledTimes(2);
	});

	it('catches and logs a rejected rebuild, and still rebuilds on a later event', async () => {
		const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn');
		const failure = new Error('rebuild boom');

		index.rebuild.mockRejectedValueOnce(failure).mockResolvedValueOnce(undefined);

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
});
