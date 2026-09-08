import {
	PROPERTY_COMMAND_CONFIRMATION_GRACE_MS,
	PropertyCommandWindowHandle,
	PropertyCommandWindowService,
} from './property-command-window.service';

describe('PropertyCommandWindowService', () => {
	let service: PropertyCommandWindowService;

	const open = (overrides: Partial<Parameters<PropertyCommandWindowService['open']>[0]> = {}) =>
		service.open({
			canonicalTarget: { deviceId: 'device', channelId: 'channel', propertyId: 'source' },
			requestedTargets: [{ deviceId: 'device', channelId: 'channel', propertyId: 'requested' }],
			commandedValue: true,
			previousValue: false,
			ttlMs: 3_000,
			...overrides,
		});

	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-09-08T12:00:00.000Z'));
		service = new PropertyCommandWindowService();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('keeps immutable snapshots and expires on access without waiting for the sweep', () => {
		const handle = open({ ttlMs: 100 });
		const current = service.get(handle.canonicalPropertyId);

		expect(current).toEqual(
			expect.objectContaining({
				generation: handle.generation,
				commandedValue: true,
				previousValue: false,
				state: 'pending',
			}),
		);
		expect(Object.isFrozen(current)).toBe(true);
		expect(Object.isFrozen(current?.requestedTargets)).toBe(true);

		jest.advanceTimersByTime(100);
		expect(service.get(handle.canonicalPropertyId)).toBeNull();
	});

	it('starts confirmation grace once and does not extend it for repeated confirmation', () => {
		const handle = open();
		const firstReceipt = { value: true as const, receivedAt: Date.now() + 100 };
		const confirmed = service.confirm(handle, firstReceipt);

		expect(confirmed).toEqual(
			expect.objectContaining({
				state: 'confirmed_grace',
				confirmedAt: firstReceipt.receivedAt,
				confirmationExpiresAt: firstReceipt.receivedAt + PROPERTY_COMMAND_CONFIRMATION_GRACE_MS,
			}),
		);

		const duplicate = service.confirm(handle, { value: true, receivedAt: Date.now() + 500 });
		expect(duplicate?.confirmationExpiresAt).toBe(firstReceipt.receivedAt + PROPERTY_COMMAND_CONFIRMATION_GRACE_MS);

		jest.advanceTimersByTime(PROPERTY_COMMAND_CONFIRMATION_GRACE_MS + 100);
		expect(service.get(handle.canonicalPropertyId)).toBeNull();
	});

	it('supersedes a generation atomically and carries the prior commanded value', () => {
		const first = open({ commandedValue: true, previousValue: false });
		const second = open({ commandedValue: false, previousValue: null });

		expect(second.generation).not.toBe(first.generation);
		expect(service.get(second.canonicalPropertyId)).toEqual(
			expect.objectContaining({ generation: second.generation, commandedValue: false, previousValue: true }),
		);
	});

	it('does not let an old ABA generation close the latest command', () => {
		const first = open({ commandedValue: true });
		service.attachPatchReceipt(first, {
			baseline: { value: false, lastUpdated: '2026-09-08T12:00:00.000Z', trend: null },
			optimisticState: { value: true, lastUpdated: '2026-09-08T12:00:00.100Z', trend: null },
		});
		const second = open({ commandedValue: false });
		const third = open({ commandedValue: true });

		expect(service.fail(first)).toBe(false);
		expect(service.fail(second)).toBe(false);
		expect(service.get(third.canonicalPropertyId)?.generation).toBe(third.generation);
		expect(service.get(third.canonicalPropertyId)?.rollbackBaseline?.value).toBe(false);
		expect(service.get(third.canonicalPropertyId)?.patchReceipt).toBeNull();
	});

	it('does not recover a prior PATCH when replacement persistence fails before dispatch', () => {
		const first = open({ commandedValue: true });
		service.attachPatchReceipt(first, {
			baseline: { value: false, lastUpdated: '2026-09-08T12:00:00.000Z', trend: null },
			optimisticState: { value: true, lastUpdated: '2026-09-08T12:00:00.100Z', trend: null },
		});
		const replacement = open({ commandedValue: false });

		expect(replacement.generation).not.toBe(first.generation);
		expect(service.get(replacement.canonicalPropertyId)?.rollbackBaseline?.value).toBe(false);
		expect(service.fail(replacement)).toBe(true);
		expect(service.getRecovery(replacement)).toBeNull();
		expect(service.fail(first)).toBe(false);
	});

	it('keeps the last reported rollback baseline across two failed optimistic generations', () => {
		const first = open({ commandedValue: true });
		service.attachPatchReceipt(first, {
			baseline: { value: false, lastUpdated: '2026-09-08T12:00:00.000Z', trend: null },
			optimisticState: { value: true, lastUpdated: '2026-09-08T12:00:00.100Z', trend: null },
		});
		const second = open({ commandedValue: false });
		service.attachPatchReceipt(second, {
			baseline: { value: true, lastUpdated: '2026-09-08T12:00:00.100Z', trend: null },
			optimisticState: { value: false, lastUpdated: '2026-09-08T12:00:00.200Z', trend: null },
		});

		expect(service.fail(first)).toBe(false);
		expect(service.fail(second)).toBe(true);
		expect(service.getRecovery(second)?.patchReceipt).toEqual(
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			expect.objectContaining({ baseline: expect.objectContaining({ value: false }) }),
		);
	});

	it('lets a provider confirmation win over a late API failure', () => {
		const handle = open();
		service.attachPatchReceipt(handle, {
			baseline: { value: false, lastUpdated: '2026-09-08T12:00:00.000Z', trend: null },
			optimisticState: { value: true, lastUpdated: '2026-09-08T12:00:00.100Z', trend: null },
		});
		service.confirm(handle, { value: true, receivedAt: Date.now() + 100 });

		expect(service.fail(handle)).toBe(false);
		expect(service.getRecovery(handle)).toBeNull();
	});

	it('only lets the owning invocation fail an unconfirmed generation', () => {
		const handle = open();
		const foreign: PropertyCommandWindowHandle = { ...handle, generation: 'foreign' };

		expect(service.fail(foreign)).toBe(false);
		expect(service.confirm(handle, { value: true, receivedAt: Date.now() })).not.toBeNull();
		expect(service.fail(handle)).toBe(false);
		expect(service.get(handle.canonicalPropertyId)).not.toBeNull();
	});

	it('retains a held pending report for token-fenced recovery on expiry', () => {
		const handle = open({ ttlMs: 100 });
		service.hold(handle, { value: false, receivedAt: Date.now() });

		jest.advanceTimersByTime(100);
		expect(service.sweep()).toEqual([handle]);
		expect(service.getRecovery(handle)?.heldReceipt).toEqual(expect.objectContaining({ value: false }));

		expect(service.completeRecovery(handle)).toBe(true);
		expect(service.getRecovery(handle)).toBeNull();
	});

	it('retains an optimistic PATCH fallback for its owning failed generation', () => {
		const handle = open({ ttlMs: 100 });
		expect(
			service.attachPatchReceipt(handle, {
				baseline: { value: false, lastUpdated: '2026-09-08T12:00:00.000Z', trend: null },
				optimisticState: { value: true, lastUpdated: '2026-09-08T12:00:00.100Z', trend: null },
			}),
		).toBe(true);

		expect(service.fail(handle)).toBe(true);
		expect(service.getRecovery(handle)?.patchReceipt).toEqual(
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			expect.objectContaining({ optimisticState: expect.objectContaining({ value: true }) }),
		);
	});

	it('cancels a pending recovery when a newer generation replaces it', () => {
		const first = open({ ttlMs: 100 });
		service.hold(first, { value: false, receivedAt: Date.now() });
		jest.advanceTimersByTime(100);
		service.sweep();

		const second = open({ commandedValue: false });
		expect(service.getRecovery(first)).toBeNull();
		expect(service.get(second.canonicalPropertyId)?.generation).toBe(second.generation);
	});

	it('bounds a failed recovery to one original command TTL', () => {
		const handle = open({ ttlMs: 100 });
		service.hold(handle, { value: false, receivedAt: Date.now() });
		jest.advanceTimersByTime(100);
		expect(service.sweep()).toEqual([handle]);

		jest.advanceTimersByTime(100);
		expect(service.sweep()).toEqual([]);
		expect(service.getRecovery(handle)).toBeNull();
	});
});
