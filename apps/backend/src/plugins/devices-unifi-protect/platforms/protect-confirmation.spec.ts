import { ProtectConfirmationWaiters } from './protect-confirmation';

const KEY = 'light\u0000L1';
const fields = [
	{ path: 'lightDeviceSettings.ledLevel', value: 3 },
	{ path: 'lightDeviceSettings.isIndicatorEnabled', value: false },
];
const full = { lightDeviceSettings: { ledLevel: 3, isIndicatorEnabled: false } };
const other = { lightDeviceSettings: { ledLevel: 6, isIndicatorEnabled: false } };

describe('ProtectConfirmationWaiters', () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	it('resolves true on a matching observation and false on timeout', async () => {
		const waiters = new ProtectConfirmationWaiters();
		const a = waiters.arm(KEY, fields);

		a.accept(null);

		const pending = a.wait(3000);

		waiters.observe(KEY, full);
		await expect(pending).resolves.toBe(true);

		const b = waiters.arm(KEY, fields);

		b.accept(null);

		const late = b.wait(3000);

		jest.advanceTimersByTime(3000);
		await expect(late).resolves.toBe(false);
		a.dispose();
		b.dispose();
	});

	it('counts an observation made after accept but before wait()', async () => {
		const waiters = new ProtectConfirmationWaiters();
		const waiter = waiters.arm(KEY, fields);

		waiter.accept(null);
		waiters.observe(KEY, full);
		expect(waiter.matched).toBe(true);
		await expect(waiter.wait(3000)).resolves.toBe(true);
		expect(jest.getTimerCount()).toBe(0);
	});

	it('evaluates the current cached state at accept', async () => {
		const waiters = new ProtectConfirmationWaiters();
		const waiter = waiters.arm(KEY, fields);

		waiter.accept(full);
		await expect(waiter.wait(3000)).resolves.toBe(true);
	});

	it('never confirms from a match before accept that a later observation contradicted', async () => {
		const waiters = new ProtectConfirmationWaiters();
		const waiter = waiters.arm(KEY, fields);

		waiters.observe(KEY, full);
		waiters.observe(KEY, other);
		waiter.accept(other);
		expect(waiter.matched).toBe(false);

		const pending = waiter.wait(3000);

		jest.advanceTimersByTime(3000);
		await expect(pending).resolves.toBe(false);
	});

	it('confirms from an observation after accept following a contradicted early match', async () => {
		const waiters = new ProtectConfirmationWaiters();
		const waiter = waiters.arm(KEY, fields);

		waiters.observe(KEY, full);
		waiters.observe(KEY, other);
		waiter.accept(other);

		const pending = waiter.wait(3000);

		waiters.observe(KEY, full);
		await expect(pending).resolves.toBe(true);
	});

	it('ignores other devices and partial matches', async () => {
		const waiters = new ProtectConfirmationWaiters();
		const waiter = waiters.arm(KEY, fields);

		waiter.accept(null);

		const pending = waiter.wait(3000);

		waiters.observe(KEY, { lightDeviceSettings: { ledLevel: 3, isIndicatorEnabled: true } });
		waiters.observe('light\u0000L2', full);
		expect(waiter.matched).toBe(false);
		jest.advanceTimersByTime(3000);
		await expect(pending).resolves.toBe(false);
	});

	it('ends every pending wait on cancelAll()', async () => {
		const waiters = new ProtectConfirmationWaiters();
		const a = waiters.arm(KEY, fields);
		const b = waiters.arm('light\u0000L2', fields);

		a.accept(null);
		b.accept(null);

		const pending = [a.wait(3000), b.wait(3000)];

		waiters.cancelAll();
		await expect(Promise.all(pending)).resolves.toEqual([false, false]);
		expect(waiters.size).toBe(0);
		expect(jest.getTimerCount()).toBe(0);
	});

	it('refuses to arm beyond the limit and frees a slot on dispose', () => {
		const waiters = new ProtectConfirmationWaiters({ maxWaiters: 2 });
		const a = waiters.arm(KEY, fields);

		waiters.arm(KEY, fields);
		expect(waiters.arm(KEY, fields)).toBeNull();
		a.dispose();
		expect(waiters.size).toBe(1);
		expect(waiters.arm(KEY, fields)).not.toBeNull();
	});

	it('leaves no timer behind', async () => {
		const waiters = new ProtectConfirmationWaiters();
		const a = waiters.arm(KEY, fields);

		a.accept(null);

		const pending = a.wait(3000);

		expect(jest.getTimerCount()).toBe(1);
		waiters.observe(KEY, full);
		await pending;
		a.dispose();

		const b = waiters.arm(KEY, fields);
		const disposed = b.wait(3000);

		b.dispose();
		await expect(disposed).resolves.toBe(false);
		expect(jest.getTimerCount()).toBe(0);
		expect(waiters.size).toBe(0);
	});
});
