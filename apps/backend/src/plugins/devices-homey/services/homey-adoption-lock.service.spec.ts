import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

import { AddHomeyAdoptionLocks1000000000022 } from '../../../migrations/1000000000022-AddHomeyAdoptionLocks';

import { HomeyAdoptionLockService } from './homey-adoption-lock.service';

describe('HomeyAdoptionLockService', () => {
	let databasePath: string;
	let firstDataSource: DataSource;
	let secondDataSource: DataSource;
	let firstLock: HomeyAdoptionLockService;
	let secondLock: HomeyAdoptionLockService;

	beforeEach(async () => {
		databasePath = join(tmpdir(), `smart-panel-homey-adoption-${randomUUID()}.sqlite`);
		firstDataSource = new DataSource({ type: 'sqlite', database: databasePath, entities: [], synchronize: false });
		secondDataSource = new DataSource({ type: 'sqlite', database: databasePath, entities: [], synchronize: false });
		await firstDataSource.initialize();
		const queryRunner = firstDataSource.createQueryRunner();
		await new AddHomeyAdoptionLocks1000000000022().up(queryRunner);
		await queryRunner.release();
		await secondDataSource.initialize();
		firstLock = new HomeyAdoptionLockService(firstDataSource);
		secondLock = new HomeyAdoptionLockService(secondDataSource);
	});

	afterEach(async () => {
		if (secondDataSource.isInitialized) {
			await secondDataSource.destroy();
		}
		if (firstDataSource.isInitialized) {
			await firstDataSource.destroy();
		}
		await unlink(databasePath).catch(() => undefined);
	});

	it('serializes the same Homey device across independent database connections', async () => {
		const order: string[] = [];
		let releaseFirst: () => void = () => {};
		let firstEntered: () => void = () => {};
		const entered = new Promise<void>((resolve) => {
			firstEntered = resolve;
		});
		const held = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});

		const first = firstLock.runExclusive('homey-light', async () => {
			order.push('first-entered');
			firstEntered();
			await held;
			order.push('first-released');
		});
		await entered;
		const second = secondLock.runExclusive('homey-light', () => {
			order.push('second-entered');

			return Promise.resolve();
		});

		await new Promise<void>((resolve) => setTimeout(resolve, 75));
		expect(order).toEqual(['first-entered']);

		releaseFirst();
		await Promise.all([first, second]);
		expect(order).toEqual(['first-entered', 'first-released', 'second-entered']);
	});

	it('recovers an expired claim and removes its own claim after completion', async () => {
		await firstDataSource.query(
			`INSERT INTO "devices_homey_adoption_locks" ("deviceIdentifier", "ownerToken", "expiresAt") VALUES (?, ?, ?)`,
			['homey-light', 'abandoned-owner', 0],
		);

		await expect(secondLock.runExclusive('homey-light', () => Promise.resolve('adopted'))).resolves.toBe('adopted');
		await expect(firstDataSource.query(`SELECT "ownerToken" FROM "devices_homey_adoption_locks"`)).resolves.toEqual([]);
	});

	it('does not replace an expired claim while its owning process is still alive', async () => {
		let releaseOperation: () => void = () => {};
		let operationEntered: () => void = () => {};
		const entered = new Promise<void>((resolve) => {
			operationEntered = resolve;
		});
		const held = new Promise<void>((resolve) => {
			releaseOperation = resolve;
		});
		const operation = firstLock.runExclusive('homey-light', async () => {
			operationEntered();
			await held;
		});
		await entered;
		const [{ ownerToken: liveOwner }] = await firstDataSource.query<Array<{ ownerToken: string }>>(
			`SELECT "ownerToken" FROM "devices_homey_adoption_locks" WHERE "deviceIdentifier" = ?`,
			['homey-light'],
		);
		await firstDataSource.query(
			`UPDATE "devices_homey_adoption_locks" SET "expiresAt" = ? WHERE "deviceIdentifier" = ?`,
			[0, 'homey-light'],
		);
		const lockInternals = secondLock as unknown as {
			tryAcquire(deviceIdentifier: string, ownerToken: string): Promise<boolean>;
		};

		await expect(lockInternals.tryAcquire('homey-light', `${process.pid}:replacement`)).resolves.toBe(false);
		await expect(firstDataSource.query(`SELECT "ownerToken" FROM "devices_homey_adoption_locks"`)).resolves.toEqual([
			{ ownerToken: liveOwner },
		]);

		releaseOperation();
		await expect(operation).rejects.toThrow('Homey adoption lock ownership was lost');
	});

	it('reclaims an inactive same-process token while retrying its failed release', async () => {
		jest.useFakeTimers();
		const lockInternals = firstLock as unknown as {
			release(deviceIdentifier: string, ownerToken: string): Promise<void>;
		};
		jest.spyOn(lockInternals, 'release').mockRejectedValueOnce(new Error('database busy'));

		try {
			await expect(firstLock.runExclusive('homey-light', () => Promise.resolve('completed'))).resolves.toBe(
				'completed',
			);
			await expect(
				firstDataSource.query(`SELECT "ownerToken" FROM "devices_homey_adoption_locks"`),
			).resolves.toHaveLength(1);
			await expect(secondLock.runExclusive('homey-light', () => Promise.resolve('retried'))).resolves.toBe('retried');
			await expect(firstDataSource.query(`SELECT "ownerToken" FROM "devices_homey_adoption_locks"`)).resolves.toEqual(
				[],
			);

			await jest.advanceTimersByTimeAsync(1_000);
		} finally {
			jest.useRealTimers();
		}
	});

	it('releases its claim when the protected adoption fails', async () => {
		await expect(
			firstLock.runExclusive('homey-light', () => Promise.reject(new Error('persistence failed'))),
		).rejects.toThrow('persistence failed');

		await expect(secondLock.runExclusive('homey-light', () => Promise.resolve('retry'))).resolves.toBe('retry');
	});

	it('accepts authoritative ownership after a transient heartbeat query failure', async () => {
		jest.useFakeTimers();
		let releaseOperation: () => void = () => {};
		let operationEntered: () => void = () => {};
		const entered = new Promise<void>((resolve) => {
			operationEntered = resolve;
		});
		const held = new Promise<void>((resolve) => {
			releaseOperation = resolve;
		});

		try {
			const operation = firstLock.runExclusive('homey-light', async () => {
				operationEntered();
				await held;

				return 'completed';
			});
			await entered;
			const query = jest.spyOn(firstDataSource, 'query').mockRejectedValueOnce(new Error('database busy'));

			await jest.advanceTimersByTimeAsync(20_000);
			query.mockRestore();
			releaseOperation();

			await expect(operation).resolves.toBe('completed');
		} finally {
			jest.useRealTimers();
		}
	});

	it('fences protected writes as soon as a heartbeat confirms ownership loss', async () => {
		jest.useFakeTimers();
		let releaseOperation: () => void = () => {};
		let operationEntered: () => void = () => {};
		const entered = new Promise<void>((resolve) => {
			operationEntered = resolve;
		});
		const held = new Promise<void>((resolve) => {
			releaseOperation = resolve;
		});
		const lockInternals = firstLock as unknown as {
			renew(deviceIdentifier: string, ownerToken: string): Promise<boolean>;
		};
		const renew = jest.spyOn(lockInternals, 'renew');
		let writes = 0;

		try {
			const operation = firstLock.runExclusive('homey-light', async (lease) => {
				operationEntered();
				await held;
				await lease.assertOwned();
				writes += 1;
			});
			await entered;
			const [{ ownerToken }] = await firstDataSource.query<Array<{ ownerToken: string }>>(
				`SELECT "ownerToken" FROM "devices_homey_adoption_locks" WHERE "deviceIdentifier" = ?`,
				['homey-light'],
			);
			await secondDataSource.query(
				`UPDATE "devices_homey_adoption_locks" SET "ownerToken" = ?, "expiresAt" = ? WHERE "deviceIdentifier" = ?`,
				['replacement-owner', Date.now() + 120_000, 'homey-light'],
			);

			await jest.advanceTimersByTimeAsync(20_000);
			expect(renew).toHaveBeenCalledTimes(1);
			await expect(renew.mock.results[0].value).resolves.toBe(false);
			await secondDataSource.query(
				`UPDATE "devices_homey_adoption_locks" SET "ownerToken" = ?, "expiresAt" = ? WHERE "deviceIdentifier" = ?`,
				[ownerToken, Date.now() + 120_000, 'homey-light'],
			);
			releaseOperation();

			await expect(operation).rejects.toThrow('Homey adoption lock ownership was lost');
			expect(writes).toBe(0);
		} finally {
			jest.useRealTimers();
		}
	});
});
