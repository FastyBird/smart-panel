import { AsyncLocalStorage } from 'node:async_hooks';
import { Column, Entity, EntitySubscriberInterface, PrimaryGeneratedColumn } from 'typeorm';
import { SqliteDriver } from 'typeorm/driver/sqlite/SqliteDriver';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import { ExtensionLoggerService } from '../../../common/logger/extension-logger.service';
import { CreateChannelPropertyDto } from '../dto/create-channel-property.dto';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateChannelPropertyDto } from '../dto/update-channel-property.dto';
import { UpdateChannelDto } from '../dto/update-channel.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';

import { ChannelsTypeMapperService } from './channels-type-mapper.service';
import { ChannelsPropertiesTypeMapperService } from './channels.properties-type-mapper.service';
import { CreationSettlement, DeviceCreationContext, DeviceCreationSettlementError } from './device-creation-context';
import { DeviceStructureLockService } from './device-structure-lock.service';
import { DevicesTypeMapperService } from './devices-type-mapper.service';

@Entity()
class CreationRecord {
	@PrimaryGeneratedColumn() id: number;
	@Column() name: string;
}
function gate() {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}
interface NativeConnection {
	all(
		query: string,
		parameters: unknown[],
		callback: (this: unknown, error: Error | null, rows?: unknown[]) => void,
	): unknown;
}

