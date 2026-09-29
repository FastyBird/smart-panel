import { ConfigService } from '../../config/services/config.service';
import { StoragePlugin } from '../../storage/interfaces/storage-plugin.interface';
import { StorageService } from '../../storage/services/storage.service';
import { StoragePoint } from '../../storage/storage.types';
import { DataTypeType } from '../devices.constants';
import { ChannelPropertyEntity } from '../entities/devices.entity';

import { PropertyValueLockService } from './property-value-lock.service';
import { PropertyValueSourceRegistryService } from './property-value-source.registry.service';
import { PropertyValueService } from './property-value.service';

const deferred = () => {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => (resolve = done));
	return { promise, resolve };
};

describe('Live property publication and buffered history', () => {
	let storage: StorageService;
	let values: PropertyValueService;
	let history: StoragePoint[];
	let write: jest.Mock<Promise<void>, [StoragePoint[]]>;
	let locksEnabled: boolean;
	const property = { id: 'source', dataType: DataTypeType.BOOL } as ChannelPropertyEntity;

	beforeEach(async () => {
		history = [];
		locksEnabled = false;
		write = jest.fn((points: StoragePoint[]) => {
			history.push(...points);
			return Promise.resolve();
		});
		storage = new StorageService({
			getModuleConfig: () => ({ primaryStorage: 'test' }),
		} as unknown as ConfigService);
		storage.registerPlugin('test', {
			name: 'test',
			isAvailable: () => true,
			writePoints: write,
			query: jest.fn((query: string) => {
				if (query.startsWith('DELETE')) history = [];
				const latest = history.at(-1);
				return Promise.resolve(latest ? [{ ...latest.fields, time: latest.timestamp, propertyId: 'source' }] : []);
			}),
		} as unknown as StoragePlugin);
		values = new PropertyValueService(storage, new PropertyValueSourceRegistryService(), {
			isEnabled: () => locksEnabled,
			runExclusive: <T>(_id: string, operation: (lease: { assertOwned(): Promise<void> }) => Promise<T>) =>
				operation({ assertOwned: () => Promise.resolve() }),
		} as PropertyValueLockService);
		await values.write(property, false, new Date(1000));
	});

	afterEach(async () => storage.onApplicationShutdown());

	it('returns consecutive live states before delayed history while preserving every ordered measurement', async () => {
		const gate = deferred();
		write.mockImplementationOnce(async (points) => {
			await gate.promise;
			history.push(...points);
		});
		try {
			await expect(values.writeLiveWithState(property, true, new Date(2000))).resolves.toMatchObject({
				changed: true,
				state: { value: true },
			});
			await expect(values.writeLiveWithState(property, false, new Date(3000))).resolves.toMatchObject({
				changed: true,
				state: { value: false },
			});
			await expect(values.writeLiveWithState(property, true, new Date(4000))).resolves.toMatchObject({
				changed: true,
				state: { value: true },
			});
			expect(history.map((point) => point.fields.stringValue)).toEqual(['false']);
			await expect(values.readLatest(property)).resolves.toMatchObject({ value: true });
		} finally {
			gate.resolve();
			await values.flushHistory();
		}
		expect(history.map((point) => point.fields.stringValue)).toEqual(['false', 'true', 'false', 'true']);
		expect(history.map((point) => point.timestamp?.getTime())).toEqual([1000, 2000, 3000, 4000]);
	});

	it.each(['write', 'strict', 'compare', 'delete', 'deleteSince', 'read'] as const)(
		'keeps %s behind accepted history',
		async (operation) => {
			const snapshot = await values.readLatestPersistedSnapshot(property);
			const gate = deferred();
			write.mockImplementationOnce(async (points) => {
				await gate.promise;
				history.push(...points);
			});
			await values.writeLiveWithState(property, true, new Date(2000));
			const action = (): Promise<unknown> => {
				switch (operation) {
					case 'write':
						return values.writeWithState(property, false, new Date(3000));
					case 'strict':
						return values.writeStrictWithState(property, false, undefined, new Date(3000));
					case 'compare':
						return values.writeStrictIfPersistedDifferent(property, false, snapshot.state);
					case 'delete':
						return values.delete(property);
					case 'deleteSince':
						return values.deleteSinceStrict(property, new Date(0));
					case 'read':
						return values.readLatestPersistedSnapshot(property);
				}
			};
			let completed = false;
			const result = action().then((value) => {
				completed = true;
				return value;
			});
			try {
				await new Promise<void>((resolve) => setImmediate(resolve));
				expect(completed).toBe(false);
			} finally {
				gate.resolve();
			}
			const value = await result;
			if (operation === 'compare' || operation === 'read') {
				expect(value).toMatchObject({ state: { value: true } });
				expect(history.map((point) => point.fields.stringValue)).toEqual(['false', 'true']);
			} else if (operation.startsWith('delete')) {
				expect(history).toEqual([]);
			} else {
				expect(history.map((point) => point.fields.stringValue)).toEqual(['false', 'true', 'false']);
			}
		},
	);

	it('retains awaited persistence when shared-writer locking is enabled', async () => {
		locksEnabled = true;
		const gate = deferred();
		write.mockImplementationOnce(async (points) => {
			await gate.promise;
			history.push(...points);
		});
		let completed = false;
		const update = values.writeLiveWithState(property, true).then(() => (completed = true));
		try {
			await new Promise<void>((resolve) => setImmediate(resolve));
			expect(completed).toBe(false);
		} finally {
			gate.resolve();
			await update;
		}
		expect(history).toHaveLength(2);
	});

	it('keeps accepted state on history failure and allows later history to recover', async () => {
		write.mockRejectedValueOnce(new Error('Influx unavailable'));
		await values.writeLiveWithState(property, true);
		await values.flushHistory();
		await expect(values.readLatest(property)).resolves.toMatchObject({ value: true });
		await values.writeLiveWithState(property, false);
		await values.flushHistory();
		expect(history.map((point) => point.fields.stringValue)).toEqual(['false', 'false']);
	});

	it('drains the last live value on shutdown so a fresh value service can read it from storage', async () => {
		const gate = deferred();
		write.mockImplementationOnce(async (points) => {
			await gate.promise;
			history.push(...points);
		});
		await values.writeLiveWithState(property, true, new Date(2000));
		let stopped = false;
		const shutdown = storage.onApplicationShutdown().then(() => (stopped = true));
		expect(stopped).toBe(false);
		gate.resolve();
		await shutdown;
		const freshValues = new PropertyValueService(storage, new PropertyValueSourceRegistryService(), null as never);
		await expect(freshValues.readLatest(property)).resolves.toMatchObject({
			value: true,
			lastUpdated: new Date(2000).toISOString(),
		});
	});
});
