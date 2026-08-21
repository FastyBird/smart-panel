import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

import { AddPropertyValueLocks1000000000023 } from '../../../migrations/1000000000023-AddPropertyValueLocks';

import { PropertyValueLockService } from './property-value-lock.service';

describe('PropertyValueLockService', () => {
	let databasePath: string;
	let firstDataSource: DataSource;
	let secondDataSource: DataSource;
	let firstLock: PropertyValueLockService;
	let secondLock: PropertyValueLockService;

	beforeEach(async () => {
		databasePath = join(tmpdir(), `smart-panel-property-value-${randomUUID()}.sqlite`);
		firstDataSource = new DataSource({ type: 'sqlite', database: databasePath, entities: [], synchronize: false });
		secondDataSource = new DataSource({ type: 'sqlite', database: databasePath, entities: [], synchronize: false });
		await firstDataSource.initialize();
		const queryRunner = firstDataSource.createQueryRunner();
		await new AddPropertyValueLocks1000000000023().up(queryRunner);
		await queryRunner.release();
		await secondDataSource.initialize();
		firstLock = new PropertyValueLockService(firstDataSource);
		secondLock = new PropertyValueLockService(secondDataSource);
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

	it('serializes one property across independent database connections', async () => {
		const order: string[] = [];
		let releaseFirst: () => void = () => {};
		let firstEntered: () => void = () => {};
		const entered = new Promise<void>((resolve) => {
			firstEntered = resolve;
		});
		const held = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});

		const first = firstLock.runExclusive('temperature', async () => {
			order.push('first-entered');
			firstEntered();
			await held;
			order.push('first-released');
		});
		await entered;
		const second = secondLock.runExclusive('temperature', () => {
			order.push('second-entered');

			return Promise.resolve();
		});

		await new Promise<void>((resolve) => setTimeout(resolve, 75));
		expect(order).toEqual(['first-entered']);

		releaseFirst();
		await Promise.all([first, second]);
		expect(order).toEqual(['first-entered', 'first-released', 'second-entered']);
	});

	it('allows independent properties to proceed concurrently', async () => {
		let releaseFirst: () => void = () => {};
		let firstEntered: () => void = () => {};
		const entered = new Promise<void>((resolve) => {
			firstEntered = resolve;
		});
		const held = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});
		const first = firstLock.runExclusive('temperature', async () => {
			firstEntered();
			await held;
		});
		await entered;

		await expect(secondLock.runExclusive('humidity', () => Promise.resolve('written'))).resolves.toBe('written');
		releaseFirst();
		await expect(first).resolves.toBeUndefined();
	});

	it('recovers an abandoned claim whose owner socket is dead', async () => {
		await firstDataSource.query(
			`INSERT INTO "devices_module_property_value_locks" ("propertyId", "ownerToken", "expiresAt") ` +
				`VALUES (?, ?, ?)`,
			['temperature', 'abandoned-owner', Date.now() + 120_000],
		);

		await expect(secondLock.runExclusive('temperature', () => Promise.resolve('written'))).resolves.toBe('written');
		await expect(
			firstDataSource.query(`SELECT "ownerToken" FROM "devices_module_property_value_locks"`),
		).resolves.toEqual([]);
	});

	it('releases the shared claim when the protected operation fails', async () => {
		await expect(
			firstLock.runExclusive('temperature', () => Promise.reject(new Error('storage failed'))),
		).rejects.toThrow('storage failed');

		await expect(secondLock.runExclusive('temperature', () => Promise.resolve('retry'))).resolves.toBe('retry');
	});

	it('fences a write after the shared ownership token is replaced', async () => {
		let releaseOperation: () => void = () => {};
		let operationEntered: () => void = () => {};
		const entered = new Promise<void>((resolve) => {
			operationEntered = resolve;
		});
		const held = new Promise<void>((resolve) => {
			releaseOperation = resolve;
		});
		let writes = 0;

		const operation = firstLock.runExclusive('temperature', async (lease) => {
			operationEntered();
			await held;
			await lease.assertOwned();
			writes += 1;
		});
		await entered;
		await secondDataSource.query(
			`UPDATE "devices_module_property_value_locks" SET "ownerToken" = ?, "expiresAt" = ? ` + `WHERE "propertyId" = ?`,
			['replacement-owner', Date.now() + 120_000, 'temperature'],
		);
		releaseOperation();

		await expect(operation).rejects.toThrow('Property value lock ownership was lost');
		expect(writes).toBe(0);
	});
});