describe('pinned DeviceCreationContext (real coordinated SQLite)', () => {
	let database: SqliteDataSource;
	let lock: DeviceStructureLockService;
	let settlement: CreationSettlement<number>;
	let devices: DevicesTypeMapperService;
	let catalog: ReturnType<typeof captureCatalog>;
	function captureCatalog() {
		const channels = new ChannelsTypeMapperService();
		const properties = new ChannelsPropertiesTypeMapperService();
		devices.registerMapping({
			type: 'virtual',
			class: DeviceEntity,
			createDto: CreateDeviceDto,
			updateDto: UpdateDeviceDto,
		});
		channels.registerMapping({
			type: 'virtual',
			class: ChannelEntity,
			createDto: CreateChannelDto,
			updateDto: UpdateChannelDto,
		});
		properties.registerMapping({
			type: 'virtual',
			class: ChannelPropertyEntity,
			createDto: CreateChannelPropertyDto,
			updateDto: UpdateChannelPropertyDto,
		});
		const device = devices.captureMapping('virtual'),
			channel = channels.captureMapping('virtual'),
			property = properties.captureMapping('virtual');
		return { device, channel, property, current: () => device.current() && channel.current() && property.current() };
	}
	function run(work: (context: DeviceCreationContext) => Promise<number>) {
		return lock.runExclusive(() =>
			DeviceCreationContext.runPinned(
				(operation, admit) =>
					database.transaction(async (manager) => {
						admit(manager);
						return operation(manager);
					}),
				catalog,
				AsyncLocalStorage.bind(() => lock.hasCurrentStructuralLease()),
				work,
				settlement,
			),
		);
	}
	beforeEach(async () => {
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [CreationRecord],
			synchronize: true,
		}).initialize();
		lock = new DeviceStructureLockService();
		settlement = new CreationSettlement<number>();
		devices = new DevicesTypeMapperService();
		catalog = captureCatalog();
	});
	afterEach(async () => {
		jest.restoreAllMocks();
		if (database.isInitialized) await database.destroy();
	});

	it.each([false, true])('rolls back an activation-dependent pinned defer, caught=%s', async (caught) => {
		const publish = jest.fn();
		const ordinary = jest.fn();
		let refusal: unknown;
		const failure = await run(async (context) => {
			await context.manager.insert(CreationRecord, { name: 'must roll back' });
			context.defer(ordinary);
			try {
				context.defer(publish, true);
			} catch (cause) {
				refusal = cause;
				if (!caught) throw cause;
			}
			return 7;
		}).catch((cause: unknown) => cause);
		expect(refusal).toBeInstanceOf(Error);
		expect((refusal as Error).message).toBe(
			'Activation-dependent publication is not supported on the pinned creation path',
		);
		expect(failure).toBeInstanceOf(DeviceCreationSettlementError);
		expect((failure as DeviceCreationSettlementError).cause).toBe(refusal);
		expect((failure as DeviceCreationSettlementError).settlementCause).toBe(refusal);
		expect(settlement.outcome).toBe('rolled_back');
		expect(settlement.legacyPublicationFailure).toBeUndefined();
		expect(settlement.result).toEqual(caught ? { value: 7 } : undefined);
		expect(publish).not.toHaveBeenCalled();
		expect(ordinary).not.toHaveBeenCalled();
		expect(await database.manager.count(CreationRecord)).toBe(0);
	});

	it('publishes an unflagged pinned job after the native ACK under the original lock', async () => {
		const observations: { outcome: string; structuralLease: boolean }[] = [];
		const publish = jest.fn(() => {
			observations.push({ outcome: settlement.outcome, structuralLease: lock.hasCurrentStructuralLease() });
		});
		expect(
			await run(async (context) => {
				await context.manager.insert(CreationRecord, { name: 'committed' });
				context.defer(publish);
				return 0;
			}),
		).toBe(0);
		expect(publish).toHaveBeenCalledTimes(1);
		expect(observations).toEqual([{ outcome: 'committed', structuralLease: true }]);
		expect(await database.manager.count(CreationRecord)).toBe(1);
	});

	it.each([undefined, null, false, 0, '', new Error('first publication')])(
		'retains exact first post-ACK failure after cleanup and continues jobs: %s',
		async (cause) => {
			const stages: string[] = [];
			const log = jest.spyOn(ExtensionLoggerService.prototype, 'error');
			let context!: DeviceCreationContext;
			const result = await run(async (active) => {
				context = active;
				await active.manager.insert(CreationRecord, { name: 'durable' });
				active.defer(() => {
					stages.push('first');
					expect(settlement.outcome).toBe('committed');
					// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Exact unknown causes are the contract.
					return Promise.reject(cause);
				});
				active.defer(() => {
					stages.push('second');
					throw new Error('later publication');
				});
				active.defer(() => {
					stages.push('last');
				});
				return 0;
			});
			expect(result).toBe(0);
			expect(settlement.result).toEqual({ value: 0 });
			expect(settlement.outcome).toBe('committed');
			expect(settlement.legacyPublicationFailure).toEqual({ cause });
			expect(Object.isFrozen(settlement.legacyPublicationFailure)).toBe(true);
			expect(settlement.legacyPublicationFailure.cause).toBe(cause);
			if (cause instanceof Error) expect(Object.isFrozen(cause)).toBe(false);
			expect(stages).toEqual(['first', 'second', 'last']);
			expect(log).toHaveBeenCalledTimes(2);
			const logged = log.mock.calls[0][1] as Error;
			expect(logged).toBeInstanceOf(Error);
			expect(cause instanceof Error ? logged : logged.cause).toBe(cause);
			expect(() => context.assertType('virtual')).toThrow('not active');
			expect(await database.manager.count(CreationRecord)).toBe(1);
		},
	);

	it('records the publication marker before the existing logger exception path', async () => {
		const cause = new Error('publication'),
			loggerCause = new Error('logger');
		const later = jest.fn();
		jest.spyOn(ExtensionLoggerService.prototype, 'error').mockImplementation(() => {
			expect(settlement.legacyPublicationFailure.cause).toBe(cause);
			throw loggerCause;
		});
		const failure = await run(async (context) => {
			await context.manager.insert(CreationRecord, { name: 'durable' });
			context.defer(() => {
				throw cause;
			});
			context.defer(later);
			return 0;
		}).catch((error: unknown) => error);
		expect(failure).toBeInstanceOf(DeviceCreationSettlementError);
		expect((failure as DeviceCreationSettlementError).cause).toBe(loggerCause);
		expect(settlement.outcome).toBe('committed');
		expect(settlement.result).toEqual({ value: 0 });
		expect(settlement.legacyPublicationFailure.cause).toBe(cause);
		expect(later).not.toHaveBeenCalled();
		expect(await database.manager.count(CreationRecord)).toBe(1);
	});

	it.each([true, false])('preserves legacy activation-dependent publication, activated=%s', async (activated) => {
		const stages: string[] = [];
		const publish = jest.fn(() => {
			stages.push('dependent');
		});
		const result = await lock.runExclusive(() =>
			DeviceCreationContext.run(
				(operation) => database.transaction(operation),
				'virtual',
				async (context) => {
					await context.manager.insert(CreationRecord, { name: 'legacy committed' });
					context.defer(publish, true);
					context.defer(() => {
						stages.push('ordinary');
					});
					return 7;
				},
				() => {
					stages.push('activation');
					if (!activated) throw new Error('legacy activation failed');
				},
			),
		);
		expect(result).toBe(7);
		expect(stages).toEqual(activated ? ['activation', 'dependent', 'ordinary'] : ['activation', 'ordinary']);
		expect(publish).toHaveBeenCalledTimes(activated ? 1 : 0);
		expect(await database.manager.count(CreationRecord)).toBe(1);
	});

	it('closes root admission before draining an admitted whole traversal and its fixed descendants', async () => {
		const entered = gate(),
			resume = gate(),
			bodyReturned = gate();
		let root!: DeviceCreationContext;
		const input = { id: 'device', channels: [{ id: 'channel', properties: [{ id: 'property' }] }] };
		let child!: Promise<number>;
		const completed: string[] = [];
		const pending = run((context) => {
			root = context;
			child = context.catalog('device', input, async (device) => {
				entered.resolve();
				await resume.promise;
				const channelInput = device.descendants()[0];
				await device.child(0).catalog('channel', channelInput, async (channel) => {
					const propertyInput = channel.descendants()[0];
					await channel.child(0).catalog('property', propertyInput, async (property) => {
						await property.manager.insert(CreationRecord, { name: 'fixed descendant' });
						completed.push('property');
					});
				});
				return 1;
			});
			bodyReturned.resolve();
			return Promise.resolve(7);
		});
		await entered.promise;
		await bodyReturned.promise;
		await new Promise<void>((resolve) => setImmediate(resolve));
		expect(settlement.receipt?.outcome).toBe('pending');
		const getter = jest.fn(() => {
			throw new Error('late input getter');
		});
		const late = Object.defineProperty({}, 'channels', { get: getter });
		expect(() => root.catalog('device', late, () => Promise.resolve(3))).toThrow('not active');
		expect(getter).not.toHaveBeenCalled();
		resume.resolve();
		expect(await pending).toBe(7);
		expect(await child).toBe(1);
		expect(completed).toEqual(['property']);
		expect(settlement.outcome).toBe('committed');
		expect(await database.manager.count(CreationRecord)).toBe(1);
		expect(() => root.assertType('virtual')).toThrow('not active');
	});

	it.each([undefined, null, false, 0, '', new Error('first child')])(
		'retains a caught first child rejection by presence: %s',
		async (cause) => {
			const failure = await run(async (context) => {
				await context
					.catalog('device', {}, async (child) => {
						await child.manager.insert(CreationRecord, { name: 'rolled back' });
						// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Falsy business causes must retain identity.
						return Promise.reject(cause);
					})
					.catch(() => undefined);
				throw new Error('later body/cleanup failure');
			}).catch((error: unknown) => error);
			expect(failure).toBeInstanceOf(DeviceCreationSettlementError);
			expect((failure as DeviceCreationSettlementError).cause).toBe(cause);
			expect((failure as DeviceCreationSettlementError).settlementCause).toBe(cause);
			expect(settlement.outcome).toBe('rolled_back');
			expect(await database.manager.count(CreationRecord)).toBe(0);
		},
	);

	it('refuses a nested SAVEPOINT rather than blessing it as an outer receipt', async () => {
		await database.transaction(async () => {
			await expect(run(() => Promise.resolve(1))).rejects.toMatchObject({ settlement: { outcome: 'not_started' } });
		});
		expect(await database.manager.count(CreationRecord)).toBe(0);
	});

	it('keeps the original sticky catalog guard until the real native COMMIT', async () => {
		let commits = 0;
		database.subscribers.push({
			beforeQuery: (event) => {
				if (event.query === 'COMMIT') {
					commits++;
					devices.registerMapping(devices.getMapping('virtual'));
				}
			},
		} satisfies EntitySubscriberInterface);
		await expect(
			run(async (context) => {
				await context.manager.insert(CreationRecord, { name: 'refused' });
				context.defer(() => {
					throw new Error('must not publish');
				});
				return 5;
			}),
		).rejects.toMatchObject({ settlement: { outcome: 'refused' } });
		expect(commits).toBe(1);
		expect(await database.manager.count(CreationRecord)).toBe(0);
	});

	it.each(['unknown', 'after commit'] as const)(
		'retains %s and the original result without publication/deletion/retry',
		async (mode) => {
			const cause = new Error(mode);
			const native = (database.driver as SqliteDriver).databaseConnection as NativeConnection;
			const original = native.all.bind(native) as NativeConnection['all'];
			let commits = 0;
			jest.spyOn(native, 'all').mockImplementation((sql, params, callback) => {
				if (sql === 'COMMIT') commits++;
				return original(sql, params, function (error, rows) {
					callback.call(this, mode === 'unknown' && sql === 'COMMIT' && !error ? cause : error, rows);
				});
			});
			if (mode === 'after commit')
				database.subscribers.push({
					afterTransactionCommit: () => {
						return Promise.reject(cause);
					},
				});
			const publish = jest.fn();
			const error = await run(async (context) => {
				await context.manager.insert(CreationRecord, { name: 'native committed' });
				context.defer(publish);
				return 0;
			}).catch((failure: unknown) => failure);
			expect(error).toBeInstanceOf(DeviceCreationSettlementError);
			expect(settlement.outcome).toBe(mode === 'unknown' ? 'unknown' : 'committed');
			expect(settlement.result).toEqual({ value: 0 });
			const exact = (error as DeviceCreationSettlementError).cause;
			expect(exact === cause || (exact as { driverError?: unknown }).driverError === cause).toBe(true);
			expect(commits).toBe(1);
			expect(publish).not.toHaveBeenCalled();
			expect(await database.manager.count(CreationRecord)).toBe(1);
		},
	);
});
