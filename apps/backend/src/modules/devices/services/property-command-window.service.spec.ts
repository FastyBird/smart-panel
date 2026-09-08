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
		const second = open({ commandedValue: false });
		const third = open({ commandedValue: true });

		expect(service.fail(first)).toBe(false);
		expect(service.fail(second)).toBe(false);
		expect(service.get(third.canonicalPropertyId)?.generation).toBe(third.generation);
	});

	it('only lets the owning invocation fail an unconfirmed generation', () => {
		const handle = open();
		const foreign: PropertyCommandWindowHandle = { ...handle, generation: 'foreign' };

		expect(service.fail(foreign)).toBe(false);
		expect(service.confirm(handle, { value: true, receivedAt: Date.now() })).not.toBeNull();
		expect(service.fail(handle)).toBe(false);
		expect(service.get(handle.canonicalPropertyId)).not.toBeNull();
	});
});
