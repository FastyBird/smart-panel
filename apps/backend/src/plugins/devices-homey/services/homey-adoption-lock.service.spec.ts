import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

import { AddHomeyAdoptionLocks1000000000022 } from '../../../migrations/1000000000022-AddHomeyAdoptionLocks';
import { HomeyAdoptionLockEntity } from '../entities/homey-adoption-lock.entity';

import { HomeyAdoptionLockService } from './homey-adoption-lock.service';

describe('HomeyAdoptionLockService', () => {
	let databasePath: string;
	let firstDataSource: DataSource;
	let secondDataSource: DataSource;
	let firstLock: HomeyAdoptionLockService;
	let secondLock: HomeyAdoptionLockService;

	beforeEach(async () => {
		databasePath = join(tmpdir(), `smart-panel-homey-adoption-${randomUUID()}.sqlite`);
		firstDataSource = new DataSource({
			type: 'sqlite',
			database: databasePath,
			entities: [HomeyAdoptionLockEntity],
			synchronize: false,
		});
		secondDataSource = new DataSource({
			type: 'sqlite',
			database: databasePath,
			entities: [HomeyAdoptionLockEntity],
			synchronize: false,
		});
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

	it('is created when TypeORM synchronizes a fresh schema', async () => {
		const synchronized = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [HomeyAdoptionLockEntity],
			synchronize: true,
		});
		await synchronized.initialize();

		try {
			await expect(
				new HomeyAdoptionLockService(synchronized).runExclusive('homey-light', () => Promise.resolve('adopted')),
			).resolves.toBe('adopted');
		} finally {
			await synchronized.destroy();
		}
	});

	it('recovers an abandoned claim whose owner socket is dead even before its timestamp expires', async () => {
		await firstDataSource.query(
			`INSERT INTO "devices_homey_adoption_locks" ("deviceIdentifier", "ownerToken", "expiresAt") VALUES (?, ?, ?)`,
			['homey-light', 'abandoned-owner', Date.now() + 120_000],
		);

		await expect(secondLock.runExclusive('homey-light', () => Promise.resolve('adopted'))).resolves.toBe('adopted');
		await expect(firstDataSource.query(`SELECT "ownerToken" FROM "devices_homey_adoption_locks"`)).resolves.toEqual([]);
	});

	it('does not replace an expired claim while its owner socket is still live', async () => {
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

		await expect(lockInternals.tryAcquire('homey-light', 'replacement')).resolves.toBe(false);
		await expect(firstDataSource.query(`SELECT "ownerToken" FROM "devices_homey_adoption_locks"`)).resolves.toEqual([
			{ ownerToken: liveOwner },
		]);

		releaseOperation();
		await expect(operation).resolves.toBeUndefined();
	});

	it('reclaims a token immediately after its owner socket closes despite a failed release', async () => {
		const lockInternals = firstLock as unknown as {
			release(deviceIdentifier: string, ownerToken: string): Promise<void>;
		};
		jest.spyOn(lockInternals, 'release').mockRejectedValueOnce(new Error('database busy'));

		await expect(firstLock.runExclusive('homey-light', () => Promise.resolve('completed'))).resolves.toBe('completed');
		await expect(
			firstDataSource.query(`SELECT "ownerToken" FROM "devices_homey_adoption_locks"`),
		).resolves.toHaveLength(1);
		await expect(secondLock.runExclusive('homey-light', () => Promise.resolve('retried'))).resolves.toBe('retried');
		await expect(firstDataSource.query(`SELECT "ownerToken" FROM "devices_homey_adoption_locks"`)).resolves.toEqual([]);
	});

	it('releases its claim when the protected adoption fails', async () => {
		await expect(
			firstLock.runExclusive('homey-light', () => Promise.reject(new Error('persistence failed'))),
		).rejects.toThrow('persistence failed');

		await expect(secondLock.runExclusive('homey-light', () => Promise.resolve('retry'))).resolves.toBe('retry');
	});

	it('fences protected writes when the published ownership token is replaced', async () => {
		let releaseOperation: () => void = () => {};
		let operationEntered: () => void = () => {};
		const entered = new Promise<void>((resolve) => {
			operationEntered = resolve;
		});
		const held = new Promise<void>((resolve) => {
			releaseOperation = resolve;
		});
		let writes = 0;

		const operation = firstLock.runExclusive('homey-light', async (lease) => {
			operationEntered();
			await held;
			await lease.assertOwned();
			writes += 1;
		});
		await entered;
		await secondDataSource.query(
			`UPDATE "devices_homey_adoption_locks" SET "ownerToken" = ?, "expiresAt" = ? WHERE "deviceIdentifier" = ?`,
			['replacement-owner', Date.now() + 120_000, 'homey-light'],
		);
		releaseOperation();

		await expect(operation).rejects.toThrow('Homey adoption lock ownership was lost');
		expect(writes).toBe(0);
	});
});
