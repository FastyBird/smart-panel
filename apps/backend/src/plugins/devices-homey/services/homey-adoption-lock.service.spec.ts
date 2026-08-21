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

	it('releases its claim when the protected adoption fails', async () => {
		await expect(
			firstLock.runExclusive('homey-light', () => Promise.reject(new Error('persistence failed'))),
		).rejects.toThrow('persistence failed');

		await expect(secondLock.runExclusive('homey-light', () => Promise.resolve('retry'))).resolves.toBe('retry');
	});
});
