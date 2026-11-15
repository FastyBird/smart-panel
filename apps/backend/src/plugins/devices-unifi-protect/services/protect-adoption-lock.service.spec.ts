import { ProtectAdoptionLockService } from './protect-adoption-lock.service';

const gate = () => {
	let open: () => void = () => {};
	const promise = new Promise<void>((resolve) => {
		open = resolve;
	});

	return { promise, open };
};

describe('ProtectAdoptionLockService', () => {
	it('runs operations for one key in order and different keys concurrently', async () => {
		const lock = new ProtectAdoptionLockService();
		const events: string[] = [];
		const first = gate();
		const other = gate();

		const a1 = lock.run('a', async () => {
			events.push('a1:start');
			await first.promise;
			events.push('a1:end');
		});
		const a2 = lock.run('a', () => {
			events.push('a2:start');

			return Promise.resolve();
		});
		const b1 = lock.run('b', async () => {
			events.push('b1:start');
			await other.promise;
			events.push('b1:end');
		});

		await new Promise((resolve) => setImmediate(resolve));
		expect(events).toEqual(['a1:start', 'b1:start']);

		other.open();
		first.open();
		await Promise.all([a1, a2, b1]);

		expect(events.indexOf('a1:end')).toBeLessThan(events.indexOf('a2:start'));
	});

	it('releases the key after a rejection', async () => {
		const lock = new ProtectAdoptionLockService();

		await expect(lock.run('a', () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
		await expect(lock.run('a', () => Promise.resolve(7))).resolves.toBe(7);
	});

	it('returns the operation result', async () => {
		await expect(new ProtectAdoptionLockService().run('k', () => Promise.resolve('x'))).resolves.toBe('x');
	});
});
